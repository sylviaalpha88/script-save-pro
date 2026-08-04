import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useSiteBranding } from "@/lib/site-branding";
import { Button } from "@/components/ui/button";
import {
  Pill, LogOut, LayoutGrid, Package, Calculator, Truck, Globe, UserCog, MessageSquare, Briefcase,
} from "lucide-react";
import { allowedModules, type ModuleKey } from "@/lib/access";
import { type ReactNode, useEffect } from "react";

interface NavItem { to: string; label: string; }

type Tile = { to: string; label: string; icon: ReactNode; tone: string; module: ModuleKey };

const TILES: Tile[] = [
  { to: "/admin", label: "Dashboard", icon: <LayoutGrid className="h-5 w-5" />, tone: "bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100", module: "admin" },
  { to: "/pharmacy", label: "Pharmacy", icon: <Pill className="h-5 w-5" />, tone: "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100", module: "pharmacy" },
  { to: "/procurement", label: "Procurement", icon: <Package className="h-5 w-5" />, tone: "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100", module: "procurement" },
  { to: "/accountant", label: "Accountant", icon: <Calculator className="h-5 w-5" />, tone: "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100", module: "accountant" },
  { to: "/order-track", label: "Order Track", icon: <Truck className="h-5 w-5" />, tone: "bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100", module: "order_track" },
  { to: "/public-site", label: "Public Site", icon: <Globe className="h-5 w-5" />, tone: "bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100", module: "public_site" },
  { to: "/director", label: "Admin Settings", icon: <UserCog className="h-5 w-5" />, tone: "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100", module: "admin_settings" },
  { to: "/messages", label: "Messages", icon: <MessageSquare className="h-5 w-5" />, tone: "bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100", module: "messages" },
  { to: "/vacancy", label: "Vacancy", icon: <Briefcase className="h-5 w-5" />, tone: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100 hover:bg-fuchsia-100", module: "vacancy" },
  { to: "/inventory", label: "Service Stock", icon: <Tags className="h-5 w-5" />, tone: "bg-lime-50 text-lime-700 border-lime-100 hover:bg-lime-100", module: "service_stock" },
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

  const mods = allowedModules(profile);
  const tiles = TILES.filter((t) => mods.includes(t.module));

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-blue-50/60 to-white">
      <header className="bg-gradient-to-r from-sky-50 via-white to-blue-50 border-b border-sky-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/pharmacy" className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center overflow-hidden">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.name} className="h-full w-full object-cover" />
              ) : (
                <Pill className="h-6 w-6" />
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight uppercase truncate">
              <span className="text-primary">LEMSA</span> <span className="text-emerald-600">PMS</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{profile.username}</div>
              <div className="text-xs text-muted-foreground capitalize">{profile.role}</div>
            </div>
            <Button variant="outline" size="icon" aria-label="Sign out" className="border-sky-200 bg-white"
              onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <nav className="border-t border-sky-100 bg-white/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-3">
            {tiles.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center gap-3 rounded-xl border px-5 py-3 text-base font-bold shadow-sm transition hover:-translate-y-0.5 data-[status=active]:ring-2 data-[status=active]:ring-primary/40 ${t.tone}`}
              >
                {t.icon}
                <span className="whitespace-nowrap">{t.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );

}
