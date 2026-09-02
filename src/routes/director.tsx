import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  createPharmacy, deletePharmacy,
  createPharmacyAdmin, deletePharmacyAdmin, updateAdminPermissions,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useSiteBranding } from "@/lib/site-branding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pill, LogOut, Trash2, Plus, Building2, MessageSquare } from "lucide-react";
import { AccessPanel } from "@/components/AccessPanel";
import { toast } from "sonner";

export const Route = createFileRoute("/director")({
  component: DirectorPage,
});

function DirectorPage() {
  const { profile, loading, signOut } = useAuth();
  const branding = useSiteBranding();
  const navigate = useNavigate();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardHeader><CardTitle>Sign in required</CardTitle></CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: "/auth" })}>Go to Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Editors-only fallback (an Admin with can_edit_site but NOT the director)
  const isEditorOnly = !profile.is_director && profile.role === "admin";
  const isDirector = profile.is_director;

  if (!isDirector && !isEditorOnly) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardHeader><CardTitle>Access denied</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Director access only.</p>
            <Button variant="outline" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center overflow-hidden">
              {branding.logoUrl ? <img src={branding.logoUrl} alt={branding.name} className="h-full w-full object-cover"/> : <Pill className="h-5 w-5" />}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold">{branding.name} Director</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{profile.username}</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
            <LogOut className="h-4 w-4 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <Tabs defaultValue={isDirector ? "pharmacies" : "access"} className="space-y-6">
          <TabsList className="flex-wrap">
            {isDirector && <TabsTrigger value="pharmacies">Pharmacies</TabsTrigger>}
            {isDirector && <TabsTrigger value="admins">Pharmacy Admins</TabsTrigger>}
            {!isDirector && <TabsTrigger value="access">Users &amp; Access</TabsTrigger>}
          </TabsList>
          {isDirector && <TabsContent value="pharmacies"><PharmaciesPanel /></TabsContent>}
          {isDirector && <TabsContent value="admins"><AdminsPanel /></TabsContent>}
          {!isDirector && <TabsContent value="access"><AccessPanel /></TabsContent>}
        </Tabs>
      </main>
    </div>
  );
}

// ===== Pharmacies =====
type Pharmacy = { id: string; name: string; created_at: string };

function PharmaciesPanel() {
  const [list, setList] = useState<Pharmacy[]>([]);
  const [name, setName] = useState("");
  const create = useServerFn(createPharmacy);
  const del = useServerFn(deletePharmacy);

  const load = async () => {
    const { data, error } = await supabase.from("pharmacies").select("id, name, created_at").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setList((data as Pharmacy[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await create({ data: { name } }); toast.success("Pharmacy created"); setName(""); await load(); }
    catch (err) { toast.error((err as Error).message); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5"/>Add Pharmacy</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={add} className="flex gap-2">
            <Input placeholder="Pharmacy name" value={name} onChange={e => setName(e.target.value)} required />
            <Button type="submit"><Plus className="h-4 w-4 mr-1"/>Add</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>All Pharmacies ({list.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Created</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">None yet</TableCell></TableRow>}
              {list.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={async () => {
                      if (!confirm(`Delete ${p.name} and ALL its data?`)) return;
                      try { await del({ data: { id: p.id } }); toast.success("Deleted"); await load(); }
                      catch (e) { toast.error((e as Error).message); }
                    }}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Admins =====
type AdminRow = { id: string; username: string; role: string; pharmacy_id: string | null; can_edit_site: boolean; is_director: boolean };

function AdminsPanel() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [pharmacyId, setPharmacyId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [atUsername, setAtUsername] = useState("");
  const [atApiKey, setAtApiKey] = useState("");
  const [atSenderId, setAtSenderId] = useState("");

  const create = useServerFn(createPharmacyAdmin);
  const del = useServerFn(deletePharmacyAdmin);
  const updPerm = useServerFn(updateAdminPermissions);

  const load = async () => {
    const { data: phs } = await supabase.from("pharmacies").select("id, name, created_at").order("name");
    setPharmacies((phs as Pharmacy[]) ?? []);
    const { data: ad } = await supabase.from("profiles").select("id, username, role, pharmacy_id, can_edit_site, is_director").eq("role", "admin");
    setAdmins(((ad as AdminRow[]) ?? []).filter(a => !a.is_director));
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pharmacyId) { toast.error("Pick a pharmacy"); return; }
    try {
      await create({ data: {
        pharmacyId, username, password, canEditSite: canEdit,
        atUsername: atUsername.trim() || undefined,
        atApiKey: atApiKey.trim() || undefined,
        atSenderId: atSenderId.trim() || undefined,
      } });
      toast.success("Admin created");
      setUsername(""); setPassword(""); setCanEdit(false);
      setAtUsername(""); setAtApiKey(""); setAtSenderId("");
      await load();
    } catch (err) { toast.error((err as Error).message); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Create Pharmacy Admin</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={add} className="space-y-3">
            <div>
              <Label>Pharmacy</Label>
              <select className="w-full h-10 border rounded-md px-3 bg-background" value={pharmacyId} onChange={e => setPharmacyId(e.target.value)} required>
                <option value="">— select pharmacy —</option>
                {pharmacies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><Label>Admin username</Label><Input name="new-admin-username" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="off" autoCorrect="off" spellCheck={false} /></div>
            <div><Label>Admin password</Label><Input name="new-admin-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" /></div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium text-sm">Can edit public site</div>
                <div className="text-xs text-muted-foreground">If enabled, this admin can change Home, About, Services, Vacancy and Contacts.</div>
              </div>
              <Switch checked={canEdit} onCheckedChange={setCanEdit} />
            </div>

            <div className="rounded-md border p-3 space-y-3 bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" /> Africa's Talking (SMS) — for this pharmacy
              </div>
              <div className="text-xs text-muted-foreground">
                Optional. Adds SMS credentials for this pharmacy so its Admin, Pharmacy and Accountant staff can send messages to their buyers. Stored securely — only shown to the pharmacy Admin and Director.
              </div>
              <div><Label>AT username</Label><Input value={atUsername} onChange={e => setAtUsername(e.target.value)} placeholder="sandbox or live username" /></div>
              <div><Label>AT API key</Label><Input type="password" value={atApiKey} onChange={e => setAtApiKey(e.target.value)} placeholder="atsk_..." /></div>
              <div><Label>Sender ID (optional)</Label><Input value={atSenderId} onChange={e => setAtSenderId(e.target.value)} maxLength={30} /></div>
            </div>

            <Button type="submit" className="w-full">Create Admin</Button>
          </form>
        </CardContent>
      </Card>


      <Card>
        <CardHeader><CardTitle>All Pharmacy Admins ({admins.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Pharmacy</TableHead><TableHead>Site editor</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {admins.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">None yet</TableCell></TableRow>}
              {admins.map(a => {
                const ph = pharmacies.find(p => p.id === a.pharmacy_id);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.username}</TableCell>
                    <TableCell>{ph?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Switch
                        checked={a.can_edit_site}
                        onCheckedChange={async (v) => {
                          try { await updPerm({ data: { userId: a.id, canEditSite: v } }); toast.success("Updated"); await load(); }
                          catch (e) { toast.error((e as Error).message); }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={async () => {
                        if (!confirm(`Delete admin ${a.username}?`)) return;
                        try { await del({ data: { userId: a.id } }); toast.success("Deleted"); await load(); }
                        catch (e) { toast.error((e as Error).message); }
                      }}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
