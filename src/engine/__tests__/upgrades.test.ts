import { balance, makeState, makeStateWith } from '../testing';
import { UPGRADE_IDS, type UpgradeId } from '../types';
import { buyUpgrade, incomeMult, isMastered, shotsPerSec, spreadDeg, upgradeCost } from '../upgrades';

const foam = balance.sports.basketball.balls[0]!;
const medicine = balance.sports.basketball.balls[2]!;
const max = balance.upgrades.maxLevel;

function levels(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

describe('upgradeCost', () => {
  it('follows base × growth^level, rounded, for the first five levels of every card', () => {
    for (const id of UPGRADE_IDS) {
      const card = balance.upgrades[id];
      const expected = levels(5).map((l) => Math.round(card.baseCost * Math.pow(card.costGrowth, l)));
      expect(levels(5).map((l) => upgradeCost(balance, id, l))).toEqual(expected);
    }
  });

  it('starts at the base cost and stays affordable for the first rounds', () => {
    for (const id of UPGRADE_IDS) {
      expect(upgradeCost(balance, id, 0)).toBe(Math.round(balance.upgrades[id].baseCost));
      expect(upgradeCost(balance, id, 4)).toBeLessThan(balance.upgrades[id].baseCost * 3);
    }
  });

  it('is a whole number that never decreases with level', () => {
    for (const id of UPGRADE_IDS) {
      let last = 0;
      for (const l of levels(max + 1)) {
        const c = upgradeCost(balance, id, l);
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(last);
        last = c;
      }
    }
  });
});

describe('effects', () => {
  it('spread narrows with each accuracy level and never drops below the floor plus the ball penalty', () => {
    const card = balance.upgrades.accuracy;
    expect(spreadDeg(balance, 0, foam)).toBe(card.baseSpreadDeg + foam.accuracyPenaltyDeg);
    for (const l of levels(max)) {
      expect(spreadDeg(balance, l + 1, foam)).toBeLessThanOrEqual(spreadDeg(balance, l, foam));
      expect(spreadDeg(balance, l, foam)).toBeGreaterThanOrEqual(card.minSpreadDeg + foam.accuracyPenaltyDeg);
    }
    expect(spreadDeg(balance, max, medicine) - spreadDeg(balance, max, foam)).toBeCloseTo(medicine.accuracyPenaltyDeg - foam.accuracyPenaltyDeg);
  });

  it('spread stops at the floor for very high levels', () => {
    const card = balance.upgrades.accuracy;
    expect(spreadDeg(balance, max * max, foam)).toBe(card.minSpreadDeg + foam.accuracyPenaltyDeg);
  });

  it('shots per second grow strictly with fire-rate level and scale with the ball', () => {
    const card = balance.upgrades.fireRate;
    expect(shotsPerSec(balance, 0, foam)).toBeCloseTo(card.baseShotsPerSec * foam.fireRateMult);
    for (const l of levels(max)) {
      expect(shotsPerSec(balance, l + 1, foam)).toBeGreaterThan(shotsPerSec(balance, l, foam));
    }
    expect(shotsPerSec(balance, 3, medicine) / shotsPerSec(balance, 3, foam)).toBeCloseTo(medicine.fireRateMult / foam.fireRateMult);
  });

  it('income multiplier starts at 1 and grows strictly with level', () => {
    expect(incomeMult(balance, 0)).toBe(1);
    for (const l of levels(max)) {
      expect(incomeMult(balance, l + 1)).toBeGreaterThan(incomeMult(balance, l));
    }
    expect(incomeMult(balance, 2)).toBeCloseTo(1 + 2 * balance.upgrades.income.perLevel);
  });
});

describe('buyUpgrade', () => {
  it('fails without money and leaves the state untouched', () => {
    const state = makeState();
    const result = buyUpgrade(state, balance, 'accuracy');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_enough_money');
    expect(result.state).toBe(state);
    expect(state.sports.basketball.upgrades.accuracy).toBe(0);
  });

  it('buys a level, subtracts the cost and reports the new level', () => {
    const cost = upgradeCost(balance, 'fireRate', 0);
    const state = makeStateWith('basketball', { money: cost + 1 });
    const result = buyUpgrade(state, balance, 'fireRate');
    expect(result.ok).toBe(true);
    expect(result.state.sports.basketball.money).toBe(1);
    expect(result.state.sports.basketball.upgrades.fireRate).toBe(1);
    expect(result.events).toEqual([{ type: 'upgradeBought', sport: 'basketball', id: 'fireRate', level: 1 }]);
    expect(state.sports.basketball.upgrades.fireRate).toBe(0);
    expect(result.state.sports.basketball).not.toBe(state.sports.basketball);
  });

  it('charges the cost of the level the player currently holds', () => {
    const level = 4;
    const cost = upgradeCost(balance, 'income', level);
    const state = makeStateWith('basketball', { money: cost, upgrades: { accuracy: 0, fireRate: 0, income: level } });
    const result = buyUpgrade(state, balance, 'income');
    expect(result.ok).toBe(true);
    expect(result.state.sports.basketball.money).toBe(0);
    expect(result.state.sports.basketball.upgrades.income).toBe(level + 1);
  });

  it('acts on the current sport only', () => {
    const cost = upgradeCost(balance, 'accuracy', 0);
    const base = makeStateWith('football', { money: cost, unlocked: true });
    const result = buyUpgrade(base, balance, 'accuracy');
    expect(result.ok).toBe(true);
    expect(result.state.sports.football.upgrades.accuracy).toBe(1);
    expect(result.state.sports.basketball.upgrades.accuracy).toBe(0);
  });

  it('fails at max level even with money', () => {
    const state = makeStateWith('basketball', { money: Number.MAX_SAFE_INTEGER, upgrades: { accuracy: max, fireRate: 0, income: 0 } });
    const result = buyUpgrade(state, balance, 'accuracy');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('max_level');
    expect(result.state).toBe(state);
  });

  it('fires mastery exactly once, when the last card reaches max', () => {
    const almost = makeStateWith('basketball', {
      money: Number.MAX_SAFE_INTEGER,
      upgrades: { accuracy: max, fireRate: max, income: max - 2 },
    });
    expect(isMastered(balance, almost.sports.basketball)).toBe(false);

    const first = buyUpgrade(almost, balance, 'income');
    expect(first.ok).toBe(true);
    expect(first.state.sports.basketball.mastered).toBe(false);
    expect(first.events.map((e) => e.type)).toEqual(['upgradeBought']);

    const second = buyUpgrade(first.state, balance, 'income');
    expect(second.ok).toBe(true);
    expect(second.state.sports.basketball.mastered).toBe(true);
    expect(isMastered(balance, second.state.sports.basketball)).toBe(true);
    expect(second.events).toEqual([
      { type: 'upgradeBought', sport: 'basketball', id: 'income', level: max },
      { type: 'mastered', sport: 'basketball' },
    ]);

    const third = buyUpgrade(second.state, balance, 'income');
    expect(third.ok).toBe(false);
    expect(third.events).toEqual([]);
  });

  it('does not fire mastery again for a sport already flagged mastered', () => {
    const state = makeStateWith('basketball', {
      money: Number.MAX_SAFE_INTEGER,
      mastered: true,
      upgrades: { accuracy: max, fireRate: max, income: max - 1 },
    });
    const result = buyUpgrade(state, balance, 'income');
    expect(result.ok).toBe(true);
    expect(result.events.map((e) => e.type)).toEqual(['upgradeBought']);
  });

  it('can buy every level of every card up to max and no further', () => {
    let state = makeStateWith('basketball', { money: Number.MAX_SAFE_INTEGER });
    for (const id of UPGRADE_IDS as readonly UpgradeId[]) {
      for (let l = 0; l < max; l++) {
        const r = buyUpgrade(state, balance, id);
        expect(r.ok).toBe(true);
        state = r.state;
      }
      expect(state.sports.basketball.upgrades[id]).toBe(max);
    }
    expect(state.sports.basketball.mastered).toBe(true);
    expect(buyUpgrade(state, balance, 'accuracy').ok).toBe(false);
  });
});
