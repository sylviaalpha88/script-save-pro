import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPharmaciesPublic, registerBuyer } from "@/lib/buyer.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Pill, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

type Pharmacy = { id: string; name: string };

function RegisterPage() {
  const list = useServerFn(listPharmaciesPublic);
  const register = useServerFn(registerBuyer);
  const navigate = useNavigate();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [pharmacyId, setPharmacyId] = useState("");
  const [form, setForm] = useState({
    name: "", idNumber: "", phone: "", location: "",
    licenseNumber: "", email: "", password: "",
  });
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { list({}).then(setPharmacies).catch(() => {}); }, [list]);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pharmacyId) { toast.error("Select a pharmacy"); return; }
    setBusy(true);
    try {
      await register({ data: { ...form, pharmacyId } });
      // Auto sign-in so we can upload the license PDF under the user's folder.
      const { error: sErr } = await supabase.auth.signInWithPassword({
        email: form.email.toLowerCase(), password: form.password,
      });
      if (sErr) throw sErr;

      if (licenseFile) {
        const { data: ses } = await supabase.auth.getSession();
        const uid = ses.session?.user.id;
        if (uid) {
          const path = `${uid}/${Date.now()}_${licenseFile.name}`;
          const { error: upErr } = await supabase.storage.from("licenses").upload(path, licenseFile, { upsert: true });
          if (!upErr) {
            await supabase.from("wholesale_buyers").update({ license_pdf_path: path }).eq("user_id", uid);
          }
        }
      }
      toast.success("Account created. Awaiting pharmacy approval.");
      navigate({ to: "/buyer" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/20 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4 hover:underline">
          <ArrowLeft className="h-4 w-4"/> Back to home
        </Link>
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
              <Pill className="h-6 w-6"/>
            </div>
            <CardTitle className="text-2xl">Wholesale Buyer Registration</CardTitle>
            <p className="text-sm text-muted-foreground">Create an account to order from a LEMSA pharmacy.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Select Pharmacy</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={pharmacyId} onChange={e => setPharmacyId(e.target.value)} required>
                  <option value="">— choose a pharmacy —</option>
                  {pharmacies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label>Your name / Facility</Label><Input value={form.name} onChange={update("name")} required /></div>
                <div><Label>ID number</Label><Input value={form.idNumber} onChange={update("idNumber")} required /></div>
                <div><Label>Phone number</Label><Input value={form.phone} onChange={update("phone")} required /></div>
                <div><Label>Location</Label><Input value={form.location} onChange={update("location")} required /></div>
                <div><Label>License number</Label><Input value={form.licenseNumber} onChange={update("licenseNumber")} required /></div>
                <div>
                  <Label>License PDF</Label>
                  <Input type="file" accept="application/pdf" onChange={e => setLicenseFile(e.target.files?.[0] ?? null)} />
                </div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={update("email")} required /></div>
                <div><Label>Password</Label><Input type="password" value={form.password} onChange={update("password")} required minLength={6} /></div>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Creating account…" : "Create Buyer Account"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Already have an account? <Link to="/auth" className="text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
