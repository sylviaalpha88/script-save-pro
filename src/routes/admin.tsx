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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createStaffUser, deleteStaffUser, setStaffPassword } from "@/lib/admin.functions";
import { Trash2, Users, DollarSign, ShoppingCart, TrendingUp, Eye, EyeOff } from "lucide-react";





export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Profile = { id: string; username: string; role: string; created_at: string };
type SaleRow = {
  id: string;
  sale_type: "retail" | "wholesale";
  total: number;
  created_at: string;
  customer_name: string | null;
  patient_id: string | null;
};

function AdminPage() {
  const { profile, loading } = useAuth();
  return (
    <AppShell title="Dashboard" subtitle="Sales, reports and administration">

      {!loading && (profile?.role !== "admin" || profile?.is_director) ? (
        <p className="text-destructive font-semibold">You don't have permission to access this page.</p>
      ) : (
        <Tabs defaultValue="sales" className="space-y-6">
          <TabsList>
            <TabsTrigger value="sales">Sales Overview</TabsTrigger>
            <TabsTrigger value="history">Per-Item History</TabsTrigger>
            <TabsTrigger value="reconcile">Reconciliation</TabsTrigger>
            <TabsTrigger value="users">Manage Users</TabsTrigger>
            <TabsTrigger value="info">Pharmacy Info</TabsTrigger>
            <TabsTrigger value="track">Order Track</TabsTrigger>
          </TabsList>
          <TabsContent value="sales"><SalesPanel /></TabsContent>
          <TabsContent value="history"><PerItemHistory /></TabsContent>
          <TabsContent value="reconcile"><ReconciliationPanel /></TabsContent>
          <TabsContent value="users"><UsersPanel /></TabsContent>
          <TabsContent value="info"><PharmacyInfoPanel /></TabsContent>
          <TabsContent value="track"><AdminOrderTrackPanel /></TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

type SaleWithPay = SaleRow & { amount_paid: number; payment_method: string | null };
type SaleItemRow = { drug_name: string; quantity: number; subtotal: number; created_at: string; sales: { sale_type: "retail" | "wholesale" } | null };

function SalesPanel() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState<SaleWithPay[]>([]);
  const [items, setItems] = useState<SaleItemRow[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from("sales")
      .select("id, sale_type, total, created_at, customer_name, patient_id, amount_paid, payment_method")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRows((data as SaleWithPay[]) ?? []);

    const { data: it, error: iErr } = await supabase
      .from("sale_items")
      .select("drug_name, quantity, subtotal, created_at, sales(sale_type)")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false });
    if (iErr) { toast.error(iErr.message); return; }
    setItems((it as unknown as SaleItemRow[]) ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const retail = rows.filter(r => r.sale_type === "retail");
  const whole = rows.filter(r => r.sale_type === "wholesale");
  const sum = (arr: SaleWithPay[]) => arr.reduce((a, b) => a + Number(b.total), 0);
  const isMpesa = (m: string | null) => !!m && /mpesa|m-pesa/i.test(m);
  const isCash = (m: string | null) => !!m && /cash/i.test(m);
  const sumPaid = (filter: (m: string | null) => boolean) =>
    rows.filter(r => filter(r.payment_method)).reduce((a, b) => a + Number(b.amount_paid), 0);
  const cashTotal = sumPaid(isCash);
  const mpesaTotal = sumPaid(isMpesa);

  const retailItems = items.filter(i => i.sales?.sale_type === "retail");
  const wholeItems = items.filter(i => i.sales?.sale_type === "wholesale");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Filter</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
            <Button onClick={load}>Apply</Button>
            <Button variant="outline" onClick={() => { const t = todayISO(); setFrom(t); setTo(t); setTimeout(load, 0); }}>Today</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={<ShoppingCart className="h-5 w-5"/>} label="Retail Sales" value={`KSh ${sum(retail).toFixed(2)}`} sub={`${retail.length} transactions`} />
        <StatCard icon={<TrendingUp className="h-5 w-5"/>} label="Wholesale Sales" value={`KSh ${sum(whole).toFixed(2)}`} sub={`${whole.length} transactions`} />
        <StatCard icon={<DollarSign className="h-5 w-5"/>} label="Total" value={`KSh ${sum(rows).toFixed(2)}`} sub={`${rows.length} transactions`} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <StatCard icon={<DollarSign className="h-5 w-5"/>} label="Cash Received" value={`KSh ${cashTotal.toFixed(2)}`} sub={`for ${from} → ${to}`} />
        <StatCard icon={<DollarSign className="h-5 w-5"/>} label="M-Pesa Received" value={`KSh ${mpesaTotal.toFixed(2)}`} sub={`for ${from} → ${to}`} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <SalesTable title="Retail" rows={retail} />
        <SalesTable title="Wholesale" rows={whole} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <ItemsTable title="Retail Items" rows={retailItems} />
        <ItemsTable title="Wholesale Items" rows={wholeItems} />
      </div>
    </div>
  );
}

function ItemsTable({ title, rows }: { title: string; rows: SaleItemRow[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Drug</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No items in range</TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.drug_name}</TableCell>
                <TableCell className="text-right">{r.quantity}</TableCell>
                <TableCell className="text-right">KSh {Number(r.subtotal).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{sub}</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SalesTable({ title, rows }: { title: string; rows: SaleRow[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title} Sales</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No sales</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.customer_name ?? "—"}</TableCell>
                <TableCell className="text-right font-medium">KSh {Number(r.total).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type ItemAgg = { drug_name: string; day: string; quantity: number; revenue: number };

function PerItemHistory() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState<ItemAgg[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from("sale_items")
      .select("drug_name, quantity, subtotal, created_at")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`);
    if (error) { toast.error(error.message); return; }
    const map = new Map<string, ItemAgg>();
    (data ?? []).forEach((r: any) => {
      const day = String(r.created_at).slice(0, 10);
      const key = `${day}__${r.drug_name}`;
      const ex = map.get(key) ?? { day, drug_name: r.drug_name, quantity: 0, revenue: 0 };
      ex.quantity += Number(r.quantity);
      ex.revenue += Number(r.subtotal);
      map.set(key, ex);
    });
    setRows([...map.values()].sort((a, b) => (a.day < b.day ? 1 : -1)));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <Card>
      <CardHeader><CardTitle>Total Sales Per Item Per Day</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button onClick={load}>Apply</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Drug</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No data</TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.day}</TableCell>
                <TableCell>{r.drug_name}</TableCell>
                <TableCell className="text-right">{r.quantity}</TableCell>
                <TableCell className="text-right">KSh {r.revenue.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"pharmacy" | "inventory" | "accountant" | "order_track">("pharmacy");
  const [search, setSearch] = useState("");
  const create = useServerFn(createStaffUser);
  const del = useServerFn(deleteStaffUser);

  const filteredUsers = search.trim()
    ? users.filter(u => [u.username, u.role].some(v => (v ?? "").toLowerCase().includes(search.toLowerCase())))
    : users;

  const load = async () => {
    // RLS scopes this to the admin's own pharmacy; hide other admins (you only manage your staff).
    const { data } = await supabase
      .from("profiles")
      .select("id, username, role, created_at")
      .neq("role", "admin")
      .order("created_at", { ascending: false });
    setUsers((data as Profile[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create({ data: { username, password, role } });
      toast.success("User created");
      setUsername(""); setPassword("");
      await load();
    } catch (err) { toast.error((err as Error).message); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Add Staff</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-3" autoComplete="off">
            <div><Label>Username</Label><Input name="new-user-username" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="off" autoCorrect="off" spellCheck={false} /></div>
            <div><Label>Password</Label><Input name="new-user-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" /></div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pharmacy">Pharmacy</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="order_track">Order Track (Delivery)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">Create user</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Search users by name or role…" value={search} onChange={e => setSearch(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Passwords are stored one-way encrypted, so an existing password can never be displayed.
            Type a new password beside a user and click Save to change it.
          </p>
          <Table>
            <TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Role</TableHead><TableHead>Password</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredUsers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">No users match your search.</TableCell></TableRow>}
              {filteredUsers.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell className="capitalize">{u.role}</TableCell>
                  <TableCell><PasswordCell userId={u.id} username={u.username} /></TableCell>
                  <TableCell className="text-right">
                    {u.role !== "admin" && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        if (!confirm(`Delete ${u.username}?`)) return;
                        try { await del({ data: { userId: u.id } }); toast.success("Deleted"); await load(); }
                        catch (e) { toast.error((e as Error).message); }
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
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

function PasswordCell({ userId, username }: { userId: string; username: string }) {
  const setPw = useServerFn(setStaffPassword);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (value.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    try {
      await setPw({ data: { userId, password: value } });
      toast.success(`Password changed for ${username}`);
      setValue(""); setShow(false);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-8 w-36"
        type={show ? "text" : "password"}
        autoComplete="new-password"
        placeholder="New password"
        value={value}
        onChange={e => setValue(e.target.value)}
      />
      <Button size="sm" variant="ghost" type="button" onClick={() => setShow(s => !s)} title={show ? "Hide" : "Show"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      <Button size="sm" variant="outline" disabled={busy || !value} onClick={save}>Save</Button>
    </div>
  );
}


type ReportRow = { id: string; report_date: string; cash: number; mpesa: number; total: number; notes: string | null; created_at: string };

function ReconciliationPanel() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [sales, setSales] = useState<SaleWithPay[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);

  const load = async () => {
    const { data: s, error: sErr } = await supabase
      .from("sales")
      .select("id, sale_type, total, created_at, customer_name, patient_id, amount_paid, payment_method")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`);
    if (sErr) { toast.error(sErr.message); return; }
    setSales((s as SaleWithPay[]) ?? []);

    const { data: r, error: rErr } = await supabase
      .from("accountant_reports")
      .select("id, report_date, cash, mpesa, total, notes, created_at")
      .gte("report_date", from)
      .lte("report_date", to)
      .order("report_date", { ascending: false });
    if (rErr) { toast.error(rErr.message); return; }
    setReports((r as ReportRow[]) ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const isMpesa = (m: string | null) => !!m && /mpesa|m-pesa/i.test(m);
  const isCash = (m: string | null) => !!m && /cash/i.test(m);
  const sysCash = sales.filter(r => isCash(r.payment_method)).reduce((a, b) => a + Number(b.amount_paid), 0);
  const sysMpesa = sales.filter(r => isMpesa(r.payment_method)).reduce((a, b) => a + Number(b.amount_paid), 0);
  const sysTotal = sysCash + sysMpesa;

  const repCash = reports.reduce((a, b) => a + Number(b.cash), 0);
  const repMpesa = reports.reduce((a, b) => a + Number(b.mpesa), 0);
  const repTotal = reports.reduce((a, b) => a + Number(b.total), 0);

  const dCash = repCash - sysCash;
  const dMpesa = repMpesa - sysMpesa;
  const dTotal = repTotal - sysTotal;

  const fmtDev = (n: number) => {
    if (Math.abs(n) < 0.005) return <span className="text-green-600 font-semibold">0.00 ✓</span>;
    const sign = n > 0 ? "+" : "-";
    return <span className="text-red-600 font-semibold">{sign} KSh {Math.abs(n).toFixed(2)}</span>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Filter</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
            <Button onClick={load}>Apply</Button>
            <Button variant="outline" onClick={() => { const t = todayISO(); setFrom(t); setTo(t); setTimeout(load, 0); }}>Today</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Reconciliation ({from} → {to})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">System (Sales)</TableHead>
                <TableHead className="text-right">Accountant Reported</TableHead>
                <TableHead className="text-right">Deviation (Reported − System)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Cash</TableCell>
                <TableCell className="text-right">KSh {sysCash.toFixed(2)}</TableCell>
                <TableCell className="text-right">KSh {repCash.toFixed(2)}</TableCell>
                <TableCell className="text-right">{fmtDev(dCash)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">M-Pesa</TableCell>
                <TableCell className="text-right">KSh {sysMpesa.toFixed(2)}</TableCell>
                <TableCell className="text-right">KSh {repMpesa.toFixed(2)}</TableCell>
                <TableCell className="text-right">{fmtDev(dMpesa)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-right font-bold">KSh {sysTotal.toFixed(2)}</TableCell>
                <TableCell className="text-right font-bold">KSh {repTotal.toFixed(2)}</TableCell>
                <TableCell className="text-right">{fmtDev(dTotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">Red deviations mean the accountant's report differs from sales. + means accountant reported more than the system; − means less.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Accountant Submissions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Cash</TableHead><TableHead className="text-right">M-Pesa</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
            <TableBody>
              {reports.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No reports submitted</TableCell></TableRow>}
              {reports.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.report_date}</TableCell>
                  <TableCell className="text-right">KSh {Number(r.cash).toFixed(2)}</TableCell>
                  <TableCell className="text-right">KSh {Number(r.mpesa).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">KSh {Number(r.total).toFixed(2)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.notes ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// =============== Pharmacy Info Panel ===============
type PharmacyRow = { id: string; name: string; phone: string | null; email: string | null; address: string | null; postal_address: string | null; location: string | null; logo_path: string | null };

function PharmacyInfoPanel() {
  const { profile } = useAuth();
  const [row, setRow] = useState<PharmacyRow | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!profile?.pharmacy_id) return;
    const { data } = await supabase.from("pharmacies")
      .select("id, name, phone, email, address, postal_address, location, logo_path")
      .eq("id", profile.pharmacy_id).maybeSingle();

    setRow(data as PharmacyRow);
    if (data?.logo_path) {
      const { data: signed } = await supabase.storage.from("pharmacy-logos").createSignedUrl(data.logo_path, 3600);
      setLogoUrl(signed?.signedUrl ?? null);
    } else setLogoUrl(null);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.pharmacy_id]);

  if (!profile?.pharmacy_id) return <p className="text-muted-foreground">No pharmacy linked to your account.</p>;
  if (!row) return <p className="text-muted-foreground">Loading…</p>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("pharmacies").update({
      name: row.name, phone: row.phone, email: row.email, address: row.address,
      postal_address: row.postal_address, location: row.location,
    }).eq("id", row.id);

    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Pharmacy info saved");
  };

  const uploadLogo = async (file: File) => {
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
    <Card>
      <CardHeader><CardTitle>Pharmacy Information</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex items-center gap-4">
            {logoUrl ? <img src={logoUrl} alt="logo" className="h-20 w-20 rounded-lg object-cover border"/> : <div className="h-20 w-20 rounded-lg border bg-muted flex items-center justify-center text-xs text-muted-foreground">No logo</div>}
            <div>
              <Label className="text-xs">Pharmacy Logo</Label>
              <Input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
            </div>
          </div>
          <div><Label>Pharmacy name</Label><Input value={row.name ?? ""} onChange={e => setRow({...row, name: e.target.value})} required/></div>
          <div><Label>Phone number</Label><Input value={row.phone ?? ""} onChange={e => setRow({...row, phone: e.target.value})}/></div>
          <div><Label>Email address</Label><Input type="email" value={row.email ?? ""} onChange={e => setRow({...row, email: e.target.value})}/></div>
          <div><Label>Postal address</Label><Input value={row.postal_address ?? ""} onChange={e => setRow({...row, postal_address: e.target.value})} placeholder="e.g. 1234-20100, Nakuru"/></div>
          <div><Label>Location / street address</Label><Input value={row.location ?? ""} onChange={e => setRow({...row, location: e.target.value})} placeholder="Town / street"/></div>
          <div className="sm:col-span-2"><Label>Physical address (extra details)</Label><Textarea rows={2} value={row.address ?? ""} onChange={e => setRow({...row, address: e.target.value})}/></div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save pharmacy info"}</Button>
            <p className="text-xs text-muted-foreground mt-2">
              The name and logo saved here replace “LEMSA PMS” at the top of every page and appear on every printed or downloaded PDF.
            </p>
          </div>
        </form>

      </CardContent>
    </Card>
  );
}

type AdminTrackEv = {
  id: string; order_id: string; location_name: string | null;
  latitude: number | null; longitude: number | null;
  note: string | null; created_at: string;
  buyer_orders: { id: string; status: string; wholesale_buyers: { name: string } | null } | null;
};

function AdminOrderTrackPanel() {
  const [events, setEvents] = useState<AdminTrackEv[]>([]);
  const [filter, setFilter] = useState("");

  const load = async () => {
    const { data } = await supabase.from("order_tracking_events")
      .select("id, order_id, location_name, latitude, longitude, note, created_at, buyer_orders(id, status, wholesale_buyers(name))")
      .order("created_at", { ascending: false }).limit(200);
    setEvents((data as any) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-tracking")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_tracking_events" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = events.filter(e => {
    if (!filter.trim()) return true;
    const f = filter.toLowerCase();
    return (e.buyer_orders?.wholesale_buyers?.name ?? "").toLowerCase().includes(f)
      || e.order_id.toLowerCase().includes(f)
      || (e.location_name ?? "").toLowerCase().includes(f);
  });

  // Group by order, show latest event per order at top
  const latestByOrder = new Map<string, AdminTrackEv>();
  for (const e of filtered) {
    if (!latestByOrder.has(e.order_id)) latestByOrder.set(e.order_id, e);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Active deliveries — latest known location</CardTitle></CardHeader>
        <CardContent>
          <Input placeholder="Search by buyer, order id, or place…" value={filter} onChange={e => setFilter(e.target.value)} className="mb-3 max-w-sm"/>
          <Table>
            <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Buyer</TableHead><TableHead>Last update</TableHead><TableHead>Location</TableHead><TableHead>GPS</TableHead></TableRow></TableHeader>
            <TableBody>
              {latestByOrder.size === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No tracking data yet</TableCell></TableRow>}
              {Array.from(latestByOrder.values()).map(e => (
                <TableRow key={e.order_id}>
                  <TableCell className="text-xs">#{e.order_id.slice(0,8)}</TableCell>
                  <TableCell>{e.buyer_orders?.wholesale_buyers?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
                  <TableCell>{e.location_name ?? (e.note === "Live GPS" ? "Live GPS" : "—")}</TableCell>
                  <TableCell className="text-xs">{e.latitude != null && e.longitude != null ? (
                    <a className="text-primary underline" href={`https://maps.google.com/?q=${e.latitude},${e.longitude}`} target="_blank" rel="noreferrer">
                      {e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}
                    </a>
                  ) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>All tracking events (latest 200)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Order</TableHead><TableHead>Buyer</TableHead><TableHead>Location</TableHead><TableHead>GPS</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">#{e.order_id.slice(0,8)}</TableCell>
                  <TableCell>{e.buyer_orders?.wholesale_buyers?.name ?? "—"}</TableCell>
                  <TableCell>{e.location_name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{e.latitude != null && e.longitude != null ? (
                    <a className="text-primary underline" href={`https://maps.google.com/?q=${e.latitude},${e.longitude}`} target="_blank" rel="noreferrer">
                      {e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}
                    </a>
                  ) : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
