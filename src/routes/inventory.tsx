import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Package } from "lucide-react";

export const Route = createFileRoute("/inventory")({
  component: InventoryPage,
});

type Drug = {
  id: string;
  name: string;
  unit: "tab" | "cap" | "piece";
  buying_price: number;
  selling_price: number;
  selling_price_retail: number;
  selling_price_wholesale: number;
  wholesale_min_qty: number;
  stock_quantity: number;
  min_stock: number;
};

function InventoryPage() {
  const { profile, loading } = useAuth();
  const nav = profile?.role === "admin"
    ? [{ to: "/admin", label: "Dashboard" }, { to: "/pharmacy", label: "Pharmacy" }, { to: "/inventory", label: "Inventory" }]
    : [{ to: "/inventory", label: "Inventory" }];
  return (
    <AppShell title="Inventory Management" nav={nav}>
      {!loading && profile && profile.role !== "inventory" && profile.role !== "admin" ? (
        <p className="text-destructive">Access denied. Inventory or Admin only.</p>
      ) : (
        <Tabs defaultValue="stock" className="space-y-6">
          <TabsList>
            <TabsTrigger value="stock">Manage Stock</TabsTrigger>
            <TabsTrigger value="add">Add New Drug</TabsTrigger>
          </TabsList>
          <TabsContent value="stock"><StockList /></TabsContent>
          <TabsContent value="add"><AddDrug onAdded={() => {}} /></TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

function StockList() {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [edit, setEdit] = useState<Record<string, Partial<Drug>>>({});

  const load = async () => {
    const { data, error } = await supabase.from("drugs").select("*").order("name");
    if (error) { toast.error(error.message); return; }
    setDrugs((data as Drug[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async (id: string) => {
    const patch = edit[id];
    if (!patch) return;
    const { error } = await supabase.from("drugs").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Updated");
    setEdit(prev => { const c = { ...prev }; delete c[id]; return c; });
    await load();
  };

  const addStock = async (id: string, qty: number) => {
    const d = drugs.find(x => x.id === id)!;
    const { error } = await supabase.from("drugs").update({ stock_quantity: d.stock_quantity + qty }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Added ${qty} units`);
    await load();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5"/>Current Stock</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Drug</TableHead><TableHead>Unit</TableHead>
              <TableHead>Buy</TableHead>
              <TableHead>Retail Price</TableHead>
              <TableHead>Wholesale Price</TableHead>
              <TableHead>WS Min Qty</TableHead>
              <TableHead>Stock</TableHead><TableHead>Min</TableHead>
              <TableHead>Add Stock</TableHead><TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drugs.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">No drugs yet. Add one in the next tab.</TableCell></TableRow>}
            {drugs.map(d => {
              const low = d.stock_quantity < d.min_stock;
              const e = edit[d.id] ?? {};
              return (
                <TableRow key={d.id} className={low ? "bg-destructive/5" : ""}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="capitalize">{d.unit}</TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" className="w-24" defaultValue={d.buying_price}
                      onChange={ev => setEdit(p => ({ ...p, [d.id]: { ...e, buying_price: Number(ev.target.value) } }))} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" className="w-24" defaultValue={d.selling_price_retail}
                      onChange={ev => setEdit(p => ({ ...p, [d.id]: { ...e, selling_price_retail: Number(ev.target.value), selling_price: Number(ev.target.value) } }))} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" className="w-24" defaultValue={d.selling_price_wholesale}
                      onChange={ev => setEdit(p => ({ ...p, [d.id]: { ...e, selling_price_wholesale: Number(ev.target.value) } }))} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" className="w-20" defaultValue={d.wholesale_min_qty}
                      onChange={ev => setEdit(p => ({ ...p, [d.id]: { ...e, wholesale_min_qty: Number(ev.target.value) } }))} />
                  </TableCell>
                  <TableCell>
                    {low ? <Badge variant="destructive">{d.stock_quantity}</Badge> : <span className="font-medium">{d.stock_quantity}</span>}
                  </TableCell>
                  <TableCell>
                    <Input type="number" className="w-20" defaultValue={d.min_stock}
                      onChange={ev => setEdit(p => ({ ...p, [d.id]: { ...e, min_stock: Number(ev.target.value) } }))} />
                  </TableCell>
                  <TableCell>
                    <AddStockInline onAdd={(q) => addStock(d.id, q)} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => save(d.id)}>Save</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AddStockInline({ onAdd }: { onAdd: (n: number) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-1">
      <Input type="number" className="w-20" value={v} onChange={e => setV(e.target.value)} placeholder="qty" />
      <Button size="sm" variant="outline" onClick={() => { const n = Number(v); if (n > 0) { onAdd(n); setV(""); } }}>
        <Plus className="h-4 w-4"/>
      </Button>
    </div>
  );
}

function AddDrug({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<"tab" | "cap" | "piece">("tab");
  const [buying, setBuying] = useState("");
  const [retail, setRetail] = useState("");
  const [wholesale, setWholesale] = useState("");
  const [wsMin, setWsMin] = useState("10");
  const [stock, setStock] = useState("");
  const [min, setMin] = useState("10");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const retailNum = Number(retail);
    const { error } = await supabase.from("drugs").insert({
      name, unit,
      buying_price: Number(buying),
      selling_price: retailNum,
      selling_price_retail: retailNum,
      selling_price_wholesale: Number(wholesale),
      wholesale_min_qty: Number(wsMin || 10),
      stock_quantity: Number(stock || 0),
      min_stock: Number(min || 10),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Drug added");
    setName(""); setBuying(""); setRetail(""); setWholesale(""); setWsMin("10"); setStock(""); setMin("10");
    onAdded();
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>Add New Drug Stock</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Label>Drug name</Label><Input value={name} onChange={e=>setName(e.target.value)} required /></div>
          <div>
            <Label>Unit (per)</Label>
            <Select value={unit} onValueChange={(v)=>setUnit(v as any)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="tab">Tablet</SelectItem>
                <SelectItem value="cap">Capsule</SelectItem>
                <SelectItem value="piece">Piece</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Initial stock quantity</Label><Input type="number" value={stock} onChange={e=>setStock(e.target.value)} /></div>
          <div><Label>Buying price (per {unit})</Label><Input type="number" step="0.01" value={buying} onChange={e=>setBuying(e.target.value)} required /></div>
          <div><Label>Retail selling price (per {unit})</Label><Input type="number" step="0.01" value={retail} onChange={e=>setRetail(e.target.value)} required /></div>
          <div><Label>Wholesale selling price (per {unit})</Label><Input type="number" step="0.01" value={wholesale} onChange={e=>setWholesale(e.target.value)} required /></div>
          <div><Label>Min quantity to qualify as wholesale</Label><Input type="number" value={wsMin} onChange={e=>setWsMin(e.target.value)} /></div>
          <div><Label>Minimum stock alert</Label><Input type="number" value={min} onChange={e=>setMin(e.target.value)} /></div>
          <div className="sm:col-span-2"><Button type="submit" className="w-full">Save Drug</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}
