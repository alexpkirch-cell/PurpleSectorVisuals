import { ClipboardList, ExternalLink } from "lucide-react"

import type { Shoot } from "@/app/actions/shoots"
import { LinkifiedText, extractLinks, isImageLink } from "@/components/admin/linkified-text"
import { Badge } from "@/components/ui/badge"

function hostnameOf(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "")
  } catch {
    return link
  }
}

/** Read-only view of everything the client submitted in their vault's Prep & Planning step. */
export function WorkspacePrepCard({ shoot }: { shoot: Shoot }) {
  const submitted = Boolean(shoot.vault_prep_submitted_at)
  const links = extractLinks(shoot.vault_mood_board_links)
  const referenceImages = links.filter(isImageLink)
  const otherLinks = links.filter((link) => !isImageLink(link))

  return (
    <section aria-labelledby="workspace-prep" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="workspace-prep" className="flex items-center gap-2 font-heading text-base font-medium text-foreground">
          <ClipboardList className="size-4 text-primary" aria-hidden="true" />
          Client Prep &amp; Uploads
        </h2>
        {submitted ? (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            Submitted{" "}
            {new Date(shoot.vault_prep_submitted_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </Badge>
        ) : null}
      </div>

      {!submitted ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Awaiting client prep submission.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Must-have shots</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {shoot.vault_must_have_shots?.trim() || "None provided"}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Mood board</h3>
            {shoot.vault_mood_board_links?.trim() ? (
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                <LinkifiedText text={shoot.vault_mood_board_links} />
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">None provided</p>
            )}
            {otherLinks.length > 0 ? (
              <ul className="flex flex-wrap gap-2 pt-1">
                {otherLinks.map((link) => (
                  <li key={link}>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <span className="truncate">{hostnameOf(link)}</span>
                      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {referenceImages.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reference images</h3>
              <ul className="columns-2 gap-2 sm:columns-3">
                {referenceImages.map((link, index) => (
                  <li key={link} className="mb-2 break-inside-avoid overflow-hidden rounded-md border border-border bg-muted">
                    <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`Open reference image ${index + 1}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- client-supplied external reference image */}
                      <img src={link} alt={`Client reference ${index + 1}`} loading="lazy" className="block h-auto w-full" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
