/**
 * MODULE: estimate. Owner: agent "round". docs/open-decisions.md item 10 ("about $X per round").
 * A deterministic estimate of a round's income with the current stats, or as if every limb used a given ball.
 *
 * Rules:
 * - incomePerRoundEstimate(state, balance, sportId, ballId, opts): Monte Carlo through the REAL resolver with a fixed seed
 *   (opts.seed, default 7) and opts.samples shots per limb (default 24): for each limb, the shot input as round.shotInputFor would build it
 *   (ballId null = the limb's own ball; otherwise that ball on every limb), aim = ballistics.solveAim at the target's average position
 *   (phase 0, t = 0, 'high' arc for hoop, 'low' for goal and hole; if null, aim 45°), times spread evenly over the round. Hit rate per limb
 *   × shots per round per limb (shotsPerSec × roundSeconds) × hitValue (not doubled). Sum over limbs.
 * - Same inputs, same number. Rounded to a whole number.
 * - Cheap enough for the shop: with 24 samples and 8 limbs it must finish in well under 50 ms in Node.
 * - Tests (src/engine/__tests__/estimate.test.ts): deterministic, increases with the income level, a ball with huge penalties estimates
 *   lower than the foam ball at level 0, zero when the ball id is unknown.
 *
 * May import: ./types, ./balance, ./state, ./rng, ./ballistics, ./limbs, ./upgrades, ./round, ./trophies.
 */
import type { Balance } from './balance';
import type { BallId, GameState, SportId } from './types';

export interface EstimateOptions {
  samples?: number;
  seed?: number;
}

export function incomePerRoundEstimate(_state: GameState, _balance: Balance, _sportId: SportId, _ballId: BallId | null, _opts: EstimateOptions = {}): number {
  throw new Error('not implemented');
}
