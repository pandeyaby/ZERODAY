import { cn } from "@/lib/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "ghost" | "danger" | "outline" | "warn";

const styles: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[#04140e] hover:brightness-110 font-semibold shadow-[0_0_20px_rgba(61,255,168,0.25)]",
  ghost: "bg-transparent text-[var(--text)] hover:bg-white/5",
  danger: "bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/40 hover:bg-[var(--danger)]/25",
  outline:
    "bg-transparent border border-[var(--line-bright)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
  warn: "bg-[var(--warn)]/15 text-[var(--warn)] border border-[var(--warn)]/40 hover:bg-[var(--warn)]/25",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md transition disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        styles[variant],
        className
      )}
      {...props}
    />
  );
});
