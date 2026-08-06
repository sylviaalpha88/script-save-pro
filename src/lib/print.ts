export type PrintBrand = {
  name?: string;
  logoUrl?: string | null;
  lines?: string[];
  qrDataUrl?: string | null;
};

let BRAND: PrintBrand = {};

/** Set once (usually from the app shell) so every printed report is branded. */
export function setPrintBrand(brand: PrintBrand) {
  BRAND = brand;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function headerHtml() {
  const logo = BRAND.logoUrl
    ? `<img class="blogo" src="${BRAND.logoUrl}" alt="" />`
    : `<div class="blogo placeholder"></div>`;
  const info = [
    BRAND.name ? `<div class="bname">${esc(BRAND.name)}</div>` : "",
    ...(BRAND.lines ?? []).filter(Boolean).map((l) => `<div>${esc(l)}</div>`),
  ].join("");
  return `<div class="brandbar">${logo}<div class="binfo">${info}</div></div>`;
}

function footerHtml() {
  if (!BRAND.qrDataUrl) return "";
  return `<div class="qrbox">
    <img src="${BRAND.qrDataUrl}" alt="" />
    <div class="qrlabel">QR SCAN — scan to download this PDF</div>
  </div>`;
}

/** Open a print window containing the HTML of the given element. */
export function printElement(el: HTMLElement | null, title: string) {
  if (!el) return;
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${esc(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;padding:24px;color:#111}
  h1{font-size:18px;margin:0 0 4px}
  .sub{font-size:12px;color:#555;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
  th{background:#f3f4f6}
  .low{background:#fee2e2;color:#991b1b;font-weight:600}
  .mid{background:#dbeafe;color:#1e40af;font-weight:600}
  .signoff{margin-top:28px;font-size:12px;line-height:2.4}
  .brandbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:16px}
  .blogo{height:64px;width:64px;object-fit:contain}
  .blogo.placeholder{border:1px dashed #ccc}
  .binfo{text-align:right;font-size:11px;color:#333;line-height:1.5}
  .bname{font-size:15px;font-weight:800;text-transform:uppercase;color:#111}
  .qrbox{margin-top:26px;text-align:center;page-break-inside:avoid}
  .qrbox img{height:88px;width:88px}
  .qrlabel{font-size:10px;color:#555;margin-top:2px;letter-spacing:.05em}
  @page{margin:14mm}
</style></head><body>${headerHtml()}${el.innerHTML}${footerHtml()}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

/** The four-stage sign-off block used at the bottom of printed reports. */
export const SIGNOFF_ROWS = [
  "Requested by",
  "Checked by",
  "Verified by",
  "Approved by",
] as const;
