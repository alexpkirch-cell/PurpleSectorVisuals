import type { ReactNode } from "react"

/**
 * Layers saved copy over a section's built-in defaults. Layouts saved before a text field existed carry `undefined` for it,
 * and a plain object spread would let that `undefined` wipe out the default. Inside the editor, text arrives as React nodes
 * (Puck's inline editors), so every value is typed as a ReactNode.
 */
export function withTextDefaults<D extends Record<string, string>>(
  defaults: D,
  text?: { [K in keyof D]?: ReactNode }
): { [K in keyof D]: ReactNode } {
  const merged: Record<string, ReactNode> = { ...defaults }
  for (const [key, value] of Object.entries(text ?? {})) {
    if (value !== undefined && value !== null) merged[key] = value as ReactNode
  }
  return merged as { [K in keyof D]: ReactNode }
}
