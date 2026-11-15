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
 * - migrations[n] upgrades a save of version n to n + 1. Empty for version 1.
 * - Tests (src/engine/__tests__/save.test.ts): round trip, garbage returns null, future version returns null, broken references return null.
 *
 * May import only: ./types, ./balance, ./state, zod.
 */
import { z } from 'zod';

import type { Balance } from './balance';
import type { GameState } from './types';

export const CURRENT_SAVE_VERSION = 1;

export interface SaveFile {
  saveVersion: number;
  savedAt: number;
  state: GameState;
}

export const migrations: Record<number, (old: unknown) => unknown> = {};

/** Must match GameState in types.ts. Replaced by the module agent with the full schema. */
export const GameStateSchema: z.ZodType<GameState> = z.any() as unknown as z.ZodType<GameState>;

export function serialize(_state: GameState, _now: number): string {
  throw new Error('not implemented');
}

export function deserialize(_raw: string, _balance: Balance): GameState | null {
  throw new Error('not implemented');
}
