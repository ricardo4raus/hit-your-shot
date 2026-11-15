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
import { currentSport, withSport } from './state';
import { fail, succeed, type ActionResult, type GameEvent, type GameState } from './types';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/**
 * Seconds away that count for the payout. The gap is measured from the later of lastSeenAt and clockHighWater, so a clock that was
 * moved back and forth never pays the same stretch twice. Capped, and zero when the gap is shorter than the minimum.
 */
export function offlineSeconds(state: GameState, balance: Balance, now: number): number {
  const since = Math.max(state.lastSeenAt, state.clockHighWater);
  const raw = (now - since) / MS_PER_SECOND;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const seconds = Math.min(raw, balance.offline.capMinutes * SECONDS_PER_MINUTE);
  if (seconds < balance.offline.minSecondsAway) return 0;
  return seconds;
}

export function computeOfflineEarnings(state: GameState, balance: Balance, now: number): { seconds: number; money: number } {
  const seconds = offlineSeconds(state, balance, now);
  const perMinute = currentSport(state).lastRoundMoney * balance.offline.fractionOfLastRoundPerMinute;
  const money = seconds > 0 && perMinute > 0 ? perMinute * (seconds / SECONDS_PER_MINUTE) : 0;
  return { seconds, money };
}

export function applyOfflineEarnings(state: GameState, balance: Balance, now: number): ActionResult {
  const { seconds, money } = computeOfflineEarnings(state, balance, now);
  const sport = currentSport(state);
  const paid = withSport(state, state.currentSport, { ...sport, money: sport.money + money });
  const next = touchClock({ ...paid, offline: { pendingDouble: money, lastSeconds: seconds } }, now);
  const events: GameEvent[] = money > 0 ? [{ type: 'offlineEarned', money, seconds }] : [];
  return succeed(next, events);
}

export function claimOfflineDouble(state: GameState, balance: Balance): ActionResult {
  const pending = state.offline.pendingDouble;
  if (!(pending > 0)) return fail(state, 'not_available');
  const bonus = pending * (balance.offline.adDoubleMult - 1);
  const sport = currentSport(state);
  const paid = withSport(state, state.currentSport, { ...sport, money: sport.money + bonus });
  return succeed({ ...paid, offline: { ...state.offline, pendingDouble: 0 } });
}

/** Records that the app was seen at `now`. A non-finite `now` leaves the clock alone. */
export function touchClock(state: GameState, now: number): GameState {
  if (!Number.isFinite(now)) return state;
  return { ...state, lastSeenAt: now, clockHighWater: Math.max(state.clockHighWater, now) };
}
