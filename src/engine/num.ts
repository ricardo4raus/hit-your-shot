/**
 * CONTRACT FILE. Owned by the lead.
 * All number formatting. The rest of the app never formats numbers itself.
 * Copied from neural-tycoon/src/engine/num.ts (candidate for ../_shared, docs/shared-code.md). Keep the public names.
 */

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

function stripTrailingZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * Formats big numbers with suffixes.
 * - Below 1000: up to `decimals` decimals, trailing zeros removed ("12", "12.5").
 * - Then K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc, then scientific ("1.23e36").
 * - Always `decimals` decimals with a suffix ("1.50K", "12.34M").
 * - Negative numbers get a "-" prefix. NaN returns "0", Infinity "∞".
 */
export function formatNumber(x: number, decimals = 2): string {
  if (Number.isNaN(x)) return '0';
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '-∞';
  const d = Math.max(0, Math.min(20, Math.floor(Number.isFinite(decimals) ? decimals : 2)));
  if (x < 0) {
    const body = formatNumber(-x, d);
    return body === '0' ? '0' : '-' + body;
  }

  const plain = x.toFixed(d);
  if (Number(plain) < 1000) return stripTrailingZeros(plain);

  let tier = Math.floor(Math.log10(x) / 3);
  while (tier > 1 && x < Math.pow(10, 3 * tier)) tier--;
  while (x >= Math.pow(10, 3 * (tier + 1))) tier++;
  if (tier < 1) tier = 1;

  if (tier >= SUFFIXES.length) {
    return x.toExponential(d).replace('e+', 'e');
  }
  const scaled = x / Math.pow(10, 3 * tier);
  let text = scaled.toFixed(d);
  if (Number(text) >= 1000) {
    tier++;
    if (tier >= SUFFIXES.length) return x.toExponential(d).replace('e+', 'e');
    text = (x / Math.pow(10, 3 * tier)).toFixed(d);
  }
  return text + SUFFIXES[tier];
}

/** "$12", "$1.50K". Whole dollars below 1000 (the game has no cents). */
export function formatMoney(x: number): string {
  if (Number.isFinite(x) && Math.abs(x) < 1000) return '$' + formatNumber(Math.round(x), 0);
  return '$' + formatNumber(x, 2);
}

/** "12.5" for percentages and multipliers: at most one decimal, no trailing zero. */
export function formatMult(x: number): string {
  return '×' + stripTrailingZeros(x.toFixed(1));
}
