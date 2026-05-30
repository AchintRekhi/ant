"use client";

import { useActionState, useState } from "react";
import { Button, FormError, inputClasses } from "@/components/ui";
import { deleteAccount, type DeleteResult } from "./account-actions";

/**
 * Danger zone: permanently delete the account. Two-step — the destructive form
 * stays hidden behind a toggle, and submitting requires re-typing the exact
 * username. On success the action redirects away, so there's no success state
 * to render here.
 */
export default function DeleteAccount({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DeleteResult | null, FormData>(
    deleteAccount,
    null,
  );

  return (
    <section className="mt-12 rounded-lg border border-red-200 p-5">
      <h2 className="text-base font-semibold text-red-700">Delete account</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Permanently erases your profile, workouts, routines, photos, social
        connections and challenges. This cannot be undone.
      </p>

      {!open ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(true)}
          className="mt-4 h-10 border-red-300 text-sm text-red-700 hover:border-red-500"
        >
          Delete my account
        </Button>
      ) : (
        <form action={action} className="mt-4 flex flex-col gap-3">
          <label className="text-sm text-zinc-600">
            Type your username{" "}
            <span className="font-semibold text-black">@{username}</span> to
            confirm:
          </label>
          <input
            name="confirm"
            autoComplete="off"
            placeholder={username}
            className={`${inputClasses} text-base`}
          />
          <FormError message={state?.error} />
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={pending}
              className="h-10 bg-red-600 text-sm hover:bg-red-700"
            >
              {pending ? "Deleting…" : "Permanently delete"}
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
      )}
    </section>
  );
}
