import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { PRINT_DOC_CSS } from "@/lib/print";

export const Route = createFileRoute("/doc/$id")({
  component: DocPage,
  ssr: false,
  head: () => ({
    meta: [
      { title: "Document · Pharmacy report download" },
      { name: "description", content: "Scan-to-download copy of a pharmacy report or requisition, exactly as it was printed." },
      { property: "og:title", content: "Pharmacy report download" },
      { property: "og:description", content: "Scan-to-download copy of a pharmacy report, exactly as it was printed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Brand = { name?: string | null; logoUrl?: string | null; lines?: string[] };
type Doc = { title: string; html: string; brand: Brand; created_at: string };

function DocPage() {
  const { id } = Route.useParams();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [missing, setMissing] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const auto = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("auto") === "1";

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("printed_docs")
        .select("title, html, brand, created_at")
        .eq("id", id)
        .maybeSingle();
      if (!data) { setMissing(true); return; }
      setDoc(data as unknown as Doc);
      try {
        const base = window.location.origin + window.location.pathname;
        setQr(await QRCode.toDataURL(`${base}?auto=1`, { margin: 1, width: 180 }));
      } catch { /* optional */ }
    })();
  }, [id]);

  useEffect(() => {
    if (!auto || !doc) return;
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, [auto, doc]);

  if (missing) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">This document is no longer available.</div>;
  if (!doc) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading document…</div>;

  const brand = doc.brand ?? {};

  return (
    <div className="min-h-screen bg-white">
      <style>{PRINT_DOC_CSS}</style>
      <div className="mx-auto max-w-4xl p-6">
        <div className="print:hidden mb-4 flex justify-end">
          <button className="rounded-md border px-4 py-2 text-sm font-semibold" onClick={() => window.print()}>
            Download / Print PDF
          </button>
        </div>
        <div className="brandbar">
          {brand.logoUrl ? <img className="blogo" src={brand.logoUrl} alt="" /> : <div className="blogo placeholder" />}
          <div className="binfo">
            {brand.name && <div className="bname">{brand.name}</div>}
            {(brand.lines ?? []).filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: doc.html }} />
        {qr && (
          <div className="qrbox">
            <img src={qr} alt="QR code" />
            <div className="qrlabel">QR SCAN — scan to download this PDF</div>
          </div>
        )}
      </div>
    </div>
  );
}
