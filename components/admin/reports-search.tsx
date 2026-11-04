"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search, X } from "lucide-react"
import useSWR from "swr"

import { queryReports, type ReportFilters, type ReportRow } from "@/app/actions/crm"
import { CountersignRowButton } from "@/components/admin/countersign-row-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { STATUS_LABELS } from "@/lib/operations"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).filter(([key]) => key !== "new_inquiry")
const CATEGORIES = ["Portraits", "Athletics", "Automotive", "Events", "Commercial"]
const SEARCH_DEBOUNCE_MS = 300

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

type SortKey =
  | "clientName"
  | "shootDate"
  | "category"
  | "status"
  | "vaultPin"
  | "grossCollected"
  | "driverReimbursement"
  | "admin"
  | "house"
  | "shooters"
  | "editors"

type SortState = { key: SortKey; direction: "asc" | "desc" }

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "clientName", label: "Client" },
  { key: "shootDate", label: "Date" },
  { key: "category", label: "Category" },
  { key: "status", label: "Pipeline Status" },
  { key: "vaultPin", label: "Vault PIN" },
  { key: "grossCollected", label: "Gross Collected", numeric: true },
  { key: "driverReimbursement", label: "Driver Reimb.", numeric: true },
  { key: "admin", label: "Admin", numeric: true },
  { key: "house", label: "House", numeric: true },
  { key: "shooters", label: "Shooters", numeric: true },
  { key: "editors", label: "Editors", numeric: true },
]

/** Reports always open the shoot's own workspace (or the draft vault's), never the client profile. */
function workspaceHref(row: ReportRow) {
  return `/admin/shoots/${row.workspaceId}`
}

function statusLabel(status: string) {
  if (status === "draft") return "Draft"
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status
}

function compare(a: ReportRow, b: ReportRow, key: SortKey) {
  const left = a[key]
  const right = b[key]
  if (left === null || left === undefined || left === "") return right === null || right === undefined || right === "" ? 0 : 1
  if (right === null || right === undefined || right === "") return -1
  if (typeof left === "number" && typeof right === "number") return left - right
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" })
}

function formatDate(value: string | null) {
  if (!value) return "Not scheduled"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function toCsv(rows: ReportRow[]) {
  const headers = [
    "Client", "Email", "Phone", "Vault PIN", "Shoot Date", "Category", "Pipeline Status",
    "Gross Collected", "Driver Reimbursement", "Admin", "House", "Shooters", "Editors",
  ]
  const lines = rows.map((row) => [
    row.clientName, row.email ?? "", row.phone ?? "", row.vaultPin ?? "",
    row.shootDate ? new Date(row.shootDate).toISOString().slice(0, 10) : "",
    row.category, statusLabel(row.status),
    row.grossCollected.toFixed(2), row.driverReimbursement.toFixed(2), row.admin.toFixed(2),
    row.house.toFixed(2), row.shooters.toFixed(2), row.editors.toFixed(2),
  ])
  return [headers, ...lines]
    .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n")
}

const fieldClass =
  "mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

export function ReportsSearch({ personnel }: { personnel: string[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filters, setFilters] = useState<Omit<ReportFilters, "q">>({})
  const [sort, setSort] = useState<SortState>({ key: "shootDate", direction: "desc" })

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const query: ReportFilters = { ...filters, q: debouncedSearch }
  const { data, isLoading, mutate } = useSWR<ReportRow[]>(["reports", query], () => queryReports(query), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const rows = useMemo(() => {
    const sorted = [...(data ?? [])].sort((a, b) => compare(a, b, sort.key))
    return sort.direction === "desc" ? sorted.reverse() : sorted
  }, [data, sort])

  function setFilter(key: keyof Omit<ReportFilters, "q">, value: string) {
    setFilters((current) => ({ ...current, [key]: value || undefined }))
  }

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }
    )
  }

  function download() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `purple-sector-report-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const hasFilters = Boolean(search || Object.values(filters).some(Boolean))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Reports &amp; Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find any client or vault, then open their workspace. Stack filters to reconcile financial splits.
        </p>
      </div>

      <section aria-label="Search and filters" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <div className="relative">
          <label htmlFor="report-search" className="sr-only">
            Search by client name, email, phone number or vault PIN
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id="report-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by client name, email, phone number or vault PIN"
            autoComplete="off"
            className="h-12 w-full rounded-lg border border-input bg-background pr-10 pl-11 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs text-muted-foreground">
            From
            <input type="date" value={filters.from ?? ""} onChange={(e) => setFilter("from", e.target.value)} className={fieldClass} />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <input type="date" value={filters.to ?? ""} onChange={(e) => setFilter("to", e.target.value)} className={fieldClass} />
          </label>
          <label className="text-xs text-muted-foreground">
            Pipeline Status
            <select value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value)} className={fieldClass}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Category
            <select value={filters.category ?? ""} onChange={(e) => setFilter("category", e.target.value)} className={fieldClass}>
              <option value="">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Personnel
            <select value={filters.personnel ?? ""} onChange={(e) => setFilter("personnel", e.target.value)} className={fieldClass}>
              <option value="">All personnel</option>
              {personnel.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {hasFilters ? (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("")
                setFilters({})
              }}
            >
              Clear all filters
            </Button>
          </div>
        ) : null}
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <p className="text-sm font-medium text-foreground" aria-live="polite">
            {isLoading && !data ? "Searching..." : `${rows.length} ${rows.length === 1 ? "record" : "records"}`}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={download} disabled={rows.length === 0}>
            <Download className="size-4" aria-hidden="true" />
            Export to CSV
          </Button>
        </div>

        <table className="w-full min-w-[84rem] border-collapse text-sm">
          <caption className="sr-only">Clients and vaults matching the current search and filters</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs tracking-wider text-muted-foreground uppercase">
              {COLUMNS.map((column) => {
                const active = sort.key === column.key
                const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                    className={cn("px-4 py-3 font-medium", column.numeric && "text-right")}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 uppercase tracking-wider transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        active && "text-foreground"
                      )}
                    >
                      {column.label}
                      <Icon className="size-3" aria-hidden="true" />
                    </button>
                  </th>
                )
              })}
              <th scope="col" className="px-4 py-3 font-medium">
                Contract
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-12 text-center text-muted-foreground">
                  No clients or vaults match this search.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("a, button, input, select, summary")) return
                  router.push(workspaceHref(row))
                }}
                className="cursor-pointer border-b border-border last:border-b-0 hover:bg-accent/30"
              >
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <Link
                    href={workspaceHref(row)}
                    className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {row.clientName}
                  </Link>
                  {row.email || row.phone ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{[row.email, row.phone].filter(Boolean).join(" · ")}</span>
                  ) : null}
                </th>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(row.shootDate)}</td>
                <td className="px-4 py-3">{row.category}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={row.status === "draft" ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" : "border-primary/30 bg-primary/10 text-primary"}
                  >
                    {statusLabel(row.status)}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono tracking-widest">{row.vaultPin ?? "—"}</td>
                <td className="px-4 py-3 text-right">{money.format(row.grossCollected)}</td>
                <td className="px-4 py-3 text-right">{money.format(row.driverReimbursement)}</td>
                <td className="px-4 py-3 text-right">{money.format(row.admin)}</td>
                <td className="px-4 py-3 text-right">{money.format(row.house)}</td>
                <td className="px-4 py-3 text-right">{money.format(row.shooters)}</td>
                <td className="px-4 py-3 text-right">{money.format(row.editors)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1.5">
                    <Badge
                      variant="outline"
                      className={row.contractSigned ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border text-muted-foreground"}
                    >
                      {row.contractSigned ? (row.countersigned ? "Countersigned" : "Signed") : "Pending"}
                    </Badge>
                    {row.contractSigned && !row.countersigned && row.shootId ? (
                      <CountersignRowButton shootId={row.shootId} clientName={row.clientName} onDone={() => void mutate()} />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
