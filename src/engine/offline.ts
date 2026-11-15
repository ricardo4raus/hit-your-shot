/**
 * MODULE: offline. Owner: agent "meta". docs/game-design.md "Offline earnings", docs/open-decisions.md item 11.
 * A small, capped trickle while the app is closed. Adapted from neural-tycoon/src/engine/offline.ts (shared-code candidate).
 *
 * Rules:
 * - offlineSeconds(state, balance, now) = clamp((now − max(lastSeenAt, clockHighWater)) / 1000, 0, capMinutes × 60). Non-finite or
 *   negative → 0. Below balance.offline.minSecondsAway → 0 (short gaps pay nothing and show nothing).
 * - computeOfflineEarnings(state, balance, now): money = currentSport.lastRoundMoney × fractionOfLastRoundPerMinute × (seconds / 60).
 *   Returns { seconds, money }. money 0 when lastRoundMoney is 0.
 * - applyOfflineEarnings(state, balance, now): adds money to the current sport, sets offline.pendingDouble = money (the "double" ad can add
 *   the same again) and offline.lastSeconds = seconds, then touchClock. Event offlineEarned when money > 0. With money 0 it still touches
 *   the clock and returns ok with no events.
 * - claimOfflineDouble(state, balance): 'not_available' when pendingDouble <= 0. Adds pendingDouble × (adDoubleMult − 1) to the current
 *   sport and clears pendingDouble. (The store shows the ad first; this function only pays.)
 * - touchClock(state, now): lastSeenAt = now, clockHighWater = max(clockHighWater, now). Never pays.
 * - Tests (src/engine/__tests__/offline.test.ts): cap, min gap, backwards clock pays nothing and never pays twice, double pays once.
 *
 * May import only: ./types, ./balance, ./state.
 */
import type { Balance } from './balance';
import type { ActionResult, GameState } from './types';

export function offlineSeconds(_state: GameState, _balance: Balance, _now: number): number {
  throw new Error('not implemented');
}

export function computeOfflineEarnings(_state: GameState, _balance: Balance, _now: number): { seconds: number; money: number } {
  throw new Error('not implemented');
}

export function applyOfflineEarnings(_state: GameState, _balance: Balance, _now: number): ActionResult {
  throw new Error('not implemented');
}

export function claimOfflineDouble(_state: GameState, _balance: Balance): ActionResult {
  throw new Error('not implemented');
}

export function touchClock(_state: GameState, _now: number): GameState {
  throw new Error('not implemented');
}
