const PUBLIC_OBJECT_MARKER = "/storage/v1/object/public/"

/** Splits a Supabase public object URL into its bucket and path, or null for any other URL. */
export function parsePublicStorageUrl(url: string): { bucket: string; path: string } | null {
  const markerIndex = url.indexOf(PUBLIC_OBJECT_MARKER)
  if (markerIndex === -1) return null

  const rest = url.slice(markerIndex + PUBLIC_OBJECT_MARKER.length).split("?")[0]
  const slash = rest.indexOf("/")
  if (slash <= 0) return null

  return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1)) }
}
