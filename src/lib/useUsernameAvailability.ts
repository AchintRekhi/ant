import { useEffect, useState } from "react";
import { checkUsername } from "@/app/onboarding/actions";

// Live username availability for the onboarding wizard and profile editor.
// Debounces input, then asks the server (the is_username_available RPC) and
// reports a status the UI can render — including the positive "available" case.

export type AvailabilityStatus =
  | "idle"
  | "invalid"
  | "checking"
  | "available"
  | "taken";

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const DEBOUNCE_MS = 400;

export function useUsernameAvailability(
  username: string,
  // When the current value equals this (e.g. the profile's own username), there's
  // nothing to check — the RPC would report it as "taken" by the user themselves.
  skipValue?: string,
): { status: AvailabilityStatus; message?: string } {
  const [status, setStatus] = useState<AvailabilityStatus>("idle");
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    const value = username.trim().toLowerCase();

    if (skipValue !== undefined && value === skipValue) {
      setStatus("idle");
      setMessage(undefined);
      return;
    }
    if (!value) {
      setStatus("idle");
      setMessage(undefined);
      return;
    }
    if (!USERNAME_RE.test(value)) {
      setStatus("invalid");
      setMessage("3–30 chars: lowercase letters, numbers, underscores.");
      return;
    }

    setStatus("checking");
    setMessage(undefined);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await checkUsername(value);
      if (cancelled) return;
      if (result.available) {
        setStatus("available");
        setMessage("Available");
      } else {
        setStatus("taken");
        setMessage(result.error ?? "That username is taken.");
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, skipValue]);

  return { status, message };
}

/** Tailwind text colour for an availability status (B&W + red/green accents). */
export function availabilityColor(status: AvailabilityStatus): string {
  switch (status) {
    case "available":
      return "text-green-600";
    case "taken":
    case "invalid":
      return "text-red-600";
    default:
      return "text-zinc-400";
  }
}
