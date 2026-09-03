import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { printElement } from "@/lib/print";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MapPin, Navigation, Radio, Search, Printer, X } from "lucide-react";

export const Route = createFileRoute("/order-track")({
  component: OrderTrackPage,
});

type Buyer = { name: string; phone: string | null; id_number: string | null; location: string | null };
type Order = {
  id: string; created_at: string; status: string; payment_status: string; total: number;
  wholesale_buyers: Buyer | null;
};
type Ev = { id: string; order_id: string; location_name: string | null; latitude: number | null; longitude: number | null; note: string | null; created_at: string };
type Tracked = { orderId: string; buyer: Buyer | null };

function OrderTrackPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [pick, setPick] = useState<string[]>([]);
  const [tracked, setTracked] = useState<Tracked[]>([]);
  const [buyerQuery, setBuyerQuery] = useState("");
  const [locName, setLocName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [lastPing, setLastPing] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const wasLive = useRef(false);

  const orderIds = tracked.map(t => t.orderId);
  const idsKey = orderIds.join(",");

  useEffect(() => {
    if (loading) return;
    if (!profile) { navigate({ to: "/auth" }); return; }
    if (profile.is_director || !["order_track", "admin", "pharmacy"].includes(profile.role)) { navigate({ to: "/home" }); return; }
    loadOrders();
  }, [profile, loading]);

  const loadOrders = async () => {
    const { data } = await supabase.from("buyer_orders")
      .select("id, created_at, status, payment_status, total, wholesale_buyers(name, phone, id_number, location)")
      .order("created_at", { ascending: false }).limit(50);
    setOrders((data as any) ?? []);
  };

  const loadEvents = async (ids: string[]) => {
    if (ids.length === 0) { setEvents([]); return; }
    const { data } = await supabase.from("order_tracking_events")
      .select("id, order_id, location_name, latitude, longitude, note, created_at")
      .in("order_id", ids).order("created_at", { ascending: false });
    setEvents((data as Ev[]) ?? []);
  };

  useEffect(() => { loadEvents(orderIds); }, [idsKey]);

  // Realtime: refresh history when new events land
  useEffect(() => {
    if (orderIds.length === 0) return;
    const ch = supabase.channel(`ot-${idsKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_tracking_events" },
        () => loadEvents(orderIds))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [idsKey]);

  // Live GPS: auto-send position every 30s while enabled (for every tracked order)
  useEffect(() => {
    if (!live || orderIds.length === 0 || !profile?.pharmacy_id) return;
    const pharmacyId = profile.pharmacy_id;
    const userId = profile.id;
    const ids = orderIds;
    if (!("geolocation" in navigator)) { toast.error("GPS not available"); setLive(false); return; }
    let cancelled = false;
    const ping = () => {
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          if (cancelled) return;
          const { error } = await supabase.from("order_tracking_events").insert(
            ids.map(id => ({
              order_id: id, pharmacy_id: pharmacyId, recorded_by: userId,
              latitude: p.coords.latitude, longitude: p.coords.longitude,
              location_name: null, note: "Live GPS",
            }))
          );
          if (!error) setLastPing(new Date().toLocaleTimeString());
        },
        (err) => { if (!cancelled) toast.error(err.message); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    };
    ping();
    const iv = setInterval(ping, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [live, idsKey, profile?.pharmacy_id, profile?.id]);

  // When live tracking is switched off, the GPS trail for the tracked orders is wiped.
  useEffect(() => {
    if (live) { wasLive.current = true; return; }
    if (!wasLive.current || orderIds.length === 0) return;
    wasLive.current = false;
    const ids = orderIds;
    (async () => {
      const { error } = await supabase.from("order_tracking_events")
        .delete().in("order_id", ids).not("latitude", "is", null);
      if (error) { toast.error(error.message); return; }
      setLastPing(null);
      toast.success("Live GPS stopped · GPS trail cleared");
      loadEvents(ids);
    })();
  }, [live, idsKey]);

  const recordEvent = async (payload: { location_name?: string | null; latitude?: number | null; longitude?: number | null; note?: string | null }) => {
    if (orderIds.length === 0) { toast.error("Add at least one buyer to track"); return; }
    if (!profile?.pharmacy_id) { toast.error("No pharmacy linked"); return; }
    setBusy(true);
    const { error } = await supabase.from("order_tracking_events").insert(
      orderIds.map(id => ({
        order_id: id, pharmacy_id: profile.pharmacy_id!, recorded_by: profile.id,
        ...payload,
      }))
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Tracking point added for ${orderIds.length} order${orderIds.length > 1 ? "s" : ""}`);
    setLocName(""); setNote("");
    loadEvents(orderIds);
  };

  const sendGps = () => {
    if (!("geolocation" in navigator)) { toast.error("GPS not available"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => recordEvent({ latitude: p.coords.latitude, longitude: p.coords.longitude, location_name: locName || null, note: note || null }),
      (err) => toast.error(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const sendName = () => {
    if (!locName.trim()) { toast.error("Enter location name"); return; }
    recordEvent({ location_name: locName.trim(), note: note || null });
  };

  const matchingOrders = useMemo(() => {
    const s = buyerQuery.trim().toLowerCase();
    const notTracked = orders.filter(o => !orderIds.includes(o.id));
    if (!s) return notTracked;
    return notTracked.filter(o => {
      const b = o.wholesale_buyers;
      return [b?.name, b?.phone, b?.id_number, b?.location].some(v => (v ?? "").toLowerCase().includes(s));
    });
  }, [orders, buyerQuery, idsKey]);

  const buyerFor = (oid: string) =>
    tracked.find(t => t.orderId === oid)?.buyer ?? orders.find(o => o.id === oid)?.wholesale_buyers ?? null;

  return (
    <AppShell title="Pharmacy" subtitle="Track orders and delivery status">
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2">Wholesale Buyer Accounts ({orders.length})</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelect(select.length === orders.length ? [] : orders.map(o => o.id))}>
              {select.length === orders.length && orders.length > 0 ? "Unselect all" : "Select all"}
            </Button>
            <Button size="sm" disabled={select.length === 0} onClick={trackSelected}>
              <Navigation className="h-4 w-4 mr-1" />Track selected ({select.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Buyer name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Order date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No wholesale buyer orders yet</TableCell></TableRow>}
              {orders.map(o => (
                <TableRow key={o.id} className={orderIds.includes(o.id) ? "bg-sky-50" : undefined}>
                  <TableCell>
                    <Checkbox checked={select.includes(o.id)}
                      onCheckedChange={() => setSelect(s => s.includes(o.id) ? s.filter(x => x !== o.id) : [...s, o.id])} />
                  </TableCell>
                  <TableCell className="font-medium">{o.wholesale_buyers?.name ?? "Buyer"}</TableCell>
                  <TableCell>{o.wholesale_buyers?.phone ?? "—"}</TableCell>
                  <TableCell>{o.wholesale_buyers?.location ?? "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="capitalize">{o.status}</TableCell>
                  <TableCell className="capitalize">{o.payment_status}</TableCell>
                  <TableCell>KSh {Number(o.total).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>


          <CardHeader><CardTitle className="flex items-center gap-2"><Navigation className="h-5 w-5" />Record Tracking Point</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Buyer name (add as many as you need)</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Type buyer name, phone, ID or location…"
                  value={buyerQuery} onChange={e => setBuyerQuery(e.target.value)} />
                {buyerQuery.trim() && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
                    {matchingOrders.length === 0 && <p className="p-2 text-sm text-muted-foreground">No buyer found</p>}
                    {matchingOrders.map(o => (
                      <button key={o.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => {
                          setTracked(t => t.some(x => x.orderId === o.id) ? t : [...t, { orderId: o.id, buyer: o.wholesale_buyers ?? null }]);
                          setBuyerQuery("");
                          toast.success(`Added ${o.wholesale_buyers?.name ?? "buyer"} to tracking`);
                        }}>
                        <div className="font-medium">{o.wholesale_buyers?.name ?? "Buyer"}</div>
                        <div className="text-xs text-muted-foreground">
                          {o.wholesale_buyers?.phone ?? "no phone"} · {o.wholesale_buyers?.location ?? "no location"} · {new Date(o.created_at).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {tracked.length > 0 && (
              <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                <div className="text-xs text-muted-foreground">Tracking {tracked.length} order{tracked.length > 1 ? "s" : ""}</div>
                {tracked.map(t => (
                  <div key={t.orderId} className="flex items-center justify-between gap-2 text-sm">
                    <div>
                      <div className="font-medium">{t.buyer?.name ?? "Buyer"}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.buyer?.phone ?? "—"} · {t.buyer?.location ?? "—"} · #{t.orderId.slice(0, 8)}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setTracked(list => list.filter(x => x.orderId !== t.orderId))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => { setTracked([]); setBuyerQuery(""); }}>Clear all</Button>
              </div>
            )}

            <div><Label>Location name (e.g. Nakuru CBD)</Label><Input value={locName} onChange={e => setLocName(e.target.value)} placeholder="Type current location" /></div>
            <div><Label>Note (optional)</Label><Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button onClick={sendGps} disabled={busy || tracked.length === 0} className="flex-1"><Navigation className="h-4 w-4 mr-1" />Send GPS</Button>
              <Button onClick={sendName} disabled={busy || tracked.length === 0} variant="secondary" className="flex-1"><MapPin className="h-4 w-4 mr-1" />Save location name</Button>
            </div>
            <div className={`flex items-center justify-between gap-2 rounded-md border p-3 ${live ? "border-green-500 bg-green-50 dark:bg-green-950/30" : ""}`}>
              <div className="flex items-center gap-2">
                <Radio className={`h-4 w-4 ${live ? "text-green-600 animate-pulse" : "text-muted-foreground"}`} />
                <div>
                  <div className="text-sm font-medium">Live GPS tracking</div>
                  <div className="text-xs text-muted-foreground">
                    {live ? `Auto-sending every 30s${lastPing ? ` · last ${lastPing}` : ""}` : "Turn on while driving · switching off clears the GPS trail"}
                  </div>
                </div>
              </div>
              <Switch checked={live} onCheckedChange={setLive} disabled={tracked.length === 0} />
            </div>
            <p className="text-xs text-muted-foreground">GPS uses your device's geolocation. Each entry is timestamped and visible to the buyers in real time.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <CardTitle>Tracking History {tracked.length > 0 && `(${tracked.length} order${tracked.length > 1 ? "s" : ""})`}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => printElement(printRef.current, "Tracking History")}>
              <Printer className="h-4 w-4 mr-1" />Print / Download
            </Button>
          </CardHeader>
          <CardContent>
            <label className="inline-flex items-center gap-2 text-xs mb-3">
              <Checkbox
                checked={events.length > 0 && pick.length === events.length}
                onCheckedChange={() => setPick(pick.length === events.length ? [] : events.map(e => e.id))}
              />
              Select all · only ticked rows are printed (none ticked = print all)
            </label>
            <div ref={printRef} className="overflow-x-auto">
              <h1>Tracking History</h1>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 print:hidden" />
                    <TableHead>Name</TableHead>
                    <TableHead>Phone number</TableHead>
                    <TableHead>Location of buyer</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>GPS location</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No tracking points yet</TableCell></TableRow>}
                  {events.map(e => {
                    const b = buyerFor(e.order_id);
                    return (
                      <TableRow key={e.id} data-print-row={pick.includes(e.id) ? "1" : "0"}>
                        <TableCell className="print:hidden">
                          <Checkbox checked={pick.includes(e.id)}
                            onCheckedChange={() => setPick(p => p.includes(e.id) ? p.filter(x => x !== e.id) : [...p, e.id])} />
                        </TableCell>
                        <TableCell className="font-medium">{b?.name ?? "—"}</TableCell>
                        <TableCell>{b?.phone ?? "—"}</TableCell>
                        <TableCell>{b?.location ?? "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">
                          {e.latitude != null && e.longitude != null ? (
                            <a className="text-primary underline" href={`https://maps.google.com/?q=${e.latitude},${e.longitude}`} target="_blank" rel="noreferrer">
                              {e.latitude.toFixed(4)}, {e.longitude.toFixed(4)}
                            </a>
                          ) : (e.location_name ?? "—")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.note ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
