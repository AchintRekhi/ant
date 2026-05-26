"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthState } from "../actions";
import { Button, FormError, inputClasses } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    login,
    {},
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-zinc-500">Log in to your account.</p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <FormError message={state.error} />

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
        </div>

        <div>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            required
            className={inputClasses}
          />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <div className="flex flex-col gap-2 text-sm text-zinc-500">
        <Link href="/forgot-password" className="underline hover:text-black">
          Forgot your password?
        </Link>
        <p>
          New here?{" "}
          <Link href="/signup" className="underline hover:text-black">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
