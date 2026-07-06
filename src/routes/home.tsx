import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSiteBranding } from "@/lib/site-branding";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pill, Store, Package, Calculator, Truck, Globe, LogOut, ArrowRight } from "lucide-react";
import type { Role } from "@/lib/auth-context";

export const Route = createFileRoute("/home")({
  component: HomeHub,
});

type Tile = {
  key: string;
  label: string;
  tagline: string;
  to: string;
  color: string; // tailwind text color class for icon + label
  bg: string;    // tailwind bg color class for icon circle
  icon: React.ReactNode;
  allow: (r: Role | string, isDirector: boolean) => boolean;
};

const TILES: Tile[] = [
  {
    key: "pharmacy", label: "PHARMACY", tagline: "Manage medicine sales and pharmacy operations",
    to: "/pharmacy", color: "text-emerald-600", bg: "bg-emerald-100",
    icon: <Store className="h-10 w-10 text-emerald-600" />,
    allow: (r, d) => d || r === "admin" || r === "pharmacy",
  },
  {
    key: "inventory", label: "INVENTORY", tagline: "Track stock, manage inventory and supplies",
    to: "/inventory", color: "text-sky-600", bg: "bg-sky-100",
    icon: <Package className="h-10 w-10 text-sky-600" />,
    allow: (r, d) => d || r === "admin" || r === "inventory",
  },
  {
    key: "accountant", label: "ACCOUNTANT", tagline: "Handle accounts, expenses and financial reports",
    to: "/accountant", color: "text-purple-600", bg: "bg-purple-100",
    icon: <Calculator className="h-10 w-10 text-purple-600" />,
    allow: (r, d) => d || r === "admin" || r === "accountant",
  },
  {
    key: "order-track", label: "ORDER TRACK", tagline: "Track orders and delivery status",
    to: "/order-track", color: "text-orange-500", bg: "bg-orange-100",
    icon: <Truck className="h-10 w-10 text-orange-500" />,
    allow: (r, d) => d || r === "admin" || r === "order_track",
  },
  {
    key: "public", label: "PUBLIC SITE", tagline: "Visit our website and discover more",
    to: "/", color: "text-teal-600", bg: "bg-teal-100",
    icon: <Globe className="h-10 w-10 text-teal-600" />,
    allow: () => true,
  },
];

function HomeHub() {
  const { profile, loading, signOut } = useAuth();
  const branding = useSiteBranding();
  const navigate = useNavigate();
  const [denied, setDenied] = useState<string | null>(null);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!profile) { navigate({ to: "/auth" }); return null; }

  // Buyer role has its own dedicated portal — send them there.
  if (profile.role === "buyer") { navigate({ to: "/buyer" }); return null; }
  // Director gets director dashboard as extra "home" via top button.

  const go = (t: Tile) => {
    if (!t.allow(profile.role, profile.is_director)) {
      setDenied(t.label);
      return;
    }
    navigate({ to: t.to });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-sky-50 to-white">
      {/* Top bar */}
      <header className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-11 w-11 rounded-lg bg-white shadow-sm flex items-center justify-center overflow-hidden border">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.name} className="h-full w-full object-cover" />
            ) : (
              <Pill className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold">{branding.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{branding.tagline}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {profile.is_director && (
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/director" })}>Director</Button>
          )}
          {profile.role === "admin" && !profile.is_director && (
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/admin" })}>Admin</Button>
          )}
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium">{profile.username}</div>
            <div className="text-xs text-muted-foreground capitalize">{profile.is_director ? "director" : profile.role}</div>
          </div>
          <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 pt-6 pb-10 text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="h-16 w-16 rounded-2xl bg-white shadow flex items-center justify-center overflow-hidden border">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.name} className="h-full w-full object-cover" />
            ) : (
              <Pill className="h-9 w-9 text-primary" />
            )}
          </div>
          <div className="text-left">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none">
              <span className="text-sky-600">{branding.name.split(" ")[0] ?? branding.name}</span>{" "}
              <span className="text-emerald-600">{branding.name.split(" ").slice(1).join(" ")}</span>
            </div>
            <div className="text-xs sm:text-sm tracking-[0.3em] text-slate-600 mt-1">MANAGEMENT SYSTEM</div>
          </div>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-6">
          Welcome to {branding.name.toUpperCase()} MANAGEMENT SYSTEM
        </h1>
        <div className="flex items-center justify-center gap-2 my-3">
          <span className="h-px w-24 bg-slate-300"></span>
          <span className="h-2 w-2 rounded-full bg-slate-400"></span>
          <span className="h-px w-24 bg-slate-300"></span>
        </div>
        <p className="text-slate-600">{branding.tagline}</p>
      </section>

      {/* Tiles */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div className="bg-white/80 backdrop-blur rounded-2xl border shadow-sm p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {TILES.map(t => {
              const permitted = t.allow(profile.role, profile.is_director);
              return (
                <Card
                  key={t.key}
                  onClick={() => go(t)}
                  className={`cursor-pointer transition hover:shadow-lg hover:-translate-y-0.5 border ${permitted ? "" : "opacity-90"}`}
                >
                  <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                    <div className={`h-20 w-20 rounded-full ${t.bg} flex items-center justify-center`}>
                      {t.icon}
                    </div>
                    <div>
                      <div className={`font-bold tracking-wider ${t.color}`}>{t.label}</div>
                      <div className="text-xs text-slate-600 mt-1 leading-relaxed max-w-[16ch] mx-auto">
                        {t.tagline}
                      </div>
                    </div>
                    <div className={`h-9 w-9 rounded-full border-2 flex items-center justify-center ${t.color.replace("text-", "border-")}`}>
                      <ArrowRight className={`h-4 w-4 ${t.color}`} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <AlertDialog open={!!denied} onOpenChange={(o) => !o && setDenied(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive text-xl">Access denied</AlertDialogTitle>
            <AlertDialogDescription className="text-destructive font-semibold">
              You don't have permission to access this page{denied ? ` (${denied})` : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
