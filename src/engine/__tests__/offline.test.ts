import { applyOfflineEarnings, claimOfflineDouble, computeOfflineEarnings, offlineSeconds, touchClock } from '../offline';
import { balance, makeStateWith, T0 } from '../testing';
import type { GameState } from '../types';

const MINUTE = 60_000;
const LAST_ROUND = 100;
const perMinute = LAST_ROUND * balance.offline.fractionOfLastRoundPerMinute;

/** A game at T0 whose current sport just finished a round worth LAST_ROUND. */
function awayFrom(lastRoundMoney = LAST_ROUND): GameState {
  return makeStateWith('basketball', { lastRoundMoney, money: 0 });
}

function expectUnchanged(before: GameState, snapshot: string): void {
  expect(JSON.stringify(before)).toBe(snapshot);
}

describe('offlineSeconds', () => {
  it('counts whole seconds away from lastSeenAt', () => {
    expect(offlineSeconds(awayFrom(), balance, T0 + 10 * MINUTE)).toBe(600);
  });

  it('pays nothing below the minimum gap', () => {
    const justUnder = T0 + balance.offline.minSecondsAway * 1000 - 1;
    expect(offlineSeconds(awayFrom(), balance, justUnder)).toBe(0);
    expect(offlineSeconds(awayFrom(), balance, T0 + balance.offline.minSecondsAway * 1000)).toBe(balance.offline.minSecondsAway);
  });

  it('caps at capMinutes', () => {
    const cap = balance.offline.capMinutes * 60;
    expect(offlineSeconds(awayFrom(), balance, T0 + 3 * balance.offline.capMinutes * MINUTE)).toBe(cap);
  });

  it('returns 0 for a clock in the past or a broken clock', () => {
    expect(offlineSeconds(awayFrom(), balance, T0 - MINUTE)).toBe(0);
    expect(offlineSeconds(awayFrom(), balance, Number.NaN)).toBe(0);
    expect(offlineSeconds(awayFrom(), balance, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('measures from the clock high-water mark when it is later than lastSeenAt', () => {
    const state = { ...awayFrom(), clockHighWater: T0 + 60 * MINUTE };
    expect(offlineSeconds(state, balance, T0 + 70 * MINUTE)).toBe(600);
    expect(offlineSeconds(state, balance, T0 + 30 * MINUTE)).toBe(0);
  });
});

describe('computeOfflineEarnings', () => {
  it('pays a fraction of the last round per minute', () => {
    const { seconds, money } = computeOfflineEarnings(awayFrom(), balance, T0 + 10 * MINUTE);
    expect(seconds).toBe(600);
    expect(money).toBeCloseTo(perMinute * 10);
  });

  it('pays nothing when the last round earned nothing', () => {
    expect(computeOfflineEarnings(awayFrom(0), balance, T0 + 10 * MINUTE)).toEqual({ seconds: 600, money: 0 });
  });

  it('pays nothing below the minimum gap', () => {
    expect(computeOfflineEarnings(awayFrom(), balance, T0 + 1000)).toEqual({ seconds: 0, money: 0 });
  });
});

describe('applyOfflineEarnings', () => {
  it('adds the money to the current sport, offers the double and touches the clock', () => {
    const before = awayFrom();
    const snapshot = JSON.stringify(before);
    const now = T0 + 10 * MINUTE;
    const result = applyOfflineEarnings(before, balance, now);
    expect(result.ok).toBe(true);
    const expected = perMinute * 10;
    expect(result.state.sports.basketball.money).toBeCloseTo(expected);
    expect(result.state.offline.pendingDouble).toBeCloseTo(expected);
    expect(result.state.offline.lastSeconds).toBe(600);
    expect(result.state.lastSeenAt).toBe(now);
    expect(result.state.clockHighWater).toBe(now);
    expect(result.events).toEqual([{ type: 'offlineEarned', money: expected, seconds: 600 }]);
    expectUnchanged(before, snapshot);
  });

  it('is capped', () => {
    const result = applyOfflineEarnings(awayFrom(), balance, T0 + 24 * 60 * MINUTE);
    expect(result.state.sports.basketball.money).toBeCloseTo(perMinute * balance.offline.capMinutes);
    expect(result.state.offline.lastSeconds).toBe(balance.offline.capMinutes * 60);
  });

  it('touches the clock, clears an old offer and emits nothing for a short gap', () => {
    const before = { ...awayFrom(), offline: { pendingDouble: 50, lastSeconds: 300 } };
    const now = T0 + 1000;
    const result = applyOfflineEarnings(before, balance, now);
    expect(result.ok).toBe(true);
    expect(result.events).toEqual([]);
    expect(result.state.sports.basketball.money).toBe(0);
    expect(result.state.offline).toEqual({ pendingDouble: 0, lastSeconds: 0 });
    expect(result.state.lastSeenAt).toBe(now);
  });

  it('pays nothing for a clock moved backwards and still records the time', () => {
    const paid = applyOfflineEarnings(awayFrom(), balance, T0 + 60 * MINUTE).state;
    const moneyAfterFirst = paid.sports.basketball.money;
    const back = applyOfflineEarnings(paid, balance, T0 + 10 * MINUTE);
    expect(back.ok).toBe(true);
    expect(back.events).toEqual([]);
    expect(back.state.sports.basketball.money).toBe(moneyAfterFirst);
    expect(back.state.lastSeenAt).toBe(T0 + 10 * MINUTE);
    expect(back.state.clockHighWater).toBe(T0 + 60 * MINUTE);
  });

  it('never pays the same stretch twice after the clock went back and forth', () => {
    const first = applyOfflineEarnings(awayFrom(), balance, T0 + 60 * MINUTE).state;
    const back = applyOfflineEarnings(first, balance, T0 + 10 * MINUTE).state;
    // The clock returns to where it was: only the minutes past the high-water mark count.
    const forward = applyOfflineEarnings(back, balance, T0 + 70 * MINUTE);
    expect(forward.state.sports.basketball.money).toBeCloseTo(perMinute * 60 + perMinute * 10);
    expect(forward.state.offline.lastSeconds).toBe(600);
    // Exactly at the high-water mark nothing is left to pay.
    const same = applyOfflineEarnings(first, balance, T0 + 60 * MINUTE);
    expect(same.state.sports.basketball.money).toBe(first.sports.basketball.money);
    expect(same.events).toEqual([]);
  });

  it('pays the sport the player is looking at', () => {
    const state = makeStateWith('football', { lastRoundMoney: LAST_ROUND, unlocked: true });
    const result = applyOfflineEarnings(state, balance, T0 + 10 * MINUTE);
    expect(result.state.sports.football.money).toBeCloseTo(perMinute * 10);
    expect(result.state.sports.basketball.money).toBe(0);
  });
});

describe('claimOfflineDouble', () => {
  it('is not available without a pending offer', () => {
    const state = awayFrom();
    const result = claimOfflineDouble(state, balance);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_available');
    expect(result.state).toBe(state);
  });

  it('pays the double once and then clears the offer', () => {
    const before = applyOfflineEarnings(awayFrom(), balance, T0 + 10 * MINUTE).state;
    const snapshot = JSON.stringify(before);
    const payout = before.offline.pendingDouble;
    expect(payout).toBeGreaterThan(0);

    const doubled = claimOfflineDouble(before, balance);
    expect(doubled.ok).toBe(true);
    expect(doubled.state.sports.basketball.money).toBeCloseTo(payout * balance.offline.adDoubleMult);
    expect(doubled.state.offline.pendingDouble).toBe(0);
    expect(doubled.state.offline.lastSeconds).toBe(before.offline.lastSeconds);
    expectUnchanged(before, snapshot);

    const again = claimOfflineDouble(doubled.state, balance);
    expect(again.ok).toBe(false);
    expect(again.state.sports.basketball.money).toBe(doubled.state.sports.basketball.money);
  });
});

describe('touchClock', () => {
  it('sets lastSeenAt and raises the high-water mark without paying', () => {
    const before = awayFrom();
    const snapshot = JSON.stringify(before);
    const touched = touchClock(before, T0 + MINUTE);
    expect(touched.lastSeenAt).toBe(T0 + MINUTE);
    expect(touched.clockHighWater).toBe(T0 + MINUTE);
    expect(touched.sports).toBe(before.sports);
    expectUnchanged(before, snapshot);
  });

  it('keeps the high-water mark when the clock went back', () => {
    const touched = touchClock(awayFrom(), T0 - MINUTE);
    expect(touched.lastSeenAt).toBe(T0 - MINUTE);
    expect(touched.clockHighWater).toBe(T0);
  });

  it('ignores a non-finite clock', () => {
    const state = awayFrom();
    expect(touchClock(state, Number.NaN)).toBe(state);
  });
});
