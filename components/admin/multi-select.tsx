"use client"

import { useMemo } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type MultiSelectOption = { value: string; label: string }

type MultiSelectProps = {
  id?: string
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  max?: number
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  showSelected?: boolean
  className?: string
}

export function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select options",
  max,
  defaultOpen,
  onOpenChange,
  showSelected = true,
  className,
}: MultiSelectProps) {
  // Values saved before this list existed stay visible and removable.
  const allOptions = useMemo(
    () => [
      ...options,
      ...value.filter((v) => !options.some((o) => o.value === v)).map((v) => ({ value: v, label: v })),
    ],
    [options, value]
  )

  const labelFor = (v: string) => allOptions.find((o) => o.value === v)?.label ?? v
  const atMax = max !== undefined && value.length >= max

  function toggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else if (!atMax) {
      onChange([...value, optionValue])
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Popover defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        <PopoverTrigger
          id={id}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          )}
        >
          <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
            {value.length === 0 ? placeholder : value.map(labelFor).join(", ")}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          <div role="listbox" aria-multiselectable="true" className="flex flex-col">
            {allOptions.map((option) => {
              const selected = value.includes(option.value)
              const disabled = !selected && atMax
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={disabled}
                  onClick={() => toggle(option.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input",
                      selected && "border-primary bg-primary text-primary-foreground"
                    )}
                  >
                    {selected ? <Check className="size-3" aria-hidden="true" /> : null}
                  </span>
                  {option.label}
                </button>
              )
            })}
          </div>
          {max !== undefined ? (
            <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground">
              {value.length} of {max} selected
            </p>
          ) : null}
        </PopoverContent>
      </Popover>

      {showSelected && value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              {labelFor(v)}
              <button
                type="button"
                onClick={() => onChange(value.filter((existing) => existing !== v))}
                className="inline-flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
                aria-label={`Remove ${labelFor(v)}`}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
