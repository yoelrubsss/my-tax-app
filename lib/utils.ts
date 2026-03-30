/**
 * Currency display helpers — avoid floating-point display artifacts in JS.
 * Values are rounded to 2 decimal places (half-cent) before string formatting.
 */
export function formatMoney(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) {
    return "0.00";
  }
  const rounded = Math.round(n * 100) / 100;
  return rounded.toFixed(2);
}
