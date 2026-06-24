import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, FileText } from "lucide-react";

export const Route = createFileRoute("/pharmacy")({
  component: PharmacyPage,
});

type Drug = { id: string; name: string; unit: string; selling_price: number; selling_price_retail: number; selling_price_wholesale: number; wholesale_min_qty: number; stock_quantity: number };
type LineItem = { drug_id: string; drug_name: string; unit_price: number; quantity: number };

function PharmacyPage() {
  const { profile, loading } = useAuth();
  const nav = profile?.role === "admin"
    ? [{ to: "/admin", label: "Dashboard" }, { to: "/pharmacy", label: "Pharmacy" }, { to: "/inventory", label: "Inventory" }]
    : [{ to: "/pharmacy", label: "Pharmacy" }];
  return (
    <AppShell title="Pharmacy – Sales" nav={nav}>

      {!loading && profile && profile.role !== "pharmacy" && profile.role !== "admin" ? (
        <p className="text-destructive">Access denied.</p>
      ) : (
        <Tabs defaultValue="retail" className="space-y-6">
          <TabsList>
            <TabsTrigger value="retail">Retail (Patients)</TabsTrigger>
            <TabsTrigger value="wholesale">Wholesale</TabsTrigger>
            <TabsTrigger value="dispensed">Dispensed</TabsTrigger>
          </TabsList>
          <TabsContent value="retail"><RetailForm /></TabsContent>
          <TabsContent value="wholesale"><WholesaleForm /></TabsContent>
          <TabsContent value="dispensed"><DispensedPanel /></TabsContent>
        </Tabs>

      )}
    </AppShell>
  );
}

function useDrugs() {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  useEffect(() => {
    supabase.from("drugs").select("id,name,unit,selling_price,selling_price_retail,selling_price_wholesale,wholesale_min_qty,stock_quantity").order("name")
      .then(({ data }) => setDrugs((data as Drug[]) ?? []));
  }, []);
  return drugs;
}

type SaleMode = "retail" | "wholesale";

function DrugPicker({ drugs, mode, onAdd }: { drugs: Drug[]; mode: SaleMode; onAdd: (d: Drug, qty: number, unitPrice: number) => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Drug | null>(null);
  const [qty, setQty] = useState("1");

  const filtered = useMemo(() =>
    q.trim() ? drugs.filter(d => d.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []
  , [drugs, q]);

  const priceOf = (d: Drug) => mode === "wholesale" ? Number(d.selling_price_wholesale) : Number(d.selling_price_retail);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
        <div className="relative">
          <Input placeholder="Search drug…" value={q} onChange={e => { setQ(e.target.value); setSel(null); }} />
          {filtered.length > 0 && !sel && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
              {filtered.map(d => (
                <button type="button" key={d.id} onClick={() => { setSel(d); setQ(d.name); }}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between">
                  <span>{d.name} <span className="text-muted-foreground">({d.unit})</span></span>
                  <span className="text-muted-foreground">stock: {d.stock_quantity} · KSh {priceOf(d).toFixed(2)}{mode === "wholesale" ? ` · min ${d.wholesale_min_qty}` : ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="qty" />
        <Button type="button" disabled={!sel} onClick={() => {
          if (!sel) return;
          const n = Math.max(1, Number(qty) || 1);
          if (mode === "wholesale" && n < sel.wholesale_min_qty) {
            toast.error(`Wholesale requires at least ${sel.wholesale_min_qty} ${sel.unit}s of ${sel.name}`);
            return;
          }
          onAdd(sel, n, priceOf(sel)); setSel(null); setQ(""); setQty("1");
        }}><Plus className="h-4 w-4 mr-1"/>Add</Button>
      </div>
      {sel && mode === "wholesale" && (
        <p className="text-xs text-muted-foreground">Wholesale min for {sel.name}: {sel.wholesale_min_qty} {sel.unit}s @ KSh {priceOf(sel).toFixed(2)}</p>
      )}
    </div>
  );
}

function LineItemsTable({ items, onRemove }: { items: LineItem[]; onRemove: (i: number) => void }) {
  const total = items.reduce((a, b) => a + b.unit_price * b.quantity, 0);
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader><TableRow><TableHead>Drug</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No items</TableCell></TableRow>}
          {items.map((it, i) => (
            <TableRow key={i}>
              <TableCell>{it.drug_name}</TableCell>
              <TableCell className="text-right">{it.quantity}</TableCell>
              <TableCell className="text-right">KSh {it.unit_price.toFixed(2)}</TableCell>
              <TableCell className="text-right font-medium">KSh {(it.unit_price * it.quantity).toFixed(2)}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => onRemove(i)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end p-3 bg-muted/40 font-bold text-lg">Total: KSh {total.toFixed(2)}</div>
    </div>
  );
}

function RetailForm() {
  const drugs = useDrugs();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [pcode, setPcode] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [prescription, setPrescription] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const total = items.reduce((a, b) => a + b.unit_price * b.quantity, 0);

  const submit = async () => {
    if (items.length === 0) { toast.error("Add at least one drug"); return; }
    let patientId: string | null = null;
    if (name.trim()) {
      const { data: pat, error: pErr } = await supabase.from("patients").insert({
        name: name.trim(), age: age ? Number(age) : null, patient_code: pcode || null,
      }).select("id").single();
      if (pErr) { toast.error(pErr.message); return; }
      patientId = pat.id;
    }

    const { data: sale, error: sErr } = await supabase.from("sales").insert({
      sale_type: "retail",
      patient_id: patientId,
      customer_name: name.trim() || null,
      total,
      amount_paid: amountPaid ? Number(amountPaid) : 0,
      payment_method: paymentMethod || null,
    }).select("id").single();
    if (sErr) { toast.error(sErr.message); return; }

    const rows = items.map(it => ({
      sale_id: sale.id, drug_id: it.drug_id, drug_name: it.drug_name,
      quantity: it.quantity, unit_price: it.unit_price, subtotal: it.unit_price * it.quantity,
    }));
    const { error: iErr } = await supabase.from("sale_items").insert(rows);
    if (iErr) { toast.error(iErr.message); return; }

    toast.success("Sale recorded");
    navigate({ to: "/invoice/$id", params: { id: sale.id } });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Patient Info <span className="text-xs font-normal text-muted-foreground">(optional)</span></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Name (optional)</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="leave blank for walk-in" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Age</Label><Input type="number" value={age} onChange={e=>setAge(e.target.value)} /></div>
            <div><Label>Patient ID</Label><Input value={pcode} onChange={e=>setPcode(e.target.value)} /></div>
          </div>
          <div><Label>Prescription / Notes</Label><Input value={prescription} onChange={e=>setPrescription(e.target.value)} placeholder="optional notes" /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Prescribed Drugs</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <DrugPicker drugs={drugs} mode="retail" onAdd={(d, qty, unit_price) => setItems(prev => [...prev, { drug_id: d.id, drug_name: d.name, unit_price, quantity: qty }])} />
          <LineItemsTable items={items} onRemove={(i) => setItems(prev => prev.filter((_,idx)=>idx!==i))} />
          <PaymentFields total={total} amountPaid={amountPaid} setAmountPaid={setAmountPaid} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} />
          <Button className="w-full" onClick={submit}><FileText className="h-4 w-4 mr-2"/>Generate Invoice</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentFields({ total, amountPaid, setAmountPaid, paymentMethod, setPaymentMethod }: {
  total: number; amountPaid: string; setAmountPaid: (v: string) => void;
  paymentMethod: string; setPaymentMethod: (v: string) => void;
}) {
  const paid = amountPaid ? Number(amountPaid) : 0;
  const balance = total - paid;
  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/30">
      <div className="text-sm font-medium">Receive Payment <span className="text-xs font-normal text-muted-foreground">(optional)</span></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Amount received (KSh)</Label>
          <Input type="number" step="0.01" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label className="text-xs">Method</Label>
          <Input value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} placeholder="Cash / M-Pesa / Card" />
        </div>
      </div>
      {amountPaid && (
        <div className="text-xs flex justify-between">
          <span>Total: KSh {total.toFixed(2)}</span>
          <span className={balance > 0 ? "text-destructive font-medium" : "text-primary font-medium"}>
            {balance > 0 ? `Balance: KSh ${balance.toFixed(2)}` : balance < 0 ? `Change: KSh ${(-balance).toFixed(2)}` : "Paid in full"}
          </span>
        </div>
      )}
    </div>
  );
}

function WholesaleForm() {
  const drugs = useDrugs();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const total = items.reduce((a, b) => a + b.unit_price * b.quantity, 0);

  const submit = async () => {
    if (!customer || items.length === 0) { toast.error("Enter customer name and add drugs"); return; }
    const { data: sale, error: sErr } = await supabase.from("sales").insert({
      sale_type: "wholesale",
      customer_name: customer,
      total,
      amount_paid: amountPaid ? Number(amountPaid) : 0,
      payment_method: paymentMethod || null,
    }).select("id").single();
    if (sErr) { toast.error(sErr.message); return; }

    const rows = items.map(it => ({
      sale_id: sale.id, drug_id: it.drug_id, drug_name: it.drug_name,
      quantity: it.quantity, unit_price: it.unit_price, subtotal: it.unit_price * it.quantity,
    }));
    const { error: iErr } = await supabase.from("sale_items").insert(rows);
    if (iErr) { toast.error(iErr.message); return; }
    toast.success("Wholesale recorded");
    navigate({ to: "/invoice/$id", params: { id: sale.id } });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Wholesaler / Customer</CardTitle></CardHeader>
        <CardContent>
          <Label>Customer name</Label>
          <Input value={customer} onChange={e=>setCustomer(e.target.value)} required />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Add Drugs in Bulk</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <DrugPicker drugs={drugs} mode="wholesale" onAdd={(d, qty, unit_price) => setItems(prev => [...prev, { drug_id: d.id, drug_name: d.name, unit_price, quantity: qty }])} />
          <LineItemsTable items={items} onRemove={(i) => setItems(prev => prev.filter((_,idx)=>idx!==i))} />
          <PaymentFields total={total} amountPaid={amountPaid} setAmountPaid={setAmountPaid} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} />
          <Button className="w-full" onClick={submit}><FileText className="h-4 w-4 mr-2"/>Generate Invoice</Button>
        </CardContent>
      </Card>
    </div>
  );
}

type DispRow = {
  id: string;
  created_at: string;
  sale_id: string;
  drug_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  drug_id: string;
  sales: { sale_type: "retail" | "wholesale"; customer_name: string | null } | null;
  drugs: { stock_quantity: number; min_stock: number; unit: string } | null;
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

function DispensedPanel() {
  const [rows, setRows] = useState<DispRow[]>([]);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const navigate = useNavigate();

  const load = async () => {
    const { data, error } = await supabase
      .from("sale_items")
      .select("id, created_at, sale_id, drug_id, drug_name, quantity, unit_price, subtotal, sales(sale_type, customer_name), drugs(stock_quantity, min_stock, unit)")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { toast.error(error.message); return; }
    setRows((data as unknown as DispRow[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = q.trim()
    ? rows.filter(r =>
        r.drug_name.toLowerCase().includes(q.toLowerCase()) ||
        (r.sales?.customer_name ?? "").toLowerCase().includes(q.toLowerCase()))
    : rows;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Dispensed Drugs</div>
            <div className="text-xs text-muted-foreground">Showing drugs sold between selected dates. Defaults to today.</div>
          </div>
          <Input className="max-w-xs" placeholder="Search drug or customer…" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button onClick={load}>Apply</Button>
          <Button variant="outline" onClick={() => { const t = todayISO(); setFrom(t); setTo(t); setTimeout(load, 0); }}>Today</Button>
        </div>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Drug</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Stock Left</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No dispenses in selected range</TableCell></TableRow>}
              {filtered.map(r => {
                const stock = r.drugs?.stock_quantity ?? 0;
                const low = r.drugs ? stock < r.drugs.min_stock : false;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{r.sales?.sale_type ?? "—"}</TableCell>
                    <TableCell>{r.sales?.customer_name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.drug_name} <span className="text-xs text-muted-foreground">({r.drugs?.unit})</span></TableCell>
                    <TableCell className="text-right">{r.quantity}</TableCell>
                    <TableCell className="text-right">KSh {Number(r.subtotal).toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-medium ${low ? "text-destructive" : ""}`}>{stock}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/invoice/$id", params: { id: r.sale_id } })}>
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

