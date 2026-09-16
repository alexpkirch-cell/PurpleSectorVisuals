"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
]

const THEME_CLASS = "theme-papaya"
const STORAGE_KEY = "psv-papaya-mode"

/**
 * Global keydown listener for the classic Konami code. On success it toggles
 * a `.theme-papaya` class on <html>, swapping the electric-purple palette for
 * motorsport papaya orange. Persists across reloads via localStorage.
 */
export function Konami() {
  const progressRef = useRef(0)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "1") {
      document.documentElement.classList.add(THEME_CLASS)
    }

    function handleKeyDown(event: KeyboardEvent) {
      const expected = SEQUENCE[progressRef.current]
      const pressed = event.key.length === 1 ? event.key.toLowerCase() : event.key

      if (pressed === expected) {
        progressRef.current += 1
        if (progressRef.current === SEQUENCE.length) {
          progressRef.current = 0
          const isActive = document.documentElement.classList.toggle(THEME_CLASS)
          localStorage.setItem(STORAGE_KEY, isActive ? "1" : "0")
          toast(isActive ? "Papaya mode engaged." : "Papaya mode disengaged.")
        }
      } else {
        progressRef.current = pressed === SEQUENCE[0] ? 1 : 0
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return null
}
