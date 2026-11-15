/**
 * Pips math for the upgrade cards. A tier is `tierSize` levels (balance.trophies.upgradeTierEvery, 5). The row shows the levels bought
 * inside the current tier. A level that completes a tier shows the tier full, not the next tier empty, so a purchase never looks like a loss.
 */
export interface Pips {
  /** Pips lit. */
  filled: number;
  /** Pips in the row. */
  total: number;
  /** 1-based tier the row belongs to. */
  tier: number;
}

export function pipsFor(level: number, tierSize: number): Pips {
  const total = Math.max(1, Math.floor(tierSize) || 1);
  const lvl = Math.max(0, Math.floor(level) || 0);
  if (lvl === 0) return { filled: 0, total, tier: 1 };
  const filled = ((lvl - 1) % total) + 1;
  const tier = Math.floor((lvl - 1) / total) + 1;
  return { filled, total, tier };
}
