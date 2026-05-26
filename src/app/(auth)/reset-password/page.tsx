"use client";

import { useActionState } from "react";
import { updatePassword, type AuthState } from "../actions";
import { Button, FieldError, FormError, inputClasses } from "@/components/ui";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    updatePassword,
    {},
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Choose a new password for your account.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <FormError message={state.error} />
        <div>
          <label htmlFor="password" className="sr-only">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            required
            autoFocus
            className={inputClasses}
          />
          <FieldError message={state.fieldErrors?.password} />
          <p className="mt-2 text-xs text-zinc-400">
            At least 8 characters, with a letter and a number.
          </p>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
