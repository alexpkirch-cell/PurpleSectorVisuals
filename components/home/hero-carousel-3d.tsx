"use client"

import { useEffect, useRef } from "react"

const SLOTS = [
  "SLOT 01 // PORTRAIT",
  "SLOT 02 // AUTOMOTIVE",
  "SLOT 03 // EDITORIAL",
  "SLOT 04 // MOTORSPORT",
  "SLOT 05 // STUDIO",
  "SLOT 06 // LIFESTYLE",
]

// Fixed scatter offsets (percent of container) so cards don't stack directly
// on top of one another as they float toward the camera.
const OFFSETS = [
  { x: -26, y: -16, w: 300, h: 400, aspect: "aspect-[4/5]" },
  { x: 27, y: -22, w: 260, h: 340, aspect: "aspect-[4/5]" },
  { x: -33, y: 22, w: 280, h: 370, aspect: "aspect-[4/5]" },
  { x: 32, y: 20, w: 300, h: 400, aspect: "aspect-[4/5]" },
  { x: 2, y: -30, w: 340, h: 191, aspect: "aspect-[16/9]" },
  { x: -1, y: 30, w: 340, h: 191, aspect: "aspect-[16/9]" },
]

const FAR_Z = -3400
const NEAR_Z = 700
const TOTAL_DEPTH = NEAR_Z - FAR_Z
// Slow ambient drift, ~75% calmer than the original creep.
const CREEP_SPEED = 1.6
const IDLE_MS = 3000

export function HeroCarousel3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const zPositions = useRef<number[]>(
    OFFSETS.map((_, i) => FAR_Z + (i * TOTAL_DEPTH) / OFFSETS.length),
  )
  const velocityRef = useRef(0)
  const tiltRef = useRef({ x: 0, y: 0 })
  const mouseInfluenceRef = useRef({ x: 0, y: 0 })
  const lastInputRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const isVisibleRef = useRef(true)

  useEffect(() => {
    lastInputRef.current = performance.now()

    // Nudges the ambient drift and card tilt. Only ever driven by horizontal
    // input (mouse position, horizontal wheel/trackpad panning, or
    // horizontal swipes) so native vertical page scrolling is never touched.
    const bumpVelocity = (deltaX: number) => {
      if (!isVisibleRef.current) return
      lastInputRef.current = performance.now()
      velocityRef.current += Math.sign(deltaX) * Math.min(Math.abs(deltaX), 120) * 0.22
      velocityRef.current = Math.max(Math.min(velocityRef.current, 70), -70)
      tiltRef.current.y = Math.max(Math.min(tiltRef.current.y + deltaX * 0.02, 8), -8)
    }

    // Desktop: cursor position over the section continuously biases the
    // drift direction and card tilt, released back to neutral once the
    // pointer leaves.
    const handleMouseMove = (e: MouseEvent) => {
      const rect = sectionRef.current?.getBoundingClientRect()
      if (!rect) return
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      mouseInfluenceRef.current = { x: nx, y: ny }
      lastInputRef.current = performance.now()
    }

    const handleMouseLeave = () => {
      mouseInfluenceRef.current = { x: 0, y: 0 }
    }

    // Only horizontal wheel/trackpad panning drives the carousel. Vertical
    // wheel delta is ignored entirely so the page always scrolls natively.
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > 0) bumpVelocity(e.deltaX)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") bumpVelocity(-60)
      if (e.key === "ArrowRight") bumpVelocity(60)
    }

    // Mobile: horizontal swipes only. Vertical touch movement is left
    // completely alone so the page scrolls smoothly at all times.
    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      touchStartRef.current = { x: t.clientX, y: t.clientY }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return
      const t = e.touches[0]
      const dx = touchStartRef.current.x - t.clientX
      const dy = touchStartRef.current.y - t.clientY
      // Ignore swipes that are predominantly vertical intent.
      if (Math.abs(dx) > Math.abs(dy)) {
        bumpVelocity(dx * 0.6)
      }
      touchStartRef.current = { x: t.clientX, y: t.clientY }
    }

    const section = sectionRef.current
    section?.addEventListener("mousemove", handleMouseMove)
    section?.addEventListener("mouseleave", handleMouseLeave)
    window.addEventListener("wheel", handleWheel, { passive: true })
    window.addEventListener("keydown", handleKeyDown)
    section?.addEventListener("touchstart", handleTouchStart, { passive: true })
    section?.addEventListener("touchmove", handleTouchMove, { passive: true })

    const tick = () => {
      const now = performance.now()
      const idle = now - lastInputRef.current > IDLE_MS

      // Decay velocity and tilt back toward baseline. Higher friction keeps
      // input feeling like a gentle nudge rather than a shove.
      const decay = idle ? 0.9 : 0.965
      velocityRef.current *= decay
      tiltRef.current.x *= decay
      tiltRef.current.y *= decay

      const mouseX = mouseInfluenceRef.current.x
      const mouseY = mouseInfluenceRef.current.y
      const speed = CREEP_SPEED + velocityRef.current + mouseX * 1.4
      // Subdued into a subtle tilt only — no aggressive stretch/squeeze warp.
      const velocityAbs = Math.min(Math.abs(velocityRef.current), 70)
      const stretch = 1 + velocityAbs * 0.0002
      const squeeze = 1 - velocityAbs * 0.0001

      for (let i = 0; i < OFFSETS.length; i++) {
        let z = zPositions.current[i] + speed
        if (z > NEAR_Z) z -= TOTAL_DEPTH
        if (z < FAR_Z) z += TOTAL_DEPTH
        zPositions.current[i] = z

        const progress = (z - FAR_Z) / TOTAL_DEPTH
        const fadeIn = Math.min(progress / 0.15, 1)
        const fadeOut = Math.min((1 - progress) / 0.2, 1)
        const opacity = Math.max(Math.min(fadeIn, fadeOut), 0)

        const card = cardRefs.current[i]
        if (!card) continue

        const { x, y } = OFFSETS[i]
        const rotateX = Math.max(Math.min(-tiltRef.current.x - mouseY * 4, 8), -8)
        const rotateY = Math.max(Math.min(tiltRef.current.y + mouseX * 4, 8), -8)

        card.style.transform = `translate3d(calc(-50% + ${x}vw), calc(-50% + ${y}vh), ${z}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${stretch}, ${squeeze})`
        card.style.opacity = String(opacity)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    // Pause the loop and ignore input while the section is scrolled out of
    // view, so it doesn't burn frames in the background, and resume cleanly
    // when it scrolls back in.
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting
        if (entry.isIntersecting && rafRef.current === null) {
          lastInputRef.current = performance.now()
          rafRef.current = requestAnimationFrame(tick)
        } else if (!entry.isIntersecting && rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
      },
      { threshold: 0 },
    )
    if (containerRef.current) observer.observe(containerRef.current)

    return () => {
      section?.removeEventListener("mousemove", handleMouseMove)
      section?.removeEventListener("mouseleave", handleMouseLeave)
      window.removeEventListener("wheel", handleWheel)
      window.removeEventListener("keydown", handleKeyDown)
      section?.removeEventListener("touchstart", handleTouchStart)
      section?.removeEventListener("touchmove", handleTouchMove)
      observer.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative h-[130vh] w-full sm:h-[220vh]">
      <div
        ref={sectionRef}
        className="sticky top-0 h-[80vh] w-full overflow-hidden bg-zinc-950 sm:h-[100svh]"
        style={{ perspective: "1200px" }}
        aria-label="Purple Sector Visuals showcase"
      >
      {SLOTS.map((label, i) => (
        <div
          key={label}
          ref={(el) => {
            cardRefs.current[i] = el
          }}
          className={`absolute left-1/2 top-1/2 flex items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm will-change-transform ${OFFSETS[i].aspect}`}
          style={{
            width: `clamp(150px, 55vw, ${OFFSETS[i].w}px)`,
            transformStyle: "preserve-3d",
          }}
        >
          <span className="px-4 text-center font-mono text-[10px] tracking-wider text-zinc-600 sm:text-xs">
            {label}
          </span>
        </div>
      ))}

      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex flex-col items-center gap-2 px-4 text-center sm:bottom-8 sm:gap-3 sm:px-6">
        <div className="flex flex-col items-center gap-1 sm:gap-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-zinc-500 sm:text-xs sm:tracking-[0.3em]">
            Move your cursor or swipe sideways to navigate
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-zinc-500 sm:text-xs sm:tracking-[0.3em]">
            Auto-play resumes after 3 seconds of inactivity
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            containerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
          }}
          className="pointer-events-auto mt-1 flex flex-col items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-200"
          aria-label="Scroll to explore"
        >
          <span className="font-mono text-[9px] uppercase tracking-[0.25em] sm:text-[10px] sm:tracking-[0.3em]">
            Scroll to explore
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="animate-bounce"
            aria-hidden="true"
          >
            <path d="M12 4v16m0 0l-6-6m6 6l6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-zinc-950/60 via-transparent to-zinc-950/80" />
      </div>
    </div>
  )
}
