"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { blockUser, unblockUser } from "../../social/actions";

/**
 * Block / unblock toggle. Confirms before blocking because it severs any
 * existing follow relationship in both directions.
 */
export default function BlockButton({
  targetId,
  blocked,
}: {
  targetId: string;
  blocked: boolean;
}) {
  const router = useRouter();
  const [isBlocked, setIsBlocked] = useState(blocked);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!isBlocked && !confirm("Block this user? Existing follows will be removed.")) {
      return;
    }
    startTransition(async () => {
      const result = isBlocked ? await unblockUser(targetId) : await blockUser(targetId);
      if (result.ok) {
        setIsBlocked(!isBlocked);
        router.refresh();
      }
    });
  };

  return (
    <Button variant="ghost" disabled={pending} onClick={onClick}>
      {pending ? "…" : isBlocked ? "Unblock" : "Block"}
    </Button>
  );
}
