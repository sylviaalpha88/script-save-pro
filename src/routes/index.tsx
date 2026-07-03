import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSiteBranding } from "@/lib/site-branding";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Pill } from "lucide-react";
import heroImg from "@/assets/pharmacy-hero.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

type Section = { section: string; title: string; body: string; image_url: string | null };

const ORDER = ["home", "about", "services", "vacancy", "contacts"];
const LABELS: Record<string, string> = {
  home: "Home",
  about: "About Us",
  services: "Services",
  vacancy: "Vacancy",
  contacts: "Contacts Us",
};

function Index() {
  const { loading, profile } = useAuth();
  const branding = useSiteBranding();
  const navigate = useNavigate();
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    supabase.from("site_content").select("section, title, body, image_url").then(({ data }) => {
      const map = new Map((data ?? []).map((r: any) => [r.section, r as Section]));
      setSections(ORDER.map(k => map.get(k) ?? { section: k, title: LABELS[k], body: "", image_url: null }));
    });
  }, []);

  useEffect(() => {
    if (loading) return;
    if (profile) {
      if (profile.is_director) navigate({ to: "/director" });
      else if (profile.role === "admin") navigate({ to: "/admin" });
      else if (profile.role === "inventory") navigate({ to: "/inventory" });
      else if (profile.role === "accountant") navigate({ to: "/accountant" });
      else if (profile.role === "buyer") navigate({ to: "/buyer" });
      else navigate({ to: "/pharmacy" });
    }
  }, [loading, profile, navigate]);

  if (loading || profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">{branding.name}</h1>
          <p className="mt-3 text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div id="home" className="relative min-h-screen">
        <img src={sections.find(s => s.section === "home")?.image_url || heroImg} alt="Pharmacist attending to a client at the pharmacy counter" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center overflow-hidden">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.name} className="h-full w-full object-cover" />
              ) : (
                <Pill className="h-5 w-5" />
              )}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-white">{branding.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/70">{branding.tagline}</div>
            </div>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2 text-white text-xs sm:text-sm">
            {ORDER.map(id => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="px-2 sm:px-3 py-1.5 rounded-md hover:bg-white/15 uppercase tracking-wide font-medium"
              >
                {LABELS[id]}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="outline" size="sm" className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white">
                Login
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight drop-shadow-lg">
            {sections.find(s => s.section === "home")?.title || "LEMSA Pharmacy"}
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-white/90 max-w-2xl drop-shadow-md">
            {sections.find(s => s.section === "home")?.body || "Comprehensive management system for inventory, sales, and pharmacy operations."}
          </p>
          <div className="mt-8 flex gap-4">
            <Link to="/auth"><Button size="lg" className="px-8">Sign In</Button></Link>
          </div>
        </div>
      </div>

      {/* Editable sections */}
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-16">
        {sections.filter(s => s.section !== "home").map(s => (
          <section key={s.section} id={s.section} className="grid md:grid-cols-2 gap-8 items-center scroll-mt-20">
            {s.image_url ? (
              <img src={s.image_url} alt={s.title} className="w-full rounded-lg shadow-md object-cover max-h-80" />
            ) : (
              <div className="w-full h-60 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                No image yet
              </div>
            )}
            <div>
              <h2 className="text-3xl font-bold tracking-tight">{s.title || LABELS[s.section]}</h2>
              <p className="mt-4 text-muted-foreground whitespace-pre-wrap">{s.body}</p>
            </div>
          </section>
        ))}
      </div>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} LEMSA Pharmacy
      </footer>
    </div>
  );
}
