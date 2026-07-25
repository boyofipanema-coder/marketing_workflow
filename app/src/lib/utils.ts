import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn — merge Tailwind class lists with correct conflict resolution.
 * Standard across every component in this app. Import from "@/lib/utils".
 *
 *   cn("px-3 py-2", isActive && "bg-accent text-text-on-accent", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
