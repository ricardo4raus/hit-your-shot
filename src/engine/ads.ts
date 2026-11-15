/**
 * MODULE: ads. Owner: agent "meta". docs/game-design.md "Version 1 scope" (monetization row), docs/open-decisions.md item 12.
 * The ×2 placement and the remove-ads purchase. Showing the ad is the store's job; this module only decides and pays.
 *
 * Rules:
 * - canWatchX2(state, balance): true when state.removeAds, or ads.roundsSinceX2 >= balance.ads.x2EveryRounds.
 * - markX2Used(state): ads.roundsSinceX2 = 0. The store sets round.doubled = true itself after the ad was rewarded (or free with removeAds).
 * - buyRemoveAds(state): 'already_owned' when removeAds; sets removeAds = true, event removeAdsBought. (Receipt handling is in the store.)
 * - Tests (src/engine/__tests__/ads.test.ts): cooldown, remove-ads bypass, double purchase.
 *
 * May import only: ./types, ./balance.
 */
import type { Balance } from './balance';
import type { ActionResult, GameState } from './types';

export function canWatchX2(_state: GameState, _balance: Balance): boolean {
  throw new Error('not implemented');
}

export function markX2Used(_state: GameState): GameState {
  throw new Error('not implemented');
}

export function buyRemoveAds(_state: GameState): ActionResult {
  throw new Error('not implemented');
}
