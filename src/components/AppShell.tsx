import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useSiteBranding } from "@/lib/site-branding";
import { Button } from "@/components/ui/button";
import { Pill, LogOut } from "lucide-react";
import { type ReactNode, useEffect } from "react";

interface NavItem { to: string; label: string; }

export function AppShell({ title, nav, children }: { title: string; nav: NavItem[]; children: ReactNode }) {
  const { profile, signOut, loading } = useAuth();
  const branding = useSiteBranding();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !profile) navigate({ to: "/auth" });
  }, [loading, profile, navigate]);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center overflow-hidden">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.name} className="h-full w-full object-cover" />
              ) : (
                <Pill className="h-5 w-5" />
              )}
            </div>
            <div className="text-sm font-bold whitespace-nowrap">{branding.name} — {branding.tagline}</div>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => {
              const active = pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{profile.username}</div>
              <div className="text-xs text-muted-foreground capitalize">{profile.role}</div>
            </div>
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="md:hidden border-t bg-card overflow-x-auto">
          <div className="flex gap-1 px-2 py-1">
            {nav.map((n) => {
              const active = pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
              return (
                <Link key={n.to} to={n.to} className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold mb-6">{title}</h1>
        {children}
      </main>
    </div>
  );
}
