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

export function limbAnchors(_n: number, _kind: LimbKind): LimbAnchor[] {
  throw new Error('not implemented');
}

export function muzzleOffsets(_n: number, _sport: SportDef, _balance: Balance): number[] {
  throw new Error('not implemented');
}
