"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/site-url";
import { emailSchema, passwordSchema } from "@/lib/validation";

export type AuthState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  // signup: email sent and awaiting confirmation. reset: reset email sent.
  status?: "check_email" | "reset_sent";
  email?: string;
};

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const emailResult = emailSchema.safeParse(email);
  const passwordResult = passwordSchema.safeParse(password);
  if (!emailResult.success || !passwordResult.success) {
    return {
      fieldErrors: {
        email: emailResult.success ? undefined : emailResult.error.issues[0].message,
        password: passwordResult.success
          ? undefined
          : passwordResult.error.issues[0].message,
      },
    };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: emailResult.data,
    password: passwordResult.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
  });

  if (error) return { error: error.message };

  // If the project has email confirmation disabled, a session is returned
  // immediately and we can go straight to onboarding.
  if (data.session) redirect("/onboarding");

  return { status: "check_email", email: emailResult.data };
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: "Invalid email or password." };

  // Land in the app; the app layout sends unfinished profiles to /onboarding.
  redirect("/app");
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const emailResult = emailSchema.safeParse(email);
  if (!emailResult.success) {
    return { fieldErrors: { email: emailResult.error.issues[0].message } };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  await supabase.auth.resetPasswordForEmail(emailResult.data, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Always report success — never reveal whether an account exists.
  return { status: "reset_sent", email: emailResult.data };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const passwordResult = passwordSchema.safeParse(password);
  if (!passwordResult.success) {
    return { fieldErrors: { password: passwordResult.error.issues[0].message } };
  }

  const supabase = await createClient();
  // Requires the recovery session established by the /auth/callback redirect.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({
    password: passwordResult.data,
  });
  if (error) return { error: error.message };

  redirect("/app");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
