import type { CommandCenterProject } from "@/app/actions/command-center"
import { COMMAND_CENTER_BUCKETS, splitRevenue } from "@/lib/command-center-split"
import { formatCurrency } from "@/components/admin/command-center/format"

export function FinancesPanel({ projects }: { projects: CommandCenterProject[] }) {
  const realized = projects.filter((p) => p.status === "Delivered").reduce((sum, p) => sum + p.totalPrice, 0)
  const pipeline = projects
    .filter((p) => p.status === "Retainer_Paid" || p.status === "Staging")
    .reduce((sum, p) => sum + p.totalPrice, 0)
  const leads = projects.filter((p) => p.status === "Lead").reduce((sum, p) => sum + p.totalPrice, 0)

  const realizedSplit = splitRevenue(realized)
  const pipelineSplit = splitRevenue(pipeline)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Realized (Delivered)", value: realized },
          { label: "In Pipeline (Retainer Paid + Staging)", value: pipeline },
          { label: "Open Leads", value: leads },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(card.value)}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-heading text-sm font-medium text-foreground">Revenue Buckets</h2>
          <p className="text-xs text-muted-foreground">
            Every booking splits 50% Shooter / 15% Editor / 10% Admin / 25% House Reserve.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2 font-medium">
                Bucket
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Share
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Realized
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                In pipeline
              </th>
            </tr>
          </thead>
          <tbody>
            {COMMAND_CENTER_BUCKETS.map((bucket) => (
              <tr key={bucket.key} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{bucket.label}</p>
                  <p className="text-xs text-muted-foreground">{bucket.description}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{Math.round(bucket.rate * 100)}%</td>
                <td className="px-4 py-3 text-right font-medium text-foreground">
                  {formatCurrency(realizedSplit[bucket.key])}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {formatCurrency(pipelineSplit[bucket.key])}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-accent/40 text-foreground">
              <td className="px-4 py-3 font-medium">Total</td>
              <td className="px-4 py-3 text-muted-foreground">100%</td>
              <td className="px-4 py-3 text-right font-semibold">{formatCurrency(realized)}</td>
              <td className="px-4 py-3 text-right font-semibold">{formatCurrency(pipeline)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
