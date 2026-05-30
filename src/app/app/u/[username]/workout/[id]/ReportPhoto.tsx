"use client";

import { useActionState, useState } from "react";
import { Button, FormError, inputClasses } from "@/components/ui";
import { reportPhoto, type ReportResult } from "./report-action";

/**
 * "Report photo" affordance shown under another user's session photo. Collapsed
 * to a small link until tapped; once a report is filed it shows a thank-you and
 * doesn't re-open (the unique constraint would reject a second one anyway).
 */
export default function ReportPhoto({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ReportResult | null, FormData>(
    reportPhoto,
    null,
  );

  if (state?.ok) {
    return (
      <p className="mt-2 text-xs text-zinc-400" aria-live="polite">
        Thanks — this photo has been reported for review.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-zinc-400 underline hover:text-zinc-600"
      >
        Report photo
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <textarea
        name="reason"
        required
        maxLength={500}
        rows={3}
        placeholder="What's wrong with this photo?"
        className={`${inputClasses} text-base`}
      />
      <FormError message={state?.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="h-10 text-sm">
          {pending ? "Submitting…" : "Submit report"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          className="h-10 text-sm"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
