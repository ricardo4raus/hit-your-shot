/**
 * Pacing targets from docs/analysis.md, measured by the simulator bot on the real engine (tools/sim/core.ts, the same bot as
 * `npm run simulate`). A fast subset: 4 seeds, 150 rounds (about 35 minutes of play each), so only the early targets are judged here.
 * The full report judges all of them.
 */
import { simulateCampaign } from '../../../tools/sim/core';
import { evaluateTargets } from '../../../tools/sim/targets';
import { defaultBalance } from '../index';

const SEEDS = 4;
const ROUNDS = 150;
const EARLY = new Set(['first_upgrade', 'ball_swap', 'limbs2', 'quiet']);

const campaigns = Array.from({ length: SEEDS }, (_, i) => simulateCampaign(defaultBalance, i + 1, { rounds: ROUNDS, estimateSamples: 8 }));
const targets = evaluateTargets(campaigns).filter((t) => EARLY.has(t.id));

describe('pacing targets (docs/analysis.md)', () => {
  it.each(targets.map((t) => [t.name, t] as const))('%s', (_name, t) => {
    expect(`${t.name}: ${t.result}: ${t.ok ? 'met' : `wanted ${t.target}`}`).toBe(`${t.name}: ${t.result}: met`);
  });

  it('every campaign earns money and buys things', () => {
    for (const c of campaigns) {
      const last = c.rounds[c.rounds.length - 1]!;
      expect(last.money).toBeGreaterThan(0);
      expect(c.milestones.firstUpgrade).not.toBeNull();
    }
  });
});
