"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "../actions";
import { Button, FieldError, inputClasses } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.status === "reset_sent") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-sm text-zinc-600">
          If an account exists for{" "}
          <span className="font-medium text-black">{state.email}</span>, we sent a
          link to reset your password.
        </p>
        <Link href="/login" className="text-sm underline hover:text-black">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Email"
            required
            className={inputClasses}
          />
          <FieldError message={state.fieldErrors?.email} />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <Link href="/login" className="text-sm underline hover:text-black">
        Back to log in
      </Link>
    </div>
  );
}
