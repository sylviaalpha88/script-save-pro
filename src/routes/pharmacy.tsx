import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { registerBuyer } from "@/lib/buyer.functions";
import { deleteBuyerAccount } from "@/lib/admin.functions";
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
    ? [{ to: "/admin", label: "Dashboard" }, { to: "/pharmacy", label: "Pharmacy" }, { to: "/inventory", label: "Inventory" }, { to: "/accountant", label: "Accountant" }]
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
            <TabsTrigger value="buyers">Buyer Accounts</TabsTrigger>
            <TabsTrigger value="buyer_orders">Buyer Orders</TabsTrigger>
          </TabsList>
          <TabsContent value="retail"><RetailForm /></TabsContent>
          <TabsContent value="wholesale"><WholesaleForm /></TabsContent>
          <TabsContent value="dispensed"><DispensedPanel /></TabsContent>
          <TabsContent value="buyers"><BuyersPanel /></TabsContent>
          <TabsContent value="buyer_orders"><BuyerOrdersPanel /></TabsContent>
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
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [pcode, setPcode] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [prescription, setPrescription] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const total = items.reduce((a, b) => a + b.unit_price * b.quantity, 0);
  useEffect(() => { setAmountPaid(total > 0 ? total.toFixed(2) : ""); }, [total]);

  const submit = async (mode: "invoice" | "bill") => {
    if (items.length === 0) { toast.error("Add at least one drug"); return; }
    const pharmacyId = profile?.pharmacy_id;
    if (!pharmacyId) { toast.error("Your account is not linked to a pharmacy"); return; }
    let patientId: string | null = null;
    if (name.trim()) {
      const { data: pat, error: pErr } = await supabase.from("patients").insert({
        name: name.trim(), age: age ? Number(age) : null, patient_code: pcode || null,
        pharmacy_id: pharmacyId,
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
      pharmacy_id: pharmacyId,
    }).select("id").single();
    if (sErr) { toast.error(sErr.message); return; }

    const rows = items.map(it => ({
      sale_id: sale.id, drug_id: it.drug_id, drug_name: it.drug_name,
      quantity: it.quantity, unit_price: it.unit_price, subtotal: it.unit_price * it.quantity,
      pharmacy_id: pharmacyId,
    }));
    const { error: iErr } = await supabase.from("sale_items").insert(rows);
    if (iErr) { toast.error(iErr.message); return; }

    if (mode === "invoice") {
      toast.success("Sale recorded");
      navigate({ to: "/invoice/$id", params: { id: sale.id } });
    } else {
      toast.success(`Bill recorded · KSh ${total.toFixed(2)}`);
      setItems([]); setName(""); setAge(""); setPcode(""); setPrescription(""); setAmountPaid(""); setPaymentMethod("");
    }
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
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => submit("bill")}>Record Bill</Button>
            <Button onClick={() => submit("invoice")}><FileText className="h-4 w-4 mr-2"/>Generate Invoice</Button>
          </div>
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
  const { profile } = useAuth();
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const total = items.reduce((a, b) => a + b.unit_price * b.quantity, 0);
  useEffect(() => { setAmountPaid(total > 0 ? total.toFixed(2) : ""); }, [total]);

  const submit = async (mode: "invoice" | "bill") => {
    if (!customer || items.length === 0) { toast.error("Enter customer name and add drugs"); return; }
    const pharmacyId = profile?.pharmacy_id;
    if (!pharmacyId) { toast.error("Your account is not linked to a pharmacy"); return; }
    const { data: sale, error: sErr } = await supabase.from("sales").insert({
      sale_type: "wholesale",
      customer_name: customer,
      total,
      amount_paid: amountPaid ? Number(amountPaid) : 0,
      payment_method: paymentMethod || null,
      pharmacy_id: pharmacyId,
    }).select("id").single();
    if (sErr) { toast.error(sErr.message); return; }

    const rows = items.map(it => ({
      sale_id: sale.id, drug_id: it.drug_id, drug_name: it.drug_name,
      quantity: it.quantity, unit_price: it.unit_price, subtotal: it.unit_price * it.quantity,
      pharmacy_id: pharmacyId,
    }));
    const { error: iErr } = await supabase.from("sale_items").insert(rows);
    if (iErr) { toast.error(iErr.message); return; }
    if (mode === "invoice") {
      toast.success("Wholesale recorded");
      navigate({ to: "/invoice/$id", params: { id: sale.id } });
    } else {
      toast.success(`Bill recorded · KSh ${total.toFixed(2)}`);
      setItems([]); setCustomer(""); setAmountPaid(""); setPaymentMethod("");
    }
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
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => submit("bill")}>Record Bill</Button>
            <Button onClick={() => submit("invoice")}><FileText className="h-4 w-4 mr-2"/>Generate Invoice</Button>
          </div>
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


// =============== BUYER ACCOUNTS PANEL ===============

type WBuyer = {
  id: string; user_id: string | null; name: string; email: string | null;
  id_number: string | null; phone: string | null; location: string | null;
  license_number: string | null; license_pdf_path: string | null;
  status: string; created_at: string;
};

function BuyersPanel() {
  const { profile } = useAuth();
  const register = useServerFn(registerBuyer);
  const delBuyer = useServerFn(deleteBuyerAccount);
  const drugs = useDrugs();
  const [buyers, setBuyers] = useState<WBuyer[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", idNumber: "", phone: "", location: "", licenseNumber: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [orderFor, setOrderFor] = useState<WBuyer | null>(null);
  const [orderItems, setOrderItems] = useState<LineItem[]>([]);

  const load = async () => {
    const { data } = await supabase.from("wholesale_buyers")
      .select("id, user_id, name, email, id_number, phone, location, license_number, license_pdf_path, status, created_at")
      .order("created_at", { ascending: false });
    setBuyers((data as WBuyer[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = q.trim() ? buyers.filter(b =>
    [b.name, b.email, b.phone, b.id_number].some(v => (v ?? "").toLowerCase().includes(q.toLowerCase()))
  ) : buyers;

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("wholesale_buyers").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Buyer ${status}`); load();
  };

  const openLicense = async (path: string) => {
    const { data, error } = await supabase.storage.from("licenses").createSignedUrl(path, 300);
    if (error || !data) { toast.error(error?.message ?? "Failed"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.pharmacy_id) { toast.error("No pharmacy"); return; }
    setBusy(true);
    try {
      await register({ data: { ...form, pharmacyId: profile.pharmacy_id } });
      toast.success("Buyer registered");
      setForm({ name: "", idNumber: "", phone: "", location: "", licenseNumber: "", email: "", password: "" });
      setShowForm(false); load();
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  const startOrder = (b: WBuyer) => {
    if (b.status !== "approved") { toast.error("Approve buyer first"); return; }
    setOrderFor(b); setOrderItems([]);
  };

  const submitOrder = async () => {
    if (!orderFor || !profile?.pharmacy_id) return;
    const pharmacyId = profile.pharmacy_id;
    if (orderItems.length === 0) { toast.error("Add at least one drug"); return; }
    const total = orderItems.reduce((a, b) => a + b.unit_price * b.quantity, 0);
    const { data: order, error: oErr } = await supabase.from("buyer_orders").insert({
      buyer_id: orderFor.id, pharmacy_id: pharmacyId,
      total, status: "reviewed", payment_status: "unpaid",
    }).select("id").single();
    if (oErr) { toast.error(oErr.message); return; }
    const rows = orderItems.map(it => ({
      order_id: order.id, pharmacy_id: pharmacyId,
      drug_id: it.drug_id, drug_name: it.drug_name,
      requested_qty: it.quantity, approved_qty: it.quantity,
      unit_price: it.unit_price, subtotal: it.unit_price * it.quantity,
      status: "approved", flagged_out_of_stock: false,
    }));
    const { error: iErr } = await supabase.from("buyer_order_items").insert(rows);
    if (iErr) { toast.error(iErr.message); return; }
    toast.success("Order created · go to Buyer Orders to record payment");
    setOrderFor(null); setOrderItems([]);
  };

  return (
    <Card><CardContent className="p-5 space-y-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="font-semibold">Wholesale Buyer Accounts</div>
        <div className="flex gap-2">
          <Input className="w-56" placeholder="Search name/email/phone/ID…" value={q} onChange={e => setQ(e.target.value)} />
          <Button size="sm" onClick={() => setShowForm(s => !s)}><Plus className="h-4 w-4 mr-1"/>Register buyer</Button>
        </div>
      </div>
      {showForm && (
        <form onSubmit={submitForm} className="grid sm:grid-cols-2 gap-3 p-3 border rounded-md bg-muted/30">
          <div><Label className="text-xs">Name/Facility</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required/></div>
          <div><Label className="text-xs">ID Number</Label><Input value={form.idNumber} onChange={e => setForm({...form, idNumber: e.target.value})} required/></div>
          <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required/></div>
          <div><Label className="text-xs">Location</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} required/></div>
          <div><Label className="text-xs">License #</Label><Input value={form.licenseNumber} onChange={e => setForm({...form, licenseNumber: e.target.value})} required/></div>
          <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required/></div>
          <div><Label className="text-xs">Password</Label><Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={6}/></div>
          <div className="sm:col-span-2"><Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Create buyer account"}</Button></div>
        </form>
      )}
      {orderFor && (
        <div className="p-3 border rounded-md bg-muted/30 space-y-3">
          <div className="flex justify-between items-center">
            <div className="font-medium">New wholesale order for <span className="text-primary">{orderFor.name}</span></div>
            <Button size="sm" variant="ghost" onClick={() => { setOrderFor(null); setOrderItems([]); }}>Close</Button>
          </div>
          <DrugPicker drugs={drugs} mode="wholesale" onAdd={(d, qty, unit_price) => setOrderItems(prev => [...prev, { drug_id: d.id, drug_name: d.name, unit_price, quantity: qty }])} />
          <LineItemsTable items={orderItems} onRemove={(i) => setOrderItems(prev => prev.filter((_,idx) => idx !== i))} />
          <Button onClick={submitOrder} disabled={orderItems.length === 0} className="w-full"><FileText className="h-4 w-4 mr-2"/>Create Order (await payment)</Button>
        </div>
      )}
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>ID</TableHead><TableHead>License</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No buyers yet</TableCell></TableRow>}
            {filtered.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}<div className="text-xs text-muted-foreground">{b.location}</div></TableCell>
                <TableCell>{b.email}</TableCell>
                <TableCell>{b.phone}</TableCell>
                <TableCell>{b.id_number}</TableCell>
                <TableCell>{b.license_number}{b.license_pdf_path && <Button variant="link" size="sm" onClick={() => openLicense(b.license_pdf_path!)}>view PDF</Button>}</TableCell>
                <TableCell><span className={b.status === "approved" ? "text-green-600" : b.status === "rejected" ? "text-destructive" : "text-amber-600"}>{b.status}</span></TableCell>
                <TableCell className="text-right space-x-1 whitespace-nowrap">
                  {b.status !== "approved" && <Button size="sm" onClick={() => setStatus(b.id, "approved")}>Approve</Button>}
                  {b.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "rejected")}>Reject</Button>}
                  {b.status === "approved" && <Button size="sm" variant="secondary" onClick={() => startOrder(b)}><Plus className="h-4 w-4 mr-1"/>Order</Button>}
                  <Button size="sm" variant="ghost" onClick={async () => {
                    if (!confirm(`Delete buyer ${b.name}? This removes their login and order history.`)) return;
                    try { await delBuyer({ data: { buyerId: b.id } }); toast.success("Buyer deleted"); load(); }
                    catch (e) { toast.error((e as Error).message); }
                  }}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardContent></Card>
  );
}

// =============== BUYER ORDERS PANEL ===============
type BOrder = {
  id: string; buyer_id: string; created_at: string; status: string;
  payment_status: string; total: number; amount_paid: number;
  wholesale_buyers: { name: string; email: string | null; phone: string | null; id_number: string | null } | null;
};
type BOItem = {
  id: string; order_id: string; drug_id: string | null; drug_name: string;
  requested_qty: number; approved_qty: number | null; unit_price: number;
  subtotal: number; status: string; reject_reason: string | null; flagged_out_of_stock: boolean;
};

function BuyerOrdersPanel() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<BOrder[]>([]);
  const [items, setItems] = useState<Record<string, BOItem[]>>({});
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const load = async () => {
    const { data: os } = await supabase.from("buyer_orders")
      .select("id, buyer_id, created_at, status, payment_status, total, amount_paid, wholesale_buyers(name, email, phone, id_number)")
      .gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false });
    setOrders((os as unknown as BOrder[]) ?? []);
    const ids = (os ?? []).map((o: any) => o.id);
    if (ids.length) {
      const { data: its } = await supabase.from("buyer_order_items")
        .select("*").in("order_id", ids);
      const grouped: Record<string, BOItem[]> = {};
      (its ?? []).forEach((it: any) => { (grouped[it.order_id] ||= []).push(it); });
      setItems(grouped);
    } else setItems({});
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filteredOrders = search.trim()
    ? orders.filter(o => {
        const b = o.wholesale_buyers; if (!b) return false;
        const s = search.toLowerCase();
        return [b.name, b.email, b.phone, b.id_number].some(v => (v ?? "").toLowerCase().includes(s));
      })
    : orders;

  const decideItem = async (item: BOItem, status: "approved" | "rejected", approvedQty?: number, reason?: string) => {
    const aQ = status === "approved" ? (approvedQty ?? item.requested_qty) : 0;
    const sub = status === "approved" ? aQ * Number(item.unit_price) : 0;
    const { error } = await supabase.from("buyer_order_items").update({
      status, approved_qty: aQ, subtotal: sub, reject_reason: status === "rejected" ? (reason ?? null) : null,
    }).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const finalizeReview = async (order: BOrder) => {
    const its = items[order.id] ?? [];
    if (its.some(i => i.status === "pending")) { toast.error("Decide every item first"); return; }
    const total = its.filter(i => i.status === "approved").reduce((a, b) => a + Number(b.subtotal), 0);
    const { error } = await supabase.from("buyer_orders").update({ status: "reviewed", total }).eq("id", order.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Order reviewed. Pending payment.");
    load();
  };

  const recordPayment = async (order: BOrder, method: string) => {
    const its = (items[order.id] ?? []).filter(i => i.status === "approved");
    if (its.length === 0) { toast.error("No approved items"); return; }
    const total = its.reduce((a, b) => a + Number(b.subtotal), 0);
    // Create sales + sale_items so stock decrements and revenue counts.
    const { data: sale, error: sErr } = await supabase.from("sales").insert({
      sale_type: "wholesale",
      customer_name: order.wholesale_buyers?.name ?? "Buyer",
      total, amount_paid: total, payment_method: method,
      pharmacy_id: profile?.pharmacy_id,
    }).select("id").single();
    if (sErr) { toast.error(sErr.message); return; }
    const rows = its.filter(i => i.drug_id).map(i => ({
      sale_id: sale.id, drug_id: i.drug_id!, drug_name: i.drug_name,
      quantity: i.approved_qty ?? i.requested_qty, unit_price: Number(i.unit_price),
      subtotal: Number(i.subtotal), pharmacy_id: profile?.pharmacy_id,
    }));
    if (rows.length) await supabase.from("sale_items").insert(rows);
    const { error: oErr } = await supabase.from("buyer_orders").update({
      payment_status: "paid", status: "paid", amount_paid: total, payment_method: method,
    }).eq("id", order.id);
    if (oErr) { toast.error(oErr.message); return; }
    toast.success("Payment recorded · invoice marked PAID");
    load();
  };

  return (
    <Card><CardContent className="p-5 space-y-4">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="font-semibold">Buyer Orders</div>
        <Input className="w-64" placeholder="Search buyer name / ID / phone / email…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <Button size="sm" onClick={load}>Apply</Button>
        <Button size="sm" variant="outline" onClick={() => { const t = todayISO(); setFrom(t); setTo(t); setTimeout(load, 0); }}>Today</Button>
      </div>
      <div className="space-y-4">
        {filteredOrders.length === 0 && <p className="text-muted-foreground text-center py-6">No orders in range</p>}
        {filteredOrders.map(o => (
          <div key={o.id} className="border rounded-md p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{o.wholesale_buyers?.name ?? "Buyer"} <span className="text-xs text-muted-foreground">#{o.id.slice(0,8)}</span></div>
                <div className="text-xs text-muted-foreground">{o.wholesale_buyers?.phone} · {o.wholesale_buyers?.email} · ID {o.wholesale_buyers?.id_number} · {new Date(o.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-muted">{o.status}</span>
                <span className={`px-2 py-1 rounded ${o.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{o.payment_status}</span>
              </div>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Drug</TableHead><TableHead className="text-right">Req</TableHead><TableHead className="text-right">Unit</TableHead><TableHead>Stock</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {(items[o.id] ?? []).map(it => (
                  <ItemRow key={it.id} item={it} canEdit={o.status === "pending"} onDecide={decideItem} />
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end gap-2">
              {o.status === "pending" && <Button size="sm" onClick={() => finalizeReview(o)}>Finalize review</Button>}
              {o.status === "reviewed" && o.payment_status === "unpaid" && (
                <PaymentReceive onPay={(m) => recordPayment(o, m)} total={Number(o.total)} />
              )}
            </div>
          </div>
        ))}
      </div>
    </CardContent></Card>
  );
}

function ItemRow({ item, canEdit, onDecide }: { item: BOItem; canEdit: boolean; onDecide: (i: BOItem, s: "approved"|"rejected", q?: number, r?: string) => void }) {
  const [aQ, setAQ] = useState(String(item.requested_qty));
  const [reason, setReason] = useState("");
  return (
    <TableRow>
      <TableCell>{item.drug_name}</TableCell>
      <TableCell className="text-right">{item.requested_qty}</TableCell>
      <TableCell className="text-right">KSh {Number(item.unit_price).toFixed(2)}</TableCell>
      <TableCell className="text-xs">{item.flagged_out_of_stock ? <span className="text-destructive">out of stock</span> : <span className="text-green-600">in stock</span>}</TableCell>
      <TableCell className="text-xs">
        {item.status === "approved" && <span className="text-green-600">approved · {item.approved_qty}</span>}
        {item.status === "rejected" && <span className="text-destructive">rejected{item.reject_reason ? `: ${item.reject_reason}` : ""}</span>}
        {item.status === "pending" && <span className="text-amber-600">pending</span>}
      </TableCell>
      <TableCell className="text-right">
        {canEdit && item.status === "pending" && (
          <div className="flex gap-1 items-center justify-end">
            <Input type="number" className="h-7 w-16" value={aQ} onChange={e => setAQ(e.target.value)} />
            <Button size="sm" onClick={() => onDecide(item, "approved", Number(aQ))}>OK</Button>
            <Input className="h-7 w-32" placeholder="reason" value={reason} onChange={e => setReason(e.target.value)} />
            <Button size="sm" variant="outline" onClick={() => onDecide(item, "rejected", 0, reason)}>Reject</Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function PaymentReceive({ total, onPay }: { total: number; onPay: (method: string) => void }) {
  const [method, setMethod] = useState("Cash");
  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm">Total: <b>KSh {total.toFixed(2)}</b></span>
      <Input className="h-8 w-32" value={method} onChange={e => setMethod(e.target.value)} placeholder="Cash / M-Pesa"/>
      <Button size="sm" onClick={() => onPay(method)}>Mark Payment Received</Button>
    </div>
  );
}
