import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/home")({
  component: HomeRedirect,
});

function landingFor(role: string, isDirector: boolean): string {
  if (isDirector) return "/director";
  switch (role) {
    case "buyer": return "/buyer";
    case "pharmacy": return "/pharmacy";
    case "inventory": return "/inventory";
    case "accountant": return "/accountant";
    case "order_track": return "/order-track";
    default: return "/admin";
  }
}

function HomeRedirect() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!profile) { navigate({ to: "/auth", replace: true }); return; }
    navigate({ to: landingFor(profile.role, profile.is_director), replace: true });
  }, [loading, profile, navigate]);

  return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
}
