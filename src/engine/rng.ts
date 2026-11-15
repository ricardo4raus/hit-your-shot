/**
 * CONTRACT FILE. Owned by the lead.
 * Seeded random number generator (mulberry32). Deterministic: same seed, same sequence.
 * Adapted from neural-tycoon/src/engine/rng.ts; candidate for ../_shared (docs/shared-code.md).
 */
import type { Rng } from './types';

/** One mulberry32 step: returns the float in [0, 1) and the next state. */
function step(a: number): { value: number; next: number } {
  const next = (a + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, next };
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    const s = step(a);
    a = s.next;
    return s.value;
  };
}

/**
 * Runs `fn` with an rng driven by `state.rngState`, then writes the advanced rng state into the result's state.
 * The store wraps every engine call that takes an rng with this, so random outcomes are part of the save:
 * reloading an older save repeats the same rolls instead of giving new ones.
 */
export function runWithStateRng<S extends { rngState: number }, R extends { state: S }>(state: S, fn: (rng: Rng) => R): R {
  let a = state.rngState >>> 0;
  const rng: Rng = () => {
    const s = step(a);
    a = s.next;
    return s.value;
  };
  const result = fn(rng);
  return { ...result, state: { ...result.state, rngState: a } };
}

/** Advances the state's rng by one roll and returns [value, nextState]. For single rolls outside runWithStateRng. */
export function rollFromState<S extends { rngState: number }>(state: S): [number, S] {
  const s = step(state.rngState >>> 0);
  return [s.value, { ...state, rngState: s.next }];
}

/**
 * Bell-shaped number in (−1, 1): the mean of three uniforms, rescaled. Soft middle, rare edges, no tails beyond ±1.
 * Used for the spread roll, so the cone the UI draws is the true extent of the shots.
 */
export function gaussianish(rng: Rng): number {
  return ((rng() + rng() + rng()) / 3 - 0.5) * 2;
}

/** Picks an index with probability proportional to its weight. Weights must be non-negative, not all zero. */
export function pickWeighted(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return 0;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i] ?? 0);
    if (r < 0) return i;
  }
  return weights.length - 1;
}
