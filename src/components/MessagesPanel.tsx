import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendBulkSms } from "@/lib/messaging.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Search, MessageSquare, Trash2 } from "lucide-react";

type Buyer = { id: string; name: string; phone: string | null };
type MessageRow = {
  id: string; recipient_name: string | null; recipient_phone: string;
  body: string; status: string; created_at: string;
};

export function MessagesPanel() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [body, setBody] = useState("");
  const [history, setHistory] = useState<MessageRow[]>([]);
  const [busy, setBusy] = useState(false);
  const send = useServerFn(sendBulkSms);

  const load = async () => {
    const { data: b } = await supabase.from("wholesale_buyers").select("id, name, phone").order("name");
    setBuyers(((b as Buyer[]) ?? []).filter(x => x.phone));
    const { data: m } = await supabase
      .from("messages").select("id, recipient_name, recipient_phone, body, status, created_at")
      .order("created_at", { ascending: false }).limit(100);
    setHistory((m as MessageRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter(b => b.name.toLowerCase().includes(q) || (b.phone ?? "").includes(q));
  }, [buyers, search]);

  const [pick, setPick] = useState<Record<string, boolean>>({});

  const deleteMessages = async (ids: string[]) => {
    if (ids.length === 0) { toast.error("Select messages to delete"); return; }
    const { error } = await supabase.from("messages").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`Deleted ${ids.length} message${ids.length > 1 ? "s" : ""}`);
    setPick({});
    await load();
  };

  const selectedIds = Object.keys(selected).filter(k => selected[k]);
  const allChecked = filtered.length > 0 && filtered.every(b => selected[b.id]);

  const submit = async () => {
    if (selectedIds.length === 0) { toast.error("Pick at least one buyer"); return; }
    if (!body.trim()) { toast.error("Message is empty"); return; }
    setBusy(true);
    try {
      const res = await send({ data: { buyerIds: selectedIds, body: body.trim() } });
      toast.success(`Sent ${res.sent}/${res.total} messages`);
      setBody(""); setSelected({});
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/>Send SMS to Buyers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Search buyers</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/>
              <Input className="pl-8" placeholder="Name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="border rounded-md max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(v) => {
                        const next = { ...selected };
                        filtered.forEach(b => { next[b.id] = !!v; });
                        setSelected(next);
                      }}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No buyers with phone numbers</TableCell></TableRow>}
                {filtered.map(b => (
                  <TableRow key={b.id}>
                    <TableCell><Checkbox checked={!!selected[b.id]} onCheckedChange={(v) => setSelected(s => ({ ...s, [b.id]: !!v }))} /></TableCell>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-sm">{b.phone}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <Label>Message ({body.length}/500)</Label>
            <Textarea rows={4} maxLength={500} value={body} onChange={e => setBody(e.target.value)} placeholder="Type the SMS message that will be delivered to the selected buyers…" />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {selectedIds.length} selected • sent via Africa's Talking
            </div>
            <Button onClick={submit} disabled={busy}>
              <Send className="h-4 w-4 mr-1" /> {busy ? "Sending…" : "Send SMS"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Messages ({history.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-auto max-h-[520px]">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>To</TableHead><TableHead>Body</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {history.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No messages sent yet</TableCell></TableRow>}
                {history.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{m.recipient_name}</div>
                      <div className="text-xs text-muted-foreground">{m.recipient_phone}</div>
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate" title={m.body}>{m.body}</TableCell>
                    <TableCell>
                      <Badge variant={m.status === "sent" ? "default" : "destructive"}>{m.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
