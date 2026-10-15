"use client"

import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"

import { PageNavigator } from "@/components/admin/site-editor/page-navigator"
import { buttonVariants } from "@/components/ui/button"

type BuiltInPagePreviewProps = {
  path: string
  editablePaths: string[]
}

export function BuiltInPagePreview({ path, editablePaths }: BuiltInPagePreviewProps) {
  return (
    <div className="fixed inset-y-0 right-0 left-60 z-40 flex flex-col overflow-hidden bg-background">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-foreground">{path}</span>
          <span className="text-xs text-muted-foreground">
            Built-in page: its layout is defined in code, so it is previewed here rather than edited.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <PageNavigator path={path} editablePaths={editablePaths} />
          <a href={path} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ExternalLink className="size-4" />
            View live
          </a>
          <Link href="/admin" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="size-4" />
            Admin
          </Link>
        </div>
      </header>
      <iframe key={path} src={path} title={`Preview of ${path}`} className="min-h-0 w-full flex-1 border-0 bg-background" />
    </div>
  )
}
