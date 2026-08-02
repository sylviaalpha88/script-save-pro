import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { canAccess } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Package, ArrowLeft, Search } from "lucide-react";

export const Route = createFileRoute("/procurement")({
  component: ProcurementPage,
  head: () => ({
    meta: [
      { title: "Procurement · Store & New Inventory" },
      { name: "description", content: "See goods on store and create new inventory items with supplier, costing, batch and storage details." },
      { property: "og:title", content: "Procurement · Store & New Inventory" },
      { property: "og:description", content: "See goods on store and create new inventory items with supplier, costing, batch and storage details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type StoreRow = {
  id: string; name: string; sku: string | null; unit: string; category: string | null;
  department: string | null; measurement_per_item: string | null;
  stock_quantity: number; min_stock: number; reorder_level: number; max_stock: number;
  batch_number: string | null; expiry_date: string | null; storage_location: string | null;
  quality_status: string; supplier_name: string | null; unit_cost: number; computed_total: number;
};

function ProcurementPage() {
  const { profile, loading } = useAuth();
  const [view, setView] = useState<"store" | "new">("store");

  const denied = !loading && profile && !canAccess(profile, "procurement");

  return (
    <AppShell title="Procurement" subtitle="Goods on store, suppliers and new inventory items">
      {denied ? (
        <p className="text-destructive font-semibold">You don't have permission to access this page.</p>
      ) : view === "store" ? (
        <StoreView onAddNew={() => setView("new")} />
      ) : (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setView("store")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to store
          </Button>
          <NewInventoryForm onSaved={() => setView("store")} />
        </div>
      )}
    </AppShell>
  );
}

function StoreView({ onAddNew }: { onAddNew: () => void }) {
  const [rows, setRows] = useState<StoreRow[]>([]);
  const [q, setQ] = useState("");

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Goods on Store ({rows.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Link to="/inventory"><Button variant="outline">Prices &amp; Stock</Button></Link>
          <Button onClick={onAddNew}><Plus className="h-4 w-4 mr-1" />Add New Inventory</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search item, SKU, supplier, batch…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground">Nothing on store yet. Use “Add New Inventory”.</TableCell></TableRow>
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

function NewInventoryForm({ onSaved }: { onSaved: () => void }) {
  const { profile } = useAuth();
  const [f, setF] = useState({
    sku: "", name: "", description: "", category: "Consumables", unit: "piece",
    measurement_per_item: "", department: "", reorder_level: "10", min_stock: "10",
    avg_stock: "30", max_stock: "100",
    supplier_name: "", supplier_ref: "", lead_time_days: "0", po_number: "", invoice_note_number: "",
    unit_cost: "0", tax_vat: "0", freight_cost: "0",
    qty_ordered: "0", qty_received: "0", batch_number: "", manufacture_date: "", expiry_date: "",
    storage_location: "", quality_status: "pending",
    buying_price: "0", selling_price_retail: "0", selling_price_wholesale: "0", wholesale_min_qty: "10",
  });
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));

  const computedTotal = useMemo(() => {
    const qty = Number(f.qty_received || f.qty_ordered || 0);
    const base = Number(f.unit_cost || 0) * (qty > 0 ? qty : 1);
    return base + Number(f.tax_vat || 0) + Number(f.freight_cost || 0);
  }, [f.unit_cost, f.qty_received, f.qty_ordered, f.tax_vat, f.freight_cost]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.pharmacy_id) { toast.error("Your account is not linked to a pharmacy"); return; }
    const retail = Number(f.selling_price_retail || 0);
    const { error } = await supabase.from("drugs").insert({
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
      qty_received: Number(f.qty_received || 0),
      stock_quantity: Number(f.qty_received || 0),
      batch_number: f.batch_number || null,
      manufacture_date: f.manufacture_date || null,
      expiry_date: f.expiry_date || null,
      storage_location: f.storage_location || null,
      quality_status: f.quality_status,
      buying_price: Number(f.buying_price || f.unit_cost || 0),
      selling_price: retail,
      selling_price_retail: retail,
      selling_price_wholesale: Number(f.selling_price_wholesale || 0),
      wholesale_min_qty: Number(f.wholesale_min_qty || 10),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("New inventory item created");
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Product &amp; Item Details</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div><Label>SKU / Part Number</Label><Input value={f.sku} onChange={e => set("sku", e.target.value)} required /></div>
          <div><Label>Item Name</Label><Input value={f.name} onChange={e => set("name", e.target.value)} required /></div>
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
          <div><Label>Retail selling price</Label><Input type="number" step="0.01" value={f.selling_price_retail} onChange={e => set("selling_price_retail", e.target.value)} /></div>
          <div><Label>Wholesale selling price</Label><Input type="number" step="0.01" value={f.selling_price_wholesale} onChange={e => set("selling_price_wholesale", e.target.value)} /></div>
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
