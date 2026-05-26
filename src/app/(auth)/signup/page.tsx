"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signup, type AuthState } from "../actions";
import { Button, FieldError, FormError, inputClasses } from "@/components/ui";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signup,
    {},
  );
  // One field per screen: email first, then password.
  const [step, setStep] = useState<0 | 1>(0);
  const [email, setEmail] = useState("");

  if (state.status === "check_email") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-sm text-zinc-600">
          We sent a confirmation link to{" "}
          <span className="font-medium text-black">{state.email}</span>. Click it
          to verify your account and finish setting up your profile.
        </p>
        <p className="text-sm text-zinc-500">
          Wrong address?{" "}
          <Link href="/signup" className="underline hover:text-black">
            Start over
          </Link>
        </p>
      </div>
    );
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {step === 0 ? "What's your email?" : "Choose a password."}
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <FormError message={state.error} />

        {step === 0 ? (
          <>
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
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClasses}
              />
              <FieldError message={state.fieldErrors?.email} />
            </div>
            <Button
              type="button"
              disabled={!emailValid}
              onClick={() => setStep(1)}
            >
              Continue
            </Button>
          </>
        ) : (
          <>
            {/* Carry the email collected on the previous screen. */}
            <input type="hidden" name="email" value={email} />
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Password"
                autoFocus
                className={inputClasses}
              />
              <FieldError message={state.fieldErrors?.password} />
              <p className="mt-2 text-xs text-zinc-400">
                At least 8 characters, with a letter and a number.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(0)}
                disabled={pending}
              >
                Back
              </Button>
              <Button type="submit" disabled={pending} className="flex-1">
                {pending ? "Creating…" : "Create account"}
              </Button>
            </div>
          </>
        )}
      </form>

      <p className="text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="underline hover:text-black">
          Log in
        </Link>
      </p>
    </div>
  );
}
