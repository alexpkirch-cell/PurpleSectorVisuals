"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function PinEntryForm() {
  const router = useRouter()
  const [pin, setPin] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = pin.trim()
    if (!/^\d{4,6}$/.test(trimmed)) return
    setSubmitting(true)
    router.push(`/vault/${trimmed}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        placeholder="6-digit PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        className="border-zinc-800 bg-black text-center font-mono text-lg tracking-[0.3em] text-zinc-100 placeholder:text-zinc-600 focus-visible:border-[#9D00FF] focus-visible:ring-[#9D00FF]"
      />
      <Button
        type="submit"
        disabled={pin.trim().length < 4 || submitting}
        className="w-full bg-[#9D00FF] font-mono text-xs uppercase tracking-[0.2em] text-white transition-all hover:bg-[#b32bff] hover:shadow-[0_0_20px_rgba(157,0,255,0.5)] disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock with PIN"}
      </Button>
    </form>
  )
}
