import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type Branding = {
  name: string;
  tagline: string;
  logoUrl: string | null;
};

const DEFAULTS: Branding = {
  name: "LEMSA Pharmacy",
  tagline: "Pharmacy Management System",
  logoUrl: null,
};

const Ctx = createContext<Branding>(DEFAULTS);

export function SiteBrandingProvider({ children }: { children: ReactNode }) {
  const [b, setB] = useState<Branding>(DEFAULTS);

  const load = async () => {
    const { data } = await supabase
      .from("site_content")
      .select("section, title, body, image_url")
      .eq("section", "home")
      .maybeSingle();
    if (data) {
      setB({
        name: data.title?.trim() || DEFAULTS.name,
        tagline: (data.body?.split("\n")[0]?.trim() || DEFAULTS.tagline).slice(0, 80),
        logoUrl: data.image_url || null,
      });
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("site-branding")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_content", filter: "section=eq.home" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = `${b.name} — ${b.tagline}`;
    const setMeta = (sel: string, attr: string, val: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(sel);
      if (!el) {
        el = document.createElement("meta");
        const [k, v] = sel.replace(/[\[\]"]/g, "").split("=");
        el.setAttribute(k, v);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, val);
    };
    setMeta('meta[name="description"]', "content", `${b.name} — ${b.tagline}`);
    setMeta('meta[property="og:title"]', "content", b.name);
    setMeta('meta[property="og:description"]', "content", b.tagline);
    setMeta('meta[name="twitter:title"]', "content", b.name);
    setMeta('meta[name="twitter:description"]', "content", b.tagline);

    if (b.logoUrl) {
      let icon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!icon) {
        icon = document.createElement("link");
        icon.rel = "icon";
        document.head.appendChild(icon);
      }
      icon.href = b.logoUrl;
      icon.type = b.logoUrl.startsWith("data:") ? b.logoUrl.slice(5).split(";")[0] : "image/png";
      setMeta('meta[property="og:image"]', "content", b.logoUrl);
      setMeta('meta[name="twitter:image"]', "content", b.logoUrl);
    }

    // JSON-LD for search engines: name + logo + site search
    let ld = document.getElementById("site-jsonld") as HTMLScriptElement | null;
    if (!ld) {
      ld = document.createElement("script");
      ld.id = "site-jsonld";
      ld.type = "application/ld+json";
      document.head.appendChild(ld);
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          name: b.name,
          url: origin,
          logo: b.logoUrl || undefined,
        },
        {
          "@type": "WebSite",
          name: b.name,
          alternateName: b.tagline,
          url: origin,
          potentialAction: {
            "@type": "SearchAction",
            target: `${origin}/?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        },
      ],
    });
  }, [b]);

  return <Ctx.Provider value={b}>{children}</Ctx.Provider>;
}

export function useSiteBranding() {
  return useContext(Ctx);
}
