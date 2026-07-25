import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — a small, quiet pill for metadata: counts, tags, generic labels.
 * For task status specifically, use <StatusBadge> which encodes the status
 * color vocabulary. This is the neutral base.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap align-middle",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-text-secondary",
        outline: "border border-border text-text-secondary",
        accent: "bg-accent/12 text-accent",
        solid: "bg-text text-bg",
      },
      size: {
        sm: "h-5 px-2 text-2xs",
        md: "h-6 px-2.5 text-xs",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { badgeVariants };
