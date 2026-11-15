import { parseBalance, type Balance } from '../balance';
import { incomePerRoundEstimate } from '../estimate';
import { balance, makeState, makeStateWith } from '../testing';
import type { GameState, SportState } from '../types';
import { shotsPerSec } from '../upgrades';

const [foam, regulation, medicine] = balance.sports.basketball.balls as [
  (typeof balance.sports.basketball.balls)[number],
  (typeof balance.sports.basketball.balls)[number],
  (typeof balance.sports.basketball.balls)[number],
];

function basketball(overrides: Partial<SportState> = {}): GameState {
  return makeStateWith('basketball', overrides);
}

function withLimbs(limbs: number, ballId = foam.id, overrides: Partial<SportState> = {}): GameState {
  return basketball({ limbs, limbBalls: new Array<string>(limbs).fill(ballId), ownedBalls: [foam.id, regulation.id, medicine.id], ...overrides });
}

/** The default balance with the hoop standing still, so a zero-spread shot always lands. */
function withStaticHoop(): Balance {
  const raw = JSON.parse(JSON.stringify(balance)) as Balance;
  raw.sports.basketball.target.motion.amplitude = 0;
  return parseBalance(raw);
}

describe('incomePerRoundEstimate', () => {
  it('is deterministic: same inputs, same number', () => {
    const state = basketball({ upgrades: { accuracy: 3, fireRate: 2, income: 1 } });
    const a = incomePerRoundEstimate(state, balance, 'basketball', null);
    const b = incomePerRoundEstimate(state, balance, 'basketball', null);
    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
    expect(incomePerRoundEstimate(state, balance, 'basketball', null, { seed: 7, samples: 24 })).toBe(a);
  });

  it('is a whole, non-negative number for every ball of every sport', () => {
    for (const sport of ['basketball', 'football', 'golf'] as const) {
      const state = { ...makeState(), currentSport: sport };
      for (const ball of balance.sports[sport].balls) {
        const n = incomePerRoundEstimate(state, balance, sport, ball.id);
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('a fresh basketball player scores something with the foam ball', () => {
    expect(incomePerRoundEstimate(makeState(), balance, 'basketball', null)).toBeGreaterThan(0);
  });

  it('a different seed may change the number, the default seed is 7', () => {
    const state = makeState();
    expect(incomePerRoundEstimate(state, balance, 'basketball', null, { seed: 7 })).toBe(incomePerRoundEstimate(state, balance, 'basketball', null));
  });

  it('increases with the income level', () => {
    const b = withStaticHoop();
    const at = (income: number) => incomePerRoundEstimate(basketball({ upgrades: { accuracy: 10, fireRate: 0, income } }), b, 'basketball', null);
    expect(at(5)).toBeGreaterThan(at(0));
    expect(at(20)).toBeGreaterThan(at(5));
  });

  it('scales exactly with the income multiplier when every sample hits', () => {
    const b = withStaticHoop();
    const perfect = (income: number) =>
      incomePerRoundEstimate(basketball({ upgrades: { accuracy: 1000, fireRate: 0, income } }), b, 'basketball', foam.id, { samples: 8 });
    const base = perfect(0);
    expect(base).toBe(Math.round(shotsPerSec(b, 0, foam) * b.roundSeconds * foam.value));
    expect(perfect(2)).toBe(Math.round(shotsPerSec(b, 0, foam) * b.roundSeconds * foam.value * (1 + 2 * b.upgrades.income.perLevel)));
  });

  it('a ball with huge penalties estimates lower than the foam ball at level 0', () => {
    const raw = JSON.parse(JSON.stringify(balance)) as Balance;
    raw.sports.basketball.balls.push({
      id: 'anvil',
      name: 'Anvil',
      cost: 1,
      value: 1,
      accuracyPenaltyDeg: 60,
      fireRateMult: 0.05,
      launchSpeed: 9.2,
      radiusMult: 1,
    });
    const b = parseBalance(raw);
    const state = makeState();
    const withFoam = incomePerRoundEstimate(state, b, 'basketball', foam.id);
    const withAnvil = incomePerRoundEstimate(state, b, 'basketball', 'anvil');
    expect(withFoam).toBeGreaterThan(0);
    expect(withAnvil).toBeLessThan(withFoam);
  });

  it('is zero when the ball id is unknown', () => {
    expect(incomePerRoundEstimate(makeState(), balance, 'basketball', 'no-such-ball')).toBe(0);
  });

  it('a ball id puts that ball on every limb, null keeps each limb\'s own ball', () => {
    const b = withStaticHoop();
    const upgrades = { accuracy: 1000, fireRate: 0, income: 0 };
    const mixed = withLimbs(2, foam.id, { limbBalls: [foam.id, medicine.id], upgrades });
    const bothFoam = withLimbs(2, foam.id, { upgrades });
    const bothMedicine = withLimbs(2, medicine.id, { upgrades });
    const own = incomePerRoundEstimate(mixed, b, 'basketball', null, { samples: 8 });
    const allFoam = incomePerRoundEstimate(mixed, b, 'basketball', foam.id, { samples: 8 });
    const allMedicine = incomePerRoundEstimate(mixed, b, 'basketball', medicine.id, { samples: 8 });
    // Naming a ball is the same as owning a state with that ball on every limb.
    expect(allFoam).toBe(incomePerRoundEstimate(bothFoam, b, 'basketball', null, { samples: 8 }));
    expect(allMedicine).toBe(incomePerRoundEstimate(bothMedicine, b, 'basketball', null, { samples: 8 }));
    // The foam ball has almost no spread at this accuracy and the hoop stands still, so both foam limbs hit every sample.
    const foamRound = shotsPerSec(b, 0, foam) * b.roundSeconds * foam.value;
    const medicineRound = shotsPerSec(b, 0, medicine) * b.roundSeconds * medicine.value;
    expect(allFoam).toBe(Math.round(2 * foamRound));
    // The medicine ball keeps its 7° penalty and clips the rim from an offset limb, so it misses some samples.
    expect(allMedicine).toBeLessThan(Math.round(2 * medicineRound));
    // The mixed state pays the foam limb in full plus whatever the medicine limb lands.
    expect(own).toBeGreaterThanOrEqual(Math.floor(foamRound));
    expect(own).toBeLessThanOrEqual(Math.round(foamRound + medicineRound));
    expect(own).not.toBe(allFoam);
    // The caller's state is not changed.
    expect(mixed.sports.basketball.limbBalls).toEqual([foam.id, medicine.id]);
  });

  it('grows with more limbs', () => {
    const b = withStaticHoop();
    const one = incomePerRoundEstimate(withLimbs(1, foam.id, { upgrades: { accuracy: 20, fireRate: 0, income: 0 } }), b, 'basketball', null);
    const four = incomePerRoundEstimate(withLimbs(4, foam.id, { upgrades: { accuracy: 20, fireRate: 0, income: 0 } }), b, 'basketball', null);
    expect(four).toBeGreaterThan(one);
  });

  it('includes the mastery bonus of other sports', () => {
    const b = withStaticHoop();
    const plain = basketball({ upgrades: { accuracy: 1000, fireRate: 0, income: 0 } });
    const mastered = { ...plain, sports: { ...plain.sports, golf: { ...plain.sports.golf, mastered: true } } };
    const a = incomePerRoundEstimate(plain, b, 'basketball', null, { samples: 8 });
    const m = incomePerRoundEstimate(mastered, b, 'basketball', null, { samples: 8 });
    expect(m).toBe(Math.round(shotsPerSec(b, 0, foam) * b.roundSeconds * foam.value * (1 + b.mastery.incomeBonusPerSport)));
    expect(m).toBeGreaterThan(a);
  });

  it('a sport without limbs estimates zero', () => {
    expect(incomePerRoundEstimate(basketball({ limbs: 0, limbBalls: [] }), balance, 'basketball', null)).toBe(0);
  });

  it('handles every sport with a fallback aim when the target is out of range', () => {
    const raw = JSON.parse(JSON.stringify(balance)) as Balance;
    for (const ball of raw.sports.golf.balls) ball.launchSpeed = 1;
    const b = parseBalance(raw);
    const state = { ...makeState(), currentSport: 'golf' as const };
    expect(() => incomePerRoundEstimate(state, b, 'golf', null)).not.toThrow();
    expect(incomePerRoundEstimate(state, b, 'golf', null)).toBe(0);
  });

  it('runs 8 limbs × 24 samples quickly', () => {
    const state = withLimbs(8);
    // Warm up the resolver once so the measurement is of the estimate, not of the JIT.
    incomePerRoundEstimate(state, balance, 'basketball', null);
    const start = performance.now();
    const n = incomePerRoundEstimate(state, balance, 'basketball', null);
    const ms = performance.now() - start;
    console.log(`incomePerRoundEstimate: 8 limbs × 24 samples in ${ms.toFixed(2)} ms (estimate ${n})`);
    expect(ms).toBeLessThan(200);
  });

  it('reports the fresh basketball estimate for each ball', () => {
    const state = makeState();
    const values = balance.sports.basketball.balls.map((ball) => [ball.id, incomePerRoundEstimate(state, balance, 'basketball', ball.id)] as const);
    console.log(`fresh basketball estimates per round: ${values.map(([id, v]) => `${id}=${v}`).join(', ')}`);
    for (const [, v] of values) expect(v).toBeGreaterThanOrEqual(0);
  });
});
