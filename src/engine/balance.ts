/**
 * CONTRACT FILE. Owned by the lead. Module agents must not edit it.
 *
 * Typed, validated view of balance/balance.json. Keys starting with "_" are comments and are stripped.
 */
import { z } from 'zod';

import rawBalance from '../../balance/balance.json';
import type { SportId } from './types';

const Vec2Schema = z.object({ x: z.number(), y: z.number() });

const BallDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** 0 = owned from the start. */
  cost: z.number().nonnegative(),
  /** Money per hit before multipliers. */
  value: z.number().positive(),
  accuracyPenaltyDeg: z.number().nonnegative(),
  fireRateMult: z.number().positive(),
  /** m/s. */
  launchSpeed: z.number().positive(),
  /** × sport ballRadius. */
  radiusMult: z.number().positive(),
});

const TargetMotionSchema = z.object({
  /** 'z' slides the sensor sideways; 'keeper' slides the keeper box instead. periodSec 0 = no motion during the round (golf: the hole sits at a different z each round). */
  axis: z.enum(['z', 'keeper']),
  amplitude: z.number().nonnegative(),
  periodSec: z.number().nonnegative(),
});

const TargetDefSchema = z.object({
  kind: z.enum(['hoop', 'goal', 'hole']),
  center: Vec2Schema,
  halfWidth: z.number().positive(),
  motion: TargetMotionSchema,
  /** Hoop only: board at center.x + dx, from center.y + yFrom to center.y + yTo, halfSpan to each side of the hoop. */
  backboard: z.object({ dx: z.number(), yFrom: z.number(), yTo: z.number(), halfSpan: z.number().positive() }).optional(),
  rimRadius: z.number().positive().optional(),
  /** Goal only: a box in front of the goal line, 2 × keeperHalfDepth deep. */
  keeperHalfWidth: z.number().positive().optional(),
  keeperHeight: z.number().positive().optional(),
  keeperHalfDepth: z.number().positive().optional(),
});

const SurfacesSchema = z.object({
  floorRestitution: z.number().min(0).max(1),
  wallRestitution: z.number().min(0).max(1),
  ceilingRestitution: z.number().min(0).max(1),
  backboardRestitution: z.number().min(0).max(1),
  rimRestitution: z.number().min(0).max(1),
  /** Tangential speed kept on a bounce. */
  friction: z.number().min(0).max(1),
});

const SportDefSchema = z.object({
  name: z.string(),
  limb: z.enum(['arm', 'foot']),
  unlockTrophies: z.number().int().nonnegative(),
  /** length: depth from the back wall to the far wall (x); height: ceiling (y); halfSpan: side walls at z = ±halfSpan. */
  field: z.object({ length: z.number().positive(), height: z.number().positive(), halfSpan: z.number().positive(), origin: Vec2Schema }),
  ballRadius: z.number().positive(),
  target: TargetDefSchema,
  surfaces: SurfacesSchema,
  balls: z.array(BallDefSchema).min(1),
});

const UpgradeCostSchema = { baseCost: z.number().positive(), costGrowth: z.number().gt(1) };

export const BalanceSchema = z.object({
  roundSeconds: z.number().positive(),
  physics: z.object({
    gravity: z.number().positive(),
    stepSec: z.number().positive(),
    maxFlightSec: z.number().positive(),
    restSpeed: z.number().positive(),
    restLingerSec: z.number().nonnegative(),
    hitLingerSec: z.number().nonnegative(),
    maxShotsPerTick: z.number().int().positive(),
    maxBallsInFlight: z.number().int().positive(),
  }),
  upgrades: z.object({
    maxLevel: z.number().int().positive(),
    accuracy: z.object({ ...UpgradeCostSchema, baseSpreadDeg: z.number().positive(), spreadDecay: z.number().gt(0).lt(1), minSpreadDeg: z.number().positive() }),
    fireRate: z.object({ ...UpgradeCostSchema, baseShotsPerSec: z.number().positive(), perLevel: z.number().positive() }),
    income: z.object({ ...UpgradeCostSchema, perLevel: z.number().positive() }),
  }),
  characters: z.object({
    baseCost: z.number().positive(),
    costGrowth: z.number().gt(1),
    softCapLimbs: z.number().int().positive(),
    names: z.array(z.string()).min(1),
  }),
  limbs: z.object({ spacingFraction: z.number().positive(), maxSpanFraction: z.number().positive().max(1) }),
  trophies: z.object({
    upgradeTierEvery: z.number().int().positive(),
    perUpgradeTier: z.number().int().positive(),
    perNewBall: z.number().int().positive(),
    perBestRoundDecade: z.number().int().positive(),
    bestRoundFirstDecade: z.number().positive(),
  }),
  mastery: z.object({ incomeBonusPerSport: z.number().nonnegative() }),
  offline: z.object({
    fractionOfLastRoundPerMinute: z.number().nonnegative(),
    capMinutes: z.number().positive(),
    minSecondsAway: z.number().nonnegative(),
    adDoubleMult: z.number().gt(1),
  }),
  ads: z.object({
    boostMult: z.number().gt(1),
    boostMinutes: z.number().positive(),
    boostCapMinutes: z.number().positive(),
    offerSeconds: z.number().positive(),
  }),
  shop: z.object({ removeAdsPriceUsd: z.number().positive(), removeAdsProductId: z.string() }),
  commentary: z.object({ heavyBallPenaltyDeg: z.number().nonnegative(), manyBallsShots: z.number().int().positive() }),
  sports: z.object({ basketball: SportDefSchema, football: SportDefSchema, golf: SportDefSchema }),
});

export type Balance = z.infer<typeof BalanceSchema>;
export type SportDef = z.infer<typeof SportDefSchema>;
export type BallDef = z.infer<typeof BallDefSchema>;
export type TargetDef = z.infer<typeof TargetDefSchema>;

function stripComments(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripComments);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!k.startsWith('_')) out[k] = stripComments(v);
    }
    return out;
  }
  return value;
}

/** Validates any balance-shaped object (bundled file, remote override, test variant). Throws on invalid input. */
export function parseBalance(raw: unknown): Balance {
  return BalanceSchema.parse(stripComments(raw));
}

export const defaultBalance: Balance = parseBalance(rawBalance);

export function sportDef(balance: Balance, sport: SportId): SportDef {
  return balance.sports[sport];
}

export function ballDefOf(balance: Balance, sport: SportId, ballId: string): BallDef | undefined {
  return balance.sports[sport].balls.find((b) => b.id === ballId);
}
