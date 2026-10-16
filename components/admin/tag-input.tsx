"use client"

import { useState, type KeyboardEvent } from "react"
import { Plus, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type TagInputProps = {
  id?: string
  value: string[]
  onChange: (value: string[]) => void
  suggestions?: string[]
  placeholder?: string
  max?: number
}

export function TagInput({ id, value, onChange, suggestions = [], placeholder, max = 12 }: TagInputProps) {
  const [draft, setDraft] = useState("")

  function add(raw: string) {
    const tag = raw.trim().replace(/\s+/g, " ")
    setDraft("")
    if (!tag || value.length >= max) return
    if (value.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return
    onChange([...value, tag])
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      add(draft)
    } else if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const remainingSuggestions = suggestions.filter(
    (suggestion) => !value.some((existing) => existing.toLowerCase() === suggestion.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
        )}
      >
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((existing) => existing !== tag))}
              className="inline-flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </Badge>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length === 0 ? placeholder : "Add another"}
          disabled={value.length >= max}
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {remainingSuggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Suggested:</span>
          {remainingSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <Plus className="size-3" aria-hidden="true" />
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">Press Enter or comma to add a tag.</p>
    </div>
  )
}
