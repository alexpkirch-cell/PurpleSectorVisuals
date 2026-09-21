"use client"

import { useRef, useState } from "react"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
  createLegalDocument,
  deleteLegalDocument,
  type LegalDocumentCategory,
  type LegalDocumentWithSignedUrl,
} from "@/app/actions/legal"
import { createClient } from "@/lib/supabase/client"
import { BUSINESS_DOCUMENTS_BUCKET } from "@/lib/storage-buckets"

const CATEGORY_LABELS: Record<LegalDocumentCategory, string> = {
  corporate: "Corporate Filing",
  waiver: "Model Release / Waiver",
  contractor: "Contractor W-9",
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function LegalDocuments({ initialDocuments }: { initialDocuments: LegalDocumentWithSignedUrl[] }) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<LegalDocumentCategory>("corporate")
  const [uploading, setUploading] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    if (!title.trim()) {
      toast.error("Give the document a title before uploading")
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const storagePath = `${category}/${crypto.randomUUID()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from(BUSINESS_DOCUMENTS_BUCKET)
        .upload(storagePath, file, { contentType: file.type })

      if (uploadError) throw new Error(uploadError.message)

      await createLegalDocument({ title: title.trim(), category, storagePath })

      const { data } = await supabase.storage.from(BUSINESS_DOCUMENTS_BUCKET).createSignedUrl(storagePath, 60 * 60)

      setDocuments((prev) => [
        {
          id: crypto.randomUUID(),
          title: title.trim(),
          category,
          file_url: storagePath,
          uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          signedUrl: data?.signedUrl ?? null,
        },
        ...prev,
      ])
      setTitle("")
      toast.success("Document uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDelete(id: string) {
    setPendingId(id)
    const previous = documents
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    try {
      await deleteLegalDocument(id)
    } catch (error) {
      setDocuments(previous)
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-end sm:gap-3">
        <div className="flex-1">
          <Label htmlFor="doc-title" className="text-xs text-muted-foreground">
            Title
          </Label>
          <Input
            id="doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="2026 LLC Operating Agreement"
            className="mt-1.5"
          />
        </div>
        <div className="w-full sm:w-56">
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as LegalDocumentCategory)}>
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
        <Button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="gap-2">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload document
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
          }}
        />
      </div>

      {documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No records found. Waiting for first entry.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">Uploaded {formatDate(doc.uploaded_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="secondary">{CATEGORY_LABELS[doc.category]}</Badge>
                {doc.signedUrl ? (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View
                  </a>
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={pendingId === doc.id}
                  onClick={() => handleDelete(doc.id)}
                  aria-label={`Delete ${doc.title}`}
                  className="size-7 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
