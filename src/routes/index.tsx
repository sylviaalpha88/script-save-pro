import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!profile) { navigate({ to: "/auth" }); return; }
    if (profile.role === "admin") navigate({ to: "/admin" });
    else if (profile.role === "inventory") navigate({ to: "/inventory" });
    else navigate({ to: "/pharmacy" });
  }, [loading, profile, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">LEMSA Pharmacy Management System</h1>
        <p className="mt-3 text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
