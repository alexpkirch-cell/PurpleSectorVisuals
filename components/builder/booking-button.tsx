"use client"

import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type BookingButtonProps = {
  label?: string
  shooterId?: string
  variant?: "default" | "outline" | "secondary" | "ghost"
  size?: "default" | "sm" | "lg"
  className?: string
}

export function BookingButton({
  label = "Book a shoot",
  shooterId,
  variant = "default",
  size = "lg",
  className,
}: BookingButtonProps) {
  const href = shooterId ? `/book?shooter=${encodeURIComponent(shooterId)}` : "/book"

  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant, size }),
        "h-11 px-6 font-heading text-sm tracking-wide",
        className
      )}
    >
      {label}
    </Link>
  )
}
