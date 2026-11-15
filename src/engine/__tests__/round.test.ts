import { ballDefOf } from '../balance';
import { muzzleOffsets } from '../limbs';
import { createRound, dueShots, hitValue, limbRates, recordShot, settleRound, shotInputFor } from '../round';
import { balance, fixedRng, makeState, makeStateWith, rng, T0 } from '../testing';
import { masteryBonus } from '../trophies';
import type { GameState, RoundState, ShotResult, SportState } from '../types';
import { incomeMult, shotsPerSec, spreadDeg } from '../upgrades';

const foam = balance.sports.basketball.balls[0]!;
const regulation = balance.sports.basketball.balls[1]!;
const medicine = balance.sports.basketball.balls[2]!;
const cap = balance.physics.maxShotsPerTick;

/** A basketball state with `limbs` limbs, every limb on `ballId`, and the given sport overrides. */
function withLimbs(limbs: number, ballId = foam.id, overrides: Partial<SportState> = {}): GameState {
  return makeStateWith('basketball', {
    limbs,
    limbBalls: new Array<string>(limbs).fill(ballId),
    ownedBalls: [foam.id, regulation.id, medicine.id],
    ...overrides,
  });
}

function roundFor(state: GameState, overrides: Partial<RoundState> = {}): RoundState {
  return { ...createRound(state, balance, T0, rng()), ...overrides };
}

function result(hit: boolean, value: number, limb = 0): ShotResult {
  return { hit, value: hit ? value : 0, segments: [], endSec: 1, eventSec: 1, radius: 0.1, ballId: foam.id, limb };
}

describe('createRound', () => {
  it('copies the sport, the length and the start time and starts every counter at zero', () => {
    const state = makeState();
    const round = createRound(state, balance, T0, rng());
    expect(round.sport).toBe('basketball');
    expect(round.startedAt).toBe(T0);
    expect(round.seconds).toBe(balance.roundSeconds);
    expect(round.shots).toBe(0);
    expect(round.hits).toBe(0);
    expect(round.money).toBe(0);
    expect(round.doubled).toBe(false);
    expect(round.finished).toBe(false);
  });

  it('takes the target phase from one rng roll scaled to a full turn', () => {
    expect(createRound(makeState(), balance, T0, fixedRng(0)).targetPhase).toBe(0);
    expect(createRound(makeState(), balance, T0, fixedRng(0.25)).targetPhase).toBeCloseTo(Math.PI / 2, 12);
    expect(createRound(makeState(), balance, T0, fixedRng(0.999)).targetPhase).toBeLessThan(2 * Math.PI);
  });

  it('interleaves the first fire times: limb i starts at i × (1 / rate_i) / limbs', () => {
    const state = withLimbs(4);
    const rate = shotsPerSec(balance, 0, foam);
    const round = createRound(state, balance, T0, rng());
    expect(round.nextFireAt).toHaveLength(4);
    for (let i = 0; i < 4; i++) expect(round.nextFireAt[i]).toBeCloseTo((i * (1 / rate)) / 4, 12);
    expect(round.nextFireAt[0]).toBe(0);
    expect(round.nextFireAt[3]!).toBeLessThan(1 / rate);
  });

  it('uses each limb\'s own rate for its stagger', () => {
    const state = withLimbs(2, foam.id, { limbBalls: [foam.id, medicine.id] });
    const round = createRound(state, balance, T0, rng());
    expect(round.nextFireAt[1]).toBeCloseTo((1 / shotsPerSec(balance, 0, medicine)) / 2, 12);
  });

  it('a single limb fires at t = 0', () => {
    expect(createRound(makeState(), balance, T0, rng()).nextFireAt).toEqual([0]);
  });
});

describe('limbRates', () => {
  it('returns upgrades.shotsPerSec for every limb with its own ball', () => {
    const state = withLimbs(3, foam.id, { limbBalls: [foam.id, regulation.id, medicine.id], upgrades: { accuracy: 0, fireRate: 5, income: 0 } });
    expect(limbRates(state, balance, 'basketball')).toEqual([
      shotsPerSec(balance, 5, foam),
      shotsPerSec(balance, 5, regulation),
      shotsPerSec(balance, 5, medicine),
    ]);
  });

  it('falls back to the first ball for an unknown ball id', () => {
    const state = withLimbs(1, 'no-such-ball');
    expect(limbRates(state, balance, 'basketball')).toEqual([shotsPerSec(balance, 0, foam)]);
  });
});

describe('dueShots', () => {
  it('fires nothing before the first fire time and once it is reached', () => {
    const state = withLimbs(1);
    const rate = shotsPerSec(balance, 0, foam);
    const round = roundFor(state, { nextFireAt: [0.5] });
    const before = dueShots(round, state, balance, 0.4);
    expect(before.limbs).toEqual([]);
    expect(before.round).toBe(round);
    const at = dueShots(round, state, balance, 0.5);
    expect(at.limbs).toEqual([0]);
    expect(at.round.nextFireAt[0]).toBeCloseTo(0.5 + 1 / rate, 12);
    expect(round.nextFireAt[0]).toBe(0.5);
  });

  it('returns the oldest due limb first', () => {
    const state = withLimbs(3);
    const round = roundFor(state, { nextFireAt: [0.3, 0.1, 0.2] });
    const due = dueShots(round, state, balance, 0.3);
    expect(due.limbs).toEqual([1, 2, 0]);
  });

  it('lists a limb that is far behind once per missed interval, oldest first', () => {
    const state = withLimbs(2);
    const rate = shotsPerSec(balance, 0, foam);
    const interval = 1 / rate;
    const round = roundFor(state, { nextFireAt: [0, interval * 1.5] });
    const due = dueShots(round, state, balance, interval * 2.6);
    // Limb 0 is due at 0, 1, 2 intervals; limb 1 at 1.5 and 2.5. Sorted by time: 0, 1, 1.5, 2, 2.5.
    expect(due.limbs).toEqual([0, 0, 1, 0, 1]);
    expect(due.round.nextFireAt[0]).toBeCloseTo(interval * 3, 10);
    expect(due.round.nextFireAt[1]).toBeCloseTo(interval * 3.5, 10);
  });

  it('never returns more than maxShotsPerTick and carries the rest over', () => {
    // A rate high enough that cap + 10 intervals fit inside the round.
    const level = 150;
    const state = withLimbs(1, foam.id, { upgrades: { accuracy: 0, fireRate: level, income: 0 } });
    const rate = shotsPerSec(balance, level, foam);
    const round = roundFor(state, { nextFireAt: [0] });
    const t = (cap + 10) / rate;
    expect(t).toBeLessThan(round.seconds);
    const first = dueShots(round, state, balance, t);
    expect(first.limbs).toHaveLength(cap);
    expect(first.round.nextFireAt[0]).toBeCloseTo(cap / rate, 8);
    const second = dueShots(first.round, state, balance, t);
    expect(second.limbs).toHaveLength(11);
  });

  it('never fires at or past the end of the round', () => {
    const state = withLimbs(2);
    const round = roundFor(state, { nextFireAt: [round_end(), round_end() - 0.001] });
    const atEnd = dueShots(round, state, balance, round.seconds);
    expect(atEnd.limbs).toEqual([]);
    const pastEnd = dueShots(round, state, balance, round.seconds + 5);
    expect(pastEnd.limbs).toEqual([]);
    const justBefore = dueShots(round, state, balance, round.seconds - 0.0005);
    expect(justBefore.limbs).toEqual([1]);
    // A limb whose next fire time is exactly the end never fires, even when t is far behind in the backlog.
    const behind = roundFor(state, { nextFireAt: [0, round_end()] });
    const due = dueShots(behind, state, balance, round.seconds - 1e-9);
    expect(due.limbs.every((l) => l === 0)).toBe(true);
    expect(due.round.nextFireAt[1]).toBe(round_end());
  });

  it('never fires when the round is finished', () => {
    const state = withLimbs(2);
    const round = roundFor(state, { finished: true, nextFireAt: [0, 0] });
    const due = dueShots(round, state, balance, 1);
    expect(due.limbs).toEqual([]);
    expect(due.round).toBe(round);
  });

  it('skips a limb without a rate instead of looping on it', () => {
    const state = withLimbs(2, foam.id, { upgrades: { accuracy: 0, fireRate: Number.NaN, income: 0 } });
    const round = roundFor(state, { nextFireAt: [0, 0] });
    const due = dueShots(round, state, balance, 1);
    expect(due.limbs).toEqual([]);
  });

  it('30 limbs at a high rate, ticked at 30 Hz over a whole round, fire floor(rate × seconds) shots each under the cap', () => {
    const limbs = 30;
    // A fire-rate level far above the shop's maximum: about 45 shots per second per limb, 1360 per second in total.
    const level = 150;
    const state = withLimbs(limbs, foam.id, { upgrades: { accuracy: 0, fireRate: level, income: 0 } });
    const rate = shotsPerSec(balance, level, foam);
    expect(rate).toBeGreaterThan(40);
    expect(rate * limbs).toBeLessThan(cap * 30);

    let round = createRound(state, balance, T0, rng());
    const seconds = round.seconds;
    const ticks = Math.round(seconds * 30);
    const perLimb = new Array<number>(limbs).fill(0);
    let total = 0;
    let maxPerCall = 0;
    let lastTime = -1;
    for (let k = 0; k <= ticks; k++) {
      const t = k / 30;
      const due = dueShots(round, state, balance, t);
      round = due.round;
      maxPerCall = Math.max(maxPerCall, due.limbs.length);
      for (const limb of due.limbs) perLimb[limb]!++;
      total += due.limbs.length;
      if (t >= seconds) expect(due.limbs).toEqual([]);
      lastTime = t;
    }
    expect(lastTime).toBe(seconds);
    // One last drain just before the end collects what came due after the last tick inside the round.
    const drain = dueShots(round, state, balance, seconds - 1e-9);
    round = drain.round;
    for (const limb of drain.limbs) perLimb[limb]!++;
    total += drain.limbs.length;
    maxPerCall = Math.max(maxPerCall, drain.limbs.length);

    expect(maxPerCall).toBeLessThanOrEqual(cap);
    expect(maxPerCall).toBeGreaterThan(cap / 2);
    const expected = Math.floor(rate * seconds) * limbs;
    // Each limb's fire times are i × stagger + k / rate; floating-point drift in the running sum may move one fire time across the end.
    expect(Math.abs(total - expected)).toBeLessThanOrEqual(limbs);
    for (const n of perLimb) expect(Math.abs(n - Math.floor(rate * seconds))).toBeLessThanOrEqual(1);
    // Nothing is due any more inside the round and every limb's next fire time is at or past the end.
    for (const at of round.nextFireAt) expect(at).toBeGreaterThanOrEqual(seconds - 1e-9);
  });

  it('with a rate above the cap\'s throughput every tick is full and the backlog is only delayed, never lost', () => {
    const limbs = 30;
    const level = 400;
    const state = withLimbs(limbs, foam.id, { upgrades: { accuracy: 0, fireRate: level, income: 0 } });
    const rate = shotsPerSec(balance, level, foam);
    expect(rate * limbs).toBeGreaterThan(cap * 30);
    let round = createRound(state, balance, T0, rng());
    let total = 0;
    const ticks = 30;
    for (let k = 1; k <= ticks; k++) {
      const due = dueShots(round, state, balance, k / 30);
      expect(due.limbs).toHaveLength(cap);
      round = due.round;
      total += due.limbs.length;
    }
    expect(total).toBe(cap * ticks);
    // The next fire times are still behind the clock: the shots are owed, not dropped.
    expect(Math.min(...round.nextFireAt)).toBeLessThan(1);
  });
});

function round_end(): number {
  return balance.roundSeconds;
}

describe('hitValue', () => {
  it('is ball value × income multiplier × mastery bonus, not rounded', () => {
    const state = withLimbs(1, foam.id, { upgrades: { accuracy: 0, fireRate: 0, income: 3 } });
    expect(hitValue(state, balance, 'basketball', regulation, false)).toBeCloseTo(regulation.value * incomeMult(balance, 3), 12);
    expect(hitValue(state, balance, 'basketball', foam, false)).toBe(1 * incomeMult(balance, 3) * masteryBonus(state, balance));
  });

  it('multiplies by the ×2 round multiplier when doubled', () => {
    const state = makeState();
    expect(hitValue(state, balance, 'basketball', medicine, true)).toBeCloseTo(medicine.value * balance.ads.x2RoundMult, 12);
  });

  it('counts mastered sports everywhere', () => {
    const state = makeStateWith('football', { mastered: true });
    expect(hitValue(state, balance, 'basketball', foam, false)).toBeCloseTo(1 + balance.mastery.incomeBonusPerSport, 12);
  });
});

describe('shotInputFor', () => {
  it('carries the sport, aim, time, phase, spread, offset, ball and value of the limb', () => {
    const state = withLimbs(3, foam.id, {
      limbBalls: [foam.id, medicine.id, regulation.id],
      upgrades: { accuracy: 4, fireRate: 0, income: 2 },
    });
    const round = roundFor(state, { targetPhase: 1.234 });
    const offsets = muzzleOffsets(3, balance.sports.basketball, balance);
    const input = shotInputFor(state, balance, round, 1, 0.9, 3.3);
    expect(input).toEqual({
      sport: 'basketball',
      aim: 0.9,
      spreadDeg: spreadDeg(balance, 4, medicine),
      ballId: medicine.id,
      offset: offsets[1],
      t: 3.3,
      targetPhase: 1.234,
      valueIfHit: hitValue(state, balance, 'basketball', medicine, false),
    });
    expect(shotInputFor(state, balance, round, 0, 0.9, 3.3).offset).toBe(offsets[0]);
    expect(shotInputFor(state, balance, round, 2, 0.9, 3.3).offset).toBe(offsets[2]);
    expect(shotInputFor(state, balance, round, 2, 0.9, 3.3).ballId).toBe(regulation.id);
  });

  it('a single limb fires from the aim line', () => {
    const state = makeState();
    expect(shotInputFor(state, balance, roundFor(state), 0, 1, 0).offset).toBe(0);
  });

  it('doubles the value in a ×2 round', () => {
    const state = makeState();
    const plain = shotInputFor(state, balance, roundFor(state), 0, 1, 0).valueIfHit;
    const doubled = shotInputFor(state, balance, roundFor(state, { doubled: true }), 0, 1, 0).valueIfHit;
    expect(doubled).toBeCloseTo(plain * balance.ads.x2RoundMult, 12);
  });

  it('follows the round\'s sport, not the state\'s current sport', () => {
    const state = { ...makeState(), currentSport: 'golf' as const };
    const round: RoundState = { ...roundFor(makeState()), sport: 'basketball' };
    expect(shotInputFor(state, balance, round, 0, 1, 0).sport).toBe('basketball');
    expect(shotInputFor(state, balance, round, 0, 1, 0).ballId).toBe(foam.id);
  });
});

describe('recordShot', () => {
  it('adds the shot, the hit and the money and leaves the input alone', () => {
    const round = roundFor(makeState());
    const a = recordShot(round, result(true, 2.5));
    const b = recordShot(a, result(false, 2.5));
    const c = recordShot(b, result(true, 4));
    expect([a.shots, a.hits, a.money]).toEqual([1, 1, 2.5]);
    expect([b.shots, b.hits, b.money]).toEqual([2, 1, 2.5]);
    expect([c.shots, c.hits, c.money]).toEqual([3, 2, 6.5]);
    expect([round.shots, round.hits, round.money]).toEqual([0, 0, 0]);
    expect(c.nextFireAt).toBe(round.nextFireAt);
  });
});

describe('settleRound', () => {
  function played(state: GameState, shots: number, hits: number, money: number, overrides: Partial<RoundState> = {}): RoundState {
    return { ...roundFor(state), shots, hits, money, ...overrides };
  }

  it('refuses a finished round', () => {
    const state = makeState();
    const res = settleRound(state, balance, played(state, 3, 1, 5, { finished: true }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('invalid');
    expect(res.state).toBe(state);
    expect(res.events).toEqual([]);
  });

  it('updates every counter of the sport and emits roundEnded first, then newBest', () => {
    const state = makeStateWith('basketball', {
      money: 10,
      lifetimeMoney: 100,
      shotsFired: 40,
      hits: 12,
      roundsPlayed: 7,
      bestRound: 20,
      lastRoundMoney: 15,
    });
    const res = settleRound(state, balance, played(state, 9, 4, 33.5));
    expect(res.ok).toBe(true);
    const sport = res.state.sports.basketball;
    expect(sport.money).toBe(43.5);
    expect(sport.lifetimeMoney).toBe(133.5);
    expect(sport.shotsFired).toBe(49);
    expect(sport.hits).toBe(16);
    expect(sport.roundsPlayed).toBe(8);
    expect(sport.bestRound).toBe(33.5);
    expect(sport.lastRoundMoney).toBe(33.5);
    expect(res.state.ads.roundsSinceX2).toBe(1);
    expect(res.events).toEqual([
      { type: 'roundEnded', sport: 'basketball', money: 33.5, shots: 9, hits: 4, newBest: true },
      { type: 'newBest', sport: 'basketball', money: 33.5 },
    ]);
    // The input state is untouched.
    expect(state.sports.basketball.money).toBe(10);
    expect(state.ads.roundsSinceX2).toBe(0);
  });

  it('a round that only equals the best is not a new best', () => {
    const state = makeStateWith('basketball', { bestRound: 20 });
    const res = settleRound(state, balance, played(state, 5, 5, 20));
    expect(res.ok).toBe(true);
    expect(res.state.sports.basketball.bestRound).toBe(20);
    expect(res.events).toEqual([{ type: 'roundEnded', sport: 'basketball', money: 20, shots: 5, hits: 5, newBest: false }]);
  });

  it('settles the round\'s sport even when the state looks at another sport', () => {
    const state = { ...makeState(), currentSport: 'golf' as const };
    const round = { ...roundFor(makeState()), sport: 'basketball' as const, shots: 2, hits: 1, money: 3 };
    const res = settleRound(state, balance, round);
    expect(res.state.sports.basketball.money).toBe(3);
    expect(res.state.sports.golf.money).toBe(0);
    expect(res.state.currentSport).toBe('golf');
  });

  it('counts rounds since the last ×2 ad, and resets it after a doubled round', () => {
    const base = makeState({ ads: { roundsSinceX2: 2 } });
    const plain = settleRound(base, balance, played(base, 1, 0, 0));
    expect(plain.state.ads.roundsSinceX2).toBe(3);
    const doubled = settleRound(base, balance, played(base, 1, 0, 0, { doubled: true }));
    expect(doubled.state.ads.roundsSinceX2).toBe(0);
  });

  it('awards trophy milestones after the round and appends their events in order', () => {
    const first = balance.trophies.bestRoundFirstDecade;
    const state = makeStateWith('basketball', { ownedBalls: [foam.id, regulation.id] });
    const res = settleRound(state, balance, played(state, 50, 40, first * 10));
    expect(res.ok).toBe(true);
    expect(res.events.map((e) => e.type)).toEqual(['roundEnded', 'newBest', 'trophy', 'trophy', 'trophy']);
    const milestones = res.events.filter((e) => e.type === 'trophy').map((e) => (e.type === 'trophy' ? e.milestone : ''));
    expect(milestones).toEqual([`ball:${regulation.id}`, 'best:0', 'best:1']);
    expect(res.state.trophies).toBe(balance.trophies.perNewBall + 2 * balance.trophies.perBestRoundDecade);
    expect(res.state.sports.basketball.trophyMilestones).toEqual(milestones);
    // Settling again with a smaller round pays nothing new.
    const again = settleRound(res.state, balance, played(res.state, 1, 0, 0));
    expect(again.events.map((e) => e.type)).toEqual(['roundEnded']);
  });

  it('a ×2 round through shotInputFor and recordShot pays twice as much', () => {
    const state = makeState();
    const plainRound = roundFor(state);
    const doubledRound = roundFor(state, { doubled: true });
    const plainValue = shotInputFor(state, balance, plainRound, 0, 1, 0).valueIfHit;
    const doubledValue = shotInputFor(state, balance, doubledRound, 0, 1, 0).valueIfHit;
    const plain = settleRound(state, balance, recordShot(plainRound, result(true, plainValue)));
    const doubled = settleRound(state, balance, recordShot(doubledRound, result(true, doubledValue)));
    expect(doubled.state.sports.basketball.money).toBeCloseTo(plain.state.sports.basketball.money * balance.ads.x2RoundMult, 12);
    expect(plain.state.sports.basketball.money).toBe(foam.value);
  });

  it('round-trips the ball of a limb with an unknown id to the first ball', () => {
    const state = withLimbs(1, 'ghost');
    const input = shotInputFor(state, balance, roundFor(state), 0, 1, 0);
    expect(input.ballId).toBe(foam.id);
    expect(ballDefOf(balance, 'basketball', input.ballId)).toBe(foam);
  });
});
