import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MapPin, Navigation, Radio } from "lucide-react";

export const Route = createFileRoute("/order-track")({
  component: OrderTrackPage,
});

type Order = { id: string; created_at: string; status: string; payment_status: string; total: number; wholesale_buyers: { name: string; phone: string | null } | null };
type Ev = { id: string; order_id: string; location_name: string | null; latitude: number | null; longitude: number | null; note: string | null; created_at: string };

function OrderTrackPage() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [orderId, setOrderId] = useState<string>("");
  const [locName, setLocName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [lastPing, setLastPing] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!profile) { navigate({ to: "/auth" }); return; }
    if (profile.is_director || !["order_track", "admin", "pharmacy"].includes(profile.role)) { navigate({ to: "/home" }); return; }
    loadOrders();
  }, [profile, loading]);

  const loadOrders = async () => {
    const { data } = await supabase.from("buyer_orders")
      .select("id, created_at, status, payment_status, total, wholesale_buyers(name, phone)")
      .order("created_at", { ascending: false }).limit(50);
    setOrders((data as any) ?? []);
  };

  const loadEvents = async (oid: string) => {
    const { data } = await supabase.from("order_tracking_events")
      .select("id, order_id, location_name, latitude, longitude, note, created_at")
      .eq("order_id", oid).order("created_at", { ascending: false });
    setEvents((data as Ev[]) ?? []);
  };

  useEffect(() => { if (orderId) loadEvents(orderId); else setEvents([]); }, [orderId]);

  // Realtime: refresh history when new events land
  useEffect(() => {
    if (!orderId) return;
    const ch = supabase.channel(`ot-${orderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_tracking_events", filter: `order_id=eq.${orderId}` },
        () => loadEvents(orderId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId]);

  // Live GPS: auto-send position every 30s while enabled
  useEffect(() => {
    if (!live || !orderId || !profile?.pharmacy_id) return;
    const pharmacyId = profile.pharmacy_id;
    const userId = profile.id;
    if (!("geolocation" in navigator)) { toast.error("GPS not available"); setLive(false); return; }
    let cancelled = false;
    const ping = () => {
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          if (cancelled) return;
          const { error } = await supabase.from("order_tracking_events").insert({
            order_id: orderId, pharmacy_id: pharmacyId, recorded_by: userId,
            latitude: p.coords.latitude, longitude: p.coords.longitude,
            location_name: null, note: "Live GPS",
          });
          if (!error) setLastPing(new Date().toLocaleTimeString());
        },
        (err) => { if (!cancelled) toast.error(err.message); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    };
    ping();
    const iv = setInterval(ping, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [live, orderId, profile?.pharmacy_id, profile?.id]);

  const recordEvent = async (payload: { location_name?: string | null; latitude?: number | null; longitude?: number | null; note?: string | null }) => {
    if (!orderId) { toast.error("Select an order"); return; }
    if (!profile?.pharmacy_id) { toast.error("No pharmacy linked"); return; }
    setBusy(true);
    const { error } = await supabase.from("order_tracking_events").insert({
      order_id: orderId, pharmacy_id: profile.pharmacy_id, recorded_by: profile.id,
      ...payload,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tracking point added");
    setLocName(""); setNote("");
    loadEvents(orderId);
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

  return (
    <AppShell title="Order Track" nav={[{ to: "/order-track", label: "Order Track" }]}>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Navigation className="h-5 w-5"/>Record Tracking Point</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Select order</Label>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger><SelectValue placeholder="Choose order"/></SelectTrigger>
                <SelectContent>
                  {orders.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      #{o.id.slice(0,8)} · {o.wholesale_buyers?.name ?? "Buyer"} · {new Date(o.created_at).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Location name (e.g. Nakuru CBD)</Label><Input value={locName} onChange={e => setLocName(e.target.value)} placeholder="Type current location" /></div>
            <div><Label>Note (optional)</Label><Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button onClick={sendGps} disabled={busy || !orderId} className="flex-1"><Navigation className="h-4 w-4 mr-1"/>Send GPS</Button>
              <Button onClick={sendName} disabled={busy || !orderId} variant="secondary" className="flex-1"><MapPin className="h-4 w-4 mr-1"/>Save location name</Button>
            </div>
            <div className={`flex items-center justify-between gap-2 rounded-md border p-3 ${live ? "border-green-500 bg-green-50 dark:bg-green-950/30" : ""}`}>
              <div className="flex items-center gap-2">
                <Radio className={`h-4 w-4 ${live ? "text-green-600 animate-pulse" : "text-muted-foreground"}`} />
                <div>
                  <div className="text-sm font-medium">Live GPS tracking</div>
                  <div className="text-xs text-muted-foreground">
                    {live ? `Auto-sending every 30s${lastPing ? ` · last ${lastPing}` : ""}` : "Turn on while driving to auto-share location"}
                  </div>
                </div>
              </div>
              <Switch checked={live} onCheckedChange={setLive} disabled={!orderId} />
            </div>
            <p className="text-xs text-muted-foreground">GPS uses your device's geolocation. Each entry is timestamped and visible to the buyer in real time.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tracking History {orderId && `(#${orderId.slice(0,8)})`}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Location</TableHead><TableHead>GPS</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
              <TableBody>
                {events.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No tracking points yet</TableCell></TableRow>}
                {events.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{new Date(e.created_at).toLocaleString()}</TableCell>
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
    </AppShell>
  );
}
