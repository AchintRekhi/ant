import { z } from "zod";

// Shared validation schemas for auth and onboarding. Server Actions are the
// security boundary, so every action re-validates its input with these.

export const emailSchema = z.email({ message: "Enter a valid email address." });

export const passwordSchema = z
  .string()
  .min(8, { message: "At least 8 characters." })
  .regex(/[a-zA-Z]/, { message: "Include at least one letter." })
  .regex(/[0-9]/, { message: "Include at least one number." });

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, {
    message: "3–30 chars: lowercase letters, numbers, and underscores only.",
  });

export const GOAL_TYPES = [
  "lose_weight",
  "build_muscle",
  "get_stronger",
  "stay_consistent",
] as const;

/** Payload the onboarding wizard submits. Height/weight arrive normalized to metric. */
export const onboardingSchema = z.object({
  username: usernameSchema,
  units: z.enum(["metric", "imperial"]),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Enter your date of birth." })
    .refine(
      (value) => {
        const age = ageFromDob(value);
        return age >= 13 && age <= 100;
      },
      { message: "You must be between 13 and 100 years old." },
    ),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  heightCm: z
    .number()
    .min(50, { message: "That height looks too low." })
    .max(300, { message: "That height looks too high." }),
  weightKg: z
    .number()
    .min(20, { message: "That weight looks too low." })
    .max(500, { message: "That weight looks too high." }),
  timezone: z.string().min(1, { message: "Pick your timezone." }),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  goals: z
    .array(z.enum(GOAL_TYPES))
    .min(1, { message: "Pick at least one goal." }),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter a display name." })
  .max(50, { message: "Keep it under 50 characters." });

export const bioSchema = z
  .string()
  .trim()
  .max(300, { message: "Keep your bio under 300 characters." });

/** Payload the profile editor submits. Height arrives normalized to metric. */
export const profileUpdateSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  bio: bioSchema,
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  heightCm: z
    .number()
    .min(50, { message: "That height looks too low." })
    .max(300, { message: "That height looks too high." }),
  units: z.enum(["metric", "imperial"]),
  privacy: z.enum(["public", "private"]),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  goals: z
    .array(z.enum(GOAL_TYPES))
    .min(1, { message: "Pick at least one goal." }),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/** Payload for logging a bodyweight entry. Weight arrives normalized to metric. */
export const bodyWeightSchema = z.object({
  weightKg: z
    .number()
    .min(20, { message: "That weight looks too low." })
    .max(500, { message: "That weight looks too high." }),
  // Optional YYYY-MM-DD; defaults to "now" server-side when omitted.
  recordedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Pick a valid date." })
    .optional(),
});

export type BodyWeightInput = z.infer<typeof bodyWeightSchema>;

/** Whole-years age from a YYYY-MM-DD date of birth, in the server's clock. */
export function ageFromDob(dob: string): number {
  const birth = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}
