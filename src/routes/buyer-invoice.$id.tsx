import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
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
  payment_status: string; payment_method: string | null; pharmacy_id: string;
  wholesale_buyers: { name: string; phone: string | null; email: string | null; id_number: string | null; location: string | null } | null;
};
type Item = { drug_name: string; approved_qty: number | null; requested_qty: number; unit_price: number; subtotal: number; status: string };
type Pharmacy = { name: string; phone: string | null; email: string | null; address: string | null; location: string | null; logo_path: string | null };

function BuyerInvoicePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { profile, loading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !profile) { navigate({ to: "/auth" }); return; }
    (async () => {
      const { data: o } = await supabase.from("buyer_orders")
        .select("id, created_at, total, amount_paid, payment_status, payment_method, pharmacy_id, wholesale_buyers(name, phone, email, id_number, location)")
        .eq("id", id).maybeSingle();
      setOrder(o as unknown as Order);
      const { data: its } = await supabase.from("buyer_order_items")
        .select("drug_name, approved_qty, requested_qty, unit_price, subtotal, status")
        .eq("order_id", id).eq("status", "approved");
      setItems((its as Item[]) ?? []);
      if (o?.pharmacy_id) {
        const { data: ph } = await supabase.from("pharmacies")
          .select("name, phone, email, address, location, logo_path")
          .eq("id", o.pharmacy_id).maybeSingle();
        if (ph) {
          setPharmacy(ph as Pharmacy);
          if (ph.logo_path) {
            const { data: s } = await supabase.storage.from("pharmacy-logos").createSignedUrl(ph.logo_path, 3600);
            setLogoUrl(s?.signedUrl ?? null);
          }
        }
      }
      try {
        const url = typeof window !== "undefined" ? window.location.href : "";
        const qr = await QRCode.toDataURL(url, { margin: 1, width: 160 });
        setQrDataUrl(qr);
      } catch { /* ignore */ }
    })();
  }, [id, loading, profile, navigate]);

  if (!order) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading invoice…</div>;

  const back = profile?.role === "buyer" ? "/buyer" : "/pharmacy";
  const isPaid = order.payment_status === "paid";

  const Header = (
    <div className="flex items-start justify-between border-b pb-4 mb-6 gap-4">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="Pharmacy logo" className="h-16 w-16 object-contain rounded-md border bg-white" />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Pill className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="text-right text-xs leading-relaxed">
        <div className="text-base font-bold">{pharmacy?.name ?? "LEMSA PHARMACY"}</div>
        {pharmacy?.address && <div>{pharmacy.address}</div>}
        {pharmacy?.location && <div>{pharmacy.location}</div>}
        {pharmacy?.phone && <div>Tel: {pharmacy.phone}</div>}
        {pharmacy?.email && <div>{pharmacy.email}</div>}
      </div>
    </div>
  );

  const Footer = (
    <div className="mt-10 pt-4 border-t flex items-end justify-between gap-4">
      <div className="text-xs text-muted-foreground max-w-[60%]">
        <div className="font-semibold text-foreground mb-1">Scan to download / view this invoice</div>
        Scan the QR code with any smartphone camera. It opens this exact invoice page where you can print or save as PDF.
      </div>
      {qrDataUrl && (
        <div className="text-center">
          <img src={qrDataUrl} alt="Invoice QR code" className="h-24 w-24" />
          <div className="text-[10px] text-muted-foreground mt-1">QR SCAN</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8">
      <style>{`
        @media print {
          @page { margin: 18mm 12mm 32mm 12mm; }
          .print-fixed-header {
            position: fixed; top: 0; left: 0; right: 0;
            display: flex; align-items: flex-start; justify-content: space-between;
            padding: 6mm 12mm; border-bottom: 1px solid #ddd; background: white;
            font-size: 10px;
          }
          .print-fixed-footer {
            position: fixed; bottom: 0; left: 0; right: 0;
            display: flex; align-items: center; justify-content: space-between;
            padding: 4mm 12mm; border-top: 1px solid #ddd; background: white;
            font-size: 9px;
          }
          .print-hidden-on-page { display: none !important; }
        }
      `}</style>

      {/* Repeating print header (logo far left, pharmacy info far right) */}
      <div className="print-fixed-header hidden print:flex">
        <div>
          {logoUrl
            ? <img src={logoUrl} alt="" style={{ height: 56, width: 56, objectFit: "contain" }} />
            : <div style={{ fontWeight: 700 }}>{pharmacy?.name ?? "LEMSA PHARMACY"}</div>}
        </div>
        <div style={{ textAlign: "right", lineHeight: 1.35 }}>
          <div style={{ fontWeight: 700 }}>{pharmacy?.name ?? "LEMSA PHARMACY"}</div>
          {pharmacy?.address && <div>{pharmacy.address}</div>}
          {pharmacy?.location && <div>{pharmacy.location}</div>}
          {pharmacy?.phone && <div>Tel: {pharmacy.phone}</div>}
          {pharmacy?.email && <div>{pharmacy.email}</div>}
        </div>
      </div>

      {/* Repeating print footer QR */}
      <div className="print-fixed-footer hidden print:flex">
        <div>Scan QR to download this invoice PDF</div>
        {qrDataUrl && <img src={qrDataUrl} alt="" style={{ height: 70, width: 70 }} />}
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between mb-4 print:hidden">
          <Button variant="outline" onClick={() => navigate({ to: back })}><ArrowLeft className="h-4 w-4 mr-2"/>Back</Button>
          <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2"/>Print / Download PDF</Button>
        </div>
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-8 print:p-4">
            {Header}

            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Billed To</div>
                <div className="font-semibold">{order.wholesale_buyers?.name ?? "—"}</div>
                <div className="text-sm text-muted-foreground">
                  {order.wholesale_buyers?.phone} · {order.wholesale_buyers?.email}
                  {order.wholesale_buyers?.id_number && <> · ID {order.wholesale_buyers.id_number}</>}
                </div>
                {order.wholesale_buyers?.location && <div className="text-sm text-muted-foreground">{order.wholesale_buyers.location}</div>}
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold uppercase tracking-wider ${isPaid ? "text-green-600" : "text-amber-600"}`}>{isPaid ? "PAID INVOICE" : "PENDING INVOICE"}</div>
                <div className="text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</div>
                <div className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</div>
              </div>
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
                {!isPaid && (
                  <tr>
                    <td colSpan={3} className="pt-2 text-right text-sm font-semibold text-amber-600">Balance Due</td>
                    <td className="pt-2 text-right text-sm font-semibold text-amber-600">KSh {(Number(order.total) - Number(order.amount_paid)).toFixed(2)}</td>
                  </tr>
                )}
              </tfoot>
            </table>

            {Footer}

            <div className="mt-6 text-center text-xs text-muted-foreground">
              Thank you for choosing {pharmacy?.name ?? "LEMSA Pharmacy"}.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
