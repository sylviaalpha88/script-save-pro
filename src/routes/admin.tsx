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
import { createStaffUser, deleteStaffUser } from "@/lib/admin.functions";
import { Trash2, Users, DollarSign, ShoppingCart, TrendingUp } from "lucide-react";

const BASE_ADMIN_NAV = [
  { to: "/admin", label: "Dashboard" },
  { to: "/pharmacy", label: "Pharmacy" },
  { to: "/inventory", label: "Inventory" },
  { to: "/accountant", label: "Accountant" },
  { to: "/order-track", label: "Order Track" },
];

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
  const nav = profile?.can_edit_site
    ? [...BASE_ADMIN_NAV, { to: "/director", label: "Public Site" }]
    : BASE_ADMIN_NAV;
  return (
    <AppShell title="Admin Dashboard" nav={nav}>

      {!loading && profile?.role !== "admin" ? (
        <p className="text-destructive">Access denied. Admin only.</p>
      ) : (
        <Tabs defaultValue="sales" className="space-y-6">
          <TabsList>
            <TabsTrigger value="sales">Sales Overview</TabsTrigger>
            <TabsTrigger value="history">Per-Item History</TabsTrigger>
            <TabsTrigger value="reconcile">Reconciliation</TabsTrigger>
            <TabsTrigger value="users">Manage Users</TabsTrigger>
            <TabsTrigger value="info">Pharmacy Info</TabsTrigger>
          </TabsList>
          <TabsContent value="sales"><SalesPanel /></TabsContent>
          <TabsContent value="history"><PerItemHistory /></TabsContent>
          <TabsContent value="reconcile"><ReconciliationPanel /></TabsContent>
          <TabsContent value="users"><UsersPanel /></TabsContent>
          <TabsContent value="info"><PharmacyInfoPanel /></TabsContent>
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
  const create = useServerFn(createStaffUser);
  const del = useServerFn(deleteStaffUser);

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
          <form onSubmit={onCreate} className="space-y-3">
            <div><Label>Username</Label><Input value={username} onChange={e => setUsername(e.target.value)} required /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}/></div>
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
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Role</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell className="capitalize">{u.role}</TableCell>
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
