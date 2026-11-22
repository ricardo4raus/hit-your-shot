/**
 * CONTRACT FILE. Owned by the lead. Module agents must not edit it.
 * If you need a change, describe it in your report instead.
 *
 * Shared types for the Hit Your Shot engine (docs/game-design.md, docs/architecture.md). The engine is pure TypeScript:
 * no React, no React Native, no Date.now(), no Math.random(). Wall time (`now`, ms since epoch) and round time
 * (`t`, seconds since the round started) and randomness (`rng`) are always passed in.
 */

/** Random number source. Returns a float in [0, 1). Use `createRng` from rng.ts in tests. */
export type Rng = () => number;

export type SportId = 'basketball' | 'football' | 'golf';
export const SPORT_IDS: readonly SportId[] = ['basketball', 'football', 'golf'];

export type UpgradeId = 'accuracy' | 'fireRate' | 'income';
export const UPGRADE_IDS: readonly UpgradeId[] = ['accuracy', 'fireRate', 'income'];

/** Which body part a sport shoots with. Drives limb placement and the words on screen. */
export type LimbKind = 'arm' | 'foot';

/** Ball ids come from balance.sports[sport].balls[].id. */
export type BallId = string;

export interface Vec2 {
  x: number;
  y: number;
}

/** World point: x depth toward the target, y height, z lateral (positive = the player's right). See ballistics.ts. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ---------- Persistent state ----------

/** Everything about one sport. Money, upgrades, balls and characters are per sport (docs/game-design.md). */
export interface SportState {
  /** False until bought with Trophies. The first sport starts unlocked. */
  unlocked: boolean;
  money: number;
  /** Levels, 0-based. Level 0 = nothing bought. Max is balance.upgrades.maxLevel. */
  upgrades: Record<UpgradeId, number>;
  ownedBalls: BallId[];
  /** Number of limbs = the character owned. Starts at 1. */
  limbs: number;
  /** Ball id per limb, length === limbs. */
  limbBalls: BallId[];
  /** Money of the best round. */
  bestRound: number;
  /** Money of the last finished round; the offline trickle is a fraction of it. */
  lastRoundMoney: number;
  roundsPlayed: number;
  lifetimeMoney: number;
  shotsFired: number;
  hits: number;
  /** Milestone ids already paid in Trophies (trophies.ts). */
  trophyMilestones: string[];
  /** Set once when all three upgrades reach max. Pays the mastery bonus everywhere. */
  mastered: boolean;
}

export interface OfflineState {
  /** Money of the last offline payout that the "double" ad can still add. 0 = no offer. */
  pendingDouble: number;
  /** Seconds the last payout covered; shown on the welcome-back panel. */
  lastSeconds: number;
}

export interface AdsState {
  /** Wall time (ms) the income boost runs until; 0 or the past = no boost. Each rewarded ad adds balance.ads.boostMinutes (ads.ts). */
  boostUntil: number;
}

export interface Settings {
  sound: boolean;
  haptics: boolean;
}

export interface GameState {
  createdAt: number;
  /** Last time the store saw the app running (ms). Offline time starts here. */
  lastSeenAt: number;
  /** Highest `now` ever seen, so a clock moved back and forth never pays the same time twice. */
  clockHighWater: number;
  currentSport: SportId;
  sports: Record<SportId, SportState>;
  trophies: number;
  offline: OfflineState;
  ads: AdsState;
  /** One-time purchase. Makes the boost and the offline double free (no ad). */
  removeAds: boolean;
  settings: Settings;
  /** Advanced by runWithStateRng after every random engine call. */
  rngState: number;
}

// ---------- Shots and rounds (transient) ----------

/** One parabola: position(t) = p + v (t − t0) + ½ g (t − t0)² for t in [t0, t1). `gy` is negative (down); nothing acts on x and z. */
export interface Segment {
  t0: number;
  t1: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gy: number;
}

export interface ShotInput {
  sport: SportId;
  /** Aim yaw in radians, 0 = straight down the field at the target, positive = the player's right. The pitch is solved by the engine. */
  aim: number;
  /** Total spread in degrees (upgrade + ball), before the random roll. */
  spreadDeg: number;
  ballId: BallId;
  /** Lateral (z) offset of this limb from the shot origin, in meters (limbs.ts muzzleOffsets). */
  offset: number;
  /** Round time of the shot, seconds. The target pose is evaluated from this. */
  t: number;
  /** Phase of the target motion for this round, radians. */
  targetPhase: number;
  /** Money a hit pays (ball value × multipliers). The resolver copies it into the result. */
  valueIfHit: number;
}

export interface ShotResult {
  hit: boolean;
  /** Money earned, 0 on a miss. */
  value: number;
  segments: Segment[];
  /** Round time when the ball stops being drawn. */
  endSec: number;
  /** Round time of the hit (sensor crossing) or the rest, whichever ended the flight. */
  eventSec: number;
  /** Ball radius in meters, for drawing. */
  radius: number;
  ballId: BallId;
  limb: number;
}

/** Where the target is at round time t. The UI draws it; the resolver tests against it. Only z changes with time. */
export interface TargetPose {
  /** Center of the sensor (hoop center, hole center, goal mouth center). */
  center: Vec3;
  /** Sensor half width (hoop and hole: radius; goal: half the mouth width). */
  halfWidth: number;
  /** Optional keeper box center (football) or null. */
  keeper: Vec3 | null;
}

/** The live round. Owned by the store, never saved. Created by round.ts. */
export interface RoundState {
  sport: SportId;
  /** Wall time the round started (ms). */
  startedAt: number;
  seconds: number;
  targetPhase: number;
  /** Next round time (seconds) each limb fires. */
  nextFireAt: number[];
  shots: number;
  hits: number;
  money: number;
  /** The income boost was running when the round started: every hit pays balance.ads.boostMult. */
  doubled: boolean;
  finished: boolean;
}

// ---------- Results and events ----------

export type ErrorCode =
  | 'not_enough_money'
  | 'not_enough_trophies'
  | 'max_level'
  | 'already_owned'
  | 'not_owned'
  | 'locked'
  | 'unknown_id'
  | 'invalid'
  | 'not_available';

export type GameEvent =
  | { type: 'roundEnded'; sport: SportId; money: number; shots: number; hits: number; newBest: boolean }
  | { type: 'newBest'; sport: SportId; money: number }
  | { type: 'upgradeBought'; sport: SportId; id: UpgradeId; level: number }
  | { type: 'ballBought'; sport: SportId; id: BallId }
  | { type: 'characterBought'; sport: SportId; limbs: number }
  | { type: 'trophy'; amount: number; milestone: string }
  | { type: 'mastered'; sport: SportId }
  | { type: 'sportUnlocked'; sport: SportId }
  | { type: 'offlineEarned'; money: number; seconds: number }
  | { type: 'boostAdded'; until: number }
  | { type: 'removeAdsBought' };

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; state: GameState; events: GameEvent[]; error: ErrorCode };

export function fail(state: GameState, error: ErrorCode): ActionResult {
  return { ok: false, state, events: [], error };
}

export function succeed(state: GameState, events: GameEvent[] = []): ActionResult {
  return { ok: true, state, events };
}
