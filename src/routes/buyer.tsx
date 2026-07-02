import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pill, Plus, Trash2, LogOut } from "lucide-react";

export const Route = createFileRoute("/buyer")({
  component: BuyerPage,
});

type Drug = { id: string; name: string; unit: string; selling_price_wholesale: number; stock_quantity: number; wholesale_min_qty: number };
type Buyer = { id: string; pharmacy_id: string; status: string; name: string };
type Line = { drug_id: string; drug_name: string; qty: number; unit_price: number; flagged_out_of_stock: boolean };
type Order = {
  id: string; created_at: string; status: string; payment_status: string;
  total: number; amount_paid: number;
};
type OrderItem = {
  id: string; order_id: string; drug_name: string; requested_qty: number;
  approved_qty: number | null; unit_price: number; subtotal: number;
  status: string; reject_reason: string | null; flagged_out_of_stock: boolean;
};

function BuyerPage() {
  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [buyer, setBuyer] = useState<Buyer | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!profile) { navigate({ to: "/auth" }); return; }
    if (profile.role !== "buyer") { navigate({ to: "/" }); return; }
    supabase.from("wholesale_buyers").select("id, pharmacy_id, status, name")
      .eq("user_id", profile.id).maybeSingle().then(({ data }) => setBuyer(data as Buyer));
  }, [profile, loading, navigate]);

  if (!profile || !buyer) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Pill className="h-5 w-5"/></div>
            <div>
              <div className="font-bold leading-tight">LEMSA Buyer Portal</div>
              <div className="text-xs text-muted-foreground">{buyer.name} · Status: <span className={buyer.status === "approved" ? "text-green-600" : "text-amber-600"}>{buyer.status}</span></div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
            <LogOut className="h-4 w-4 mr-1"/> Sign out
          </Button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {buyer.status !== "approved" ? (
          <Card><CardContent className="p-8 text-center space-y-2">
            <h2 className="text-xl font-semibold">Account pending approval</h2>
            <p className="text-muted-foreground">Your account is awaiting approval by the pharmacy. You'll be able to place orders once approved.</p>
          </CardContent></Card>
        ) : (
          <Tabs defaultValue="order" className="space-y-4">
            <TabsList>
              <TabsTrigger value="order">Place New Order</TabsTrigger>
              <TabsTrigger value="history">My Orders</TabsTrigger>
              <TabsTrigger value="track">Order Track</TabsTrigger>
            </TabsList>
            <TabsContent value="order"><PlaceOrder buyer={buyer} /></TabsContent>
            <TabsContent value="history"><OrderHistory buyer={buyer} /></TabsContent>
            <TabsContent value="track"><OrderTrack buyer={buyer} /></TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

function PlaceOrder({ buyer }: { buyer: Buyer }) {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Drug | null>(null);
  const [qty, setQty] = useState("1");
  const [items, setItems] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("drugs").select("id,name,unit,selling_price_wholesale,stock_quantity,wholesale_min_qty")
      .eq("pharmacy_id", buyer.pharmacy_id).order("name")
      .then(({ data }) => setDrugs((data as Drug[]) ?? []));
  }, [buyer.pharmacy_id]);

  const filtered = useMemo(() =>
    q.trim() ? drugs.filter(d => d.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []
  , [drugs, q]);

  const add = () => {
    if (!sel) return;
    const n = Math.max(1, Number(qty) || 1);
    const outOfStock = n > sel.stock_quantity;
    setItems(prev => [...prev, {
      drug_id: sel.id, drug_name: sel.name, qty: n,
      unit_price: Number(sel.selling_price_wholesale),
      flagged_out_of_stock: outOfStock,
    }]);
    setSel(null); setQ(""); setQty("1");
  };

  const total = items.reduce((a, b) => a + b.unit_price * b.qty, 0);

  const submit = async () => {
    if (items.length === 0) { toast.error("Add at least one drug"); return; }
    setBusy(true);
    try {
      const { data: order, error: oErr } = await supabase.from("buyer_orders").insert({
        buyer_id: buyer.id, pharmacy_id: buyer.pharmacy_id,
        total, status: "pending", payment_status: "unpaid",
      }).select("id").single();
      if (oErr) throw oErr;

      const rows = items.map(it => ({
        order_id: order.id, pharmacy_id: buyer.pharmacy_id,
        drug_id: it.drug_id, drug_name: it.drug_name,
        requested_qty: it.qty, unit_price: it.unit_price,
        subtotal: it.unit_price * it.qty,
        status: "pending", flagged_out_of_stock: it.flagged_out_of_stock,
      }));
      const { error: iErr } = await supabase.from("buyer_order_items").insert(rows);
      if (iErr) throw iErr;
      toast.success("Order submitted. Awaiting pharmacy approval.");
      setItems([]);
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card><CardHeader><CardTitle>New Order</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
          <div className="relative">
            <Input placeholder="Search drug name…" value={q} onChange={e => { setQ(e.target.value); setSel(null); }} />
            {filtered.length > 0 && !sel && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                {filtered.map(d => (
                  <button type="button" key={d.id} onClick={() => { setSel(d); setQ(d.name); }}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between">
                    <span>{d.name} <span className="text-muted-foreground">({d.unit})</span></span>
                    <span className={d.stock_quantity === 0 ? "text-destructive" : "text-muted-foreground"}>
                      stock: {d.stock_quantity} · KSh {Number(d.selling_price_wholesale).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
          <Button type="button" disabled={!sel} onClick={add}><Plus className="h-4 w-4 mr-1"/>Add</Button>
        </div>
        {sel && sel.stock_quantity < Number(qty) && (
          <p className="text-xs text-amber-600">⚠ Requested qty exceeds current stock ({sel.stock_quantity}). You can still order; it will be flagged out of stock.</p>
        )}
        <div className="border rounded-md">
          <Table>
            <TableHeader><TableRow><TableHead>Drug</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead></TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No items added</TableCell></TableRow>}
              {items.map((it, i) => (
                <TableRow key={i}>
                  <TableCell>{it.drug_name}</TableCell>
                  <TableCell className="text-right">{it.qty}</TableCell>
                  <TableCell className="text-right">KSh {it.unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">KSh {(it.unit_price * it.qty).toFixed(2)}</TableCell>
                  <TableCell className="text-xs">{it.flagged_out_of_stock ? <span className="text-amber-600">out of stock</span> : <span className="text-green-600">in stock</span>}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => setItems(p => p.filter((_,idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end p-3 bg-muted/40 font-bold">Total: KSh {total.toFixed(2)}</div>
        </div>
        <Button onClick={submit} disabled={busy || items.length === 0} className="w-full">{busy ? "Submitting…" : "Submit Order for Approval"}</Button>
      </CardContent>
    </Card>
  );
}

function OrderHistory({ buyer }: { buyer: Buyer }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>({});

  const load = async () => {
    const { data: os } = await supabase.from("buyer_orders")
      .select("id, created_at, status, payment_status, total, amount_paid")
      .eq("buyer_id", buyer.id).order("created_at", { ascending: false });
    setOrders((os as Order[]) ?? []);
    const ids = (os ?? []).map(o => o.id);
    if (ids.length) {
      const { data: its } = await supabase.from("buyer_order_items")
        .select("id, order_id, drug_name, requested_qty, approved_qty, unit_price, subtotal, status, reject_reason, flagged_out_of_stock")
        .in("order_id", ids);
      const grouped: Record<string, OrderItem[]> = {};
      (its ?? []).forEach((it: any) => { (grouped[it.order_id] ||= []).push(it); });
      setItemsByOrder(grouped);
    }
  };
  useEffect(() => {
    load();
    // Realtime: any new/updated order or item for this buyer refreshes the list,
    // so orders created by pharmacy staff appear automatically without a reload.
    const ch = supabase.channel(`buyer-orders-${buyer.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "buyer_orders", filter: `buyer_id=eq.${buyer.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "buyer_order_items" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [buyer.id]);

  return (
    <div className="space-y-4">
      {orders.length === 0 && <p className="text-muted-foreground text-center py-8">No orders yet.</p>}
      {orders.map(o => {
        const approvedTotal = (itemsByOrder[o.id] ?? []).filter(i => i.status === "approved")
          .reduce((a, b) => a + Number(b.subtotal), 0);
        const reviewed = o.status === "reviewed" || o.status === "paid";
        return (
          <Card key={o.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">Order #{o.id.slice(0,8)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className={`px-2 py-1 rounded ${o.status === "pending" ? "bg-amber-100 text-amber-800" : o.status === "reviewed" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                    {o.status}
                  </span>
                  <span className={`px-2 py-1 rounded ${o.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                    {o.payment_status === "paid" ? "PAID INVOICE" : reviewed ? "PENDING INVOICE — awaiting payment" : "—"}
                  </span>
                </div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Drug</TableHead><TableHead className="text-right">Req</TableHead><TableHead className="text-right">Approved</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(itemsByOrder[o.id] ?? []).map(it => (
                    <TableRow key={it.id}>
                      <TableCell>{it.drug_name}</TableCell>
                      <TableCell className="text-right">{it.requested_qty}</TableCell>
                      <TableCell className="text-right">{it.approved_qty ?? "—"}</TableCell>
                      <TableCell className="text-right">{it.status === "approved" ? `KSh ${Number(it.subtotal).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-xs">
                        {it.status === "approved" && <span className="text-green-600">approved</span>}
                        {it.status === "rejected" && <span className="text-destructive">rejected{it.reject_reason ? `: ${it.reject_reason}` : ""}</span>}
                        {it.status === "pending" && <span className="text-amber-600">pending</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {reviewed && (
                <div className="flex justify-between items-center text-sm">
                  <span>
                    <Link to="/buyer-invoice/$id" params={{ id: o.id }} className="text-primary underline font-medium">
                      {o.payment_status === "paid" ? "Download / view PAID invoice" : "View / download PENDING invoice"}
                    </Link>

                  </span>
                  <span className="font-semibold">Approved total: KSh {approvedTotal.toFixed(2)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

type Trk = { id: string; order_id: string; location_name: string | null; latitude: number | null; longitude: number | null; note: string | null; created_at: string };

function OrderTrack({ buyer }: { buyer: Buyer }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Trk[]>([]);
  const [orderId, setOrderId] = useState<string>("");

  useEffect(() => {
    supabase.from("buyer_orders").select("id, created_at, status, payment_status, total, amount_paid")
      .eq("buyer_id", buyer.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        const list = (data as Order[]) ?? [];
        setOrders(list);
        if (list.length && !orderId) setOrderId(list[0].id);
      });
    // eslint-disable-next-line
  }, [buyer.id]);

  useEffect(() => {
    if (!orderId) { setEvents([]); return; }
    const load = () => supabase.from("order_tracking_events")
      .select("id, order_id, location_name, latitude, longitude, note, created_at")
      .eq("order_id", orderId).order("created_at", { ascending: false })
      .then(({ data }) => setEvents((data as Trk[]) ?? []));
    load();
    const ch = supabase.channel(`trk-${orderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_tracking_events", filter: `order_id=eq.${orderId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  return (
    <Card>
      <CardHeader><CardTitle>Track your delivery</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Order</Label>
          <select className="w-full border rounded-md p-2 bg-background" value={orderId} onChange={e => setOrderId(e.target.value)}>
            <option value="">Select order…</option>
            {orders.map(o => <option key={o.id} value={o.id}>#{o.id.slice(0,8)} · {new Date(o.created_at).toLocaleDateString()} · {o.payment_status}</option>)}
          </select>
        </div>
        {orderId && events.length === 0 && <p className="text-muted-foreground text-center py-6 text-sm">No tracking updates yet for this order.</p>}
        <ol className="relative border-l-2 border-primary/30 ml-3 space-y-4">
          {events.map(e => (
            <li key={e.id} className="ml-4">
              <span className="absolute -left-2 h-4 w-4 rounded-full bg-primary"></span>
              <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
              <div className="font-medium">{e.location_name ?? "Location update"}</div>
              {e.latitude != null && e.longitude != null && (
                <a className="text-xs text-primary underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${e.latitude},${e.longitude}`}>
                  View on map ({e.latitude.toFixed(4)}, {e.longitude.toFixed(4)})
                </a>
              )}
              {e.note && <div className="text-xs text-muted-foreground mt-1">{e.note}</div>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
