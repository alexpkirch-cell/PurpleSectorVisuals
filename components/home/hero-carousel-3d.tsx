"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"

const IMAGES = [
  "/placeholders/1.jpg",
  "/placeholders/2.jpg",
  "/placeholders/3.jpg",
  "/placeholders/4.jpg",
  "/placeholders/5.jpg",
  "/placeholders/6.jpg",
]

// Fixed scatter offsets (percent of container) so cards don't stack directly
// on top of one another as they float toward the camera.
const OFFSETS = [
  { x: -26, y: -16, w: 300, h: 400 },
  { x: 27, y: -22, w: 260, h: 340 },
  { x: -33, y: 22, w: 280, h: 370 },
  { x: 32, y: 20, w: 300, h: 400 },
  { x: 2, y: -30, w: 240, h: 320 },
  { x: -1, y: 30, w: 320, h: 220 },
]

const FAR_Z = -3400
const NEAR_Z = 700
const TOTAL_DEPTH = NEAR_Z - FAR_Z
const CREEP_SPEED = 6.5
const IDLE_MS = 3000

export function HeroCarousel3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const zPositions = useRef<number[]>(
    OFFSETS.map((_, i) => FAR_Z + (i * TOTAL_DEPTH) / OFFSETS.length),
  )
  const velocityRef = useRef(0)
  const tiltRef = useRef({ x: 0, y: 0 })
  const lastInputRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const isVisibleRef = useRef(true)

  useEffect(() => {
    lastInputRef.current = performance.now()

    const bumpVelocity = (deltaY: number, deltaX = 0) => {
      if (!isVisibleRef.current) return
      lastInputRef.current = performance.now()
      const magnitude = Math.max(Math.abs(deltaY), Math.abs(deltaX))
      velocityRef.current += Math.sign(deltaY || deltaX) * Math.min(magnitude, 120) * 0.9
      velocityRef.current = Math.max(Math.min(velocityRef.current, 260), -260)
      tiltRef.current.x = Math.max(Math.min(tiltRef.current.x - deltaY * 0.06, 22), -22)
      tiltRef.current.y = Math.max(Math.min(tiltRef.current.y + deltaX * 0.06, 22), -22)
    }

    const handleWheel = (e: WheelEvent) => {
      bumpVelocity(e.deltaY)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") bumpVelocity(-60)
      if (e.key === "ArrowDown" || e.key === "ArrowRight") bumpVelocity(60)
    }

    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      touchStartRef.current = { x: t.clientX, y: t.clientY }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return
      const t = e.touches[0]
      const dy = touchStartRef.current.y - t.clientY
      const dx = touchStartRef.current.x - t.clientX
      bumpVelocity(dy * 0.8, dx * 0.3)
      touchStartRef.current = { x: t.clientX, y: t.clientY }
    }

    window.addEventListener("wheel", handleWheel, { passive: true })
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("touchstart", handleTouchStart, { passive: true })
    window.addEventListener("touchmove", handleTouchMove, { passive: true })

    const tick = () => {
      const now = performance.now()
      const idle = now - lastInputRef.current > IDLE_MS

      // Decay velocity and tilt back toward baseline. Faster ease-out once idle.
      const decay = idle ? 0.86 : 0.93
      velocityRef.current *= decay
      tiltRef.current.x *= decay
      tiltRef.current.y *= decay

      const speed = CREEP_SPEED + velocityRef.current
      const velocityAbs = Math.min(Math.abs(velocityRef.current), 260)
      const stretch = 1 + velocityAbs * 0.0014
      const squeeze = 1 - velocityAbs * 0.0007

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
        const rotateX = Math.max(Math.min(-tiltRef.current.x, 24), -24)
        const rotateY = Math.max(Math.min(tiltRef.current.y, 24), -24)

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
      window.removeEventListener("wheel", handleWheel)
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("touchstart", handleTouchStart)
      window.removeEventListener("touchmove", handleTouchMove)
      observer.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative h-[220vh] w-full">
      <section
        className="sticky top-0 h-[100svh] w-full overflow-hidden bg-zinc-950"
        style={{ perspective: "1200px" }}
        aria-label="Purple Sector Visuals showcase"
      >
      {IMAGES.map((src, i) => (
        <div
          key={src}
          ref={(el) => {
            cardRefs.current[i] = el
          }}
          className="absolute left-1/2 top-1/2 overflow-hidden rounded-2xl border border-white/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] will-change-transform"
          style={{
            width: OFFSETS[i].w,
            height: OFFSETS[i].h,
            transformStyle: "preserve-3d",
          }}
        >
          <Image
            src={src || "/placeholder.svg"}
            alt=""
            fill
            crossOrigin="anonymous"
            sizes="320px"
            className="object-cover"
            priority={i < 2}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      ))}

      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <h1 className="select-none text-balance px-6 text-center font-sans text-[16vw] font-bold uppercase leading-[0.85] tracking-tight text-white sm:text-[13vw] md:text-[10vw]">
          Benchmark
        </h1>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex flex-col items-center gap-1.5 px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 sm:text-xs">
          Use mouse wheel, arrow keys, or touch to navigate
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 sm:text-xs">
          Auto-play resumes after 3 seconds of inactivity
        </p>
      </div>

        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-zinc-950/60 via-transparent to-zinc-950/80" />
      </section>
    </div>
  )
}
