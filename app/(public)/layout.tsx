import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { GlobalLightbox } from "@/components/global-lightbox"
import { AfkScreensaver } from "@/components/system/afk-screensaver"

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
      <GlobalLightbox />
      <AfkScreensaver />
    </>
  )
}
