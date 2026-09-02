import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useSiteBranding } from "@/lib/site-branding";
import { supabase } from "@/integrations/supabase/client";
import { setPrintBrand } from "@/lib/print";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Pill, LogOut, LayoutGrid, Package, Calculator, Truck, Globe, UserCog, MessageSquare, Briefcase, Tags, Image as ImageIcon,
} from "lucide-react";
import { allowedModules, type ModuleKey } from "@/lib/access";
import { type ReactNode, useEffect, useState } from "react";


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
  { to: "/pharm-branding", label: "Pharm Branding", icon: <ImageIcon className="h-5 w-5" />, tone: "bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100", module: "pharm_branding" },
];

export function AppShell({
  title,
  subtitle,
  children,
}: { title: string; subtitle?: string; nav?: NavItem[]; children: ReactNode }) {
  const { profile, signOut, loading } = useAuth();
  const branding = useSiteBranding();
  const navigate = useNavigate();
  const [pharmName, setPharmName] = useState<string | null>(null);
  const [pharmLogo, setPharmLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) navigate({ to: "/auth" });
  }, [loading, profile, navigate]);

  // Brand every printed / downloaded PDF: logo left, pharmacy details right, QR at the bottom.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let name = branding.name;
      let logoUrl: string | null = branding.logoUrl ?? null;
      const lines: string[] = [];
      if (profile?.pharmacy_id) {
        const { data } = await supabase
          .from("pharmacies")
          .select("name, phone, email, address, postal_address, location, logo_path")
          .eq("id", profile.pharmacy_id)
          .maybeSingle();
        if (data) {
          name = data.name || name;
          if (data.postal_address) lines.push(`P.O. Box ${data.postal_address}`);
          if (data.address) lines.push(data.address);
          if (data.location) lines.push(data.location);
          if (data.phone) lines.push(`Tel: ${data.phone}`);
          if (data.email) lines.push(data.email);
          if (data.logo_path) {
            const { data: signed } = await supabase.storage
              .from("pharmacy-logos")
              .createSignedUrl(data.logo_path, 3600);
            if (signed?.signedUrl) {
              logoUrl = signed.signedUrl;
              // Inline the logo so it survives inside printed / scan-to-download copies.
              try {
                const blob = await (await fetch(signed.signedUrl)).blob();
                logoUrl = await new Promise<string>((resolve, reject) => {
                  const fr = new FileReader();
                  fr.onload = () => resolve(String(fr.result));
                  fr.onerror = reject;
                  fr.readAsDataURL(blob);
                });
              } catch { /* keep the signed url */ }
            }
          }
        }
      }
      if (!cancelled) {
        setPharmName(name || null);
        setPharmLogo(logoUrl);
        setPrintBrand({ name, logoUrl, lines, pharmacyId: profile?.pharmacy_id ?? null });
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.pharmacy_id, branding.name, branding.logoUrl]);


  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const mods = allowedModules(profile);

  const tileClass = (tone: string) =>
    `flex items-center gap-3 rounded-xl border px-5 py-3 text-base font-bold shadow-sm transition hover:-translate-y-0.5 data-[status=active]:ring-2 data-[status=active]:ring-primary/40 ${tone}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-blue-50/60 to-white">
      <header className="bg-gradient-to-r from-sky-50 via-white to-blue-50 border-b border-sky-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/pharmacy" className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center overflow-hidden">
              {(pharmLogo || branding.logoUrl) ? (
                <img src={pharmLogo || branding.logoUrl!} alt={pharmName ?? branding.name} className="h-full w-full object-cover" />
              ) : (
                <Pill className="h-6 w-6" />
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight uppercase truncate">
              {(() => {
                const full = (pharmName ?? "LEMSA PMS").trim();
                const [first, ...rest] = full.split(/\s+/);
                return (
                  <>
                    <span className="text-primary">{first}</span>
                    {rest.length > 0 && <> <span className="text-emerald-600">{rest.join(" ")}</span></>}
                  </>
                );
              })()}
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
            {TILES.map((t) => {
              const allowed = mods.includes(t.module);
              if (allowed) {
                return (
                  <Link key={t.to} to={t.to} className={tileClass(t.tone)}>
                    {t.icon}
                    <span className="whitespace-nowrap">{t.label}</span>
                  </Link>
                );
              }
              return (
                <button
                  key={t.to}
                  type="button"
                  onClick={() =>
                    toast.error("You do not have permission to access this page", {
                      className: "!bg-destructive !text-destructive-foreground !border-destructive",
                    })
                  }
                  className={`${tileClass(t.tone)} opacity-70`}
                >
                  {t.icon}
                  <span className="whitespace-nowrap">{t.label}</span>
                </button>
              );
            })}
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
