import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Upload, FileText } from "lucide-react";

export type Section = "home" | "about" | "services" | "contacts";
export const SITE_SECTIONS: { key: Section; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "about", label: "About Us" },
  { key: "services", label: "Services" },
  { key: "contacts", label: "Contacts Us" },
];
type Row = { section: string; title: string; body: string; image_url: string | null; images: string[] };

export function SitePanel() {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("site_content").select("section, title, body, image_url, images");
    if (error) { toast.error(error.message); setLoading(false); return; }
    const map: Record<string, Row> = {};
    SITE_SECTIONS.forEach(s => { map[s.key] = { section: s.key, title: "", body: "", image_url: null, images: [] }; });
    (data ?? []).forEach((r: any) => {
      if (map[r.section]) map[r.section] = { ...(r as Row), images: (r.images as string[]) ?? [] };
    });
    setRows(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const update = (key: Section, patch: Partial<Row>) =>
    setRows(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const onImage = (key: Section, file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error("Image too large (max 2 MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => update(key, { image_url: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const onSlideImages = (key: Section, files: FileList) => {
    const current = rows[key].images ?? [];
    const room = 5 - current.length;
    if (room <= 0) { toast.error("You already have 5 photos. Remove one first."); return; }
    const picked = Array.from(files).slice(0, room);
    picked.forEach(file => {
      if (file.size > 2 * 1024 * 1024) { toast.error(`${file.name} is too large (max 2 MB)`); return; }
      const reader = new FileReader();
      reader.onload = () =>
        setRows(prev => {
          const imgs = prev[key].images ?? [];
          if (imgs.length >= 5) return prev;
          return { ...prev, [key]: { ...prev[key], images: [...imgs, String(reader.result)] } };
        });
      reader.readAsDataURL(file);
    });
  };

  const save = async (key: Section) => {
    const r = rows[key];
    const { error } = await supabase.from("site_content").upsert({
      section: r.section, title: r.title, body: r.body, image_url: r.image_url,
      images: r.images ?? [],
      updated_at: new Date().toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`${key} saved`);
  };

  if (loading) return <p>Loading…</p>;
  return (
    <div className="space-y-6">
      {SITE_SECTIONS.map(s => {
        const r = rows[s.key];
        return (
          <Card key={s.key}>
            <CardHeader><CardTitle>{s.label}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Title</Label><Input value={r.title} onChange={e => update(s.key, { title: e.target.value })} /></div>
              <div><Label>Words / Description</Label><Textarea rows={4} value={r.body} onChange={e => update(s.key, { body: e.target.value })} /></div>
              <div>
                <Label>Photo</Label>
                <Input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onImage(s.key, f); }} />
                {r.image_url && (
                  <div className="mt-2">
                    <Button variant="ghost" size="sm" onClick={() => update(s.key, { image_url: null })}>Remove image</Button>
                  </div>
                )}
              </div>
              <div>
                <Label>Slideshow photos (up to 5 — they play automatically on the public site)</Label>
                <Input type="file" accept="image/*" multiple
                  onChange={e => { const fs = e.target.files; if (fs?.length) onSlideImages(s.key, fs); }} />
                <div className="mt-2 flex flex-wrap gap-2">
                  {(r.images ?? []).map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt={`Slide ${i + 1}`} className="h-20 w-28 object-cover rounded border" />
                      <Button size="icon" variant="secondary" className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => update(s.key, { images: (r.images ?? []).filter((_, ix) => ix !== i) })}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={() => save(s.key)}>Save {s.label}</Button>
            </CardContent>
          </Card>
        );
      })}

      <DownloadsPanel />
    </div>
  );
}

type DownloadRow = { id: string; title: string; file_path: string; created_at: string };

function DownloadsPanel() {
  const [rows, setRows] = useState<DownloadRow[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("site_downloads")
      .select("id, title, file_path, created_at").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRows((data as DownloadRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!title.trim()) { toast.error("Enter the title of the PDF"); return; }
    if (!file) { toast.error("Choose a PDF file"); return; }
    setBusy(true);
    const path = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("downloads").upload(path, file, { upsert: true });
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }
    const { error } = await supabase.from("site_downloads").insert({ title: title.trim(), file_path: path });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("PDF added to the public Downloads page");
    setTitle(""); setFile(null);
    load();
  };

  const remove = async (r: DownloadRow) => {
    if (!confirm(`Remove “${r.title}” from Downloads?`)) return;
    await supabase.storage.from("downloads").remove([r.file_path]);
    const { error } = await supabase.from("site_downloads").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    load();
  };

  const open = async (r: DownloadRow) => {
    const { data, error } = await supabase.storage.from("downloads").createSignedUrl(r.file_path, 3600);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? "Could not open the file"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Downloads (PDFs on the public site)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div><Label>Title of the PDF</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Price list 2026" /></div>
          <div><Label>PDF file</Label><Input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>
          <Button disabled={busy} onClick={upload}><Upload className="h-4 w-4 mr-1" />{busy ? "Uploading…" : "Add to Downloads"}</Button>
        </div>
        <div className="divide-y border rounded-md">
          {rows.length === 0 && <p className="p-3 text-sm text-muted-foreground">No PDFs added yet.</p>}
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-2 text-sm">
              <button className="text-left font-medium hover:underline" onClick={() => open(r)}>{r.title}</button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                <Button size="sm" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
