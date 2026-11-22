/**
 * MODULE: save. Owner: agent "meta". docs/architecture.md "Save and time".
 * GameState to string and back, with a version, migrations and validation. Storage itself is in src/services.
 * Pattern from neural-tycoon/src/engine/save.ts (shared-code candidate).
 *
 * Rules:
 * - File format: { saveVersion: number, savedAt: number, state: GameState } as JSON.
 * - deserialize(raw, balance): parse JSON, run migrations from the file's version up to CURRENT_SAVE_VERSION in order, validate with
 *   GameStateSchema (zod, matching GameState in types.ts exactly, unknown fields stripped), then check referential integrity against
 *   balance: every ball id in ownedBalls and limbBalls exists in that sport, limbBalls.length === limbs, limbs >= 1, upgrade levels
 *   within [0, maxLevel], all numbers finite and money/trophies non-negative. Return null on ANY problem. Never throw.
 * - serialize(state, now): JSON of the file with savedAt = now.
 * - migrations[n] upgrades a save of version n to n + 1. Version 2 (2026-11-22): ads.roundsSinceX2 became ads.boostUntil.
 * - Tests (src/engine/__tests__/save.test.ts): round trip, garbage returns null, future version returns null, broken references return null.
 *
 * May import only: ./types, ./balance, ./state, zod.
 */
import { z } from 'zod';

import type { Balance } from './balance';
import { SPORT_IDS, UPGRADE_IDS, type GameState, type SportState } from './types';

export const CURRENT_SAVE_VERSION = 2;

export interface SaveFile {
  saveVersion: number;
  savedAt: number;
  state: GameState;
}

/**
 * migrations[n] upgrades a save of version n to n + 1. Each migration receives the whole parsed file ({ saveVersion, savedAt, state, ... })
 * and returns the upgraded file, or anything that is not an object to discard the save. deserialize sets saveVersion to n + 1 afterwards.
 */
export const migrations: Record<number, (old: unknown) => unknown> = {
  // 1 → 2 (owner 2026-11-22): the ×2-per-round cooldown became a timed boost; an old save starts with no boost.
  1: (old) => {
    if (!isRecord(old) || !isRecord(old.state)) return null;
    return { ...old, state: { ...old.state, ads: { boostUntil: 0 } } };
  },
};

// zod v4: z.number() already rejects NaN and both infinities, so every number below is finite.
const finite = z.number();
const nonNeg = z.number().nonnegative();
// Counters stay far below 2^53 in any realistic game, so int() is safe here.
const nonNegInt = z.number().int().nonnegative();
const RNG_STATE_MAX = 0xffffffff;

const SportIdSchema = z.enum(SPORT_IDS);
const UpgradeIdSchema = z.enum(UPGRADE_IDS);

const SportStateSchema = z.object({
  unlocked: z.boolean(),
  money: nonNeg,
  upgrades: z.record(UpgradeIdSchema, nonNegInt),
  ownedBalls: z.array(z.string()),
  limbs: z.number().int().min(1),
  limbBalls: z.array(z.string()),
  bestRound: nonNeg,
  lastRoundMoney: nonNeg,
  roundsPlayed: nonNegInt,
  lifetimeMoney: nonNeg,
  shotsFired: nonNegInt,
  hits: nonNegInt,
  trophyMilestones: z.array(z.string()),
  mastered: z.boolean(),
});

const OfflineStateSchema = z.object({
  pendingDouble: nonNeg,
  lastSeconds: nonNeg,
});

const AdsStateSchema = z.object({
  boostUntil: nonNeg,
});

const SettingsSchema = z.object({
  sound: z.boolean(),
  haptics: z.boolean(),
});

const GameStateObjectSchema = z.object({
  createdAt: finite,
  lastSeenAt: finite,
  clockHighWater: finite,
  currentSport: SportIdSchema,
  sports: z.record(SportIdSchema, SportStateSchema),
  trophies: nonNeg,
  offline: OfflineStateSchema,
  ads: AdsStateSchema,
  removeAds: z.boolean(),
  settings: SettingsSchema,
  rngState: z.number().int().min(0).max(RNG_STATE_MAX),
});

// Compile-time check: the schema and GameState must describe exactly the same shape, in both directions.
type AssertAssignable<To, _From extends To> = true;
type _SchemaToState = AssertAssignable<GameState, z.infer<typeof GameStateObjectSchema>>;
type _StateToSchema = AssertAssignable<z.infer<typeof GameStateObjectSchema>, GameState>;

/** Must match GameState in types.ts. Unknown fields are stripped. */
export const GameStateSchema: z.ZodType<GameState> = GameStateObjectSchema;

const SaveFileSchema = z.object({
  saveVersion: z.literal(CURRENT_SAVE_VERSION),
  savedAt: finite,
  state: GameStateSchema,
});

export function serialize(state: GameState, now: number): string {
  const file: SaveFile = { saveVersion: CURRENT_SAVE_VERSION, savedAt: now, state };
  return JSON.stringify(file);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Checks one sport against the balance it will be played with. The schema has already checked shapes and signs. */
function sportIsConsistent(sport: SportState, balls: ReadonlySet<string>, maxLevel: number): boolean {
  if (sport.limbBalls.length !== sport.limbs) return false;
  for (const id of sport.ownedBalls) if (!balls.has(id)) return false;
  for (const id of sport.limbBalls) if (!balls.has(id)) return false;
  for (const id of UPGRADE_IDS) {
    const level = sport.upgrades[id];
    if (level < 0 || level > maxLevel) return false;
  }
  return true;
}

function isConsistentWith(state: GameState, balance: Balance): boolean {
  for (const id of SPORT_IDS) {
    const balls = new Set(balance.sports[id].balls.map((b) => b.id));
    if (!sportIsConsistent(state.sports[id], balls, balance.upgrades.maxLevel)) return false;
  }
  return true;
}

export function deserialize(raw: string, balance: Balance): GameState | null {
  try {
    let file: unknown = JSON.parse(raw);
    if (!isRecord(file)) return null;

    const version = file.saveVersion;
    if (typeof version !== 'number' || !Number.isInteger(version)) return null;
    if (version > CURRENT_SAVE_VERSION) return null;

    // Older versions need an unbroken migration chain up to the current version.
    for (let v = version; v < CURRENT_SAVE_VERSION; v++) {
      const migrate = migrations[v];
      if (!migrate) return null;
      const upgraded = migrate(file);
      if (!isRecord(upgraded)) return null;
      file = { ...upgraded, saveVersion: v + 1 };
    }

    const parsed = SaveFileSchema.safeParse(file);
    if (!parsed.success) return null;
    const state = parsed.data.state;
    return isConsistentWith(state, balance) ? state : null;
  } catch {
    return null;
  }
}
