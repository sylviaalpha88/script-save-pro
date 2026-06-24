import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resolveUsername } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Pill, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/director")({
  component: DirectorPage,
});

type Section = "home" | "services" | "about" | "contacts";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "services", label: "Services" },
  { key: "about", label: "About LEMSA Pharmacy" },
  { key: "contacts", label: "Contacts" },
];

type Row = { section: string; title: string; body: string; image_url: string | null };

function DirectorPage() {
  const { profile, loading, refresh } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }
  if (!profile) return <DirectorLogin onSignedIn={refresh} />;
  if (profile.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Director access only</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">You must sign in as Admin to manage the public site.</p>
            <Button onClick={async () => { await supabase.auth.signOut(); await refresh(); }}>Sign out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  return <DirectorEditor />;
}

function DirectorLogin({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const resolve = useServerFn(resolveUsername);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { email } = await resolve({ data: { username } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await onSignedIn();
      toast.success("Welcome, Director");
    } catch (err) {
      toast.error((err as Error).message || "Invalid credentials");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <Pill className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Director Sign-In</CardTitle>
          <p className="text-sm text-muted-foreground">Use Admin username and Admin password</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="u">Admin Username</Label>
              <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p">Admin Password</Label>
              <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Enter as Director"}
            </Button>
            <div className="text-center">
              <Link to="/" className="text-xs text-muted-foreground hover:underline">← Back to public site</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function DirectorEditor() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("site_content").select("section, title, body, image_url");
    if (error) { toast.error(error.message); setLoading(false); return; }
    const map: Record<string, Row> = {};
    SECTIONS.forEach(s => { map[s.key] = { section: s.key, title: "", body: "", image_url: null }; });
    (data ?? []).forEach((r: any) => { map[r.section] = r as Row; });
    setRows(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (key: Section, patch: Partial<Row>) => {
    setRows(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const onImage = async (key: Section, file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large (max 2 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update(key, { image_url: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const save = async (key: Section) => {
    const r = rows[key];
    const { error } = await supabase.from("site_content").upsert({
      section: r.section,
      title: r.title,
      body: r.body,
      image_url: r.image_url,
      updated_at: new Date().toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`${key} saved`);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Public site
            </Button>
            <h1 className="font-bold">Director — Public Site Editor</h1>
          </div>
          <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>Sign out</Button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {loading ? <p>Loading…</p> : SECTIONS.map(s => {
          const r = rows[s.key];
          return (
            <Card key={s.key}>
              <CardHeader><CardTitle>{s.label}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Title</Label>
                  <Input value={r.title} onChange={(e) => update(s.key, { title: e.target.value })} />
                </div>
                <div>
                  <Label>Words / Description</Label>
                  <Textarea rows={4} value={r.body} onChange={(e) => update(s.key, { body: e.target.value })} />
                </div>
                <div>
                  <Label>Photo</Label>
                  <Input type="file" accept="image/*" onChange={(e) => {
                    const f = e.target.files?.[0]; if (f) onImage(s.key, f);
                  }} />
                  {r.image_url && (
                    <div className="mt-2">
                      <img src={r.image_url} alt={s.label} className="h-32 rounded object-cover" />
                      <Button variant="ghost" size="sm" onClick={() => update(s.key, { image_url: null })}>Remove image</Button>
                    </div>
                  )}
                </div>
                <Button onClick={() => save(s.key)}>Save {s.label}</Button>
              </CardContent>
            </Card>
          );
        })}
      </main>
    </div>
  );
}
