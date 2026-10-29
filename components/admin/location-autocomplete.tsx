"use client"

import { useId, useRef, useState, type KeyboardEvent } from "react"
import { useJsApiLoader } from "@react-google-maps/api"
import { MapPin } from "lucide-react"

import { Input } from "@/components/ui/input"
import { buildMapsUrl } from "@/lib/maps"
import { cn } from "@/lib/utils"

const LIBRARIES: "places"[] = ["places"]
const DEBOUNCE_MS = 250
const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

type Suggestion = { placeId: string; text: string }

export type LocationSelection = { location: string; mapsUrl: string | null }

/**
 * Location input backed by Google Places autocomplete. Picking a suggestion reports the
 * formatted address together with a maps link pinned to that place; typing freely reports
 * no link so the server derives one from the text. Without an API key it is a plain input.
 */
export function LocationAutocomplete({
  id,
  name,
  value,
  onChange,
  placeholder,
}: {
  id?: string
  name?: string
  value: string
  onChange: (selection: LocationSelection) => void
  placeholder?: string
}) {
  const listId = useId()
  const { isLoaded } = useJsApiLoader({
    id: "psv-google-maps",
    googleMapsApiKey: MAPS_API_KEY,
    libraries: LIBRARIES,
    preventGoogleFontsLoading: true,
  })
  const enabled = Boolean(MAPS_API_KEY) && isLoaded

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestId = useRef(0)
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null)

  async function fetchSuggestions(input: string) {
    const current = ++requestId.current
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = (await google.maps.importLibrary(
        "places",
      )) as google.maps.PlacesLibrary
      sessionToken.current ??= new AutocompleteSessionToken()
      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionToken.current,
      })
      if (current !== requestId.current) return
      const next = results.flatMap((result) =>
        result.placePrediction
          ? [{ placeId: result.placePrediction.placeId, text: result.placePrediction.text.toString() }]
          : [],
      )
      setSuggestions(next)
      setOpen(next.length > 0)
      setActiveIndex(-1)
    } catch {
      if (current === requestId.current) setSuggestions([])
    }
  }

  function handleInput(next: string) {
    onChange({ location: next, mapsUrl: null })
    if (!enabled) return
    if (timer.current) clearTimeout(timer.current)
    if (next.trim().length < 3) {
      requestId.current++
      setSuggestions([])
      setOpen(false)
      return
    }
    timer.current = setTimeout(() => fetchSuggestions(next.trim()), DEBOUNCE_MS)
  }

  function select(suggestion: Suggestion) {
    onChange({ location: suggestion.text, mapsUrl: buildMapsUrl(suggestion.text, suggestion.placeId) })
    sessionToken.current = null
    setSuggestions([])
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % suggestions.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault()
      select(suggestions[activeIndex])
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(event) => handleInput(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.placeId}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault()
                select(suggestion)
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
              )}
            >
              <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{suggestion.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
