// Weekdays as stored in routine_days.day_of_week: 0 = Monday … 6 = Sunday.
export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 0, label: "Monday", short: "Mon" },
  { value: 1, label: "Tuesday", short: "Tue" },
  { value: 2, label: "Wednesday", short: "Wed" },
  { value: 3, label: "Thursday", short: "Thu" },
  { value: 4, label: "Friday", short: "Fri" },
  { value: 5, label: "Saturday", short: "Sat" },
  { value: 6, label: "Sunday", short: "Sun" },
];

export function weekdayLabel(value: number): string {
  return WEEKDAYS.find((d) => d.value === value)?.label ?? "—";
}

/** Today's weekday in the 0=Monday convention, for the given timezone. */
export function todayWeekday(timezone: string): number {
  // Intl gives 0=Sunday..6=Saturday; shift so Monday=0.
  const sunday0 = new Date(
    new Date().toLocaleString("en-US", { timeZone: timezone }),
  ).getDay();
  return (sunday0 + 6) % 7;
}
