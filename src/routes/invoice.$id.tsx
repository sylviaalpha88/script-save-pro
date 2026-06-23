import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pill, Printer, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/invoice/$id")({
  component: InvoicePage,
});

type Sale = {
  id: string; sale_type: "retail" | "wholesale"; total: number;
  customer_name: string | null; created_at: string; patient_id: string | null;
};
type Item = { drug_name: string; quantity: number; unit_price: number; subtotal: number };
type Patient = { name: string; age: number | null; patient_code: string | null };

function InvoicePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { profile, loading } = useAuth();
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    if (!loading && !profile) { navigate({ to: "/auth" }); return; }
    (async () => {
      const { data: s } = await supabase.from("sales").select("*").eq("id", id).maybeSingle();
      setSale(s as Sale);
      const { data: it } = await supabase.from("sale_items").select("drug_name, quantity, unit_price, subtotal").eq("sale_id", id);
      setItems((it as Item[]) ?? []);
      if (s?.patient_id) {
        const { data: p } = await supabase.from("patients").select("name, age, patient_code").eq("id", s.patient_id).maybeSingle();
        setPatient(p as Patient);
      }
    })();
  }, [id, loading, profile, navigate]);

  if (!sale) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading invoice…</div>;

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between mb-4 print:hidden">
          <Button variant="outline" onClick={() => navigate({ to: "/" })}><ArrowLeft className="h-4 w-4 mr-2"/>Back</Button>
          <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2"/>Print</Button>
        </div>
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-8 print:p-4">
            <div className="flex items-center justify-between border-b pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                  <Pill className="h-6 w-6"/>
                </div>
                <div>
                  <div className="text-xl font-bold">LEMSA PHARMACY</div>
                  <div className="text-xs text-muted-foreground">Management System</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold uppercase tracking-wider">{sale.sale_type} Invoice</div>
                <div className="text-xs text-muted-foreground">#{sale.id.slice(0, 8).toUpperCase()}</div>
                <div className="text-xs text-muted-foreground">{new Date(sale.created_at).toLocaleString()}</div>
              </div>
            </div>

            <div className="mb-6">
              <div className="text-xs uppercase text-muted-foreground mb-1">Billed To</div>
              <div className="font-semibold">{sale.customer_name ?? patient?.name ?? "—"}</div>
              {patient && (
                <div className="text-sm text-muted-foreground">
                  {patient.age != null && <>Age: {patient.age} · </>}
                  {patient.patient_code && <>ID: {patient.patient_code}</>}
                </div>
              )}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Drug</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{it.drug_name}</td>
                    <td className="py-2 text-right">{it.quantity}</td>
                    <td className="py-2 text-right">${Number(it.unit_price).toFixed(2)}</td>
                    <td className="py-2 text-right">${Number(it.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-4 text-right font-semibold">Total</td>
                  <td className="pt-4 text-right text-xl font-bold">${Number(sale.total).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-10 text-center text-xs text-muted-foreground">
              Thank you for choosing LEMSA Pharmacy.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
