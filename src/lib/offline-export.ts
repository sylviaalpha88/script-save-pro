import { supabase } from "@/integrations/supabase/client";
import { getPrintBrand } from "@/lib/print";

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

  const [
    sales, saleItems, buyerOrders, buyerOrderItems, drugs, stock, services, patients, buyers, reports, messages,
    tracking, procurement, procurementItems, applicants,
  ] = await Promise.all([
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
    scoped("stock_orders"),
    scoped("stock_order_items"),
    scoped("vacancy_applications"),
  ]);

  return {
    sales, sale_items: saleItems, buyer_orders: buyerOrders, buyer_order_items: buyerOrderItems,
    drugs, pharmacy_stock: stock, services, patients, wholesale_buyers: buyers,
    accountant_reports: reports, messages, order_tracking_events: tracking,
    stock_orders: procurement, stock_order_items: procurementItems, vacancy_applications: applicants,
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
  stock_orders: "Procurement Requests",
  stock_order_items: "Requested Items",
  vacancy_applications: "Vacancy Applicants",
};

/** Same modules, same order, same wording and colours as the live left menu. */
type Module = { key: string; label: string; subtitle: string; tone: string; text: string; tabs: { label: string; table: string }[] };

const MODULES: Module[] = [
  {
    key: "dashboard", label: "Dashboard", subtitle: "Sales, cash and M-Pesa summary for the saved dates",
    tone: "#f5f3ff", text: "#6d28d9",
    tabs: [
      { label: "Retail & Wholesale Sales", table: "sales" },
      { label: "Total Sales per Item", table: "sale_items" },
      { label: "Daily Reports", table: "accountant_reports" },
    ],
  },
  {
    key: "pharmacy", label: "Pharmacy", subtitle: "Manage medicines sales and pharmacy operations",
    tone: "#ecfdf5", text: "#047857",
    tabs: [
      { label: "Buyers Order", table: "buyer_orders" },
      { label: "Make Order (Items Ordered)", table: "buyer_order_items" },
      { label: "Register Buyer", table: "wholesale_buyers" },
      { label: "Today", table: "sales" },
      { label: "History", table: "sale_items" },
      { label: "Retail (Patients)", table: "patients" },
      { label: "Wholesale", table: "wholesale_buyers" },
      { label: "Pharmacy Store", table: "pharmacy_stock" },
      { label: "Service Stock", table: "services" },
    ],
  },
  {
    key: "procurement", label: "Procurement", subtitle: "Stock orders, counter stock and requests",
    tone: "#fffbeb", text: "#b45309",
    tabs: [
      { label: "Add Procurement", table: "stock_orders" },
      { label: "Receive Procurement", table: "stock_order_items" },
      { label: "Requested Items", table: "stock_order_items" },
      { label: "Inventory Items", table: "drugs" },
      { label: "Pharmacy Counter Stock", table: "pharmacy_stock" },
      { label: "Requests History", table: "stock_orders" },
    ],
  },
  {
    key: "accountant", label: "Accountant", subtitle: "Cash received, M-Pesa received and daily reconciliation",
    tone: "#fff1f2", text: "#be123c",
    tabs: [
      { label: "Daily Reports", table: "accountant_reports" },
      { label: "Sales Received", table: "sales" },
      { label: "Sold Items", table: "sale_items" },
    ],
  },
  {
    key: "order_track", label: "Order Track", subtitle: "Tracked buyer orders and recorded tracking points",
    tone: "#f0f9ff", text: "#0369a1",
    tabs: [
      { label: "Buyers Orders", table: "buyer_orders" },
      { label: "Items In Orders", table: "buyer_order_items" },
      { label: "Tracking Points", table: "order_tracking_events" },
    ],
  },
  {
    key: "public_site", label: "Public Site", subtitle: "Wholesale buyer accounts shown on the public site",
    tone: "#eef2ff", text: "#4338ca",
    tabs: [
      { label: "Wholesale Buyer Accounts", table: "wholesale_buyers" },
      { label: "Register Buyer", table: "wholesale_buyers" },
    ],
  },

  {
    key: "admin_settings", label: "Admin Settings", subtitle: "Pharmacy information saved with this copy",
    tone: "#eff6ff", text: "#1d4ed8",
    tabs: [{ label: "Pharmacy Information", table: "__brand" }],
  },
  {
    key: "messages", label: "Messages", subtitle: "Messages sent and received in these dates",
    tone: "#f0fdfa", text: "#0f766e",
    tabs: [{ label: "Messages", table: "messages" }],
  },
  {
    key: "vacancy", label: "Vacancy", subtitle: "Applicants recorded in these dates",
    tone: "#fdf4ff", text: "#a21caf",
    tabs: [{ label: "Applicants", table: "vacancy_applications" }],
  },
  {
    key: "service_stock", label: "Service Stock", subtitle: "Services with retail and wholesale selling prices",
    tone: "#f7fee7", text: "#4d7c0f",
    tabs: [{ label: "Current Service", table: "services" }],
  },
  {
    key: "pharm_branding", label: "Pharm Branding", subtitle: "Logo and pharmacy details used on every printed PDF",
    tone: "#fff7ed", text: "#e11d48",
    tabs: [{ label: "Branding", table: "__brand" }],
  },
];

/** Friendly words for every column shown in the offline copy. */
const COLUMN_LABELS: Record<string, string> = {
  sale_type: "Sale Type",
  customer_name: "Customer",
  patient_name: "Patient",
  drug_name: "Item",
  quantity: "Quantity",
  requested_qty: "Quantity Requested",
  approved_qty: "Quantity Approved",
  unit_price: "Unit Price",
  subtotal: "Subtotal",
  total: "Total",
  amount_paid: "Amount Received",
  payment_method: "Paid By",
  payment_status: "Payment",
  cash: "Cash Received",
  mpesa: "M-Pesa Received",
  created_at: "Date",
  updated_at: "Last Updated",
  decided_at: "Decided On",
  moved_at: "Moved On",
  stock_quantity: "In Store",
  min_stock: "Minimum",
  avg_stock: "Average",
  max_stock: "Maximum",
  reorder_level: "Reorder Level",
  buying_price: "Buying Price",
  selling_price: "Selling Price",
  selling_price_retail: "Retail Price",
  selling_price_wholesale: "Wholesale Price",
  wholesale_min_qty: "Wholesale Minimum Qty",
  measurement_per_item: "Measurement",
  supplier_name: "Supplier",
  lead_time_days: "Lead Time (days)",
  unit_cost: "Unit Cost",
  tax_vat: "Tax / VAT",
  freight_cost: "Freight Cost",
  computed_total: "Computed Total",
  qty_ordered: "Quantity Ordered",
  qty_received: "Quantity Received",
  batch_number: "Batch Number",
  manufacture_date: "Manufactured",
  expiry_date: "Expires",
  storage_location: "Storage Location",
  quality_status: "Quality",
  requested_by_name: "Requested By",
  reject_reason: "Reason",
  flagged_out_of_stock: "Out Of Stock",
  recipient_name: "Sent To",
  recipient_phone: "Phone",
  body: "Message",
  status: "Status",
  note: "Note",
  notes: "Notes",
  location_name: "Place",
  latitude: "Latitude",
  longitude: "Longitude",
  applicant_name: "Applicant",
  id_number: "ID Number",
  license_number: "License Number",
  name: "Name",
  phone: "Phone",
  email: "Email",
  location: "Location",
  age: "Age",
  patient_code: "Patient Number",
  report_date: "Report Date",
  unit: "Unit",
  sku: "Code",
  category: "Category",
  department: "Department",
  description: "Description",
  remaining: "Remaining",
  order_qty: "Order Quantity",
  level: "Level",
  archived_at: "Archived On",
};

/** Columns that only hold machine references — never shown in the offline copy. */
const isHiddenColumn = (c: string) =>
  c === "id" ||
  c.endsWith("_id") ||
  c.endsWith("_by") ||
  c.endsWith("_path") ||
  c.endsWith("_paths") ||
  c === "provider_response" ||
  c === "at_api_key";

const MONEY = /(price|total|cash|mpesa|paid|cost|subtotal|vat)/i;

const label = (c: string) =>
  COLUMN_LABELS[c] ?? c.replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());

function cell(col: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.map(x => String(x)).join(", ") : "—";
  if (typeof v === "object") return "—";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`).toLocaleDateString();
  if (typeof v === "number" && MONEY.test(col)) return `KSh ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (MONEY.test(col) && /^\d+(\.\d+)?$/.test(s)) return `KSh ${Number(s).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return s;
}

function tableHtml(rows: unknown[]): string {
  if (rows.length === 0) return `<p class="empty">No records saved for these dates.</p>`;
  const all = Object.keys(rows[0] as Record<string, unknown>);
  const cols = all.filter(c => !isHiddenColumn(c));
  const shown = cols.length ? cols : all;
  const head = shown.map(c => `<th>${esc(label(c))}</th>`).join("");
  const body = rows
    .map(r => `<tr>${shown.map(c => `<td>${esc(cell(c, (r as Record<string, unknown>)[c]))}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}


/**
 * Build one self-contained HTML file that looks exactly like the live system
 * (white header, coloured shortcut cards, left menu, page title, tabs, tables)
 * with every record embedded. It opens instantly with no internet and every
 * page can be printed or saved as PDF offline.
 */
function buildViewer(data: ArchiveData, range: ExportRange): string {
  const brand = getPrintBrand();
  const brandName = brand.name || "LEMSA PMS";
  const brandLines = (brand.lines ?? []).filter(Boolean);
  const logo = brand.logoUrl
    ? `<img class="logo" src="${brand.logoUrl}" alt="" />`
    : `<div class="logo ph"></div>`;

  const brandRows: unknown[] = [
    {
      pharmacy_name: brandName,
      details: brandLines.join(" · ") || "—",
      records_from: range.from,
      records_to: range.to,
    },
  ];

  const panels: Record<string, string> = {};
  for (const m of MODULES) {
    for (const t of m.tabs) {
      const rows = t.table === "__brand" ? brandRows : (data[t.table] ?? []);
      panels[`${m.key}::${t.label}`] = tableHtml(rows);
    }
  }

  const counts = Object.fromEntries(
    MODULES.map(m => [m.key, m.tabs.reduce((n, t) => n + (t.table === "__brand" ? 1 : (data[t.table]?.length ?? 0)), 0)]),
  );

  const modulesJson = JSON.stringify(
    MODULES.map(m => ({ key: m.key, label: m.label, subtitle: m.subtitle, tone: m.tone, text: m.text, tabs: m.tabs.map(t => t.label) })),
  );

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(brandName)} · Offline Copy ${esc(range.from)} → ${esc(range.to)}</title>
<style>
 *{box-sizing:border-box}
 body{margin:0;font-family:ui-sans-serif,system-ui,"Segoe UI",Arial;background:#fff;color:#0f172a}
 header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 22px;background:#fff;border-bottom:1px solid #e5e7eb}
 header .brand{display:flex;align-items:center;gap:12px}
 header .logo{width:42px;height:42px;border-radius:12px;object-fit:cover;border:1px solid #d1fae5}
 header .logo.ph{background:linear-gradient(135deg,#059669,#10b981)}
 header h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.01em}
 header .who{text-align:right;font-size:12px;color:#64748b}
 header .who b{display:block;font-size:13px;color:#0f172a;letter-spacing:.06em}
 .layout{display:flex;min-height:calc(100vh - 72px)}
 aside{width:242px;flex:0 0 242px;border-right:1px solid #e5e7eb;padding:14px 12px;background:#fff}
 aside button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:transparent;padding:10px 12px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:2px}
 aside button:hover{background:#f1f5f9}
 aside button.on{background:#f1f5f9}
 aside .dot{width:10px;height:10px;border-radius:4px;flex:0 0 10px}
 aside hr{border:0;border-top:1px solid #e5e7eb;margin:12px 4px}
 main{flex:1;min-width:0}
 .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;padding:20px 24px;border-bottom:1px solid #e5e7eb}
 .tile{border-radius:18px;border:1px solid #e5e7eb;padding:16px 10px;text-align:center;font-weight:800;font-size:14px;cursor:pointer;transition:transform .12s}
 .tile:hover{transform:translateY(-2px)}
 .tile small{display:block;font-weight:600;font-size:11px;opacity:.75;margin-top:4px;color:#475569}
 .page{padding:22px 26px 50px}
 .page h2{margin:0;font-size:32px;font-weight:800;letter-spacing:-.02em}
 .page p.sub{margin:6px 0 16px;color:#64748b;font-size:14px}
 .tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
 .tabs button{border:0;background:transparent;padding:8px 14px;border-radius:10px;font-size:14px;font-weight:600;color:#64748b;cursor:pointer}
 .tabs button.on{background:#f1f5f9;color:#0f172a;font-weight:700}
 .panel{border:1px solid #e5e7eb;border-radius:18px;padding:16px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
 .panel .top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap}
 .panel .top h3{margin:0;font-size:17px}
 .btn{border:1px solid #0f172a;background:#0f172a;color:#fff;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer}
 .btn.light{background:#fff;color:#0f172a}
 .scroll{overflow:auto;max-height:66vh;border:1px solid #eef2f7;border-radius:12px}
 table{width:100%;border-collapse:collapse;font-size:13px}
 th,td{border-bottom:1px solid #eef2f7;padding:9px 12px;text-align:left;white-space:nowrap}
 th{background:#f8fafc;position:sticky;top:0;font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:.03em}
 tbody tr:hover{background:#f8fafc}
 .empty{color:#64748b;font-size:14px;margin:8px 0}
 .note{margin-top:14px;font-size:12px;color:#64748b}
 @media (max-width:860px){.layout{flex-direction:column}aside{width:auto;flex:none;border-right:0;border-bottom:1px solid #e5e7eb}}
 @media print{aside,.tiles,.tabs,.btn,header .who{display:none}.scroll{max-height:none;overflow:visible}.page{padding:0}body{background:#fff}}
</style></head><body>
<header>
 <div class="brand">${logo}<div><h1>${esc(brandName)}</h1>
 <div style="font-size:12px;color:#64748b">Offline copy · records ${esc(range.from)} to ${esc(range.to)}</div></div></div>
 <div class="who"><b>OFFLINE</b>${brandLines.length ? esc(brandLines[0]) : "No internet needed"}</div>
</header>
<div class="layout">
 <aside id="nav"></aside>
 <main>
  <div class="tiles" id="tiles"></div>
  <div class="page">
   <h2 id="ttl"></h2>
   <p class="sub" id="sub"></p>
   <div class="tabs" id="tabs"></div>
   <div class="panel">
    <div class="top"><h3 id="ptitle"></h3>
     <div><button class="btn light" onclick="window.print()">Download / Print PDF</button></div></div>
    <div id="body"></div>
   </div>
   <p class="note">This copy works with no internet. Use “Download / Print PDF” on any page to print it or save it as a PDF.</p>
  </div>
 </main>
</div>
<script>
var MODULES=${modulesJson};
var PANELS=${JSON.stringify(panels)};
var COUNTS=${JSON.stringify(counts)};
var nav=document.getElementById('nav'),tiles=document.getElementById('tiles'),tabs=document.getElementById('tabs');
var ttl=document.getElementById('ttl'),sub=document.getElementById('sub'),body=document.getElementById('body'),ptitle=document.getElementById('ptitle');
var cur=MODULES[0].key,curTab=MODULES[0].tabs[0];
function find(k){for(var i=0;i<MODULES.length;i++){if(MODULES[i].key===k)return MODULES[i];}return MODULES[0];}
function render(){
  var m=find(cur);
  ttl.textContent=m.label;sub.textContent=m.subtitle;
  tabs.innerHTML='';
  m.tabs.forEach(function(t){
    var b=document.createElement('button');b.textContent=t;
    if(t===curTab)b.className='on';
    b.onclick=function(){curTab=t;render();};tabs.appendChild(b);
  });
  ptitle.textContent=curTab;
  body.innerHTML=PANELS[m.key+'::'+curTab]||'<p class="empty">No records saved for these dates.</p>';
  [].slice.call(nav.querySelectorAll('button')).forEach(function(b){b.className=b.dataset.k===cur?'on':'';});
}
function go(k){cur=k;curTab=find(k).tabs[0];render();window.scrollTo(0,0);}
MODULES.forEach(function(m,i){
  var b=document.createElement('button');b.dataset.k=m.key;b.style.color=m.text;
  b.innerHTML='<span class="dot" style="background:'+m.text+'"></span>'+m.label;
  b.onclick=function(){go(m.key);};nav.appendChild(b);
  if(i===6)nav.appendChild(document.createElement('hr'));
  var t=document.createElement('div');t.className='tile';t.style.background=m.tone;t.style.color=m.text;
  t.innerHTML=m.label+'<small>'+COUNTS[m.key]+' records</small>';t.onclick=function(){go(m.key);};tiles.appendChild(t);
});
render();
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

export { LABELS as OFFLINE_TABLE_LABELS };
