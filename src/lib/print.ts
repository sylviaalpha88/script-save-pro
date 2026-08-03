/** Open a print window containing the HTML of the given element. */
export function printElement(el: HTMLElement | null, title: string) {
  if (!el) return;
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
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
  @page{margin:14mm}
</style></head><body>${el.innerHTML}</body></html>`);
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
