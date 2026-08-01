import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useSiteBranding } from "@/lib/site-branding";
import { Button } from "@/components/ui/button";
import {
  Pill, LogOut, Home, LayoutGrid, Package, Calculator, Truck, Globe, UserCog,
} from "lucide-react";
import { type ReactNode, useEffect } from "react";

interface NavItem { to: string; label: string; }

type Tile = { to: string; label: string; icon: ReactNode; show: (p: { role: string; can_edit_site?: boolean | null }) => boolean };

const TILES: Tile[] = [
  { to: "/home", label: "Home", icon: <Home className="h-5 w-5" />, show: () => true },
  { to: "/admin", label: "Dashboard", icon: <LayoutGrid className="h-5 w-5" />, show: () => true },
  { to: "/pharmacy", label: "Pharmacy", icon: <Pill className="h-5 w-5" />, show: () => true },
  { to: "/inventory", label: "Inventory", icon: <Package className="h-5 w-5" />, show: () => true },
  { to: "/accountant", label: "Accountant", icon: <Calculator className="h-5 w-5" />, show: () => true },
  { to: "/order-track", label: "Order Track", icon: <Truck className="h-5 w-5" />, show: () => true },
  { to: "/", label: "Public Site", icon: <Globe className="h-5 w-5" />, show: () => true },
  { to: "/director", label: "Admin Settings", icon: <UserCog className="h-5 w-5" />, show: (p) => !!p.can_edit_site },
];

export function AppShell({
  title,
  subtitle,
  children,
}: { title: string; subtitle?: string; nav?: NavItem[]; children: ReactNode }) {
  const { profile, signOut, loading } = useAuth();
  const branding = useSiteBranding();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !profile) navigate({ to: "/auth" });
  }, [loading, profile, navigate]);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const words = branding.name.trim().split(/\s+/);
  const first = words[0] ?? branding.name;
  const rest = words.slice(1).join(" ");
  const tiles = TILES.filter((t) => t.show(profile as never));

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/home" className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center overflow-hidden">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.name} className="h-full w-full object-cover" />
              ) : (
                <Pill className="h-6 w-6" />
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight uppercase truncate">
              <span className="text-primary">{first}</span>
              {rest && <> <span className="text-emerald-600">{rest}</span></>}
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{profile.username}</div>
              <div className="text-xs text-muted-foreground capitalize">{profile.role}</div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Sign out"
              onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <nav className="border-t bg-background/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-3">
            {tiles.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: t.to === "/" }}
                className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-base font-bold shadow-sm transition hover:bg-accent hover:-translate-y-0.5 data-[status=active]:border-primary data-[status=active]:text-primary"
              >
                {t.icon}
                <span className="whitespace-nowrap">{t.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
