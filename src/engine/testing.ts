/**
 * CONTRACT FILE. Owned by the lead.
 * Shared helpers for engine tests.
 */
import { defaultBalance, type Balance } from './balance';
import { createRng } from './rng';
import { createInitialState } from './state';
import type { GameState, Rng, SportId, SportState } from './types';

/** Fixed start time for tests: 2026-01-01T00:00:00Z. */
export const T0 = Date.UTC(2026, 0, 1);

export const balance: Balance = defaultBalance;

/** A new game at T0 with a fixed seed, with optional overrides of top-level fields. */
export function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(balance, T0, 12345), ...overrides };
}

/** makeState with one sport's fields overridden. */
export function makeStateWith(sport: SportId, sportOverrides: Partial<SportState>, overrides: Partial<GameState> = {}): GameState {
  const s = makeState(overrides);
  return { ...s, currentSport: sport, sports: { ...s.sports, [sport]: { ...s.sports[sport], ...sportOverrides } } };
}

/** Deterministic rng. */
export function rng(seed = 42): Rng {
  return createRng(seed);
}

/** Rng that always returns the given values in order (then repeats the last). */
export function fixedRng(...values: number[]): Rng {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] ?? 0;
}
