import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — the reference for how everything interactive should feel.
 *
 * Apple-fluid details baked in:
 *  - press feedback is instant and physical (active:scale-95, ~140ms)
 *  - focus is keyboard-only and calm (focus-visible ring)
 *  - transitions ride the app's --ease-out curve
 * Never restyle a button ad hoc — add a variant here instead.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none",
    "font-medium rounded-lg",
    "transition-[transform,background-color,color,box-shadow,opacity] duration-fast ease-out",
    "active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:shrink-0 [&_svg]:size-[1.05em]",
  ],
  {
    variants: {
      variant: {
        // Primary call to action — solid accent.
        primary:
          "bg-accent text-text-on-accent shadow-xs hover:bg-accent-hover active:bg-accent-pressed",
        // Neutral filled — the default for most actions.
        secondary:
          "bg-surface-2 text-text hover:bg-surface-3 active:bg-surface-3",
        // Quiet — lives inside dense UI, toolbars, cards.
        ghost:
          "bg-transparent text-text hover:bg-surface-2 active:bg-surface-3",
        // Outlined — secondary emphasis with a hairline.
        outline:
          "bg-surface text-text border border-border hover:bg-surface-2 hover:border-border-strong active:bg-surface-3",
        // Text-only accent link.
        link: "bg-transparent text-accent hover:text-accent-hover underline-offset-4 hover:underline px-0",
        // Destructive.
        destructive:
          "bg-flag-blocked text-text-on-accent shadow-xs hover:opacity-90 active:opacity-100",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-5 text-base",
        icon: "size-9 p-0",
        "icon-sm": "size-8 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element (e.g. an <a> or Next <Link>) via Radix Slot. */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
