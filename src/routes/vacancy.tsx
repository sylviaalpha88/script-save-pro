import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { canAccess } from "@/lib/access";
import { supabase } from "@/integrations/supabase/client";
import { sendSmsToPhones } from "@/lib/messaging.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Briefcase, Download, Send, History, UserPlus } from "lucide-react";

export const Route = createFileRoute("/vacancy")({
  component: VacancyPage,
  head: () => ({
    meta: [
      { title: "Vacancy · Jobs & Applicants" },
      { name: "description", content: "Open or close vacancies, publish job titles and descriptions, and review applicant letters, CVs and certificates." },
      { property: "og:title", content: "Vacancy · Jobs & Applicants" },
      { property: "og:description", content: "Open or close vacancies and review applicant documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Vacancy = { id: string; title: string; description: string; is_open: boolean; created_at: string };
type Application = {
  id: string; vacancy_id: string; applicant_name: string; email: string | null; phone: string | null;
  letter_path: string | null; cv_path: string | null; certificate_paths: string[]; created_at: string;
  archived_at: string | null;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

function VacancyPage() {
  const { profile, loading } = useAuth();
  const denied = !loading && profile && !canAccess(profile, "vacancy");
  return (
    <AppShell title="Vacancy" subtitle="Publish jobs and review applications">
      {denied ? (
        <p className="text-destructive font-semibold">You don't have permission to access this page.</p>
      ) : (
        <VacancyPanel />
      )}
    </AppShell>
  );
}

function VacancyPanel() {
  const { profile } = useAuth();
  const [list, setList] = useState<Vacancy[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const send = useServerFn(sendSmsToPhones);

  const load = async () => {
    const { data: v } = await supabase
      .from("vacancies").select("id, title, description, is_open, created_at").order("created_at", { ascending: false });
    setList((v as Vacancy[]) ?? []);
    const { data: a } = await supabase
      .from("vacancy_applications")
      .select("id, vacancy_id, applicant_name, email, phone, letter_path, cv_path, certificate_paths, created_at, archived_at")
      .order("created_at", { ascending: false });
    setApps((a as Application[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.pharmacy_id) { toast.error("Your account is not linked to a pharmacy"); return; }
    const { error } = await supabase.from("vacancies").insert({
      pharmacy_id: profile.pharmacy_id, title, description, is_open: true, created_by: profile.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Vacancy opened");
    setTitle(""); setDescription("");
    await load();
  };

  const toggleOpen = async (v: Vacancy, open: boolean) => {
    const { error } = await supabase.from("vacancies").update({ is_open: open }).eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    await load();
  };

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("applications").createSignedUrl(path, 300);
    if (error || !data) { toast.error(error?.message ?? "Could not open file"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const active = useMemo(() => apps.filter(a => !a.archived_at), [apps]);
  const archived = useMemo(() => {
    const f = new Date(`${from}T00:00:00`).getTime();
    const t = new Date(`${to}T23:59:59`).getTime();
    return apps.filter(a => {
      if (!a.archived_at) return false;
      const m = new Date(a.archived_at).getTime();
      return m >= f && m <= t;
    });
  }, [apps, from, to]);

  const toggle = (id: string) => setSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const allSelected = active.length > 0 && active.every(a => sel.includes(a.id));

  const notify = async () => {
    const chosen = active.filter(a => sel.includes(a.id));
    const pool = chosen.length > 0 ? chosen : active;
    const phones = pool.map(a => a.phone).filter((p): p is string => !!p && p.trim().length > 3);
    if (phones.length === 0) { toast.error("No phone numbers for the selected applicants"); return; }
    if (!msg.trim()) { toast.error("Type a message"); return; }
    try {
      const res = await send({ data: { phones, body: msg.trim() } });
      toast.success(`Sent to ${(res as { sent: number }).sent} applicant(s)`);
      setMsg("");
    } catch (e) { toast.error((e as Error).message); }
  };

  const moveToHistory = async () => {
    if (sel.length === 0) { toast.error("Select the applicants you want to move to history"); return; }
    setBusy(true);
    const { error } = await supabase.from("vacancy_applications")
      .update({ archived_at: new Date().toISOString() }).in("id", sel);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${sel.length} applicant(s) moved to history`);
    setSel([]);
    load();
  };

  const DocButtons = ({ a }: { a: Application }) => (
    <div className="flex flex-wrap gap-1">
      {a.letter_path && <Button size="sm" variant="outline" onClick={() => download(a.letter_path!)}><Download className="h-3 w-3 mr-1" />Letter</Button>}
      {a.cv_path && <Button size="sm" variant="outline" onClick={() => download(a.cv_path!)}><Download className="h-3 w-3 mr-1" />CV</Button>}
      {(a.certificate_paths ?? []).map((c, i) => (
        <Button key={c} size="sm" variant="outline" onClick={() => download(c)}><Download className="h-3 w-3 mr-1" />Cert {i + 1}</Button>
      ))}
      {!a.letter_path && !a.cv_path && (a.certificate_paths ?? []).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" />Open a Vacancy</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={add} className="space-y-3">
              <div><Label>Job title</Label><Input value={title} onChange={e => setTitle(e.target.value)} required /></div>
              <div><Label>Description</Label><Textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} required /></div>
              <Button type="submit" className="w-full">Publish &amp; open</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vacancies ({list.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Applicants</TableHead><TableHead>Open</TableHead></TableRow></TableHeader>
              <TableBody>
                {list.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">None yet</TableCell></TableRow>}
                {list.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.title}</TableCell>
                    <TableCell>{active.filter(a => a.vacancy_id === v.id).length}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={v.is_open} onCheckedChange={val => toggleOpen(v, val)} />
                        {v.is_open ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Open</Badge> : <Badge variant="outline">Closed</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="applications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="add"><UserPlus className="h-4 w-4 mr-1" />Add Applicant</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle>Applications ({active.length})</CardTitle>
              <Button variant="outline" disabled={busy || sel.length === 0} onClick={moveToHistory}>
                <History className="h-4 w-4 mr-1" />Move selected to History ({sel.length})
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox checked={allSelected} onCheckedChange={() => setSel(allSelected ? [] : active.map(a => a.id))} />
                Select all applicants
              </label>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Applicant</TableHead><TableHead>Vacancy</TableHead><TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead><TableHead>Documents</TableHead><TableHead>Applied</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No applications yet</TableCell></TableRow>}
                    {active.map(a => (
                      <TableRow key={a.id}>
                        <TableCell><Checkbox checked={sel.includes(a.id)} onCheckedChange={() => toggle(a.id)} /></TableCell>
                        <TableCell className="font-medium">{a.applicant_name}</TableCell>
                        <TableCell>{list.find(v => v.id === a.vacancy_id)?.title ?? "—"}</TableCell>
                        <TableCell className="text-xs">{a.email || "—"}</TableCell>
                        <TableCell className="text-xs">{a.phone || "—"}</TableCell>
                        <TableCell><DocButtons a={a} /></TableCell>
                        <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 max-w-xl border-t pt-4">
                <Label>Send SMS {sel.length > 0 ? `to ${sel.length} selected applicant(s)` : "to all applicants"}</Label>
                <p className="text-xs text-muted-foreground">Tick the applicants above to message only them; with nothing ticked the message goes to everyone.</p>
                <Textarea rows={3} value={msg} onChange={e => setMsg(e.target.value)} maxLength={1000} placeholder="Message to applicants…" />
                <Button onClick={notify}><Send className="h-4 w-4 mr-1" />Send message</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add">
          <ManualApplicantForm vacancies={list} onSaved={load} />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Applicant History ({archived.length})</CardTitle>
              <div className="flex flex-wrap items-end gap-2">
                <div><Label className="text-xs">Date from</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
                <div><Label className="text-xs">Date to</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead><TableHead>Vacancy</TableHead><TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead><TableHead>Documents</TableHead>
                      <TableHead>Applied</TableHead><TableHead>Moved to history</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archived.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nobody was moved to history in these dates.</TableCell></TableRow>}
                    {archived.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.applicant_name}</TableCell>
                        <TableCell>{list.find(v => v.id === a.vacancy_id)?.title ?? "—"}</TableCell>
                        <TableCell className="text-xs">{a.email || "—"}</TableCell>
                        <TableCell className="text-xs">{a.phone || "—"}</TableCell>
                        <TableCell><DocButtons a={a} /></TableCell>
                        <TableCell className="text-xs">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs">{a.archived_at ? new Date(a.archived_at).toLocaleString() : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ManualApplicantForm({ vacancies, onSaved }: { vacancies: Vacancy[]; onSaved: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [vacancyId, setVacancyId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [applied, setApplied] = useState(todayStr());
  const [letter, setLetter] = useState<File | null>(null);
  const [cv, setCv] = useState<File | null>(null);
  const [certs, setCerts] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File, kind: string) => {
    const path = `${vacancyId}/${crypto.randomUUID()}-${kind}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("applications").upload(path, file);
    if (error) throw new Error(error.message);
    return path;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacancyId) { toast.error("Choose the vacancy this person applied for"); return; }
    setBusy(true);
    try {
      const letterPath = letter ? await upload(letter, "letter") : null;
      const cvPath = cv ? await upload(cv, "cv") : null;
      const certPaths: string[] = [];
      for (const f of Array.from(certs ?? [])) certPaths.push(await upload(f, "cert"));
      const { error } = await supabase.from("vacancy_applications").insert({
        vacancy_id: vacancyId,
        pharmacy_id: profile?.pharmacy_id ?? null,
        applicant_name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        letter_path: letterPath,
        cv_path: cvPath,
        certificate_paths: certPaths,
        created_at: new Date(`${applied}T09:00:00`).toISOString(),
      });
      if (error) throw new Error(error.message);
      toast.success("Applicant added");
      setName(""); setEmail(""); setPhone(""); setLetter(null); setCv(null); setCerts(null);
      onSaved();
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Add Applicant Information</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
          <div><Label>Applicant name</Label><Input value={name} onChange={e => setName(e.target.value)} required maxLength={120} /></div>
          <div>
            <Label>Vacancy name</Label>
            <Select value={vacancyId} onValueChange={setVacancyId}>
              <SelectTrigger><SelectValue placeholder="Choose vacancy" /></SelectTrigger>
              <SelectContent>
                {vacancies.map(v => <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Email address</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={255} /></div>
          <div><Label>Phone number</Label><Input value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} /></div>
          <div><Label>Applied date</Label><Input type="date" value={applied} onChange={e => setApplied(e.target.value)} /></div>
          <div><Label>Application letter</Label><Input type="file" accept=".pdf,.doc,.docx" onChange={e => setLetter(e.target.files?.[0] ?? null)} /></div>
          <div><Label>CV</Label><Input type="file" accept=".pdf,.doc,.docx" onChange={e => setCv(e.target.files?.[0] ?? null)} /></div>
          <div><Label>Certificates</Label><Input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCerts(e.target.files)} /></div>
          <div className="sm:col-span-2"><Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save applicant"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}
