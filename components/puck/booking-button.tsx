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
        "h-12 px-8 font-heading text-sm font-bold tracking-[0.18em] uppercase transition-shadow",
        variant === "default" && "shadow-[0_0_28px_-6px_var(--primary)] hover:shadow-[0_0_40px_-4px_var(--primary)]",
        className
      )}
    >
      {label}
    </Link>
  )
}
