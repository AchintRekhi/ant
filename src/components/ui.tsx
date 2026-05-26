import type { ComponentProps } from "react";

// Minimal black & white primitives. Mobile-first: big tap targets, generous
// spacing. These are styling-only (no hooks) so they work in any component.

export const inputClasses =
  "w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-lg text-black " +
  "outline-none transition focus:border-black placeholder:text-zinc-400 " +
  "disabled:opacity-50";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "ghost" }) {
  const base =
    "inline-flex h-12 items-center justify-center rounded-lg px-5 text-base font-medium " +
    "transition disabled:opacity-40 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-black text-white hover:bg-zinc-800"
      : "border border-zinc-300 text-black hover:border-black";
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-2 text-sm text-red-600" aria-live="polite">
      {message}
    </p>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
      aria-live="polite"
    >
      {message}
    </p>
  );
}
