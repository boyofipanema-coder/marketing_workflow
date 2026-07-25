import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Input — text field primitive. Calm by default, accent ring on focus. Used by
 * QuickAdd, search, and every form. The 15px base size matches Apple's body
 * size and, importantly, prevents iOS Safari's zoom-on-focus (needs ≥16px on
 * mobile — bump to text-base there if a field is mobile-primary).
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg bg-surface px-3 text-base text-text",
        "border border-border placeholder:text-text-quaternary",
        "transition-[border-color,box-shadow] duration-fast ease-out",
        "hover:border-border-strong",
        "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
