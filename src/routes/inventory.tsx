import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { canAccess } from "@/lib/access";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, Tags, HardDriveDownload } from "lucide-react";
import { exportOfflineCopy, deleteRange } from "@/lib/offline-export";

export const Route = createFileRoute("/inventory")({
  component: ServiceStockPage,
  head: () => ({
    meta: [
      { title: "Service Stock · Services, Retail & Wholesale Prices" },
      { name: "description", content: "Create services and set their retail and wholesale selling prices, which inventory items pick up automatically." },
      { property: "og:title", content: "Service Stock · Services, Retail & Wholesale Prices" },
      { property: "og:description", content: "Create services and set their retail and wholesale selling prices, which inventory items pick up automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

export type Service = {
  id: string;
  name: string;
  unit: "tab" | "cap" | "piece";
  selling_price_retail: number;
  selling_price_wholesale: number;
};

function ServiceStockPage() {
  const { profile, loading } = useAuth();
  const [reload, setReload] = useState(0);
  return (
    <AppShell title="Service Stock" subtitle="Define services and the prices every drug added under them will use">
      {!loading && profile && !canAccess(profile, "service_stock") ? (
        <p className="text-destructive font-semibold">You don't have permission to access this page.</p>
      ) : (
        <Tabs defaultValue="manage" className="space-y-6">
          <TabsList>
            <TabsTrigger value="manage">Manage Service</TabsTrigger>
            <TabsTrigger value="add">Add New Service</TabsTrigger>
            <TabsTrigger value="free">Free Space</TabsTrigger>
          </TabsList>
          <TabsContent value="manage"><ServiceList key={reload} /></TabsContent>
          <TabsContent value="add"><AddService onAdded={() => setReload(n => n + 1)} /></TabsContent>
          <TabsContent value="free"><FreeSpace /></TabsContent>
        </Tabs>

      )}
    </AppShell>
  );
}

function ServiceList() {
  const [rows, setRows] = useState<Service[]>([]);
  const [edit, setEdit] = useState<Record<string, Partial<Service>>>({});

  const load = async () => {
    const { data, error } = await supabase
      .from("services")
      .select("id, name, unit, selling_price_retail, selling_price_wholesale")
      .order("name");
    if (error) { toast.error(error.message); return; }
    setRows((data as Service[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async (id: string) => {
    const patch = edit[id];
    if (!patch) return;
    const { error } = await supabase.from("services").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Service updated");
    setEdit(prev => { const c = { ...prev }; delete c[id]; return c; });
    await load();
  };

  const remove = async (s: Service) => {
    if (!confirm(`Delete service "${s.name}"?`)) return;
    const { error } = await supabase.from("services").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    await load();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5" />Current Service ({rows.length})</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service name</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Retail Price</TableHead>
              <TableHead>Wholesale Price</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No services yet. Add one in “Add New Service”.</TableCell></TableRow>
            )}
            {rows.map(s => {
              const e = edit[s.id] ?? {};
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="capitalize">{s.unit}</TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" className="w-28" defaultValue={s.selling_price_retail}
                      onChange={ev => setEdit(p => ({ ...p, [s.id]: { ...e, selling_price_retail: Number(ev.target.value) } }))} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" className="w-28" defaultValue={s.selling_price_wholesale}
                      onChange={ev => setEdit(p => ({ ...p, [s.id]: { ...e, selling_price_wholesale: Number(ev.target.value) } }))} />
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" onClick={() => save(s.id)}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

function AddService({ onAdded }: { onAdded: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<"tab" | "cap" | "piece">("tab");
  const [retail, setRetail] = useState("");
  const [wholesale, setWholesale] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pharmacyId = profile?.pharmacy_id;
    if (!pharmacyId) { toast.error("Your account is not linked to a pharmacy"); return; }
    const { error } = await supabase.from("services").insert({
      name: name.trim(),
      unit,
      selling_price_retail: Number(retail),
      selling_price_wholesale: Number(wholesale),
      pharmacy_id: pharmacyId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Service added");
    setName(""); setRetail(""); setWholesale("");
    onAdded();
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>Add New Service</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Service name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} required placeholder="hint: the service name is the drug name" />
          </div>
          <div>
            <Label>Unit (per)</Label>
            <Select value={unit} onValueChange={v => setUnit(v as "tab" | "cap" | "piece")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tab">Tablet</SelectItem>
                <SelectItem value="cap">Capsule</SelectItem>
                <SelectItem value="piece">Piece</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Retail selling price (per {unit})</Label><Input type="number" step="0.01" value={retail} onChange={e => setRetail(e.target.value)} required /></div>
          <div><Label>Wholesale selling price (per {unit})</Label><Input type="number" step="0.01" value={wholesale} onChange={e => setWholesale(e.target.value)} required /></div>
          <div className="sm:col-span-2"><Button type="submit" className="w-full">Save Service</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function FreeSpace() {
  const { profile } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      const res = await exportOfflineCopy(profile?.pharmacy_id ?? null, { from, to });
      setDownloaded(true);
      const total = Object.values(res.counts).reduce((a, b) => a + b, 0);
      toast.success(`Offline copy downloaded (${total} records) — opens instantly with no internet`);

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirm(`Delete all live records from ${from} to ${to}? Make sure you downloaded the copy first.`)) return;
    setBusy(true);
    const errors = await deleteRange(profile?.pharmacy_id ?? null, { from, to });
    setBusy(false);
    if (errors.length) { toast.error(errors[0]); return; }
    toast.success("Records in the selected dates deleted from the live system");
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HardDriveDownload className="h-5 w-5" />Free Space</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Download a copy of the system as one file — same look as here, with the menu, coloured cards and all your
          records for the chosen dates inside. It opens straight away on any PC with no internet. After downloading,
          you can free space by deleting the live records of the same dates.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Date from</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Date to</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={doExport} disabled={busy}>
            <HardDriveDownload className="h-4 w-4 mr-1" />{busy ? "Working…" : "Download offline copy"}
          </Button>
          <Button variant="destructive" onClick={doDelete} disabled={busy || !downloaded}>
            <Trash2 className="h-4 w-4 mr-1" />Delete these dates from the live site
          </Button>
        </div>
        {!downloaded && <p className="text-xs text-muted-foreground">Deletion unlocks after a copy is downloaded.</p>}
      </CardContent>
    </Card>
  );
}
