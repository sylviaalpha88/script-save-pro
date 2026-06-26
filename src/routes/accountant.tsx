import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/accountant")({
  component: AccountantPage,
});

const todayISO = () => new Date().toISOString().slice(0, 10);

type Report = { id: string; report_date: string; cash: number; mpesa: number; total: number; notes: string | null; created_at: string };

function AccountantPage() {
  const { profile, loading } = useAuth();
  const isAdmin = profile?.role === "admin";
  const nav = isAdmin
    ? [
        { to: "/admin", label: "Dashboard" },
        { to: "/pharmacy", label: "Pharmacy" },
        { to: "/inventory", label: "Inventory" },
        { to: "/accountant", label: "Accountant" },
      ]
    : [{ to: "/accountant", label: "Accountant" }];

  const [date, setDate] = useState(todayISO());
  const [cash, setCash] = useState("");
  const [mpesa, setMpesa] = useState("");
  const [notes, setNotes] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);

  const total = (Number(cash) || 0) + (Number(mpesa) || 0);

  const load = async () => {
    const { data, error } = await supabase
      .from("accountant_reports")
      .select("id, report_date, cash, mpesa, total, notes, created_at")
      .order("report_date", { ascending: false })
      .limit(60);
    if (error) { toast.error(error.message); return; }
    setReports((data as Report[]) ?? []);
  };

  useEffect(() => { if (profile) load(); }, [profile]);

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
    <AppShell title="Accountant – Daily Sales Report" nav={nav}>
      {!loading && profile && profile.role !== "accountant" && profile.role !== "admin" ? (
        <p className="text-destructive">Access denied.</p>
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
            <CardHeader><CardTitle>My Submitted Reports</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Cash</TableHead><TableHead className="text-right">M-Pesa</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {reports.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No reports yet</TableCell></TableRow>}
                  {reports.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.report_date}</TableCell>
                      <TableCell className="text-right">KSh {Number(r.cash).toFixed(2)}</TableCell>
                      <TableCell className="text-right">KSh {Number(r.mpesa).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">KSh {Number(r.total).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
