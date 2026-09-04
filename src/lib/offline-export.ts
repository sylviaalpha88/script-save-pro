import { supabase } from "@/integrations/supabase/client";

export type ExportRange = { from: string; to: string };

export type ArchiveData = Record<string, unknown[]>;

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Pull every record of this pharmacy inside the selected date range. */
export async function collectArchive(pharmacyId: string | null, range: ExportRange): Promise<ArchiveData> {
  const fromIso = new Date(`${range.from}T00:00:00`).toISOString();
  const toIso = new Date(`${range.to}T23:59:59.999`).toISOString();

  const scoped = async (table: string, cols = "*", dateCol: string | null = "created_at") => {
    let q = supabase.from(table as never).select(cols);
    if (pharmacyId) q = (q as never as { eq: (a: string, b: string) => typeof q }).eq("pharmacy_id", pharmacyId);
    if (dateCol) {
      q = (q as never as { gte: (a: string, b: string) => typeof q }).gte(dateCol, fromIso);
      q = (q as never as { lte: (a: string, b: string) => typeof q }).lte(dateCol, toIso);
    }
    const { data } = await q;
    return (data as unknown[]) ?? [];
  };

  const [sales, saleItems, buyerOrders, buyerOrderItems, drugs, stock, services, patients, buyers, reports, messages, tracking] =
    await Promise.all([
      scoped("sales"),
      scoped("sale_items"),
      scoped("buyer_orders"),
      scoped("buyer_order_items"),
      scoped("drugs", "*", null),
      scoped("pharmacy_stock", "*", null),
      scoped("services", "*", null),
      scoped("patients"),
      scoped("wholesale_buyers", "*", null),
      scoped("accountant_reports"),
      scoped("messages"),
      scoped("order_tracking_events"),
    ]);

  return {
    sales, sale_items: saleItems, buyer_orders: buyerOrders, buyer_order_items: buyerOrderItems,
    drugs, pharmacy_stock: stock, services, patients, wholesale_buyers: buyers,
    accountant_reports: reports, messages, order_tracking_events: tracking,
  };
}

const LABELS: Record<string, string> = {
  sales: "Retail & Wholesale Sales",
  sale_items: "Sold Items",
  buyer_orders: "Buyers Orders",
  buyer_order_items: "Buyer Order Items",
  drugs: "Inventory Items",
  pharmacy_stock: "Pharmacy Counter Stock",
  services: "Service Stock",
  patients: "Patients",
  wholesale_buyers: "Wholesale Buyer Accounts",
  accountant_reports: "Daily Reports",
  messages: "Messages",
  order_tracking_events: "Order Tracking",
};

/**
 * Build one self-contained HTML file that looks like the live system
 * (header, left menu, coloured cards) with the archive embedded.
 * It opens instantly because there is no bundle to download or evaluate.
 */
function buildViewer(data: ArchiveData, range: ExportRange): string {
  const keys = Object.keys(data);
  const rowsHtml = (rows: unknown[]) => {
    if (rows.length === 0) return `<p class="empty">No records in this range.</p>`;
    const cols = Object.keys(rows[0] as Record<string, unknown>);
    return `<div class="scroll"><table><thead><tr>${cols.map(c => `<th>${esc(c.replace(/_/g, " "))}</th>`).join("")}</tr></thead><tbody>${rows
      .map(r => `<tr>${cols.map(c => `<td>${esc((r as Record<string, unknown>)[c])}</td>`).join("")}</tr>`)
      .join("")}</tbody></table></div>`;
  };
  const pages = Object.fromEntries(keys.map(k => [k, rowsHtml(data[k])]));
  const labels = Object.fromEntries(keys.map(k => [k, LABELS[k] ?? k.replace(/_/g, " ")]));

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>LEMSA PMS · Offline Copy ${esc(range.from)} → ${esc(range.to)}</title>
<style>
 *{box-sizing:border-box}
 body{margin:0;font-family:ui-sans-serif,system-ui,Segoe UI,Arial;background:linear-gradient(180deg,#eff6ff,#f8fafc);color:#0f172a}
 header{display:flex;align-items:center;gap:12px;padding:14px 20px;background:linear-gradient(90deg,#0ea5e9,#22c55e);color:#fff}
 header h1{margin:0;font-size:20px;font-weight:800;letter-spacing:.02em;text-transform:uppercase}
 header .sub{font-size:12px;opacity:.9}
 .layout{display:flex;min-height:calc(100vh - 58px)}
 aside{width:230px;flex:0 0 230px;background:#fff;border-right:1px solid #dbeafe;padding:12px}
 aside button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:9px 10px;border-radius:9px;font-size:13px;font-weight:600;color:#0f172a;cursor:pointer}
 aside button:hover{background:#eff6ff}
 aside button.on{background:#0ea5e9;color:#fff}
 main{flex:1;padding:18px 22px 40px;min-width:0}
 .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:18px}
 .card{border-radius:14px;padding:14px;color:#fff;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(15,23,42,.12)}
 .card small{display:block;font-weight:600;opacity:.9;font-size:11px;margin-top:4px}
 .panel{background:#fff;border:1px solid #dbeafe;border-radius:14px;padding:14px}
 .panel h2{margin:0 0 10px;font-size:16px}
 .scroll{overflow:auto;max-height:70vh}
 table{width:100%;border-collapse:collapse;font-size:12px}
 th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;white-space:nowrap}
 th{background:#f1f5f9;position:sticky;top:0}
 .empty{color:#64748b;font-size:13px}
 @media (max-width:820px){.layout{flex-direction:column}aside{width:auto;flex:none}}
 @media print{aside,.cards{display:none}}
</style></head><body>
<header><div><h1>LEMSA PMS — Offline Copy</h1>
<div class="sub">Records ${esc(range.from)} to ${esc(range.to)} · works on any PC with no internet</div></div></header>
<div class="layout"><aside id="nav"></aside>
<main><div class="cards" id="cards"></div><div class="panel"><h2 id="ttl"></h2><div id="body"></div></div></main></div>
<script>
const DATA=${JSON.stringify(Object.fromEntries(keys.map(k => [k, data[k].length])))};
const PAGES=${JSON.stringify(pages)};
const LABELS=${JSON.stringify(labels)};
const COLORS=['#0ea5e9','#22c55e','#6366f1','#f59e0b','#ec4899','#14b8a6','#8b5cf6','#ef4444','#0891b2','#65a30d','#f97316','#7c3aed'];
const nav=document.getElementById('nav'),cards=document.getElementById('cards'),body=document.getElementById('body'),ttl=document.getElementById('ttl');
const keys=Object.keys(DATA);
function show(k){
  ttl.textContent=LABELS[k]+' ('+DATA[k]+')';
  body.innerHTML=PAGES[k];
  [...nav.children].forEach(function(c){c.classList.toggle('on',c.dataset.k===k);});
}
keys.forEach(function(k,i){
  const b=document.createElement('button');b.textContent=LABELS[k];b.dataset.k=k;b.onclick=function(){show(k);};nav.appendChild(b);
  const c=document.createElement('div');c.className='card';c.style.background=COLORS[i%COLORS.length];
  c.innerHTML=LABELS[k]+'<small>'+DATA[k]+' records</small>';c.onclick=function(){show(k);};cards.appendChild(c);
});
show(keys[0]);
<\/script></body></html>`;
}

export async function exportOfflineCopy(pharmacyId: string | null, range: ExportRange) {
  const data = await collectArchive(pharmacyId, range);
  const html = buildViewer(data, range);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lemsa-pms-offline-${range.from}_to_${range.to}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
  return { mode: "app" as const, counts };
}

/** Delete the live records inside the range once a copy has been downloaded. */
export async function deleteRange(pharmacyId: string | null, range: ExportRange) {
  const fromIso = new Date(`${range.from}T00:00:00`).toISOString();
  const toIso = new Date(`${range.to}T23:59:59.999`).toISOString();
  const order = [
    "sale_items", "sales", "buyer_order_items", "buyer_orders",
    "order_tracking_events", "accountant_reports", "messages",
  ];
  const errors: string[] = [];
  for (const table of order) {
    let q = supabase.from(table as never).delete();
    if (pharmacyId) q = (q as never as { eq: (a: string, b: string) => typeof q }).eq("pharmacy_id", pharmacyId);
    q = (q as never as { gte: (a: string, b: string) => typeof q }).gte("created_at", fromIso);
    q = (q as never as { lte: (a: string, b: string) => typeof q }).lte("created_at", toIso);
    const { error } = await q;
    if (error) errors.push(`${table}: ${error.message}`);
  }
  return errors;
}
