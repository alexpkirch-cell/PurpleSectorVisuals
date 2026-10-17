"use client"

import { createContext, useContext, type ComponentProps, type ReactNode } from "react"
import Link from "next/link"

const EditModeContext = createContext(false)

/** Wrap the Puck canvas so every site component rendered inside it knows it is being edited, not browsed. */
export function EditModeProvider({ children }: { children: ReactNode }) {
  return <EditModeContext.Provider value>{children}</EditModeContext.Provider>
}

export function useEditMode() {
  return useContext(EditModeContext)
}

/** Drop-in replacement for next/link that stays inert inside the Puck canvas so blocks can be selected and edited. */
export default function EditAwareLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  const isEditing = useEditMode()

  return (
    <Link
      {...props}
      onClick={(event) => {
        if (isEditing) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        onClick?.(event)
      }}
    />
  )
}
