"use client";

import { useState, useTransition } from "react";
import { Button, FormError, inputClasses } from "@/components/ui";
import { createRoutine } from "./actions";

export default function NewRoutine() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      // On success this redirects to the new routine's editor.
      const result = await createRoutine(name);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New routine name (e.g. Push Pull Legs)"
          className={inputClasses}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) submit();
          }}
        />
        <Button onClick={submit} disabled={pending || !name.trim()}>
          {pending ? "…" : "Create"}
        </Button>
      </div>
      <FormError message={error} />
    </div>
  );
}
