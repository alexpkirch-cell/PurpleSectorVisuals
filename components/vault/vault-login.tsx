"use client"

import { useState, type FormEvent } from "react"
import { Lock } from "lucide-react"

interface VaultLoginValues {
  clientName: string
  accessCode: string
}

interface VaultLoginErrors {
  clientName?: string
  accessCode?: string
}

interface VaultLoginProps {
  onSubmit?: (values: VaultLoginValues) => void | Promise<void>
}

function validate(values: VaultLoginValues): VaultLoginErrors {
  const errors: VaultLoginErrors = {}

  if (!values.clientName.trim()) {
    errors.clientName = "Enter the name on your booking."
  }

  if (!values.accessCode.trim()) {
    errors.accessCode = "Enter your access code."
  } else if (!/^[A-Z0-9]+$/.test(values.accessCode)) {
    errors.accessCode = "Access codes are letters and numbers only."
  }

  return errors
}

export function VaultLogin({ onSubmit }: VaultLoginProps) {
  const [clientName, setClientName] = useState("")
  const [accessCode, setAccessCode] = useState("")
  const [errors, setErrors] = useState<VaultLoginErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const values: VaultLoginValues = { clientName, accessCode }
    const nextErrors = validate(values)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit?.(values)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur-md">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <Lock className="h-5 w-5 text-zinc-400" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-semibold text-zinc-50">Access Your Vault</h1>
            <p className="text-sm text-zinc-400">Enter your booking details to view your gallery.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="clientName" className="text-sm text-zinc-400">
                Client Name
              </label>
              <input
                id="clientName"
                name="clientName"
                type="text"
                autoComplete="name"
                placeholder="Jordan Rivera"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                aria-invalid={Boolean(errors.clientName)}
                aria-describedby={errors.clientName ? "clientName-error" : undefined}
                className="w-full border-0 border-b border-white/10 bg-transparent pb-2 text-base text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-[#9D00FF] focus:ring-0"
              />
              {errors.clientName && (
                <p id="clientName-error" className="text-xs text-red-400">
                  {errors.clientName}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="accessCode" className="text-sm text-zinc-400">
                Access Code
              </label>
              <input
                id="accessCode"
                name="accessCode"
                type="text"
                autoComplete="off"
                placeholder="A1B2C3"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                aria-invalid={Boolean(errors.accessCode)}
                aria-describedby={errors.accessCode ? "accessCode-error" : undefined}
                className="w-full border-0 border-b border-white/10 bg-transparent pb-2 font-mono text-base uppercase tracking-widest text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-[#9D00FF] focus:ring-0"
              />
              {errors.accessCode && (
                <p id="accessCode-error" className="text-xs text-red-400">
                  {errors.accessCode}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#9D00FF] px-4 py-2.5 text-sm font-medium text-zinc-50 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9D00FF] disabled:opacity-60"
            >
              {isSubmitting ? "Entering…" : "Enter Vault"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
