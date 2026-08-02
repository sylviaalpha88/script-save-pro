import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export type Section = "home" | "about" | "services" | "contacts";
export const SITE_SECTIONS: { key: Section; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "about", label: "About Us" },
  { key: "services", label: "Services" },
  { key: "contacts", label: "Contacts Us" },
];
type Row = { section: string; title: string; body: string; image_url: string | null };

export function SitePanel() {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("site_content").select("section, title, body, image_url");
    if (error) { toast.error(error.message); setLoading(false); return; }
    const map: Record<string, Row> = {};
    SITE_SECTIONS.forEach(s => { map[s.key] = { section: s.key, title: "", body: "", image_url: null }; });
    (data ?? []).forEach((r: any) => { if (map[r.section]) map[r.section] = r as Row; });
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

  const save = async (key: Section) => {
    const r = rows[key];
    const { error } = await supabase.from("site_content").upsert({
      section: r.section, title: r.title, body: r.body, image_url: r.image_url,
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
              <Button onClick={() => save(s.key)}>Save {s.label}</Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
