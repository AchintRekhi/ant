"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, FormError, inputClasses } from "@/components/ui";
import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/exercises";
import { createCustomExercise, deleteCustomExercise } from "./actions";

export type ExerciseRow = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  isCustom: boolean;
};

export default function ExercisesClient({
  exercises,
}: {
  exercises: ExerciseRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MuscleGroup | "all">("all");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  // New-exercise form.
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<MuscleGroup>("chest");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (filter === "all" || e.muscleGroup === filter) &&
        (q === "" || e.name.toLowerCase().includes(q)),
    );
  }, [exercises, query, filter]);

  // Group the filtered list by muscle group, in display order.
  const grouped = useMemo(() => {
    return MUSCLE_GROUPS.map((g) => ({
      group: g.value,
      label: g.label,
      items: filtered.filter((e) => e.muscleGroup === g.value),
    })).filter((s) => s.items.length > 0);
  }, [filtered]);

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await createCustomExercise({ name: newName, muscleGroup: newGroup });
      if (result.error) setError(result.error);
      else {
        setNewName("");
        setAdding(false);
        router.refresh();
      }
    });
  };

  const remove = (id: string) => {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteCustomExercise(id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="mt-6 flex flex-col gap-5">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises…"
        className={inputClasses}
      />

      {/* Muscle group filter */}
      <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterChip>
        {MUSCLE_GROUPS.map((g) => (
          <FilterChip
            key={g.value}
            active={filter === g.value}
            onClick={() => setFilter(g.value)}
          >
            {g.label}
          </FilterChip>
        ))}
      </div>

      {/* Add custom */}
      {adding ? (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Exercise name"
            className={inputClasses}
          />
          <select
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value as MuscleGroup)}
            className={inputClasses}
          >
            {MUSCLE_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setAdding(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || newName.trim().length < 2} className="flex-1">
              {pending ? "Adding…" : "Add exercise"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setAdding(true)}>
          + Add custom exercise
        </Button>
      )}

      <FormError message={error} />

      {/* Grouped list */}
      {grouped.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">No exercises match.</p>
      ) : (
        grouped.map((section) => (
          <div key={section.group}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {section.label}
            </h2>
            <ul className="divide-y divide-zinc-200 border-y border-zinc-200">
              {section.items.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium">{e.name}</span>
                  {e.isCustom && (
                    <span className="flex items-center gap-3">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                        Custom
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(e.id)}
                        disabled={pending}
                        className="text-zinc-400 underline hover:text-black disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition ${
        active ? "border-black bg-black text-white" : "border-zinc-300 hover:border-black"
      }`}
    >
      {children}
    </button>
  );
}
