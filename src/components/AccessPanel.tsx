import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createStaffUser, deleteStaffUser, updateStaffAccess } from "@/lib/admin.functions";
import { MODULES } from "@/lib/access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, Users } from "lucide-react";

type Row = { id: string; username: string; role: string; access: string[] | null };

export function AccessPanel() {
  const [users, setUsers] = useState<Row[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"pharmacy" | "inventory" | "accountant" | "order_track">("pharmacy");
  const [access, setAccess] = useState<string[]>(["pharmacy"]);
  const [search, setSearch] = useState("");

  const create = useServerFn(createStaffUser);
  const del = useServerFn(deleteStaffUser);
  const upd = useServerFn(updateStaffAccess);

  const load = async () => {
    const { data } = await supabase
      .from("profiles").select("id, username, role, access")
      .neq("role", "admin").order("created_at", { ascending: false });
    setUsers((data as Row[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const toggle = (key: string) =>
    setAccess(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create({ data: { username, password, role, access } });
      toast.success("User created");
      setUsername(""); setPassword(""); setAccess(["pharmacy"]);
      await load();
    } catch (err) { toast.error((err as Error).message); }
  };

  const toggleUser = async (u: Row, key: string) => {
    const cur = u.access ?? [];
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
    try { await upd({ data: { userId: u.id, access: next } }); await load(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const filtered = search.trim()
    ? users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()))
    : users;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Add user &amp; choose what they can access</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div><Label>Username</Label><Input value={username} onChange={e => setUsername(e.target.value)} required /></div>
              <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></div>
              <div>
                <Label>Main role</Label>
                <Select value={role} onValueChange={v => setRole(v as never)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pharmacy">Pharmacy</SelectItem>
                    <SelectItem value="inventory">Procurement / Inventory</SelectItem>
                    <SelectItem value="accountant">Accountant</SelectItem>
                    <SelectItem value="order_track">Order Track (Delivery)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Can access</Label>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MODULES.map(m => (
                  <label key={m.key} className="flex items-center gap-2 text-sm rounded-md border px-3 py-2">
                    <Checkbox checked={access.includes(m.key)} onCheckedChange={() => toggle(m.key)} />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2"><Button type="submit" className="w-full">Create user</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Users &amp; access ({users.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  {MODULES.map(m => <TableHead key={m.key} className="text-center text-xs">{m.label}</TableHead>)}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={MODULES.length + 3} className="text-center text-muted-foreground text-sm">No users</TableCell></TableRow>
                )}
                {filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell className="capitalize">{u.role}</TableCell>
                    {MODULES.map(m => (
                      <TableCell key={m.key} className="text-center">
                        <Checkbox checked={(u.access ?? []).includes(m.key)} onCheckedChange={() => toggleUser(u, m.key)} />
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={async () => {
                        if (!confirm(`Delete ${u.username}?`)) return;
                        try { await del({ data: { userId: u.id } }); toast.success("Deleted"); await load(); }
                        catch (e) { toast.error((e as Error).message); }
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            When no boxes are ticked the user only sees the pages that match their main role.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
