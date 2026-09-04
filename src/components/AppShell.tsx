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

type Tile = { to: string; label: string; icon: ReactNode; tone: string; text: string; module: ModuleKey };

const TILES: Tile[] = [
  { to: "/admin", label: "Dashboard", icon: <LayoutGrid className="h-6 w-6" />, tone: "bg-violet-50/70 border-violet-100 hover:bg-violet-100", text: "text-violet-700", module: "admin" },
  { to: "/pharmacy", label: "Pharmacy", icon: <Pill className="h-6 w-6" />, tone: "bg-emerald-50/70 border-emerald-100 hover:bg-emerald-100", text: "text-emerald-700", module: "pharmacy" },
  { to: "/procurement", label: "Procurement", icon: <Package className="h-6 w-6" />, tone: "bg-amber-50/70 border-amber-100 hover:bg-amber-100", text: "text-amber-700", module: "procurement" },
  { to: "/accountant", label: "Accountant", icon: <Calculator className="h-6 w-6" />, tone: "bg-rose-50/70 border-rose-100 hover:bg-rose-100", text: "text-rose-700", module: "accountant" },
  { to: "/order-track", label: "Order Track", icon: <Truck className="h-6 w-6" />, tone: "bg-sky-50/70 border-sky-100 hover:bg-sky-100", text: "text-sky-700", module: "order_track" },
  { to: "/public-site", label: "Public Site", icon: <Globe className="h-6 w-6" />, tone: "bg-indigo-50/70 border-indigo-100 hover:bg-indigo-100", text: "text-indigo-700", module: "public_site" },
  { to: "/director", label: "Admin Settings", icon: <UserCog className="h-6 w-6" />, tone: "bg-blue-50/70 border-blue-100 hover:bg-blue-100", text: "text-blue-700", module: "admin_settings" },
  { to: "/messages", label: "Messages", icon: <MessageSquare className="h-6 w-6" />, tone: "bg-teal-50/70 border-teal-100 hover:bg-teal-100", text: "text-teal-700", module: "messages" },
  { to: "/vacancy", label: "Vacancy", icon: <Briefcase className="h-6 w-6" />, tone: "bg-fuchsia-50/70 border-fuchsia-100 hover:bg-fuchsia-100", text: "text-fuchsia-700", module: "vacancy" },
  { to: "/inventory", label: "Service Stock", icon: <Tags className="h-6 w-6" />, tone: "bg-lime-50/70 border-lime-100 hover:bg-lime-100", text: "text-lime-700", module: "service_stock" },
  { to: "/pharm-branding", label: "Pharm Branding", icon: <ImageIcon className="h-6 w-6" />, tone: "bg-orange-50/70 border-orange-100 hover:bg-orange-100", text: "text-rose-600", module: "pharm_branding" },
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

  const denied = () =>
    toast.error("You do not have permission to access this page", {
      className: "!bg-destructive !text-destructive-foreground !border-destructive",
    });

  const tileClass = (tone: string) =>
    `flex flex-col items-center justify-center gap-2 rounded-2xl border px-4 py-5 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 ${tone}`;

  const sideClass = (active: boolean, text: string) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${text} ${
      active ? "bg-muted" : "hover:bg-muted/60"
    }`;

  const SideItem = ({ t }: { t: Tile }) => {
    const active = currentPath === t.to;
    const inner = (
      <>
        <span className="shrink-0">{t.icon}</span>
        <span className="truncate">{t.label}</span>
      </>
    );
    return mods.includes(t.module) ? (
      <Link to={t.to} className={sideClass(active, t.text)}>{inner}</Link>
    ) : (
      <button type="button" onClick={denied} className={`${sideClass(active, t.text)} opacity-60`}>{inner}</button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-blue-50/50 to-white">
      <header className="bg-white/90 backdrop-blur border-b border-sky-100 sticky top-0 z-30">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
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
              <div className="text-sm font-bold uppercase">{profile.username}</div>
              <div className="text-xs text-muted-foreground capitalize">{profile.role}</div>
            </div>
            <Button variant="outline" size="icon" aria-label="Sign out" className="border-sky-200 bg-white"
              onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:block w-60 shrink-0 border-r border-sky-100 bg-white/70 min-h-[calc(100vh-77px)] p-3 sticky top-[77px] self-start">
          <nav className="space-y-1">
            {TILES.slice(0, 7).map((t) => <SideItem key={t.to} t={t} />)}
          </nav>
          <div className="my-3 border-t border-sky-100" />
          <nav className="space-y-1">
            {TILES.slice(7).map((t) => <SideItem key={t.to} t={t} />)}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <nav className="border-b border-sky-100 bg-white/60 px-4 sm:px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
              {TILES.map((t) =>
                mods.includes(t.module) ? (
                  <Link key={t.to} to={t.to} className={`${tileClass(t.tone)} ${t.text}`}>
                    {t.icon}
                    <span className="text-center">{t.label}</span>
                  </Link>
                ) : (
                  <button key={t.to} type="button" onClick={denied} className={`${tileClass(t.tone)} ${t.text} opacity-70`}>
                    {t.icon}
                    <span className="text-center">{t.label}</span>
                  </button>
                ),
              )}
            </div>
          </nav>

          <main className="p-4 sm:p-6">
            <h1 className="text-3xl font-extrabold tracking-tight text-primary">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );


}
