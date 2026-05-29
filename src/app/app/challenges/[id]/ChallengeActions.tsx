"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, FormError } from "@/components/ui";
import {
  deleteChallenge,
  finalizeChallenge,
  inviteFollower,
  joinChallenge,
} from "../actions";
import { leaveChallenge } from "./leave-action";

export type InviteOption = {
  id: string;
  username: string;
  displayName: string | null;
};

/**
 * One client island for every challenge mutation: join, leave, invite a
 * follower, finalize early, delete. The page is otherwise a server component,
 * so this keeps interactivity scoped to where it's needed.
 */
export default function ChallengeActions({
  challengeId,
  canJoin,
  canLeave,
  canFinalize,
  canDelete,
  inviteOptions,
}: {
  challengeId: string;
  canJoin: boolean;
  canLeave: boolean;
  canFinalize: boolean;
  canDelete: boolean;
  inviteOptions: InviteOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error?: string; ok?: boolean }>) =>
    startTransition(async () => {
      setError(undefined);
      const result = await fn();
      if (result.error) setError(result.error);
      else router.refresh();
    });

  return (
    <div className="mt-4 flex flex-col gap-3">
      <FormError message={error} />

      <div className="flex flex-wrap gap-2">
        {canJoin && (
          <Button onClick={() => run(() => joinChallenge(challengeId))} disabled={pending}>
            {pending ? "Joining…" : "Join challenge"}
          </Button>
        )}
        {canLeave && (
          <Button
            variant="ghost"
            onClick={() => {
              if (!confirm("Leave this challenge?")) return;
              run(() => leaveChallenge(challengeId));
            }}
            disabled={pending}
          >
            Leave
          </Button>
        )}
        {canFinalize && (
          <Button
            variant="ghost"
            onClick={() => run(() => finalizeChallenge(challengeId))}
            disabled={pending}
          >
            Finalize scores
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            onClick={() => {
              if (!confirm("Delete this challenge? Participants lose their progress.")) return;
              run(() => deleteChallenge(challengeId));
            }}
            disabled={pending}
          >
            Delete
          </Button>
        )}
      </div>

      {inviteOptions.length > 0 && (
        <InvitePicker
          options={inviteOptions}
          pending={pending}
          onInvite={(uid) => run(() => inviteFollower(challengeId, uid))}
        />
      )}
    </div>
  );
}

function InvitePicker({
  options,
  pending,
  onInvite,
}: {
  options: InviteOption[];
  pending: boolean;
  onInvite: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-zinc-500 underline hover:text-black"
      >
        {open ? "Hide invite list" : `Invite from your followers (${options.length})`}
      </button>
      {open && (
        <ul className="mt-2 flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200">
          {options.map((o) => (
            <li key={o.id} className="flex items-center justify-between px-3 py-2">
              <span className="text-sm">
                @{o.username}
                {o.displayName && (
                  <span className="ml-2 text-xs text-zinc-500">{o.displayName}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onInvite(o.id)}
                disabled={pending}
                className="rounded-full bg-black px-3 py-1 text-xs text-white hover:bg-zinc-800 disabled:opacity-40"
              >
                Invite
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
