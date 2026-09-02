import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { canAccess } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/pharm-branding")({
  component: PharmBrandingPage,
  head: () => ({
    meta: [
      { title: "Pharm Branding · Logo, Address & Contacts on every PDF" },
      { name: "description", content: "Upload your pharmacy logo and set address, email, phone and location so they print at the top of every PDF or download." },
      { property: "og:title", content: "Pharm Branding · Logo, Address & Contacts" },
      { property: "og:description", content: "Upload your pharmacy logo and set address, email, phone and location for every printed document." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type PharmacyRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  postal_address: string | null;
  location: string | null;
  logo_path: string | null;
};

function PharmBrandingPage() {
  const { profile, loading } = useAuth();
  const [row, setRow] = useState<PharmacyRow | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!profile?.pharmacy_id) return;
    const { data } = await supabase
      .from("pharmacies")
      .select("id, name, phone, email, address, postal_address, location, logo_path")
      .eq("id", profile.pharmacy_id)
      .maybeSingle();
    setRow((data as PharmacyRow) ?? null);
    if (data?.logo_path) {
      const { data: signed } = await supabase.storage.from("pharmacy-logos").createSignedUrl(data.logo_path, 3600);
      setLogoUrl(signed?.signedUrl ?? null);
    } else setLogoUrl(null);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profile?.pharmacy_id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!row) return;
    setBusy(true);
    const { error } = await supabase.from("pharmacies").update({
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      postal_address: row.postal_address,
      location: row.location,
    }).eq("id", row.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Branding saved — it now prints on every PDF"); load(); }
  };

  const uploadLogo = async (file: File) => {
    if (!row) return;
    setBusy(true);
    const path = `${row.id}/logo-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("pharmacy-logos").upload(path, file, { upsert: true });
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }
    const { error: dbErr } = await supabase.from("pharmacies").update({ logo_path: path }).eq("id", row.id);
    setBusy(false);
    if (dbErr) { toast.error(dbErr.message); return; }
    toast.success("Logo uploaded");
    load();
  };

  return (
    <AppShell title="Pharm Branding" subtitle="Logo, address and contacts printed at the top of every PDF">
      {!loading && profile && !canAccess(profile, "pharm_branding") ? (
        <p className="text-destructive font-semibold">You don't have permission to access this page.</p>
      ) : !profile?.pharmacy_id ? (
        <p className="text-muted-foreground">No pharmacy linked to your account.</p>
      ) : !row ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Pharmacy Logo</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-center gap-6">
              {logoUrl
                ? <img src={logoUrl} alt="Pharmacy logo" className="h-28 w-28 rounded-lg object-contain border bg-white p-1" />
                : <div className="h-28 w-28 rounded-lg border bg-muted flex items-center justify-center text-xs text-muted-foreground">No logo</div>}
              <div className="space-y-2">
                <Label className="text-xs">Upload logo (any size — it is scaled automatically)</Label>
                <Input type="file" accept="image/*" disabled={busy}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                <p className="text-xs text-muted-foreground">PNG, JPG or SVG. Appears top-left of every printed or downloaded document.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pharmacy Details</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
                <div><Label>Pharmacy name</Label><Input value={row.name ?? ""} onChange={e => setRow({ ...row, name: e.target.value })} required /></div>
                <div><Label>Phone / contacts</Label><Input value={row.phone ?? ""} onChange={e => setRow({ ...row, phone: e.target.value })} placeholder="e.g. 0704 934 570" /></div>
                <div><Label>Email address</Label><Input type="email" value={row.email ?? ""} onChange={e => setRow({ ...row, email: e.target.value })} /></div>
                <div><Label>Postal address</Label><Input value={row.postal_address ?? ""} onChange={e => setRow({ ...row, postal_address: e.target.value })} placeholder="e.g. P.O. Box 1234-20100" /></div>
                <div><Label>Location</Label><Input value={row.location ?? ""} onChange={e => setRow({ ...row, location: e.target.value })} placeholder="Town / street" /></div>
                <div className="sm:col-span-2"><Label>Physical address (extra details)</Label><Textarea rows={2} value={row.address ?? ""} onChange={e => setRow({ ...row, address: e.target.value })} /></div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save branding"}</Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Saved details replace the header name in the app and print at the top of every PDF, invoice and report.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
