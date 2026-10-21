// The API sends dates without a timezone (exactly as stored), so they are shown as-is,
// the same way the previous Flask pages displayed them.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(value: string) {
  const [d, t = ""] = value.split("T");
  const [y, m, day] = d.split("-");
  return { y, m, day, hm: t.slice(0, 5) };
}

/** 2026-10-15T09:03:00 → "15 Oct 2026" */
export function fmtDate(value?: string | null) {
  if (!value) return "—";
  const p = parts(value);
  return `${p.day} ${MONTHS[Number(p.m) - 1]} ${p.y}`;
}

/** 2026-10-15T09:03:00 → "15 Oct 2026 09:03" */
export function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  return `${fmtDate(value)} ${parts(value).hm}`.trim();
}

/** 2026-10-15T09:03:00 → "2026-10-15" */
export function fmtDay(value?: string | null) {
  return value ? value.slice(0, 10) : "—";
}

/** 1234567 → "1,234,567". A missing amount shows "—" instead of breaking the page. */
export function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : "—";
}

/** "Quotation / Estimate" → "quotation---estimate" (same slug as the old document links) */
export function docSlug(name: string) {
  return name.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-");
}
