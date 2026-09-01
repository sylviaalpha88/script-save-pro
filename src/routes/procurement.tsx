import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { canAccess } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { SignOffBlock } from "@/components/SignOff";
import { printElement } from "@/lib/print";
import { supabase } from "@/integrations/supabase/client";
import type { Service } from "@/routes/inventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Package, ArrowLeft, Search, Printer, ClipboardList, Inbox, Pencil, Trash2, History } from "lucide-react";

export const Route = createFileRoute("/procurement")({
  component: ProcurementPage,
  head: () => ({
    meta: [
      { title: "Procurement · Store, Stock Order & New Inventory" },
      { name: "description", content: "See goods on store, raise stock orders for low items and create new inventory with supplier, costing, batch and storage details." },
      { property: "og:title", content: "Procurement · Store, Stock Order & New Inventory" },
      { property: "og:description", content: "See goods on store, raise stock orders for low items and create new inventory with supplier, costing, batch and storage details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const todayStr = () => new Date().toISOString().slice(0, 10);

type StoreRow = {
  id: string; name: string; sku: string | null; unit: string; category: string | null;
  department: string | null; measurement_per_item: string | null;
  stock_quantity: number; min_stock: number; reorder_level: number; max_stock: number;
  batch_number: string | null; expiry_date: string | null; storage_location: string | null;
  quality_status: string; supplier_name: string | null; unit_cost: number; computed_total: number;
};

function ProcurementPage() {
  const { profile, loading } = useAuth();
  const [view, setView] = useState<"main" | "new">("main");

  const denied = !loading && profile && !canAccess(profile, "procurement");

  return (
    <AppShell title="Procurement" subtitle="Goods on store, stock orders, suppliers and new inventory items">
      {denied ? (
        <p className="text-destructive font-semibold">You don't have permission to access this page.</p>
      ) : view === "main" ? (
        <Tabs defaultValue="store" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="store"><Package className="h-4 w-4 mr-1" />Store</TabsTrigger>
            <TabsTrigger value="stock_order"><ClipboardList className="h-4 w-4 mr-1" />Stock Order</TabsTrigger>
            <TabsTrigger value="requests"><Inbox className="h-4 w-4 mr-1" />Pharmacy Requests</TabsTrigger>
          </TabsList>
          <TabsContent value="store"><StoreView onAddNew={() => setView("new")} /></TabsContent>
          <TabsContent value="stock_order"><StockOrderPanel /></TabsContent>
          <TabsContent value="requests"><PharmacyRequestsPanel /></TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setView("main")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to store
          </Button>
          <NewInventoryForm onSaved={() => setView("main")} />
        </div>
      )}
    </AppShell>
  );
}

// =============== STOCK ORDER (auto reorder list + history) ===============

type ReorderRow = StoreRow & { avg_stock: number };
type ArchiveRow = {
  id: string; drug_id: string | null; drug_name: string; sku: string | null;
  category: string | null; department: string | null; measurement_per_item: string | null;
  remaining: number; min_stock: number; avg_stock: number; max_stock: number;
  order_qty: number; supplier_name: string | null; level: string | null; moved_at: string;
};

function StockOrderPanel() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ReorderRow[]>([]);
  const [archived, setArchived] = useState<ArchiveRow[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const histRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data, error } = await supabase.from("drugs")
      .select("id, name, sku, unit, category, department, measurement_per_item, stock_quantity, min_stock, avg_stock, reorder_level, max_stock, batch_number, expiry_date, storage_location, quality_status, supplier_name, unit_cost, computed_total")
      .order("name");
    if (error) { toast.error(error.message); return; }
    setRows((data as ReorderRow[]) ?? []);
    const { data: arch } = await supabase.from("stock_order_archive")
      .select("id, drug_id, drug_name, sku, category, department, measurement_per_item, remaining, min_stock, avg_stock, max_stock, order_qty, supplier_name, level, moved_at")
      .order("moved_at", { ascending: false });
    setArchived((arch as ArchiveRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const archivedIds = useMemo(() => new Set(archived.map(a => a.drug_id ?? "")), [archived]);

  const list = useMemo(() => rows
    .map(r => {
      const level: "critical" | "low" | null =
        r.stock_quantity < r.min_stock ? "critical"
          : r.stock_quantity < r.avg_stock ? "low" : null;
      return { ...r, level, order_qty: Math.max(0, Number(r.max_stock) - Number(r.stock_quantity)) };
    })
    .filter(r => r.level !== null && !archivedIds.has(r.id)), [rows, archivedIds]);

  const allSelected = list.length > 0 && sel.length === list.length;
  const toggle = (id: string) => setSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const moveToHistory = async () => {
    if (sel.length === 0) { toast.error("Select the items you want to move to history"); return; }
    if (!profile?.pharmacy_id) { toast.error("Your account is not linked to a pharmacy"); return; }
    setBusy(true);
    const picked = list.filter(r => sel.includes(r.id));
    const { error } = await supabase.from("stock_order_archive").insert(picked.map(r => ({
      pharmacy_id: profile.pharmacy_id!,
      drug_id: r.id, drug_name: r.name, sku: r.sku, category: r.category, department: r.department,
      measurement_per_item: r.measurement_per_item, remaining: r.stock_quantity, min_stock: r.min_stock,
      avg_stock: r.avg_stock, max_stock: r.max_stock, order_qty: r.order_qty,
      supplier_name: r.supplier_name, level: r.level, moved_by: profile.id,
    })));
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${picked.length} item(s) moved to history`);
    setSel([]);
    load();
  };

  const histList = useMemo(() => {
    const f = new Date(`${from}T00:00:00`).getTime();
    const t = new Date(`${to}T23:59:59`).getTime();
    return archived.filter(a => {
      const m = new Date(a.moved_at).getTime();
      return m >= f && m <= t;
    });
  }, [archived, from, to]);

  return (
    <Tabs defaultValue="active" className="space-y-4">
      <TabsList>
        <TabsTrigger value="active"><ClipboardList className="h-4 w-4 mr-1" />Stock Order</TabsTrigger>
        <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />History</TabsTrigger>
      </TabsList>

      <TabsContent value="active">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" />Stock Order ({list.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={busy || sel.length === 0} onClick={moveToHistory}>
                <History className="h-4 w-4 mr-1" />Move selected to History ({sel.length})
              </Button>
              <Button variant="outline" onClick={() => printElement(printRef.current, "Stock Order")}>
                <Printer className="h-4 w-4 mr-1" />Print / Download
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-xs mb-3">
              <span className="inline-flex items-center gap-2"><span className="h-3 w-6 rounded bg-destructive/20 border border-destructive" />Below minimum stock</span>
              <span className="inline-flex items-center gap-2"><span className="h-3 w-6 rounded bg-blue-100 border border-blue-400" />Between minimum and average stock</span>
              <label className="inline-flex items-center gap-2">
                <Checkbox checked={allSelected} onCheckedChange={() => setSel(allSelected ? [] : list.map(r => r.id))} />
                Select all
              </label>
            </div>
            <div ref={printRef}>
              <h1>Stock Order Requisition</h1>
              <div className="sub text-xs text-muted-foreground mb-3">
                Generated {new Date().toLocaleString()} · Quantity to order = Maximum stock − Quantity remaining
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 print:hidden" />
                      <TableHead>SKU</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Measure</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Min</TableHead>
                      <TableHead>Avg</TableHead>
                      <TableHead>Max</TableHead>
                      <TableHead>Qty to Order</TableHead>
                      <TableHead>Supplier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.length === 0 && (
                      <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">Every item is above its average stock — nothing to order.</TableCell></TableRow>
                    )}
                    {list.map(r => (
                      <TableRow key={r.id} data-print-row={sel.includes(r.id) ? "1" : "0"} className={r.level === "critical" ? "bg-destructive/5" : "bg-blue-50/60"}>

                        <TableCell className="print:hidden">
                          <Checkbox checked={sel.includes(r.id)} onCheckedChange={() => toggle(r.id)} />
                        </TableCell>
                        <TableCell className="text-xs">{r.sku || "—"}</TableCell>
                        <TableCell className={`font-medium ${r.level === "critical" ? "low text-destructive" : "mid text-blue-700"}`}>{r.name}</TableCell>
                        <TableCell>{r.category || "—"}</TableCell>
                        <TableCell>{r.department || "—"}</TableCell>
                        <TableCell>{r.measurement_per_item || "—"}</TableCell>
                        <TableCell className={r.level === "critical" ? "low text-destructive font-semibold" : "mid text-blue-700 font-semibold"}>{r.stock_quantity}</TableCell>
                        <TableCell>{r.min_stock}</TableCell>
                        <TableCell>{r.avg_stock}</TableCell>
                        <TableCell>{r.max_stock}</TableCell>
                        <TableCell className="font-bold">{r.order_qty}</TableCell>
                        <TableCell>{r.supplier_name || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <SignOffBlock />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Stock Order History ({histList.length})</CardTitle>
            <div className="flex flex-wrap items-end gap-2">
              <div><Label className="text-xs">Date from</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
              <div><Label className="text-xs">Date to</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
              <Button variant="outline" onClick={() => printElement(histRef.current, "Stock Order History")}>
                <Printer className="h-4 w-4 mr-1" />Print / Download
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={histRef}>
              <h1>Stock Order History</h1>
              <div className="sub text-xs text-muted-foreground mb-3">{from} → {to}</div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Moved</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Measure</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Qty ordered</TableHead>
                      <TableHead>Supplier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {histList.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nothing moved to history in these dates.</TableCell></TableRow>
                    )}
                    {histList.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs">{new Date(a.moved_at).toLocaleString()}</TableCell>
                        <TableCell className="font-medium">{a.drug_name}</TableCell>
                        <TableCell>{a.category || "—"}</TableCell>
                        <TableCell>{a.department || "—"}</TableCell>
                        <TableCell>{a.measurement_per_item || "—"}</TableCell>
                        <TableCell>{a.remaining}</TableCell>
                        <TableCell className="font-semibold">{a.order_qty}</TableCell>
                        <TableCell>{a.supplier_name || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <SignOffBlock />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

// =============== PHARMACY STOCK REQUESTS ===============

type SOrder = {
  id: string; status: string; note: string | null; created_at: string;
  requested_by_name: string | null;
};
type SOItem = {
  id: string; order_id: string; drug_id: string; drug_name: string;
  quantity: number; approved_qty: number | null; status: string; reject_reason: string | null;
};
type DrugMeta = { id: string; category: string | null; department: string | null; manufacture_date: string | null; expiry_date: string | null };

function PharmacyRequestsPanel() {
  const [orders, setOrders] = useState<SOrder[]>([]);
  const [items, setItems] = useState<Record<string, SOItem[]>>({});
  const [meta, setMeta] = useState<Record<string, DrugMeta>>({});
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("pending");
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const printRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data: os, error } = await supabase.from("stock_orders")
      .select("id, status, note, created_at, requested_by_name")
      .order("created_at", { ascending: false }).limit(200);
    if (error) { toast.error(error.message); return; }
    setOrders((os as SOrder[]) ?? []);
    const ids = (os ?? []).map(o => o.id);
    if (ids.length) {
      const { data: its } = await supabase.from("stock_order_items")
        .select("id, order_id, drug_id, drug_name, quantity, approved_qty, status, reject_reason")
        .in("order_id", ids);
      const grouped: Record<string, SOItem[]> = {};
      ((its as SOItem[]) ?? []).forEach(it => { (grouped[it.order_id] ||= []).push(it); });
      setItems(grouped);
      const drugIds = Array.from(new Set(((its as SOItem[]) ?? []).map(i => i.drug_id)));
      if (drugIds.length) {
        const { data: ds } = await supabase.from("drugs")
          .select("id, category, department, manufacture_date, expiry_date").in("id", drugIds);
        const m: Record<string, DrugMeta> = {};
        ((ds as DrugMeta[]) ?? []).forEach(d => { m[d.id] = d; });
        setMeta(m);
      } else setMeta({});
    } else { setItems({}); setMeta({}); }
  };
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    const { error } = await supabase.rpc("approve_stock_order", { _order_id: id });
    if (error) { toast.error(error.message); return false; }
    return true;
  };

  const reject = async (id: string, reason: string) => {
    const { error } = await supabase.from("stock_orders")
      .update({ status: "rejected", note: reason || null }).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await supabase.from("stock_order_items").update({ status: "rejected", reject_reason: reason || null }).eq("order_id", id);
    return true;
  };

  const approveOne = async (id: string) => {
    setBusy(true);
    const ok = await approve(id);
    setBusy(false);
    if (ok) { toast.success("Approved · stock moved to the pharmacy store"); load(); }
  };

  const rejectOne = async (id: string) => {
    const reason = prompt("Reason for rejecting this stock order?") ?? "";
    setBusy(true);
    const ok = await reject(id, reason);
    setBusy(false);
    if (ok) { toast.success("Rejected"); load(); }
  };

  const bulk = async (action: "approve" | "reject") => {
    if (sel.length === 0) { toast.error("Select the requests first"); return; }
    const reason = action === "reject" ? (prompt("Reason for rejecting the selected requests?") ?? "") : "";
    setBusy(true);
    let done = 0;
    for (const id of sel) {
      const ok = action === "approve" ? await approve(id) : await reject(id, reason);
      if (ok) done++;
    }
    setBusy(false);
    setSel([]);
    toast.success(`${done} request(s) ${action === "approve" ? "approved" : "rejected"}`);
    load();
  };

  const setQty = async (item: SOItem, qty: number) => {
    const { error } = await supabase.from("stock_order_items")
      .update({ approved_qty: Math.max(0, qty) }).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    setItems(prev => ({
      ...prev,
      [item.order_id]: (prev[item.order_id] ?? []).map(i => i.id === item.id ? { ...i, approved_qty: qty } : i),
    }));
  };

  const deleteItem = async (item: SOItem) => {
    if (!confirm(`Remove ${item.drug_name} from this request?`)) return;
    const { error } = await supabase.from("stock_order_items").delete().eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item removed");
    load();
  };

  const inRange = (iso: string) => {
    const m = new Date(iso).getTime();
    return m >= new Date(`${from}T00:00:00`).getTime() && m <= new Date(`${to}T23:59:59`).getTime();
  };

  const visible = tab === "pending"
    ? orders.filter(o => o.status === "pending")
    : orders.filter(o => inRange(o.created_at));

  const allSelected = visible.length > 0 && visible.every(o => sel.includes(o.id));

  return (
    <Tabs value={tab} onValueChange={v => { setTab(v); setSel([]); }} className="space-y-4">
      <TabsList>
        <TabsTrigger value="pending"><Inbox className="h-4 w-4 mr-1" />Pharmacy Requests</TabsTrigger>
        <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />History</TabsTrigger>
      </TabsList>

      <TabsContent value={tab}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5" />
              {tab === "pending" ? "Stock orders from Pharmacy" : "Pharmacy request history"} ({visible.length})
            </CardTitle>
            <div className="flex flex-wrap items-end gap-2">
              {tab === "history" && (
                <>
                  <div><Label className="text-xs">Date from</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
                  <div><Label className="text-xs">Date to</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
                </>
              )}
              <Button variant="outline" onClick={() => printElement(printRef.current, "Pharmacy Stock Orders")}>
                <Printer className="h-4 w-4 mr-1" />Print / Download
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <Checkbox checked={allSelected} onCheckedChange={() => setSel(allSelected ? [] : visible.map(o => o.id))} />
                Select all
              </label>
              <Button size="sm" disabled={busy || sel.length === 0} onClick={() => bulk("approve")}>Approve selected ({sel.length})</Button>
              <Button size="sm" variant="outline" disabled={busy || sel.length === 0} onClick={() => bulk("reject")}>Reject selected</Button>
            </div>

            <div ref={printRef} className="space-y-4">
              <h1>Pharmacy Stock Orders</h1>
              {visible.length === 0 && <p className="text-muted-foreground text-center py-6">No stock orders to show.</p>}
              {visible.map(o => (
                <div key={o.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-3">
                      <span className="print:hidden">
                        <Checkbox checked={sel.includes(o.id)}
                          onCheckedChange={() => setSel(p => p.includes(o.id) ? p.filter(x => x !== o.id) : [...p, o.id])} />
                      </span>
                      <div>
                        <div className="font-semibold">{o.requested_by_name || "Pharmacy"}</div>
                        <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}{o.note ? ` · ${o.note}` : ""}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={o.status === "approved" ? "default" : o.status === "rejected" ? "destructive" : "outline"}>{o.status}</Badge>
                      {o.status === "pending" && (
                        <>
                          <Button size="sm" disabled={busy} onClick={() => approveOne(o.id)}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => rejectOne(o.id)}>Reject</Button>
                        </>
                      )}
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="py-1">Item / Category</TableHead>
                        <TableHead className="py-1">Department</TableHead>
                        <TableHead className="py-1">Manufactured</TableHead>
                        <TableHead className="py-1">Expiry</TableHead>
                        <TableHead className="py-1 text-right">Quantity</TableHead>
                        <TableHead className="py-1">Status</TableHead>
                        <TableHead className="py-1 print:hidden" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(items[o.id] ?? []).map(it => {
                        const m = meta[it.drug_id];
                        return (
                          <TableRow key={it.id} className="text-sm">
                            <TableCell className="py-1 font-medium">{it.drug_name}{m?.category ? ` / ${m.category}` : ""}</TableCell>
                            <TableCell className="py-1">{m?.department ?? "—"}</TableCell>
                            <TableCell className="py-1">{m?.manufacture_date ?? "—"}</TableCell>
                            <TableCell className="py-1">{m?.expiry_date ?? "—"}</TableCell>
                            <TableCell className="py-1 text-right">
                              {o.status === "pending" ? (
                                <Input type="number" min="0" className="h-7 w-20 ml-auto text-right"
                                  value={it.approved_qty ?? it.quantity}
                                  onChange={e => setQty(it, Number(e.target.value) || 0)} />
                              ) : (it.approved_qty ?? it.quantity)}
                            </TableCell>
                            <TableCell className="py-1 capitalize">{it.status}{it.reject_reason ? `: ${it.reject_reason}` : ""}</TableCell>
                            <TableCell className="py-1 text-right print:hidden">
                              {o.status === "pending" && (
                                <Button size="sm" variant="ghost" onClick={() => deleteItem(it)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}


function StoreView({ onAddNew }: { onAddNew: () => void }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [rows, setRows] = useState<StoreRow[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<StoreRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("drugs")
      .select("id, name, sku, unit, category, department, measurement_per_item, stock_quantity, min_stock, reorder_level, max_stock, batch_number, expiry_date, storage_location, quality_status, supplier_name, unit_cost, computed_total")
      .order("name");
    if (error) { toast.error(error.message); return; }
    setRows((data as StoreRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      [r.name, r.sku, r.category, r.department, r.supplier_name, r.batch_number, r.storage_location]
        .some(v => (v ?? "").toLowerCase().includes(s)));
  }, [rows, q]);

  const saveEdit = async () => {
    if (!edit) return;
    setBusy(true);
    const { error } = await supabase.from("drugs").update({
      name: edit.name,
      sku: edit.sku || null,
      category: edit.category || null,
      department: edit.department || null,
      measurement_per_item: edit.measurement_per_item || null,
      stock_quantity: Number(edit.stock_quantity) || 0,
      min_stock: Number(edit.min_stock) || 0,
      reorder_level: Number(edit.reorder_level) || 0,
      max_stock: Number(edit.max_stock) || 0,
      batch_number: edit.batch_number || null,
      expiry_date: edit.expiry_date || null,
      storage_location: edit.storage_location || null,
      supplier_name: edit.supplier_name || null,
    }).eq("id", edit.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Item updated");
    setEdit(null);
    load();
  };

  const remove = async (r: StoreRow) => {
    if (!confirm(`Delete ${r.name} from the store?`)) return;
    const { error } = await supabase.from("drugs").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item deleted");
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Goods on Store ({rows.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Button onClick={onAddNew}><Plus className="h-4 w-4 mr-1" />Add New Inventory</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search item, SKU, supplier, batch…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {!isAdmin && (
          <p className="text-xs text-muted-foreground">Only an admin can edit or delete items on the store.</p>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Measure</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Min</TableHead>
                <TableHead>Reorder</TableHead>
                <TableHead>Max</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground">Nothing on store yet. Use “Add New Inventory”.</TableCell></TableRow>
              )}
              {filtered.map(r => {
                const low = r.stock_quantity < r.min_stock;
                return (
                  <TableRow key={r.id} className={low ? "bg-destructive/5" : ""}>
                    <TableCell className="text-xs">{r.sku || "—"}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.category || "—"}</TableCell>
                    <TableCell>{r.department || "—"}</TableCell>
                    <TableCell>{r.measurement_per_item || "—"}</TableCell>
                    <TableCell>{low ? <Badge variant="destructive">{r.stock_quantity}</Badge> : <span className="font-medium">{r.stock_quantity}</span>}</TableCell>
                    <TableCell>{r.min_stock}</TableCell>
                    <TableCell>{r.reorder_level}</TableCell>
                    <TableCell>{r.max_stock}</TableCell>
                    <TableCell>{r.batch_number || "—"}</TableCell>
                    <TableCell>{r.expiry_date ? new Date(r.expiry_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{r.storage_location || "—"}</TableCell>
                    <TableCell className="capitalize">
                      {r.quality_status === "approved"
                        ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Approved</Badge>
                        : <Badge variant="outline">Pending testing</Badge>}
                    </TableCell>
                    <TableCell>{r.supplier_name || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isAdmin ? (
                        <>
                          <Button size="sm" variant="ghost" aria-label="Edit item" onClick={() => setEdit({ ...r })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" aria-label="Delete item" onClick={() => remove(r)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!edit} onOpenChange={o => { if (!o) setEdit(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit item on store</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Item name</Label><Input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></div>
              <div><Label className="text-xs">SKU</Label><Input value={edit.sku ?? ""} onChange={e => setEdit({ ...edit, sku: e.target.value })} /></div>
              <div><Label className="text-xs">Category</Label><Input value={edit.category ?? ""} onChange={e => setEdit({ ...edit, category: e.target.value })} /></div>
              <div><Label className="text-xs">Department</Label><Input value={edit.department ?? ""} onChange={e => setEdit({ ...edit, department: e.target.value })} /></div>
              <div><Label className="text-xs">Measurement per item</Label><Input value={edit.measurement_per_item ?? ""} onChange={e => setEdit({ ...edit, measurement_per_item: e.target.value })} /></div>
              <div><Label className="text-xs">Stock quantity</Label><Input type="number" value={edit.stock_quantity} onChange={e => setEdit({ ...edit, stock_quantity: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Minimum stock</Label><Input type="number" value={edit.min_stock} onChange={e => setEdit({ ...edit, min_stock: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Reorder level</Label><Input type="number" value={edit.reorder_level} onChange={e => setEdit({ ...edit, reorder_level: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Maximum stock</Label><Input type="number" value={edit.max_stock} onChange={e => setEdit({ ...edit, max_stock: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Batch number</Label><Input value={edit.batch_number ?? ""} onChange={e => setEdit({ ...edit, batch_number: e.target.value })} /></div>
              <div><Label className="text-xs">Expiry date</Label><Input type="date" value={edit.expiry_date ?? ""} onChange={e => setEdit({ ...edit, expiry_date: e.target.value })} /></div>
              <div><Label className="text-xs">Storage location</Label><Input value={edit.storage_location ?? ""} onChange={e => setEdit({ ...edit, storage_location: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Supplier</Label><Input value={edit.supplier_name ?? ""} onChange={e => setEdit({ ...edit, supplier_name: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button disabled={busy} onClick={saveEdit}>{busy ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


function NewInventoryForm({ onSaved }: { onSaved: () => void }) {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [f, setF] = useState({
    service_name: "",
    sku: "", name: "", description: "", category: "Consumables", unit: "piece",
    measurement_per_item: "", department: "", reorder_level: "10", min_stock: "10",
    avg_stock: "30", max_stock: "100",
    supplier_name: "", supplier_ref: "", lead_time_days: "0", po_number: "", invoice_note_number: "",
    unit_cost: "0", tax_vat: "0", freight_cost: "0",
    qty_ordered: "0", qty_received: "0", batch_number: "", manufacture_date: "", expiry_date: "",
    storage_location: "", quality_status: "pending",
    buying_price: "0", wholesale_min_qty: "10",
  });
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    supabase.from("services").select("id, name, unit, selling_price_retail, selling_price_wholesale").order("name")
      .then(({ data }) => setServices((data as Service[]) ?? []));
  }, []);

  const svc = useMemo(
    () => services.find(s => s.name.trim().toLowerCase() === f.service_name.trim().toLowerCase()) ?? null,
    [services, f.service_name],
  );

  const computedTotal = useMemo(() => {
    const qty = Number(f.qty_received || f.qty_ordered || 0);
    const base = Number(f.unit_cost || 0) * (qty > 0 ? qty : 1);
    return base + Number(f.tax_vat || 0) + Number(f.freight_cost || 0);
  }, [f.unit_cost, f.qty_received, f.qty_ordered, f.tax_vat, f.freight_cost]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.pharmacy_id) { toast.error("Your account is not linked to a pharmacy"); return; }
    if (!svc) { toast.error("Enter an existing service name. Add it first at Service Stock → Add New Service."); return; }
    if (f.name.trim().toLowerCase() !== svc.name.trim().toLowerCase()) {
      toast.error("The item / drug name must correspond with the service name."); return;
    }
    const retail = Number(svc.selling_price_retail || 0);
    const addQty = Number(f.qty_received || 0);
    const payload = {
      pharmacy_id: profile.pharmacy_id,
      name: f.name,
      sku: f.sku || null,
      description: f.description || null,
      category: f.category || null,
      unit: f.unit as "tab" | "cap" | "piece",
      measurement_per_item: f.measurement_per_item || null,
      department: f.department || null,
      reorder_level: Number(f.reorder_level || 10),
      min_stock: Number(f.min_stock || 10),
      avg_stock: Number(f.avg_stock || 30),
      max_stock: Number(f.max_stock || 100),
      supplier_name: f.supplier_name || null,
      supplier_ref: f.supplier_ref || null,
      lead_time_days: Number(f.lead_time_days || 0),
      po_number: f.po_number || null,
      invoice_note_number: f.invoice_note_number || null,
      unit_cost: Number(f.unit_cost || 0),
      tax_vat: Number(f.tax_vat || 0),
      freight_cost: Number(f.freight_cost || 0),
      computed_total: computedTotal,
      qty_ordered: Number(f.qty_ordered || 0),
      qty_received: addQty,
      batch_number: f.batch_number || null,
      manufacture_date: f.manufacture_date || null,
      expiry_date: f.expiry_date || null,
      storage_location: f.storage_location || null,
      quality_status: f.quality_status,
      buying_price: Number(f.buying_price || f.unit_cost || 0),
      selling_price: retail,
      selling_price_retail: retail,
      selling_price_wholesale: Number(svc.selling_price_wholesale || 0),
      wholesale_min_qty: Number(f.wholesale_min_qty || 10),
    };

    // Same item name already on the store → top up its quantity instead of creating
    // a second row. All other details are refreshed from this new delivery.
    const { data: existing } = await supabase
      .from("drugs")
      .select("id, stock_quantity")
      .eq("pharmacy_id", profile.pharmacy_id)
      .ilike("name", f.name.trim())
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("drugs").update({
        ...payload,
        stock_quantity: Number(existing.stock_quantity || 0) + addQty,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      if (error) { toast.error(error.message); return; }
      toast.success(`${addQty} added on top of the existing stock of ${f.name}`);
      onSaved();
      return;
    }

    const { error } = await supabase.from("drugs").insert({ ...payload, stock_quantity: addQty });
    if (error) { toast.error(error.message); return; }
    toast.success("New inventory item created");
    onSaved();
  };


  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Product &amp; Item Details</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Service Name <span className="text-destructive">*</span></Label>
            <Input list="service-names" value={f.service_name} onChange={e => set("service_name", e.target.value)} required
              placeholder="search a service — hint: the service name is the drug name" />
            <datalist id="service-names">
              {services.map(s => <option key={s.id} value={s.name} />)}
            </datalist>
            {!svc && f.service_name.trim() !== "" && (
              <p className="text-xs text-destructive mt-1">No service with this name. Add it first at Service Stock → Add New Service.</p>
            )}
          </div>
          <div><Label>SKU / Part Number</Label><Input value={f.sku} onChange={e => set("sku", e.target.value)} required /></div>
          <div><Label>Item Name (must match the service name)</Label><Input value={f.name} onChange={e => set("name", e.target.value)} required /></div>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={f.description} onChange={e => set("description", e.target.value)} /></div>
          <div><Label>Category</Label><Input value={f.category} onChange={e => set("category", e.target.value)} placeholder="Consumables" /></div>
          <div>
            <Label>Unit of Measure</Label>
            <Select value={f.unit} onValueChange={v => set("unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="piece">pieces (pcs)</SelectItem>
                <SelectItem value="tab">tablets (tab)</SelectItem>
                <SelectItem value="cap">capsules (cap)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Measurement per Item</Label><Input value={f.measurement_per_item} onChange={e => set("measurement_per_item", e.target.value)} placeholder="e.g. 500 mg, 1 L, 250 ml" /></div>
          <div><Label>Department</Label><Input value={f.department} onChange={e => set("department", e.target.value)} placeholder="e.g. Laboratory, Dental, Renal" /></div>
          <div><Label>Reorder Level</Label><Input type="number" value={f.reorder_level} onChange={e => set("reorder_level", e.target.value)} /></div>
          <div><Label>Minimum Stock</Label><Input type="number" value={f.min_stock} onChange={e => set("min_stock", e.target.value)} /></div>
          <div><Label>Average Stock</Label><Input type="number" value={f.avg_stock} onChange={e => set("avg_stock", e.target.value)} /></div>
          <div><Label>Maximum Stock</Label><Input type="number" value={f.max_stock} onChange={e => set("max_stock", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Supplier &amp; Sourcing</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div><Label>Supplier Name</Label><Input value={f.supplier_name} onChange={e => set("supplier_name", e.target.value)} required /></div>
          <div><Label>Supplier ID</Label><Input value={f.supplier_ref} onChange={e => set("supplier_ref", e.target.value)} required /></div>
          <div><Label>Lead Time (days)</Label><Input type="number" value={f.lead_time_days} onChange={e => set("lead_time_days", e.target.value)} /></div>
          <div><Label>PO Number (optional)</Label><Input value={f.po_number} onChange={e => set("po_number", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Invoice / Delivery Note Number (optional)</Label><Input value={f.invoice_note_number} onChange={e => set("invoice_note_number", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Financial &amp; Costing</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div><Label>Unit Cost (KES)</Label><Input type="number" step="0.01" value={f.unit_cost} onChange={e => set("unit_cost", e.target.value)} /></div>
          <div><Label>Taxes / VAT (KES)</Label><Input type="number" step="0.01" value={f.tax_vat} onChange={e => set("tax_vat", e.target.value)} /></div>
          <div><Label>Freight / Landing (KES)</Label><Input type="number" step="0.01" value={f.freight_cost} onChange={e => set("freight_cost", e.target.value)} /></div>
          <div>
            <Label>Computed Total</Label>
            <Input readOnly value={computedTotal.toFixed(2)} className="bg-muted font-semibold" />
          </div>
          <div><Label>Buying price per {f.unit}</Label><Input type="number" step="0.01" value={f.buying_price} onChange={e => set("buying_price", e.target.value)} /></div>
          <div><Label>Retail selling price (from service)</Label><Input readOnly value={svc ? Number(svc.selling_price_retail).toFixed(2) : ""} className="bg-muted font-semibold" placeholder="pick a service name first" /></div>
          <div><Label>Wholesale selling price (from service)</Label><Input readOnly value={svc ? Number(svc.selling_price_wholesale).toFixed(2) : ""} className="bg-muted font-semibold" placeholder="pick a service name first" /></div>
          <div><Label>Min qty to qualify as wholesale</Label><Input type="number" value={f.wholesale_min_qty} onChange={e => set("wholesale_min_qty", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Quantity &amp; Batch</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div><Label>Quantity Ordered</Label><Input type="number" value={f.qty_ordered} onChange={e => set("qty_ordered", e.target.value)} /></div>
          <div><Label>Quantity Received</Label><Input type="number" value={f.qty_received} onChange={e => set("qty_received", e.target.value)} /></div>
          <div><Label>Batch / Lot Number</Label><Input value={f.batch_number} onChange={e => set("batch_number", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Manufacture Date</Label><Input type="date" value={f.manufacture_date} onChange={e => set("manufacture_date", e.target.value)} /></div>
            <div><Label>Expiry Date</Label><Input type="date" value={f.expiry_date} onChange={e => set("expiry_date", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Storage &amp; Status</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div><Label>Storage Location / Bin</Label><Input value={f.storage_location} onChange={e => set("storage_location", e.target.value)} placeholder="e.g. Aisle 3, Shelf B, Bin 12" /></div>
          <div>
            <Label>Quality Status</Label>
            <Select value={f.quality_status} onValueChange={v => set("quality_status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending Testing / Approve</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2"><Button type="submit" className="w-full">Save New Inventory Item</Button></div>
        </CardContent>
      </Card>
    </form>
  );
}
