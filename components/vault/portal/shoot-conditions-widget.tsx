"use client"

import type { ComponentType } from "react"
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Snowflake,
  Sun,
  SunDim,
  Sunset,
} from "lucide-react"
import useSWR from "swr"

import { getShootConditions } from "@/app/actions/vault-portal"
import type { ShootConditions, WeatherIconKey } from "@/lib/shoot-conditions"

const WEATHER_ICONS: Record<WeatherIconKey, ComponentType<{ className?: string }>> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: Snowflake,
  storm: CloudLightning,
}

const REFRESH_INTERVAL_MS = 30 * 60 * 1000

function Cell({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  detail?: string | null
}) {
  return (
    <div className="flex items-center gap-3 px-1 py-4 sm:px-5 sm:py-0">
      <Icon className="h-6 w-6 shrink-0 text-primary" />
      <div className="flex min-w-0 flex-col">
        <span className="text-xs tracking-wider text-muted-foreground uppercase">{label}</span>
        <span className="font-heading text-lg leading-tight font-medium text-foreground tabular-nums">{value}</span>
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      </div>
    </div>
  )
}

function WidgetFrame({ heading, children }: { heading: string | null; children: React.ReactNode }) {
  return (
    <section aria-label="Shoot conditions" className="rounded-xl border border-border bg-card">
      {heading && (
        <p className="border-b border-border px-5 py-3 text-xs tracking-wider text-muted-foreground uppercase">{heading}</p>
      )}
      <div className="grid divide-y divide-border px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-0 sm:py-5">
        {children}
      </div>
    </section>
  )
}

export function ShootConditionsWidget({ vaultId }: { vaultId: string }) {
  const { data, isLoading } = useSWR<ShootConditions | null>(
    ["shoot-conditions", vaultId],
    () => getShootConditions(vaultId),
    { revalidateOnFocus: false, refreshInterval: REFRESH_INTERVAL_MS }
  )

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading shoot conditions"
        className="h-[8.5rem] animate-pulse rounded-xl border border-border bg-card sm:h-[6.5rem]"
      />
    )
  }

  if (!data || data.status === "no-location" || data.status === "no-date") {
    return null
  }

  if (data.status === "geocode-failed") {
    return (
      <p className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
        We couldn&apos;t pinpoint your shoot location to show weather and light conditions yet.
      </p>
    )
  }

  const { weather } = data
  const WeatherIcon = weather ? WEATHER_ICONS[weather.icon] : Cloud

  return (
    <WidgetFrame heading={`Shoot conditions \u00b7 ${data.placeLabel} \u00b7 ${data.dateLabel}`}>
      {weather ? (
        <Cell
          icon={WeatherIcon}
          label="Weather"
          value={`${weather.highF}\u00b0 / ${weather.lowF}\u00b0F`}
          detail={`${weather.label}${weather.precipChance !== null ? ` \u00b7 ${weather.precipChance}% rain` : ""}`}
        />
      ) : (
        <Cell icon={Cloud} label="Weather" value={"\u2014"} detail={data.weatherNote} />
      )}
      <Cell
        icon={SunDim}
        label="Golden hour begins"
        value={data.goldenHour ?? "N/A"}
        detail="Best light for portraits"
      />
      <Cell icon={Sunset} label="Sunset" value={data.sunset ?? "N/A"} detail="Local time" />
    </WidgetFrame>
  )
}
