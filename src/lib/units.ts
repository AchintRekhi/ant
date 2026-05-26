// Unit conversion helpers. The database always stores metric (cm, kg); these
// convert to and from the user's preferred display units at the UI layer only.

export type Units = "metric" | "imperial";

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const KG_PER_LB = 0.45359237;

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * INCHES_PER_FOOT + inches) * CM_PER_INCH;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = Math.round(totalInches - feet * INCHES_PER_FOOT);
  // Carry a rounded 12" up to the next foot.
  if (inches === INCHES_PER_FOOT) return { feet: feet + 1, inches: 0 };
  return { feet, inches };
}

export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB;
}

export function kgToLbs(kg: number): number {
  return kg / KG_PER_LB;
}

export function formatHeight(cm: number, units: Units): string {
  if (units === "imperial") {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}′${inches}″`;
  }
  return `${Math.round(cm)} cm`;
}

export function formatWeight(kg: number, units: Units): string {
  if (units === "imperial") {
    return `${Math.round(kgToLbs(kg))} lb`;
  }
  return `${Math.round(kg * 10) / 10} kg`;
}
