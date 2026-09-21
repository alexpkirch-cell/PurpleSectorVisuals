"use client"

import { useEffect, useMemo, useState } from "react"
import { Mail, Phone } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { finalizeBooking, type Shoot } from "@/app/actions/shoots"
import { isMockShoot } from "@/lib/mock-lead"
import { ADDON_OPTIONS, PACKAGE_PRICES, STUDIO_EDITORS, STUDIO_SHOOTERS, type PackageTier } from "@/lib/booking-config"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-100">{value}</span>
    </div>
  )
}

export function ClientDetailSheet({
  shoot,
  onOpenChange,
  onFinalized,
}: {
  shoot: Shoot | null
  onOpenChange: (open: boolean) => void
  onFinalized: (shoot: Shoot) => void
}) {
  const [adminNotes, setAdminNotes] = useState("")
  const [packageTier, setPackageTier] = useState<PackageTier>("Base")
  const [addonIds, setAddonIds] = useState<string[]>([])
  const [confirmedDate, setConfirmedDate] = useState("")
  const [confirmedTime, setConfirmedTime] = useState("")
  const [confirmedLocation, setConfirmedLocation] = useState("")
  const [totalPrice, setTotalPrice] = useState("0")
  const [priceTouched, setPriceTouched] = useState(false)
  const [shooters, setShooters] = useState<string[]>([])
  const [editors, setEditors] = useState<string[]>([])
  const [isFinalizing, setIsFinalizing] = useState(false)

  useEffect(() => {
    if (shoot) {
      setAdminNotes(shoot.admin_notes ?? "")
      setPackageTier((shoot.package_tier as PackageTier) || "Base")
      setAddonIds(
        (shoot.selected_addons ?? [])
          .map((item) => ADDON_OPTIONS.find((a) => a.label === item.label)?.id)
          .filter((id): id is string => !!id),
      )
      setConfirmedDate(shoot.shoot_date ? shoot.shoot_date.slice(0, 10) : "")
      setConfirmedTime(shoot.shoot_date ? shoot.shoot_date.slice(11, 16) : "")
      setConfirmedLocation(shoot.location ?? "")
      setShooters(shoot.assigned_shooter ? shoot.assigned_shooter.split(",").map((s) => s.trim()) : [])
      setEditors(shoot.assigned_editor ? shoot.assigned_editor.split(",").map((s) => s.trim()) : [])
      setPriceTouched(false)
    }
  }, [shoot])

  const calculatedTotal = useMemo(() => {
    const addonsTotal = addonIds.reduce((sum, id) => {
      const addon = ADDON_OPTIONS.find((a) => a.id === id)
      return sum + (addon?.amount ?? 0)
    }, 0)
    return PACKAGE_PRICES[packageTier] + addonsTotal
  }, [packageTier, addonIds])

  useEffect(() => {
    if (!priceTouched) {
      setTotalPrice(String(calculatedTotal))
    }
  }, [calculatedTotal, priceTouched])

  function toggleAddon(id: string) {
    setAddonIds((current) => (current.includes(id) ? current.filter((a) => a !== id) : [...current, id]))
  }

  function toggleTeamMember(list: string[], setList: (v: string[]) => void, name: string) {
    setList(list.includes(name) ? list.filter((n) => n !== name) : [...list, name])
  }

  async function handleFinalize() {
    if (!shoot) return
    setIsFinalizing(true)
    try {
      const selectedAddons = addonIds.map((id) => {
        const addon = ADDON_OPTIONS.find((a) => a.id === id)!
        return { label: addon.label, amount: addon.amount }
      })

      if (isMockShoot(shoot.id)) {
        toast.info("This is the demo test lead — finalizing is disabled here to keep the pipeline sample intact.")
        return
      }

      const updated = await finalizeBooking(shoot.id, {
        adminNotes: adminNotes || null,
        packageTier,
        selectedAddons,
        confirmedDate: confirmedDate || null,
        confirmedTime: confirmedTime || null,
        confirmedLocation: confirmedLocation || null,
        totalPrice: Number(totalPrice) || 0,
        assignedShooters: shooters,
        assignedEditors: editors,
      })
      toast.success(`${shoot.client_name} booked — vault generated and retainer request sent`)
      onFinalized(updated)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to finalize booking")
    } finally {
      setIsFinalizing(false)
    }
  }

  return (
    <Sheet open={!!shoot} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto border-white/10 bg-zinc-950 sm:max-w-lg">
        {shoot && (
          <>
            <SheetHeader>
              <SheetTitle className="text-zinc-50">{shoot.client_name}</SheetTitle>
              <SheetDescription className="text-zinc-500">
                {shoot.shoot_type} &middot; New inquiry
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4">
              {/* Section 1: Client overview & admin notes */}
              <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/40 p-3">
                <span className="text-xs font-medium text-zinc-300">Client overview</span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoRow label="Full name" value={shoot.client_name} />
                  <InfoRow label="Email" value={shoot.client_email} />
                  <InfoRow label="Phone" value={shoot.client_phone ?? "Not provided"} />
                  <InfoRow label="Requested package" value={shoot.shoot_type} />
                </div>
                <div className="flex gap-2">
                  <a
                    href={`mailto:${shoot.client_email}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/5"
                  >
                    <Mail className="size-3.5" />
                    Email
                  </a>
                  {shoot.client_phone && (
                    <a
                      href={`tel:${shoot.client_phone}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/5"
                    >
                      <Phone className="size-3.5" />
                      Call
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">
                    Original inquiry message
                  </span>
                  <p className="rounded-md bg-white/5 p-2 text-xs text-zinc-400">
                    {shoot.notes || "No message left with the inquiry."}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="adminNotes" className="text-zinc-300">
                    Admin communication notes
                  </Label>
                  <Textarea
                    id="adminNotes"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={5}
                    placeholder="Log call and text details here..."
                    className="border-white/10 bg-black/40 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Section 2: Booking configuration & pricing calculator */}
              <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/40 p-3">
                <span className="text-xs font-medium text-zinc-300">Booking configuration</span>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-zinc-300">Package</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(PACKAGE_PRICES) as PackageTier[]).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setPackageTier(tier)}
                        className={
                          "rounded-md border px-3 py-2 text-left text-sm transition-colors " +
                          (packageTier === tier
                            ? "border-[#9D00FF] bg-[#9D00FF]/10 text-zinc-50"
                            : "border-white/10 text-zinc-400 hover:bg-white/5")
                        }
                      >
                        <span className="block font-medium">{tier}</span>
                        <span className="text-xs text-zinc-500">{formatCurrency(PACKAGE_PRICES[tier])}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-zinc-300">Add-ons</Label>
                  <div className="flex flex-col gap-2">
                    {ADDON_OPTIONS.map((addon) => (
                      <label
                        key={addon.id}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-300"
                      >
                        <span className="flex items-center gap-2">
                          <Checkbox
                            checked={addonIds.includes(addon.id)}
                            onCheckedChange={() => toggleAddon(addon.id)}
                          />
                          {addon.label}
                        </span>
                        <span className="text-xs text-zinc-500">+{formatCurrency(addon.amount)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="confirmedDate" className="text-zinc-300">
                      Confirmed date
                    </Label>
                    <Input
                      id="confirmedDate"
                      type="date"
                      value={confirmedDate}
                      onChange={(e) => setConfirmedDate(e.target.value)}
                      className="border-white/10 bg-black/40 text-zinc-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="confirmedTime" className="text-zinc-300">
                      Time
                    </Label>
                    <Input
                      id="confirmedTime"
                      type="time"
                      value={confirmedTime}
                      onChange={(e) => setConfirmedTime(e.target.value)}
                      className="border-white/10 bg-black/40 text-zinc-100"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirmedLocation" className="text-zinc-300">
                    Location
                  </Label>
                  <Input
                    id="confirmedLocation"
                    value={confirmedLocation}
                    onChange={(e) => setConfirmedLocation(e.target.value)}
                    placeholder="Where is the shoot happening?"
                    className="border-white/10 bg-black/40 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="totalPrice" className="text-zinc-300">
                    Total price
                  </Label>
                  <Input
                    id="totalPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalPrice}
                    onChange={(e) => {
                      setPriceTouched(true)
                      setTotalPrice(e.target.value)
                    }}
                    className="border-white/10 bg-black/40 font-medium text-zinc-100"
                  />
                  <p className="text-[0.65rem] text-zinc-500">
                    Auto-calculated from package + add-ons. Edit directly to apply a custom discount or charge.
                  </p>
                </div>
              </div>

              {/* Section 3: Team assignment */}
              <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/40 p-3">
                <span className="text-xs font-medium text-zinc-300">Team assignment</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">Shooters</span>
                    {STUDIO_SHOOTERS.map((name) => (
                      <label key={name} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                        <Checkbox
                          checked={shooters.includes(name)}
                          onCheckedChange={() => toggleTeamMember(shooters, setShooters, name)}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[0.65rem] uppercase tracking-wide text-zinc-500">Editors</span>
                    {STUDIO_EDITORS.map((name) => (
                      <label key={name} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                        <Checkbox
                          checked={editors.includes(name)}
                          onCheckedChange={() => toggleTeamMember(editors, setEditors, name)}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 4: Finalize */}
              <Button
                type="button"
                onClick={handleFinalize}
                disabled={isFinalizing}
                className="bg-[#9D00FF] text-zinc-50 hover:bg-[#9D00FF]/90"
              >
                {isFinalizing ? "Finalizing…" : "Finalize Booking & Generate Vault"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
