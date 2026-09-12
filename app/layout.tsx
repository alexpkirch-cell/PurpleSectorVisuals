import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteNav } from "@/components/site-nav"
import { SiteFooter } from "@/components/site-footer"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-heading",
})

export const metadata: Metadata = {
  title: "Purple Sector Visuals",
  description:
    "Purple Sector Visuals is a two-creator studio by Alex & Gabe capturing sports, automotive, portrait, and event photography with a kinetic, cinematic edge. Book your session today.",
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
        spaceGrotesk.variable,
        "bg-background"
      )}
    >
      <body className="min-h-svh">
        <ThemeProvider
          forcedTheme="dark"
          defaultTheme="dark"
          enableSystem={false}
        >
          <SiteNav />
          <main>{children}</main>
          <SiteFooter />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
