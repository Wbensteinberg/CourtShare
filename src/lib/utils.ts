import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility function for conditional classNames (shadcn/ui standard)
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
