import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Briefcase, Download, Send } from "lucide-react";

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
};

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
  const send = useServerFn(sendSmsToPhones);

  const load = async () => {
    const { data: v } = await supabase
      .from("vacancies").select("id, title, description, is_open, created_at").order("created_at", { ascending: false });
    setList((v as Vacancy[]) ?? []);
    const { data: a } = await supabase
      .from("vacancy_applications")
      .select("id, vacancy_id, applicant_name, email, phone, letter_path, cv_path, certificate_paths, created_at")
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

  const notify = async () => {
    const phones = apps.map(a => a.phone).filter((p): p is string => !!p && p.trim().length > 3);
    if (phones.length === 0) { toast.error("No applicant phone numbers"); return; }
    if (!msg.trim()) { toast.error("Type a message"); return; }
    try {
      const res = await send({ data: { phones, body: msg.trim() } });
      toast.success(`Sent to ${(res as { sent: number }).sent} applicant(s)`);
      setMsg("");
    } catch (e) { toast.error((e as Error).message); }
  };

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
                    <TableCell>{apps.filter(a => a.vacancy_id === v.id).length}</TableCell>
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

      <Card>
        <CardHeader><CardTitle>Applications ({apps.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead><TableHead>Vacancy</TableHead><TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead><TableHead>Documents</TableHead><TableHead>Applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No applications yet</TableCell></TableRow>}
                {apps.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.applicant_name}</TableCell>
                    <TableCell>{list.find(v => v.id === a.vacancy_id)?.title ?? "—"}</TableCell>
                    <TableCell className="text-xs">{a.email || "—"}</TableCell>
                    <TableCell className="text-xs">{a.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {a.letter_path && <Button size="sm" variant="outline" onClick={() => download(a.letter_path!)}><Download className="h-3 w-3 mr-1" />Letter</Button>}
                        {a.cv_path && <Button size="sm" variant="outline" onClick={() => download(a.cv_path!)}><Download className="h-3 w-3 mr-1" />CV</Button>}
                        {(a.certificate_paths ?? []).map((c, i) => (
                          <Button key={c} size="sm" variant="outline" onClick={() => download(c)}><Download className="h-3 w-3 mr-1" />Cert {i + 1}</Button>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 max-w-xl">
            <Label>Send SMS to all applicants</Label>
            <Textarea rows={3} value={msg} onChange={e => setMsg(e.target.value)} maxLength={1000} placeholder="Message to applicants…" />
            <Button onClick={notify}><Send className="h-4 w-4 mr-1" />Send message</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
