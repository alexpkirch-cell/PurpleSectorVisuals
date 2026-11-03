import { getTimes } from "suncalc"

export type WeatherIconKey = "sun" | "cloud-sun" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm"

export interface ShootWeather {
  label: string
  icon: WeatherIconKey
  highF: number
  lowF: number
  precipChance: number | null
}

export interface ShootConditions {
  status: "ok" | "no-location" | "no-date" | "geocode-failed"
  placeLabel: string | null
  dateLabel: string | null
  goldenHour: string | null
  sunset: string | null
  weather: ShootWeather | null
  weatherNote: string | null
}

const FORECAST_WINDOW_DAYS = 16
const REQUEST_TIMEOUT_MS = 6000

const WEATHER_CODES: ReadonlyArray<{ codes: readonly number[]; label: string; icon: WeatherIconKey }> = [
  { codes: [0], label: "Clear skies", icon: "sun" },
  { codes: [1, 2], label: "Partly cloudy", icon: "cloud-sun" },
  { codes: [3], label: "Overcast", icon: "cloud" },
  { codes: [45, 48], label: "Foggy", icon: "fog" },
  { codes: [51, 53, 55, 56, 57], label: "Light drizzle", icon: "drizzle" },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], label: "Rain", icon: "rain" },
  { codes: [71, 73, 75, 77, 85, 86], label: "Snow", icon: "snow" },
  { codes: [95, 96, 99], label: "Thunderstorms", icon: "storm" },
]

function describeWeatherCode(code: number): { label: string; icon: WeatherIconKey } {
  const match = WEATHER_CODES.find((entry) => entry.codes.includes(code))
  return match ?? { label: "Mixed conditions", icon: "cloud" }
}

interface GeocodeResult {
  lat: number
  lon: number
  label: string
}

interface NominatimHit {
  lat: string
  lon: string
  display_name: string
  address?: Record<string, string>
}

/**
 * Street addresses often fail to geocode, so progressively drop the leading
 * segment ("123 Main St, Grand Junction, CO" -> "Grand Junction, CO").
 */
async function geocode(location: string): Promise<GeocodeResult | null> {
  const segments = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  for (let start = 0; start < Math.max(segments.length - 1, 1); start++) {
    const query = segments.slice(start).join(", ")
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "PurpleSectorVisuals/1.0 (client vault conditions)" },
        next: { revalidate: 60 * 60 * 24 * 30 },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) continue

      const hits = (await response.json()) as NominatimHit[]
      const hit = hits[0]
      if (!hit) continue

      const address = hit.address ?? {}
      const place = address.city ?? address.town ?? address.village ?? address.hamlet ?? address.county
      const region = address.state
      const label = place ? [place, region].filter(Boolean).join(", ") : hit.display_name.split(",").slice(0, 2).join(",")

      return { lat: Number(hit.lat), lon: Number(hit.lon), label }
    } catch {
      continue
    }
  }

  return null
}

interface ForecastResponse {
  timezone: string
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: Array<number | null>
  }
}

async function fetchForecast(lat: number, lon: number): Promise<ForecastResponse | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&timezone=auto&forecast_days=${FORECAST_WINDOW_DAYS}`

  try {
    const response = await fetch(url, { next: { revalidate: 60 * 60 }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    if (!response.ok) return null
    return (await response.json()) as ForecastResponse
  } catch {
    return null
  }
}

function utcOffsetMinutes(timeZone: string, year: number, month: number, day: number) {
  const probe = new Date(Date.UTC(year, month - 1, day, 12))
  const zoneName =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(probe)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT"

  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(zoneName)
  if (!match) return 0
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
}

function formatTime(date: Date | null, timeZone: string) {
  if (!date || Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date)
}

const EMPTY: Omit<ShootConditions, "status"> = {
  placeLabel: null,
  dateLabel: null,
  goldenHour: null,
  sunset: null,
  weather: null,
  weatherNote: null,
}

/** Weather and light conditions for a shoot's saved location and date (YYYY-MM-DD). */
export async function getConditionsFor(location: string | null, isoDate: string | null): Promise<ShootConditions> {
  if (!location?.trim()) return { ...EMPTY, status: "no-location" }
  const dateMatch = isoDate ? /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate) : null
  if (!dateMatch) return { ...EMPTY, status: "no-date" }

  const [year, month, day] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])]

  const place = await geocode(location)
  if (!place) return { ...EMPTY, status: "geocode-failed" }

  const forecast = await fetchForecast(place.lat, place.lon)
  const timeZone = forecast?.timezone ?? "UTC"

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))

  const times = getTimes(
    new Date(Date.UTC(year, month - 1, day, 12)),
    place.lat,
    place.lon,
    0,
    utcOffsetMinutes(timeZone, year, month, day)
  )

  let weather: ShootWeather | null = null
  let weatherNote: string | null = null

  const index = forecast?.daily.time.indexOf(isoDate!.slice(0, 10)) ?? -1
  if (forecast && index >= 0) {
    const { label, icon } = describeWeatherCode(forecast.daily.weather_code[index])
    weather = {
      label,
      icon,
      highF: Math.round(forecast.daily.temperature_2m_max[index]),
      lowF: Math.round(forecast.daily.temperature_2m_min[index]),
      precipChance: forecast.daily.precipitation_probability_max[index] ?? null,
    }
  } else if (!forecast) {
    weatherNote = "Forecast is temporarily unavailable."
  } else if (isoDate!.slice(0, 10) < forecast.daily.time[0]) {
    weatherNote = "This shoot date has passed."
  } else {
    weatherNote = `Forecast opens ${FORECAST_WINDOW_DAYS} days before your shoot.`
  }

  return {
    status: "ok",
    placeLabel: place.label,
    dateLabel,
    goldenHour: formatTime(times.goldenHour, timeZone),
    sunset: formatTime(times.sunset, timeZone),
    weather,
    weatherNote,
  }
}
