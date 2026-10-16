"use client"

import { useState, useTransition } from "react"

import { submitRosterApplication } from "@/app/actions/roster-applications"

const inputClass =
  "w-full border-0 border-b border-zinc-800 bg-transparent px-0 py-2 text-sm text-foreground placeholder:text-zinc-600 transition-colors focus:border-[#e829f1] focus:outline-none focus:ring-0"

export function RosterApplicationForm() {
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  if (sent) {
    return (
      <p className="py-6 text-sm text-zinc-400" role="status">
        Got it. We review every application and will reach out if it&apos;s a fit.
      </p>
    )
  }

  return (
    <form
      className="flex flex-col gap-5"
      action={(formData) => {
        setError(null)
        startTransition(async () => {
          const result = await submitRosterApplication(formData)
          if (result.ok) setSent(true)
          else setError(result.error)
        })
      }}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Name
          <input name="name" required autoComplete="name" maxLength={120} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Email
          <input name="email" type="email" required autoComplete="email" maxLength={200} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Portfolio link
          <input name="portfolio_link" type="url" placeholder="https://" maxLength={300} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Instagram
          <input name="instagram" placeholder="@handle" maxLength={80} className={inputClass} />
        </label>
      </div>

      <div className="sr-only" aria-hidden="true">
        <label>
          Leave this field empty
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400 underline-offset-8 transition-colors hover:text-[#e829f1] hover:underline disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send application"}
        </button>
      </div>
    </form>
  )
}
