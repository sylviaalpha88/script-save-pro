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

/** Recursively inline a production module graph into one <script type="module">. */
async function inlineModule(url: string, seen = new Map<string, string>()): Promise<string> {
  const cached = seen.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`asset ${url}`);
  let code = await res.text();
  seen.set(url, "");
  const specifiers = Array.from(code.matchAll(/["'](\/assets\/[^"']+\.[cm]?js)["']/g)).map(m => m[1]);
  for (const spec of Array.from(new Set(specifiers))) {
    const child = await inlineModule(spec, seen);
    const dataUrl = `data:text/javascript;base64,${btoa(unescape(encodeURIComponent(child)))}`;
    code = code.split(`"${spec}"`).join(`"${dataUrl}"`).split(`'${spec}'`).join(`'${dataUrl}'`);
  }
  seen.set(url, code);
  return code;
}

/** Try to build a single-file copy of the real app bundle with the archive pre-loaded. */
async function buildAppCopy(data: ArchiveData, range: ExportRange): Promise<string | null> {
  try {
    const html = await (await fetch("/", { headers: { accept: "text/html" } })).text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const scripts = Array.from(doc.querySelectorAll<HTMLScriptElement>("script[src]"));
    const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'));
    if (scripts.length === 0) return null;
    if (!scripts.every(s => (s.getAttribute("src") ?? "").startsWith("/assets/"))) return null;

    for (const l of links) {
      const href = l.getAttribute("href")!;
      const css = await (await fetch(href)).text();
      const style = doc.createElement("style");
      style.textContent = css;
      l.replaceWith(style);
    }
    for (const s of scripts) {
      const code = await inlineModule(s.getAttribute("src")!);
      const inline = doc.createElement("script");
      inline.type = "module";
      inline.textContent = code;
      s.replaceWith(inline);
    }
    doc.querySelectorAll('link[rel="modulepreload"], link[rel="preload"]').forEach(n => n.remove());
    const boot = doc.createElement("script");
    boot.textContent = `window.__LEMSA_OFFLINE__=${JSON.stringify({ range, data })};`;
    doc.head.prepend(boot);
    return `<!doctype html>${doc.documentElement.outerHTML}`;
  } catch {
    return null;
  }
}

/** Fallback: a self-contained records viewer with the same archive embedded. */
function buildViewer(data: ArchiveData, range: ExportRange): string {
  const tabs = Object.keys(data);
  const table = (rows: unknown[]) => {
    if (rows.length === 0) return `<p class="empty">No records in this range.</p>`;
    const cols = Object.keys(rows[0] as Record<string, unknown>);
    return `<table><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows
      .map(r => `<tr>${cols.map(c => `<td>${esc((r as Record<string, unknown>)[c])}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"/>
<title>LEMSA PMS · Offline Records ${esc(range.from)} → ${esc(range.to)}</title>
<style>
 body{font-family:ui-sans-serif,system-ui,Arial;margin:0;background:#f0f9ff;color:#0f172a}
 header{padding:18px 24px;background:linear-gradient(90deg,#e0f2fe,#fff,#dbeafe);border-bottom:1px solid #bae6fd}
 h1{margin:0;font-size:20px;text-transform:uppercase;letter-spacing:.02em}
 .sub{font-size:12px;color:#475569;margin-top:4px}
 nav{display:flex;flex-wrap:wrap;gap:8px;padding:12px 24px}
 button{border:1px solid #bae6fd;background:#fff;border-radius:10px;padding:8px 12px;font-weight:700;cursor:pointer}
 button.on{background:#0ea5e9;color:#fff;border-color:#0ea5e9}
 main{padding:0 24px 40px}
 table{width:100%;border-collapse:collapse;font-size:12px;background:#fff}
 th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}
 th{background:#f1f5f9}
 .empty{color:#64748b;font-size:13px}
 @media print{nav,button{display:none}}
</style></head><body>
<header><h1>LEMSA Pharmacy Management System — Offline Copy</h1>
<div class="sub">Archived records ${esc(range.from)} to ${esc(range.to)} · runs on any PC with no internet</div></header>
<nav id="nav"></nav><main id="main"></main>
<script>
const DATA=${JSON.stringify(data)};
const HTML=${JSON.stringify(Object.fromEntries(tabs.map(t => [t, table(data[t])])))};
const nav=document.getElementById('nav'),main=document.getElementById('main');
Object.keys(DATA).forEach((k,i)=>{const b=document.createElement('button');b.textContent=k.replace(/_/g,' ')+' ('+DATA[k].length+')';
 b.onclick=()=>{[...nav.children].forEach(c=>c.classList.remove('on'));b.classList.add('on');main.innerHTML=HTML[k];};
 nav.appendChild(b); if(i===0) b.click();});
<\/script></body></html>`;
}

export async function exportOfflineCopy(pharmacyId: string | null, range: ExportRange) {
  const data = await collectArchive(pharmacyId, range);
  const app = await buildAppCopy(data, range);
  const html = app ?? buildViewer(data, range);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lemsa-pms-offline-${range.from}_to_${range.to}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
  return { mode: app ? ("app" as const) : ("viewer" as const), counts };
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
