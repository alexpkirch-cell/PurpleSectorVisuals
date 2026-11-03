"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function CopyVaultLink() {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/vault`)
      setCopied(true)
      toast.success("Vault link copied")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-muted-foreground">/vault</span>
      <Button type="button" variant="ghost" size="icon-sm" onClick={handleCopy} aria-label="Copy vault link">
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  )
}
