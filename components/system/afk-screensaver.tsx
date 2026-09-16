"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { ImageSlot } from "@/components/image-slot"
import { galleryItems } from "@/lib/site-data"
import { getPublicSiteSlots } from "@/app/actions/site-slots-public"
import type { SiteSlotOverrides } from "@/lib/site-slot-definitions"

const IDLE_TIMEOUT_MS = 10 * 60 * 1000
const PAN_DURATION_S = 18

/** Full-screen slow-panning portfolio carousel that takes over after 10 minutes idle. */
export function AfkScreensaver() {
  const [active, setActive] = useState(false)
  const [overrides, setOverrides] = useState<SiteSlotOverrides>({})
  const [index, setIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setActive(true), IDLE_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    resetTimer()
    const events: (keyof WindowEventMap)[] = ["mousemove", "scroll", "keydown", "touchstart", "click"]
    function onActivity() {
      if (active) return
      resetTimer()
    }
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }))
    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [active, resetTimer])

  useEffect(() => {
    if (!active) return
    getPublicSiteSlots().then(setOverrides).catch(() => setOverrides({}))
  }, [active])

  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % galleryItems.length)
    }, PAN_DURATION_S * 1000)
    return () => clearInterval(interval)
  }, [active])

  function dismiss() {
    setActive(false)
    resetTimer()
  }

  const item = galleryItems[index]

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 z-[200] cursor-pointer overflow-hidden bg-background"
          onClick={dismiss}
          onMouseMove={dismiss}
          onKeyDown={dismiss}
          role="button"
          tabIndex={0}
          aria-label="Screensaver — press any key to dismiss"
        >
          <motion.div
            key={item.id}
            initial={{ scale: 1, opacity: 0 }}
            animate={{ scale: 1.12, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: PAN_DURATION_S, ease: "linear", opacity: { duration: 1.2 } }}
            className="absolute inset-0"
          >
            <ImageSlot
              aspect={item.aspect}
              label=""
              className="border-none"
              slotKey={`gallery.${item.id}`}
              overrides={overrides}
              imageAlt={item.title}
            />
          </motion.div>

          <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-background/30" />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="absolute inset-x-0 bottom-12 flex flex-col items-center gap-2 text-center"
          >
            <p className="font-heading text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Purple Sector Visuals
            </p>
            <p className="text-sm text-muted-foreground">{item.title} &middot; press any key to return</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
