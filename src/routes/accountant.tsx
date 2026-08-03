import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { SignOffBlock } from "@/components/SignOff";
import { printElement } from "@/lib/print";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Save, X, Lock, Printer } from "lucide-react";


export const Route = createFileRoute("/accountant")({
  component: AccountantPage,
});

const todayISO = () => new Date().toISOString().slice(0, 10);

type Report = {
  id: string; report_date: string; cash: number; mpesa: number; total: number;
  notes: string | null; created_at: string;
};

const EDIT_WINDOW_MS = 5 * 60 * 60 * 1000;
const canEdit = (createdAt: string) => Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MS;

function AccountantPage() {
  const { profile, loading } = useAuth();



  const [date, setDate] = useState(todayISO());
  const [cash, setCash] = useState("");
  const [mpesa, setMpesa] = useState("");
  const [notes, setNotes] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);

  // Date range filter
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const total = (Number(cash) || 0) + (Number(mpesa) || 0);

  const load = async () => {
    const { data, error } = await supabase
      .from("accountant_reports")
      .select("id, report_date, cash, mpesa, total, notes, created_at")
      .gte("report_date", from)
      .lte("report_date", to)
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setReports((data as Report[]) ?? []);
  };

  useEffect(() => { if (profile) load(); /* eslint-disable-next-line */ }, [profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("accountant_reports").insert({
        pharmacy_id: profile.pharmacy_id,
        report_date: date,
        cash: Number(cash) || 0,
        mpesa: Number(mpesa) || 0,
        total,
        notes: notes || null,
        created_by: profile.id,
      });
      if (error) throw error;
      toast.success("Report submitted");
      setCash(""); setMpesa(""); setNotes("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <AppShell title="Accountant" subtitle="Handle accounts, expenses and financial reports">
      {!loading && profile && (profile.is_director || (profile.role !== "accountant" && profile.role !== "admin")) ? (
        <p className="text-destructive font-semibold">You don't have permission to access this page.</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Submit Daily Report</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-3">
                <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
                <div><Label>Cash Collected (KSh)</Label><Input type="number" step="0.01" min="0" value={cash} onChange={e => setCash(e.target.value)} required /></div>
                <div><Label>M-Pesa Collected (KSh)</Label><Input type="number" step="0.01" min="0" value={mpesa} onChange={e => setMpesa(e.target.value)} required /></div>
                <div>
                  <Label>Total Collected (auto)</Label>
                  <Input value={`KSh ${total.toFixed(2)}`} readOnly className="bg-muted font-semibold" />
                </div>
                <div><Label>Notes (optional)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy ? "Submitting…" : "Submit Report"}</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle>History</CardTitle>
              <Button variant="outline" size="sm" onClick={() => printElement(printRef.current, "Daily Reports History")}>
                <Printer className="h-4 w-4 mr-1" />Print / Download
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
                <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
                <Button onClick={load} size="sm">Apply</Button>
                <Button variant="outline" size="sm" onClick={() => { const t = todayISO(); setFrom(t); setTo(t); setTimeout(load, 0); }}>Today</Button>
              </div>
              <div ref={printRef} className="border rounded-md overflow-x-auto">
                <h1>Daily Reports History</h1>
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Cash</TableHead><TableHead className="text-right">M-Pesa</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Notes</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {reports.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No reports in range</TableCell></TableRow>}
                    {reports.map(r => <ReportRow key={r.id} r={r} onChanged={load} />)}
                  </TableBody>
                </Table>
                <SignOffBlock />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}


function ReportRow({ r, onChanged }: { r: Report; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [cash, setCash] = useState(String(r.cash));
  const [mpesa, setMpesa] = useState(String(r.mpesa));
  const locked = !canEdit(r.created_at);
  const total = (Number(cash) || 0) + (Number(mpesa) || 0);

  const save = async () => {
    const { error } = await supabase.from("accountant_reports").update({
      cash: Number(cash) || 0, mpesa: Number(mpesa) || 0,
      total: (Number(cash) || 0) + (Number(mpesa) || 0),
    }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    setEditing(false); onChanged();
  };

  return (
    <TableRow>
      <TableCell>{r.report_date}</TableCell>
      <TableCell className="text-right">
        {editing ? <Input type="number" className="h-7 w-24 ml-auto" value={cash} onChange={e => setCash(e.target.value)} /> : `KSh ${Number(r.cash).toFixed(2)}`}
      </TableCell>
      <TableCell className="text-right">
        {editing ? <Input type="number" className="h-7 w-24 ml-auto" value={mpesa} onChange={e => setMpesa(e.target.value)} /> : `KSh ${Number(r.mpesa).toFixed(2)}`}
      </TableCell>
      <TableCell className="text-right font-medium">KSh {(editing ? total : Number(r.total)).toFixed(2)}</TableCell>
      <TableCell className="text-right">
        {locked ? (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Lock className="h-3 w-3"/> locked</span>
        ) : editing ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={save}><Save className="h-4 w-4 text-green-600"/></Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setCash(String(r.cash)); setMpesa(String(r.mpesa)); }}><X className="h-4 w-4"/></Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-4 w-4"/></Button>
        )}
      </TableCell>
    </TableRow>
  );
}
