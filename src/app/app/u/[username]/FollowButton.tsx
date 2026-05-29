"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { followUser, unfollowUser } from "../../social/actions";
import type { Relationship } from "@/lib/social";

/**
 * Renders the right CTA for the viewer's current relationship and posts the
 * follow/unfollow server action on click. Local state mirrors the relationship
 * so the button reflects the action immediately; we router.refresh() so the
 * counts in the header re-fetch.
 */
export default function FollowButton({
  targetId,
  privacy,
  initialRelationship,
}: {
  targetId: string;
  privacy: "public" | "private";
  initialRelationship: Relationship;
}) {
  const router = useRouter();
  const [rel, setRel] = useState<Relationship>(initialRelationship);
  const [pending, startTransition] = useTransition();

  if (rel === "self" || rel === "blocked_by_me") return null;

  const onClick = () => {
    startTransition(async () => {
      if (rel === "none") {
        const result = await followUser(targetId);
        if (result.ok) {
          setRel(result.status === "accepted" ? "following" : "requested");
          router.refresh();
        }
      } else {
        const result = await unfollowUser(targetId);
        if (result.ok) {
          setRel("none");
          router.refresh();
        }
      }
    });
  };

  // none → "Follow" or "Request" depending on the target's privacy.
  // requested → "Requested" (clickable to cancel).
  // following → "Following" (clickable to unfollow).
  const label =
    rel === "none"
      ? privacy === "public"
        ? "Follow"
        : "Request follow"
      : rel === "requested"
        ? "Requested"
        : "Following";

  return (
    <Button
      className="flex-1"
      variant={rel === "none" ? "primary" : "ghost"}
      disabled={pending}
      onClick={onClick}
    >
      {pending ? "…" : label}
    </Button>
  );
}
