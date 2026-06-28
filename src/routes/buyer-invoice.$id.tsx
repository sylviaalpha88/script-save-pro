import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pill, Printer, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/buyer-invoice/$id")({
  component: BuyerInvoicePage,
});

type Order = {
  id: string; created_at: string; total: number; amount_paid: number;
  payment_status: string; payment_method: string | null;
  wholesale_buyers: { name: string; phone: string | null; email: string | null; id_number: string | null; location: string | null } | null;
};
type Item = { drug_name: string; approved_qty: number | null; requested_qty: number; unit_price: number; subtotal: number; status: string };

function BuyerInvoicePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { profile, loading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!loading && !profile) { navigate({ to: "/auth" }); return; }
    (async () => {
      const { data: o } = await supabase.from("buyer_orders")
        .select("id, created_at, total, amount_paid, payment_status, payment_method, wholesale_buyers(name, phone, email, id_number, location)")
        .eq("id", id).maybeSingle();
      setOrder(o as unknown as Order);
      const { data: its } = await supabase.from("buyer_order_items")
        .select("drug_name, approved_qty, requested_qty, unit_price, subtotal, status")
        .eq("order_id", id).eq("status", "approved");
      setItems((its as Item[]) ?? []);
    })();
  }, [id, loading, profile, navigate]);

  if (!order) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading invoice…</div>;

  const back = profile?.role === "buyer" ? "/buyer" : "/pharmacy";
  const isPaid = order.payment_status === "paid";

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between mb-4 print:hidden">
          <Button variant="outline" onClick={() => navigate({ to: back })}><ArrowLeft className="h-4 w-4 mr-2"/>Back</Button>
          <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2"/>Print / Download PDF</Button>
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
                  <div className="text-xs text-muted-foreground">Wholesale Invoice</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold uppercase tracking-wider ${isPaid ? "text-green-600" : "text-amber-600"}`}>{isPaid ? "PAID" : "PENDING PAYMENT"}</div>
                <div className="text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</div>
                <div className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</div>
              </div>
            </div>

            <div className="mb-6">
              <div className="text-xs uppercase text-muted-foreground mb-1">Billed To</div>
              <div className="font-semibold">{order.wholesale_buyers?.name ?? "—"}</div>
              <div className="text-sm text-muted-foreground">
                {order.wholesale_buyers?.phone} · {order.wholesale_buyers?.email}
                {order.wholesale_buyers?.id_number && <> · ID {order.wholesale_buyers.id_number}</>}
              </div>
              {order.wholesale_buyers?.location && <div className="text-sm text-muted-foreground">{order.wholesale_buyers.location}</div>}
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
                    <td className="py-2 text-right">{it.approved_qty ?? it.requested_qty}</td>
                    <td className="py-2 text-right">KSh {Number(it.unit_price).toFixed(2)}</td>
                    <td className="py-2 text-right">KSh {Number(it.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-4 text-right font-semibold">Total</td>
                  <td className="pt-4 text-right text-xl font-bold">KSh {Number(order.total).toFixed(2)}</td>
                </tr>
                {Number(order.amount_paid) > 0 && (
                  <tr>
                    <td colSpan={3} className="pt-2 text-right text-sm">Amount Paid {order.payment_method ? `(${order.payment_method})` : ""}</td>
                    <td className="pt-2 text-right text-sm">KSh {Number(order.amount_paid).toFixed(2)}</td>
                  </tr>
                )}
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
