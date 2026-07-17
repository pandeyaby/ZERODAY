import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class merge helper (client-safe). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "text-rose-400";
    case "high":
      return "text-orange-400";
    case "medium":
      return "text-amber-300";
    case "low":
      return "text-sky-300";
    default:
      return "text-zinc-400";
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
