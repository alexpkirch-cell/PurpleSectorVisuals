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
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2">
        <PageNavigator path={path} editablePaths={editablePaths} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-muted-foreground xl:inline">
            Built-in page: layout is defined in code, so it is previewed rather than edited.
          </span>
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
