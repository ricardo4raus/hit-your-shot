/**
 * MODULE: ads. Owner: agent "meta". docs/game-design.md "Version 1 scope" (monetization row), docs/decisions.md 2026-11-22.
 * The income boost and the remove-ads purchase. Showing the ad is the store's job; this module only decides and pays.
 *
 * Rules (owner 2026-11-22):
 * - Each rewarded ad adds balance.ads.boostMinutes of boost on top of what is left, up to balance.ads.boostCapMinutes in total.
 *   While the boost runs, a round that starts pays balance.ads.boostMult per hit (round.doubled, set by the store at round start).
 * - boostLeftMs(state, balance, now): ms of boost left, never negative and never more than the cap (a clock moved back cannot
 *   stretch it past the cap).
 * - canAddBoost(state, balance, now): true while one more full step fits under the cap.
 * - addBoost(state, balance, now): 'not_available' when no full step fits; otherwise boostUntil = now + left + one step, event boostAdded.
 * - buyRemoveAds(state): 'already_owned' when removeAds; sets removeAds = true, event removeAdsBought. (Receipt handling is in the store.)
 * - Tests (src/engine/__tests__/ads.test.ts): stacking, the cap, a clock moved back, remove-ads purchase.
 *
 * May import only: ./types, ./balance.
 */
import type { Balance } from './balance';
import { fail, succeed, type ActionResult, type GameState } from './types';

const MINUTE_MS = 60_000;

export function boostLeftMs(state: GameState, balance: Balance, now: number): number {
  const left = state.ads.boostUntil - now;
  if (!(left > 0)) return 0;
  return Math.min(left, balance.ads.boostCapMinutes * MINUTE_MS);
}

export function boostActive(state: GameState, balance: Balance, now: number): boolean {
  return boostLeftMs(state, balance, now) > 0;
}

export function canAddBoost(state: GameState, balance: Balance, now: number): boolean {
  return boostLeftMs(state, balance, now) + balance.ads.boostMinutes * MINUTE_MS <= balance.ads.boostCapMinutes * MINUTE_MS;
}

export function addBoost(state: GameState, balance: Balance, now: number): ActionResult {
  if (!canAddBoost(state, balance, now)) return fail(state, 'not_available');
  const until = now + boostLeftMs(state, balance, now) + balance.ads.boostMinutes * MINUTE_MS;
  return succeed({ ...state, ads: { ...state.ads, boostUntil: until } }, [{ type: 'boostAdded', until }]);
}

export function buyRemoveAds(state: GameState): ActionResult {
  if (state.removeAds) return fail(state, 'already_owned');
  return succeed({ ...state, removeAds: true }, [{ type: 'removeAdsBought' }]);
}
