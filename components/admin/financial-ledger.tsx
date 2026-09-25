"use client"

import { useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createExpense,
  deleteExpense,
  type Expense,
  type ExpenseCategory,
  type FundBucket,
} from "@/app/actions/ledger"

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  payout: "Creator Payout",
  marketing: "Marketing",
  opex: "OpEx & Business",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function FundCard({ bucket }: { bucket: FundBucket }) {
  const pct = bucket.allocated > 0 ? Math.min(100, (bucket.spent / bucket.allocated) * 100) : 0

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{bucket.label}</p>
      <p className="mt-1.5 font-heading text-xl font-medium text-foreground">
        {formatCurrency(bucket.available)}
      </p>
      <p className="text-xs text-muted-foreground">available of {formatCurrency(bucket.allocated)}</p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function FinancialLedger({
  buckets,
  initialExpenses,
}: {
  buckets: { creatorPayouts: FundBucket; opex: FundBucket; marketing: FundBucket }
  initialExpenses: Expense[]
}) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("opex")
  const [submitting, setSubmitting] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedAmount = Number(amount)
    if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a description and a positive amount")
      return
    }

    setSubmitting(true)
    try {
      const expenseDate = new Date().toISOString().slice(0, 10)
      await createExpense({ expenseDate, description: description.trim(), amount: parsedAmount, category, receiptUrl: null })
      setExpenses((prev) => [
        {
          id: crypto.randomUUID(),
          expense_date: expenseDate,
          description: description.trim(),
          amount: parsedAmount.toFixed(2),
          category,
          receipt_url: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
      setDescription("")
      setAmount("")
      toast.success("Expense logged")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to log expense")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setPendingId(id)
    const previous = expenses
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    try {
      await deleteExpense(id)
    } catch (error) {
      setExpenses(previous)
      toast.error(error instanceof Error ? error.message : "Failed to delete expense")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FundCard bucket={buckets.creatorPayouts} />
        <FundCard bucket={buckets.opex} />
        <FundCard bucket={buckets.marketing} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-end sm:gap-3"
      >
        <div className="flex-1">
          <Label htmlFor="expense-description" className="text-xs text-muted-foreground">
            Description
          </Label>
          <Input
            id="expense-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="New lens rental"
            className="mt-1.5"
          />
        </div>
        <div className="w-full sm:w-32">
          <Label htmlFor="expense-amount" className="text-xs text-muted-foreground">
            Amount
          </Label>
          <Input
            id="expense-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1.5"
          />
        </div>
        <div className="w-full sm:w-48">
          <Label className="text-xs text-muted-foreground">Fund</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={submitting} className="gap-2">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Log expense
        </Button>
      </form>

      {expenses.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No records found. Waiting for first entry.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Date</th>
                <th className="px-4 py-2.5 text-left font-medium">Description</th>
                <th className="px-4 py-2.5 text-left font-medium">Fund</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenses.map((expense) => (
                <tr key={expense.id} className="text-foreground">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    {formatDate(expense.expense_date)}
                  </td>
                  <td className="px-4 py-2.5">{expense.description}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{CATEGORY_LABELS[expense.category]}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(Number(expense.amount))}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={pendingId === expense.id}
                      onClick={() => handleDelete(expense.id)}
                      aria-label={`Delete ${expense.description}`}
                      className="size-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
