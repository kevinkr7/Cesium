import { toast } from "sonner";
import { setDemo, useDemo } from "@/lib/store";
import { joinCommunityMembership, leaveCommunityMembership } from "@/services/communities";

export function JoinButton({ id }: { id: string }) {
  const { joined, session } = useDemo();
  const on = joined.includes(id);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newJoined = on ? joined.filter((x) => x !== id) : [...joined, id];
    setDemo({ joined: newJoined });

    if (session?.id && !session.demo) {
      if (on) {
        await leaveCommunityMembership(id, session.id);
      } else {
        await joinCommunityMembership(id, session.id);
      }
    }

    toast(on ? "Left community" : "Joined community ✓");
  };

  return (
    <button
      onClick={toggle}
      className={on ? "btn-ghost !py-2 text-sm text-signal" : "btn-ghost !py-2 text-sm"}
      aria-pressed={on}
    >
      {on ? "Joined ✓" : "Join"}
    </button>
  );
}
