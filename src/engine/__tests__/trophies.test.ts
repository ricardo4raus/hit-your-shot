import { balance, makeState, makeStateWith } from '../testing';
import { awardMilestones, dueMilestones, masteryBonus, selectSport, unlockSport } from '../trophies';
import type { SportState } from '../types';

const t = balance.trophies;
const [foam, regulation, medicine] = balance.sports.basketball.balls.map((b) => b.id) as [string, string, string];

function sport(overrides: Partial<SportState> = {}): SportState {
  return { ...makeState().sports.basketball, ...overrides };
}

describe('dueMilestones', () => {
  it('is empty for a fresh sport', () => {
    expect(dueMilestones(sport(), balance)).toEqual([]);
  });

  it('pays one upgrade tier every upgradeTierEvery levels, not before', () => {
    const every = t.upgradeTierEvery;
    expect(dueMilestones(sport({ upgrades: { accuracy: every - 1, fireRate: 0, income: 0 } }), balance)).toEqual([]);
    expect(dueMilestones(sport({ upgrades: { accuracy: every, fireRate: 0, income: 0 } }), balance)).toEqual([
      { id: 'upgrade:accuracy:1', amount: t.perUpgradeTier },
    ]);
    expect(dueMilestones(sport({ upgrades: { accuracy: 0, fireRate: every * 2 + 1, income: 0 } }), balance)).toEqual([
      { id: 'upgrade:fireRate:1', amount: t.perUpgradeTier },
      { id: 'upgrade:fireRate:2', amount: t.perUpgradeTier },
    ]);
  });

  it('pays for every owned ball except the first in the list', () => {
    expect(dueMilestones(sport({ ownedBalls: [foam] }), balance)).toEqual([]);
    expect(dueMilestones(sport({ ownedBalls: [foam, medicine] }), balance)).toEqual([{ id: `ball:${medicine}`, amount: t.perNewBall }]);
    expect(dueMilestones(sport({ ownedBalls: [medicine, foam, regulation] }), balance)).toEqual([
      { id: `ball:${regulation}`, amount: t.perNewBall },
      { id: `ball:${medicine}`, amount: t.perNewBall },
    ]);
  });

  it('pays one best-round decade per power of ten above the first threshold', () => {
    const first = t.bestRoundFirstDecade;
    expect(dueMilestones(sport({ bestRound: first - 1 }), balance)).toEqual([]);
    expect(dueMilestones(sport({ bestRound: first }), balance)).toEqual([{ id: 'best:0', amount: t.perBestRoundDecade }]);
    expect(dueMilestones(sport({ bestRound: first * 100 }), balance)).toEqual([
      { id: 'best:0', amount: t.perBestRoundDecade },
      { id: 'best:1', amount: t.perBestRoundDecade },
      { id: 'best:2', amount: t.perBestRoundDecade },
    ]);
  });

  it('skips milestones already paid', () => {
    const s = sport({
      upgrades: { accuracy: t.upgradeTierEvery * 2, fireRate: 0, income: 0 },
      ownedBalls: [foam, regulation],
      bestRound: t.bestRoundFirstDecade * 10,
      trophyMilestones: ['upgrade:accuracy:1', `ball:${regulation}`, 'best:0'],
    });
    expect(dueMilestones(s, balance).map((m) => m.id)).toEqual(['upgrade:accuracy:2', 'best:1']);
  });

  it('lists upgrades by card then tier, balls in balance order, then best by decade', () => {
    const every = t.upgradeTierEvery;
    const s = sport({
      upgrades: { accuracy: every, fireRate: every * 2, income: every },
      ownedBalls: [foam, medicine, regulation],
      bestRound: t.bestRoundFirstDecade * 10,
    });
    expect(dueMilestones(s, balance).map((m) => m.id)).toEqual([
      'upgrade:accuracy:1',
      'upgrade:fireRate:1',
      'upgrade:fireRate:2',
      'upgrade:income:1',
      `ball:${regulation}`,
      `ball:${medicine}`,
      'best:0',
      'best:1',
    ]);
  });
});

describe('awardMilestones', () => {
  it('returns the same state and no events when nothing is due', () => {
    const state = makeState();
    const result = awardMilestones(state, balance, 'basketball');
    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('pays every due milestone once with one event each', () => {
    const state = makeStateWith('basketball', {
      upgrades: { accuracy: t.upgradeTierEvery, fireRate: 0, income: 0 },
      ownedBalls: [foam, regulation],
      bestRound: t.bestRoundFirstDecade,
    });
    const first = awardMilestones(state, balance, 'basketball');
    expect(first.state.trophies).toBe(t.perUpgradeTier + t.perNewBall + t.perBestRoundDecade);
    expect(first.state.sports.basketball.trophyMilestones).toEqual(['upgrade:accuracy:1', `ball:${regulation}`, 'best:0']);
    expect(first.events).toEqual([
      { type: 'trophy', amount: t.perUpgradeTier, milestone: 'upgrade:accuracy:1' },
      { type: 'trophy', amount: t.perNewBall, milestone: `ball:${regulation}` },
      { type: 'trophy', amount: t.perBestRoundDecade, milestone: 'best:0' },
    ]);
    expect(state.trophies).toBe(0);
    expect(state.sports.basketball.trophyMilestones).toEqual([]);

    const second = awardMilestones(first.state, balance, 'basketball');
    expect(second.state).toBe(first.state);
    expect(second.events).toEqual([]);
  });

  it('pays the sport named, not the current one', () => {
    const state = makeState();
    const football = { ...state.sports.football, bestRound: t.bestRoundFirstDecade };
    const withFootball = { ...state, sports: { ...state.sports, football } };
    const result = awardMilestones(withFootball, balance, 'football');
    expect(result.state.currentSport).toBe('basketball');
    expect(result.state.sports.football.trophyMilestones).toEqual(['best:0']);
    expect(result.state.sports.basketball.trophyMilestones).toEqual([]);
    expect(result.state.trophies).toBe(t.perBestRoundDecade);
  });

  it('adds to trophies already held', () => {
    const state = makeStateWith('basketball', { bestRound: t.bestRoundFirstDecade }, { trophies: 7 });
    expect(awardMilestones(state, balance, 'basketball').state.trophies).toBe(7 + t.perBestRoundDecade);
  });
});

describe('masteryBonus', () => {
  it('counts mastered sports wherever they are', () => {
    const none = makeState();
    expect(masteryBonus(none, balance)).toBe(1);
    const one = makeStateWith('football', { mastered: true });
    expect(masteryBonus(one, balance)).toBeCloseTo(1 + balance.mastery.incomeBonusPerSport);
    const two = { ...one, sports: { ...one.sports, golf: { ...one.sports.golf, mastered: true } } };
    expect(masteryBonus(two, balance)).toBeCloseTo(1 + 2 * balance.mastery.incomeBonusPerSport);
    expect(masteryBonus({ ...two, currentSport: 'basketball' }, balance)).toBe(masteryBonus({ ...two, currentSport: 'golf' }, balance));
  });
});

describe('unlockSport', () => {
  const price = balance.sports.football.unlockTrophies;

  it('fails on a sport already unlocked', () => {
    const result = unlockSport(makeState(), balance, 'basketball');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('already_owned');
  });

  it('fails without enough trophies', () => {
    const result = unlockSport(makeState({ trophies: price - 1 }), balance, 'football');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_enough_trophies');
    expect(result.state.sports.football.unlocked).toBe(false);
  });

  it('pays, unlocks and stays in the current sport', () => {
    const state = makeState({ trophies: price + 1 });
    const result = unlockSport(state, balance, 'football');
    expect(result.ok).toBe(true);
    expect(result.state.trophies).toBe(1);
    expect(result.state.sports.football.unlocked).toBe(true);
    expect(result.state.currentSport).toBe('basketball');
    expect(result.events).toEqual([{ type: 'sportUnlocked', sport: 'football' }]);
    expect(state.sports.football.unlocked).toBe(false);
    expect(state.trophies).toBe(price + 1);
  });
});

describe('selectSport', () => {
  it('refuses a locked sport', () => {
    const result = selectSport(makeState(), balance, 'golf');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('locked');
    expect(result.state.currentSport).toBe('basketball');
  });

  it('switches to an unlocked sport and makes the x2 ad available', () => {
    const state = makeStateWith('basketball', {}, { ads: { roundsSinceX2: 0 } });
    const unlocked = { ...state, sports: { ...state.sports, football: { ...state.sports.football, unlocked: true } } };
    const result = selectSport(unlocked, balance, 'football');
    expect(result.ok).toBe(true);
    expect(result.state.currentSport).toBe('football');
    expect(result.state.ads.roundsSinceX2).toBe(balance.ads.x2EveryRounds);
    expect(result.events).toEqual([]);
    expect(unlocked.currentSport).toBe('basketball');
    expect(unlocked.ads.roundsSinceX2).toBe(0);
  });
});
