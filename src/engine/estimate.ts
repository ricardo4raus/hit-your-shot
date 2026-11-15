/**
 * MODULE: estimate. Owner: agent "round". docs/open-decisions.md item 10 ("about $X per round").
 * A deterministic estimate of a round's income with the current stats, or as if every limb used a given ball.
 *
 * Rules:
 * - incomePerRoundEstimate(state, balance, sportId, ballId, opts): Monte Carlo through the REAL resolver with a fixed seed
 *   (opts.seed, default 7) and opts.samples shots per limb (default 64; fewer than about 48 is too noisy at low hit rates): for each limb, the shot input as round.shotInputFor would build it
 *   (ballId null = the limb's own ball; otherwise that ball on every limb), aim per sample = ballistics.solveAim at the target's predicted position (tracking like a player)
 *   (phase 0, t = 0, 'high' arc for hoop, 'low' for goal and hole; if null, aim 45°), times spread evenly over the round. Hit rate per limb
 *   × shots per round per limb (shotsPerSec × roundSeconds) × hitValue (not doubled). Sum over limbs.
 * - Same inputs, same number. Rounded to a whole number.
 * - Cheap enough for the shop: with 64 samples and 8 limbs it must finish in well under 50 ms in Node.
 * - Tests (src/engine/__tests__/estimate.test.ts): deterministic, increases with the income level, a ball with huge penalties estimates
 *   lower than the foam ball at level 0, zero when the ball id is unknown.
 *
 * May import: ./types, ./balance, ./state, ./rng, ./ballistics, ./limbs, ./upgrades, ./round, ./trophies.
 *
 * Implementation notes (decisions where the rules above were open):
 * - The shot inputs come from round.shotInputFor itself, called with a throwaway RoundState (phase 0, not doubled) and, when a ball id is
 *   given, a copy of the state with that ball on every limb. The estimate therefore follows every rule of the live round for free.
 * - Sample k of `samples` fires at round time k × roundSeconds / samples, so the first sample is at 0 and the moving target is seen at
 *   evenly spaced phases of its motion. The aim is solved per limb from the limb's ball speed and is not corrected for the limb's
 *   perpendicular offset: the player aims one line for all limbs, so the estimate does too.
 * - One rng (createRng(seed)) serves every sample of every limb in order, so the result depends only on the inputs.
 * - A non-positive or non-finite sample count falls back to the default; a sport with zero limbs estimates 0.
 */
import type { Balance } from './balance';
import { ballDefOf } from './balance';
import { resolveShot, solveAim, targetPose, type Arc } from './ballistics';
import { createRng } from './rng';
import { withSport } from './state';
import { hitValue, shotInputFor } from './round';
import type { BallId, GameState, RoundState, SportId } from './types';
import { shotsPerSec } from './upgrades';

export interface EstimateOptions {
  samples?: number;
  seed?: number;
}

const DEFAULT_SAMPLES = 64;
const DEFAULT_SEED = 7;
const FALLBACK_AIM = Math.PI / 4;

export function incomePerRoundEstimate(state: GameState, balance: Balance, sportId: SportId, ballId: BallId | null, opts: EstimateOptions = {}): number {
  const samples = opts.samples !== undefined && Number.isFinite(opts.samples) && opts.samples > 0 ? Math.floor(opts.samples) : DEFAULT_SAMPLES;
  const seed = opts.seed ?? DEFAULT_SEED;
  const def = balance.sports[sportId];
  const original = state.sports[sportId];
  if (original.limbs <= 0) return 0;

  // With a ball id, estimate as if every limb used it. The whole state is kept so the mastery bonus still applies.
  let estimated = state;
  if (ballId !== null) {
    if (!ballDefOf(balance, sportId, ballId)) return 0;
    const limbBalls: BallId[] = new Array(original.limbs).fill(ballId);
    estimated = withSport(state, sportId, { ...original, limbBalls });
  }
  const sport = estimated.sports[sportId];

  const round: RoundState = {
    sport: sportId,
    startedAt: 0,
    seconds: balance.roundSeconds,
    targetPhase: 0,
    nextFireAt: [],
    shots: 0,
    hits: 0,
    money: 0,
    doubled: false,
    finished: false,
  };

  // The estimate plays like a player who tracks the target: each sample aims where the target will be when the ball arrives,
  // predicted with the flight time of the mean shot. Phase 0 keeps the motion centered at t = 0.
  const arc: Arc = def.target.kind === 'hoop' ? 'high' : 'low';
  const gravity = balance.physics.gravity;
  const meanPose = targetPose(def, 0, 0);
  const meanDx = meanPose.center.x - def.field.origin.x;
  const meanDy = meanPose.center.y - def.field.origin.y;

  const rng = createRng(seed);
  let total = 0;
  for (let limb = 0; limb < sport.limbs; limb++) {
    const ball = ballDefOf(balance, sportId, sport.limbBalls[limb] ?? '') ?? def.balls[0];
    if (ball === undefined) continue;
    const meanAim = solveAim(ball.launchSpeed, gravity, meanDx, meanDy, arc) ?? FALLBACK_AIM;
    const vx = ball.launchSpeed * Math.cos(meanAim);
    const flight = vx > 0.01 ? meanDx / vx : 0;

    let hits = 0;
    for (let k = 0; k < samples; k++) {
      const t = (k * balance.roundSeconds) / samples;
      const pose = targetPose(def, t + flight, 0);
      const aim = solveAim(ball.launchSpeed, gravity, pose.center.x - def.field.origin.x, pose.center.y - def.field.origin.y, arc) ?? meanAim;
      const input = shotInputFor(estimated, balance, round, limb, aim, t);
      if (resolveShot(input, rng, balance).hit) hits++;
    }

    const shotsPerRound = shotsPerSec(balance, sport.upgrades.fireRate, ball) * balance.roundSeconds;
    total += (hits / samples) * shotsPerRound * hitValue(estimated, balance, sportId, ball, false);
  }
  return Math.round(total);
}
