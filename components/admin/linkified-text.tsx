const URL_PATTERN = /(https?:\/\/[^\s]+)/g
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i

/** Every http(s) link pasted into free text, without duplicates, in the order written. */
export function extractLinks(text: string | null | undefined): string[] {
  if (!text) return []
  return [...new Set((text.match(URL_PATTERN) ?? []).map((link) => link.replace(/[),.;]+$/, "")))]
}

/** True for direct links to an image file, which can be previewed as a thumbnail. */
export function isImageLink(url: string) {
  return IMAGE_EXTENSION.test(url)
}

/** Turns pasted links in free text into real links so the admin can open them. */
export function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </>
  )
}
