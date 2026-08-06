import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSiteBranding } from "@/lib/site-branding";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Pill, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import heroImg from "@/assets/pharmacy-hero.jpg";
import { VacancySection } from "@/components/VacancySection";

export const Route = createFileRoute("/")({
  component: Index,
});

type Section = { section: string; title: string; body: string; image_url: string | null; images: string[] };
type DownloadRow = { id: string; title: string; file_path: string; created_at: string };

const ORDER = ["home", "about", "services", "vacancy", "contacts", "downloads"];
const LABELS: Record<string, string> = {
  home: "Home",
  about: "About Us",
  services: "Services",
  vacancy: "Vacancy",
  contacts: "Contacts Us",
  downloads: "Downloads",
};

function Index() {
  const { loading, profile } = useAuth();
  const branding = useSiteBranding();
  const navigate = useNavigate();
  const [sections, setSections] = useState<Section[]>([]);
  const [downloads, setDownloads] = useState<DownloadRow[]>([]);
  const [active, setActive] = useState("home");
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    supabase.from("site_content").select("section, title, body, image_url, images").then(({ data }) => {
      const map = new Map((data ?? []).map((r: any) => [r.section, { ...r, images: (r.images as string[]) ?? [] } as Section]));
      setSections(ORDER.map(k => map.get(k) ?? { section: k, title: LABELS[k], body: "", image_url: null, images: [] }));
    });
    supabase.from("site_downloads").select("id, title, file_path, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setDownloads((data as DownloadRow[]) ?? []));
  }, []);

  const home = sections.find(s => s.section === "home");
  const slides = (home?.images ?? []).filter(Boolean);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setSlide(p => (p + 1) % slides.length), 4000);
    return () => clearInterval(t);
  }, [slides.length]);

  useEffect(() => {
    if (loading) return;
    if (profile) {
      if (profile.role === "buyer") navigate({ to: "/buyer" });
      else navigate({ to: "/home" });
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

  const openDownload = async (r: DownloadRow) => {
    const { data, error } = await supabase.storage.from("downloads").createSignedUrl(r.file_path, 3600);
    if (error || !data?.signedUrl) { toast.error("This file is not available right now."); return; }
    window.open(data.signedUrl, "_blank");
  };

  const current = sections.find(s => s.section === active);
  const heroBg = slides.length > 0 ? slides[slide % slides.length] : (home?.image_url || heroImg);

  const NavBar = ({ dark }: { dark: boolean }) => (
    <div className={`z-20 flex items-center justify-between px-6 py-4 flex-wrap gap-3 ${dark ? "" : "bg-white border-b"}`}>
      <button onClick={() => setActive("home")} className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center overflow-hidden">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.name} className="h-full w-full object-cover" />
          ) : (
            <Pill className="h-5 w-5" />
          )}
        </div>
        <div className="leading-tight text-left">
          <div className={`text-sm font-bold ${dark ? "text-white" : "text-primary"}`}>{branding.name}</div>
          <div className={`text-[10px] uppercase tracking-wider ${dark ? "text-white/70" : "text-muted-foreground"}`}>{branding.tagline}</div>
        </div>
      </button>

      <nav className={`flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${dark ? "text-white" : "text-foreground"}`}>
        {ORDER.map(id => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`px-2 sm:px-3 py-1.5 rounded-md uppercase tracking-wide font-medium ${
              active === id
                ? dark ? "bg-white/25" : "bg-primary text-primary-foreground"
                : dark ? "hover:bg-white/15" : "hover:bg-muted"
            }`}
          >
            {LABELS[id]}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <Link to="/auth">
          <Button variant="outline" size="sm"
            className={dark ? "bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white" : ""}>
            Login
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {active === "home" ? (
        <div className="relative min-h-screen">
          {slides.length > 0 ? (
            slides.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`${branding.name} photo ${i + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === slide % slides.length ? "opacity-100" : "opacity-0"}`}
              />
            ))
          ) : (
            <img src={heroBg} alt="Pharmacist attending to a client at the pharmacy counter" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

          <div className="absolute top-0 left-0 right-0 z-30"><NavBar dark /></div>

          <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight drop-shadow-lg">
              {home?.title || branding.name}
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-white/90 max-w-2xl drop-shadow-md whitespace-pre-wrap">
              {home?.body || "Comprehensive management system for inventory, sales, and pharmacy operations."}
            </p>
            <div className="mt-8 flex gap-4">
              <Link to="/auth"><Button size="lg" className="px-8">Sign In</Button></Link>
            </div>
            {slides.length > 1 && (
              <div className="mt-10 flex gap-2">
                {slides.map((_, i) => (
                  <button key={i} aria-label={`Show photo ${i + 1}`} onClick={() => setSlide(i)}
                    className={`h-2.5 w-2.5 rounded-full ${i === slide % slides.length ? "bg-white" : "bg-white/40"}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <NavBar dark={false} />
          <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12">
            {active === "vacancy" ? (
              <VacancySection />
            ) : active === "downloads" ? (
              <section>
                <h1 className="text-3xl font-bold tracking-tight">Downloads</h1>
                <p className="mt-2 text-muted-foreground">Documents shared by {branding.name}.</p>
                <div className="mt-6 divide-y border rounded-lg">
                  {downloads.length === 0 && <p className="p-4 text-sm text-muted-foreground">No documents have been shared yet.</p>}
                  {downloads.map(d => (
                    <button key={d.id} onClick={() => openDownload(d)}
                      className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted">
                      <span className="flex items-center gap-3 font-medium">
                        <FileText className="h-5 w-5 text-primary" />{d.title}
                      </span>
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <section className="grid md:grid-cols-2 gap-8 items-center">
                {current?.image_url ? (
                  <img src={current.image_url} alt={current.title || LABELS[active]} className="w-full rounded-lg shadow-md object-cover max-h-80" />
                ) : (
                  <div className="w-full h-60 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                    No image yet
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{current?.title || LABELS[active]}</h1>
                  <p className="mt-4 text-muted-foreground whitespace-pre-wrap">{current?.body}</p>
                </div>
              </section>
            )}
          </main>
        </>
      )}

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {branding.name}
      </footer>
    </div>
  );
}
