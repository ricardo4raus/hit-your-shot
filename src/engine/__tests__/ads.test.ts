import { addBoost, boostActive, boostLeftMs, buyRemoveAds, canAddBoost } from '../ads';
import { balance, makeState, T0 } from '../testing';

const MIN = 60_000;
const STEP = balance.ads.boostMinutes * MIN;
const CAP = balance.ads.boostCapMinutes * MIN;

describe('the income boost', () => {
  it('starts off', () => {
    const state = makeState();
    expect(boostLeftMs(state, balance, T0)).toBe(0);
    expect(boostActive(state, balance, T0)).toBe(false);
    expect(canAddBoost(state, balance, T0)).toBe(true);
  });

  it('adds one step per ad and stacks on what is left, without touching the input', () => {
    const before = makeState();
    const snapshot = JSON.stringify(before);
    const once = addBoost(before, balance, T0);
    expect(once.ok).toBe(true);
    expect(once.state.ads.boostUntil).toBe(T0 + STEP);
    expect(once.events).toEqual([{ type: 'boostAdded', until: T0 + STEP }]);
    // Half a step later another ad adds a full step on top of the half that is left.
    const later = T0 + STEP / 2;
    const twice = addBoost(once.state, balance, later);
    expect(boostLeftMs(twice.state, balance, later)).toBe(STEP * 1.5);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('runs out', () => {
    const state = addBoost(makeState(), balance, T0).state;
    expect(boostActive(state, balance, T0 + STEP - 1)).toBe(true);
    expect(boostActive(state, balance, T0 + STEP)).toBe(false);
    expect(boostLeftMs(state, balance, T0 + STEP * 3)).toBe(0);
  });

  it('stops at the cap', () => {
    let state = makeState();
    const steps = Math.floor(CAP / STEP);
    for (let i = 0; i < steps; i++) state = addBoost(state, balance, T0).state;
    expect(boostLeftMs(state, balance, T0)).toBe(steps * STEP);
    expect(canAddBoost(state, balance, T0)).toBe(false);
    const refused = addBoost(state, balance, T0);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe('not_available');
    expect(refused.state).toBe(state);
    // Once a full step has run down, one more fits.
    expect(canAddBoost(state, balance, T0 + STEP)).toBe(true);
  });

  it('never reports more than the cap when the clock moves back', () => {
    const state = makeState({ ads: { boostUntil: T0 + CAP } });
    expect(boostLeftMs(state, balance, T0 - 24 * 60 * MIN)).toBe(CAP);
    expect(canAddBoost(state, balance, T0 - 24 * 60 * MIN)).toBe(false);
  });
});

describe('buyRemoveAds', () => {
  it('turns remove-ads on once and reports the event', () => {
    const before = makeState();
    const snapshot = JSON.stringify(before);
    const result = buyRemoveAds(before);
    expect(result.ok).toBe(true);
    expect(result.state.removeAds).toBe(true);
    expect(result.events).toEqual([{ type: 'removeAdsBought' }]);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('refuses a second purchase', () => {
    const owned = buyRemoveAds(makeState()).state;
    const again = buyRemoveAds(owned);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('already_owned');
    expect(again.state).toBe(owned);
    expect(again.events).toEqual([]);
  });
});
