import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { useDemo } from "@/lib/store";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useDemo();
  const nav = useNavigate();

  useEffect(() => {
    if (!session) {
      toast.info("Please sign in to access Cesium.");
      nav({ to: "/login" });
    }
  }, [session, nav]);

  if (!session) {
    return (
      <div className="gutter flex min-h-[100svh] items-center justify-center pt-32">
        <p className="label-mono text-muted-foreground">Redirecting to sign in…</p>
      </div>
    );
  }

  return <>{children}</>;
}
