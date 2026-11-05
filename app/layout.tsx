import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Source_Serif_4, Space_Grotesk } from "next/font/google"
import Script from "next/script"

import "./globals.css"
import { ResizeObserverGuard } from "@/components/admin/resize-observer-guard"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

// Runs before hydration so the error listener is registered ahead of any dev-overlay or preview reporter. The editor's
// own observers no longer trigger the error (see lib/defer-resize-observer); this only covers third-party observers
// created outside our control.
const EARLY_RESIZE_OBSERVER_GUARD = `(function(){
var M=["ResizeObserver loop completed with undelivered notifications.","ResizeObserver loop limit exceeded"];
window.addEventListener("error",function(e){if(M.indexOf(e.message)!==-1){e.stopImmediatePropagation();e.preventDefault()}},true);
})();`

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-heading",
})

export const metadata: Metadata = {
  title: "Purple Sector Visuals",
  description:
    "Purple Sector Visuals is a two-creator studio capturing sports, automotive, portrait, and event photography with a kinetic, cinematic edge. Book your session today.",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable,
        sourceSerif.variable,
        spaceGrotesk.variable,
        "bg-background"
      )}
    >
      <body className="min-h-svh">
        <Script id="resize-observer-early-guard" strategy="beforeInteractive">
          {EARLY_RESIZE_OBSERVER_GUARD}
        </Script>
        <ResizeObserverGuard />
        <ThemeProvider
          forcedTheme="dark"
          defaultTheme="dark"
          enableSystem={false}
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
