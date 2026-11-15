/**
 * MODULE: limbs. Owner: agent "limbs". docs/game-design.md "Characters", docs/design-rules.md section 8, docs/open-decisions.md items 7 and 8.
 * Procedural limb placement (where limb n grows on the body) and parallel shot offsets (where limb n fires from).
 *
 * Rules:
 * - Pure, deterministic, no rng: everything derives from the limb index, so every player sees the same body for the same count.
 * - Body-local units for anchors: the body is 1 unit tall, feet at y = 0, top of the head at y = 1, x = 0 is the spine, the torso spans
 *   x in [−0.18, 0.18] from y ≈ 0.42 (hips) to y ≈ 0.78 (shoulders). The head is y in [0.78, 1]; nothing may be anchored on it.
 * - Arms: 1 and 2 at the shoulders (sides +1, −1 by index parity, limb 1 on the aiming side = +1), 3 from the middle of the back
 *   (behind = true, side −1, y ≈ 0.68), 4 from the hip (side +1, y ≈ 0.45), then alternate sides and walk down the torso and back up
 *   the back, with a small deterministic variation of y (±0.03), length (0.26 to 0.34) and rest angle (±0.25 rad) taken from a hash of
 *   the index (for example a golden-ratio sequence: frac(i × 0.6180339887)). Limbs placed on the back are `behind`.
 * - Feet: 1 and 2 at the hips (y ≈ 0.42), 3 from the side of the torso (y ≈ 0.55, side +1), 4 from the back (behind, y ≈ 0.5), then the
 *   same alternating pattern. Lengths 0.38 to 0.44.
 * - The result is sorted by index; `limbAnchors(n)` is a prefix of `limbAnchors(n + 1)` (adding a limb never moves the others).
 * - `muzzleOffsets(n, sport, balance)`: perpendicular offsets in meters, centered on the aim line, sorted ascending.
 *     spacing = min(balance.limbs.spacingFraction × (2 × target.halfWidth), (balance.limbs.maxSpanFraction × field.width) / max(1, n − 1)).
 *     offsets = (i − (n − 1) / 2) × spacing for i in 0..n−1. n = 1 → [0].
 * - Tests (src/engine/__tests__/limbs.test.ts): prefix property up to 64, no anchor on the head, sides alternate for n ≥ 5, offsets
 *   symmetric and within the span cap for n up to balance.characters.softCapLimbs, n = 1 gives [0], 2 limbs both inside a centered
 *   target of the sport's width.
 *
 * May import only: ./types, ./balance.
 */
import type { Balance, SportDef } from './balance';
import type { LimbKind } from './types';

export interface LimbAnchor {
  /** 0-based limb index. */
  index: number;
  /** Body-local attachment point. */
  x: number;
  y: number;
  /** +1 = the aiming side (toward the target), −1 = the far side. */
  side: 1 | -1;
  /** Drawn behind the torso, slightly darker. */
  behind: boolean;
  /** Body-local length. */
  length: number;
  /** Rest angle in radians relative to pointing straight toward the target, when not shooting. */
  restAngle: number;
}

// ---------- Body geometry (body-local units, see the header) ----------

/** Half width of the torso; side limbs attach at x = side * TORSO_HALF_WIDTH. */
const TORSO_HALF_WIDTH = 0.18;
/** Limbs on the back attach close to the spine so they peek out past the torso instead of sitting on its edge. */
const BACK_X = 0.08;
/** Legs hang from the hips, inside the torso edge. */
const HIP_X = 0.1;
/** Highest y an anchor may have. The head starts at 0.78 and the walk's variation of 0.03 must never reach it. */
const SHOULDER_Y = 0.75;
const HIP_Y = 0.42;

interface FixedAnchor {
  x: number;
  y: number;
  side: 1 | -1;
  behind: boolean;
}

/** Where the first four limbs of each kind sit. These are exact: the body follows itself before it stops being sensible. */
const ARM_FIXED: readonly FixedAnchor[] = [
  { x: TORSO_HALF_WIDTH, y: SHOULDER_Y, side: 1, behind: false },
  { x: -TORSO_HALF_WIDTH, y: SHOULDER_Y, side: -1, behind: false },
  { x: -0.04, y: 0.68, side: -1, behind: true },
  { x: TORSO_HALF_WIDTH, y: 0.45, side: 1, behind: false },
];
const FOOT_FIXED: readonly FixedAnchor[] = [
  { x: HIP_X, y: HIP_Y, side: 1, behind: false },
  { x: -HIP_X, y: HIP_Y, side: -1, behind: false },
  { x: TORSO_HALF_WIDTH, y: 0.55, side: 1, behind: false },
  { x: -BACK_X, y: 0.5, side: -1, behind: true },
];

/**
 * From limb 5 on the limbs walk in laps: LAP_HALF steps down the front of the torso, then LAP_HALF steps up the back. Each kind has its
 * own y range for the walk so arms start just below the shoulders and legs start lower on the torso. The lap only sets the base
 * position; the per-index hash moves the limbs of later laps so they never land exactly on top of an earlier lap.
 */
const LAP_HALF = 4;
const LAP = LAP_HALF * 2;

interface KindRules {
  fixed: readonly FixedAnchor[];
  /** Side of the first walking limb (index 4); it alternates from there. Chosen so it also alternates with limb 4. */
  firstWalkSide: 1 | -1;
  /** y of the first and last step of a lap. The walk goes top to bottom on the front and bottom to top on the back. */
  walkTop: number;
  walkBottom: number;
  minLength: number;
  maxLength: number;
}

const ARM_RULES: KindRules = {
  fixed: ARM_FIXED,
  firstWalkSide: -1,
  walkTop: 0.72,
  walkBottom: 0.48,
  minLength: 0.26,
  maxLength: 0.34,
};

const FOOT_RULES: KindRules = {
  fixed: FOOT_FIXED,
  firstWalkSide: 1,
  walkTop: 0.66,
  walkBottom: 0.46,
  minLength: 0.38,
  maxLength: 0.44,
};

const Y_VARIATION = 0.03;
const REST_ANGLE_VARIATION = 0.25;

// ---------- Hash ----------

/**
 * Low-discrepancy hashes of the index: frac(0.5 + i * a) for three irrational multipliers (the golden ratio conjugate and the two
 * constants of the R2 sequence). Each channel is well spread over [0, 1) on its own and the channels do not move together, so
 * neighbouring limbs differ in height, length and angle at the same time. Index 0 gives 0.5 in every channel: a single limb is average.
 */
const HASH_Y = 0.6180339887498949;
const HASH_LENGTH = 0.7548776662466927;
const HASH_ANGLE = 0.5698402909980532;

function hash(index: number, multiplier: number): number {
  const v = 0.5 + index * multiplier;
  return v - Math.floor(v);
}

/** Limb counts come from saved state; a bad value gives an empty body rather than a throw in the renderer. */
function limbCount(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

// ---------- Anchors ----------

function rulesFor(kind: LimbKind): KindRules {
  return kind === 'arm' ? ARM_RULES : FOOT_RULES;
}

function anchorAt(index: number, rules: KindRules): LimbAnchor {
  const length = rules.minLength + (rules.maxLength - rules.minLength) * hash(index, HASH_LENGTH);
  const restAngle = (hash(index, HASH_ANGLE) - 0.5) * 2 * REST_ANGLE_VARIATION;

  const fixed = rules.fixed[index];
  if (fixed) {
    return { index, x: fixed.x, y: fixed.y, side: fixed.side, behind: fixed.behind, length, restAngle };
  }

  const walkIndex = index - rules.fixed.length;
  const side: 1 | -1 = walkIndex % 2 === 0 ? rules.firstWalkSide : rules.firstWalkSide === 1 ? -1 : 1;
  const step = walkIndex % LAP;
  const behind = step >= LAP_HALF;
  // Steps 0 to LAP_HALF - 1 go down the front, steps LAP_HALF to LAP - 1 go back up the back.
  const progress = (behind ? LAP - 1 - step : step) / (LAP_HALF - 1);
  const baseY = rules.walkTop - (rules.walkTop - rules.walkBottom) * progress;
  const y = baseY + (hash(index, HASH_Y) - 0.5) * 2 * Y_VARIATION;
  const x = side * (behind ? BACK_X : TORSO_HALF_WIDTH);

  return { index, x, y, side, behind, length, restAngle };
}

export function limbAnchors(n: number, kind: LimbKind): LimbAnchor[] {
  const count = limbCount(n);
  const rules = rulesFor(kind);
  const out: LimbAnchor[] = new Array(count);
  for (let i = 0; i < count; i++) out[i] = anchorAt(i, rules);
  return out;
}

// ---------- Muzzle offsets ----------

export function muzzleOffsets(n: number, sport: SportDef, balance: Balance): number[] {
  const count = limbCount(n);
  if (count === 0) return [];
  if (count === 1) return [0];
  const byTarget = balance.limbs.spacingFraction * (2 * sport.target.halfWidth);
  const bySpan = (balance.limbs.maxSpanFraction * sport.field.width) / (count - 1);
  const spacing = Math.min(byTarget, bySpan);
  const mid = (count - 1) / 2;
  const out: number[] = new Array(count);
  for (let i = 0; i < count; i++) out[i] = (i - mid) * spacing;
  return out;
}
