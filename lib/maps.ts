/** A direct Google Maps link for a location string, pinned to the exact place when a place id is known. */
export function buildMapsUrl(location: string, placeId?: string | null) {
  const query = encodeURIComponent(location.trim())
  const base = `https://www.google.com/maps/search/?api=1&query=${query}`
  return placeId ? `${base}&query_place_id=${encodeURIComponent(placeId)}` : base
}

/** The stored maps link, or one derived from the location text for older records. */
export function mapsUrlFor(shoot: { location: string | null; location_maps_url: string | null }) {
  if (shoot.location_maps_url) return shoot.location_maps_url
  return shoot.location?.trim() ? buildMapsUrl(shoot.location) : null
}
