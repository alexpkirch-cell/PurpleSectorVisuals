"use client"

import { useEffect, useRef, useState } from "react"
import { Gauge } from "lucide-react"
import { cn } from "@/lib/utils"

const VELOCITY_THRESHOLD_PX_PER_MS = 3.2
const FLASH_DURATION_MS = 1400

/**
 * Watches scroll velocity and briefly flashes a radar-gun icon in the corner
 * when the user scrolls unusually fast — a nod to trackside speed traps.
 */
export function SpeedTrap() {
  const [flashing, setFlashing] = useState(false)
  const lastY = useRef(0)
  const lastT = useRef(0)
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cooldownUntil = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    lastT.current = performance.now()

    function handleScroll() {
      const y = window.scrollY
      const t = performance.now()
      const dt = t - lastT.current
      const dy = Math.abs(y - lastY.current)

      if (dt > 0) {
        const velocity = dy / dt
        if (velocity > VELOCITY_THRESHOLD_PX_PER_MS && t > cooldownUntil.current) {
          cooldownUntil.current = t + FLASH_DURATION_MS
          setFlashing(true)
          if (hideTimeout.current) clearTimeout(hideTimeout.current)
          hideTimeout.current = setTimeout(() => setFlashing(false), FLASH_DURATION_MS)
        }
      }

      lastY.current = y
      lastT.current = t
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (hideTimeout.current) clearTimeout(hideTimeout.current)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed bottom-6 right-6 z-[70] flex items-center gap-2 rounded-full border border-primary/40 bg-card/90 px-3 py-2 text-primary shadow-lg backdrop-blur transition-all duration-300",
        flashing ? "opacity-100 scale-100" : "opacity-0 scale-90"
      )}
    >
      <Gauge className="size-4 animate-pulse" />
      <span className="text-xs font-mono uppercase tracking-wider">Speed trap</span>
    </div>
  )
}
