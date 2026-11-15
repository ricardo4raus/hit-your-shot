import { CURRENT_SAVE_VERSION, deserialize, GameStateSchema, migrations, serialize, type SaveFile } from '../save';
import { balance, makeState, makeStateWith, T0 } from '../testing';
import type { GameState } from '../types';

const NOW = T0 + 1234;

/** A played-in state with every kind of field set to something other than its default. */
function richState(): GameState {
  return makeStateWith(
    'basketball',
    {
      money: 1234.5,
      upgrades: { accuracy: 3, fireRate: 5, income: 2 },
      ownedBalls: ['foam', 'regulation'],
      limbs: 2,
      limbBalls: ['regulation', 'foam'],
      bestRound: 220,
      lastRoundMoney: 180,
      roundsPlayed: 42,
      lifetimeMoney: 9876,
      shotsFired: 1500,
      hits: 400,
      trophyMilestones: ['accuracy_tier_1', 'ball_regulation'],
      mastered: false,
    },
    {
      lastSeenAt: T0 + 1000,
      clockHighWater: T0 + 2000,
      trophies: 3,
      offline: { pendingDouble: 12, lastSeconds: 600 },
      ads: { roundsSinceX2: 2 },
      removeAds: true,
      settings: { sound: false, haptics: true },
      rngState: 987654321,
    },
  );
}

/** Serializes a state and patches the parsed file before stringifying it again. */
function savedWith(patch: (file: SaveFile) => void, state: GameState = richState()): string {
  const file = JSON.parse(serialize(state, NOW)) as SaveFile;
  patch(file);
  return JSON.stringify(file);
}

describe('serialize', () => {
  it('writes the version, the time and the state', () => {
    const state = richState();
    const file = JSON.parse(serialize(state, NOW)) as SaveFile;
    expect(file.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(file.savedAt).toBe(NOW);
    expect(file.state).toEqual(state);
  });

  it('does not mutate the state', () => {
    const state = richState();
    const snapshot = JSON.stringify(state);
    serialize(state, NOW);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('deserialize round trip', () => {
  it('returns an equal copy of a fresh game', () => {
    const state = makeState();
    const loaded = deserialize(serialize(state, NOW), balance);
    expect(loaded).toEqual(state);
    expect(loaded).not.toBe(state);
  });

  it('returns an equal copy of a played-in game', () => {
    const state = richState();
    expect(deserialize(serialize(state, NOW), balance)).toEqual(state);
  });

  it('strips unknown fields at every level', () => {
    const raw = savedWith((file) => {
      const loose = file as unknown as Record<string, unknown>;
      loose.extra = 'ignored';
      (file.state as unknown as Record<string, unknown>).legacy = 1;
      (file.state.sports.golf as unknown as Record<string, unknown>).notes = [];
      (file.state.settings as unknown as Record<string, unknown>).music = true;
    });
    expect(deserialize(raw, balance)).toEqual(richState());
  });
});

describe('deserialize rejects', () => {
  it('garbage', () => {
    for (const raw of ['', 'not json', '{', 'null', '42', '"text"', '[]', '{}', '{"saveVersion":1}', '{"saveVersion":1,"savedAt":0,"state":{}}']) {
      expect(deserialize(raw, balance)).toBeNull();
    }
  });

  it('a future version', () => {
    expect(deserialize(savedWith((f) => void (f.saveVersion = CURRENT_SAVE_VERSION + 1)), balance)).toBeNull();
  });

  it('a version that is not a whole number', () => {
    expect(deserialize(savedWith((f) => void (f.saveVersion = 1.5)), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void ((f as unknown as Record<string, unknown>).saveVersion = '1')), balance)).toBeNull();
  });

  it('an old version without a migration', () => {
    expect(migrations[0]).toBeUndefined();
    expect(deserialize(savedWith((f) => void (f.saveVersion = 0)), balance)).toBeNull();
  });

  it('a missing field', () => {
    expect(deserialize(savedWith((f) => void delete (f.state as Partial<GameState>).trophies), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void delete (f.state.sports as Partial<GameState['sports']>).golf), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void delete (f.state.sports.basketball.upgrades as Partial<Record<string, number>>).income), balance)).toBeNull();
  });

  it('a wrong type or an unknown enum value', () => {
    expect(deserialize(savedWith((f) => void ((f.state as unknown as Record<string, unknown>).removeAds = 'yes')), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void ((f.state as unknown as Record<string, unknown>).currentSport = 'tennis')), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void ((f.state.sports.basketball as unknown as Record<string, unknown>).ownedBalls = 'foam')), balance)).toBeNull();
  });

  it('non-finite numbers', () => {
    // JSON.stringify turns NaN and Infinity into null; a literal 1e999 parses to Infinity.
    expect(deserialize(savedWith((f) => void (f.state.sports.basketball.money = Number.NaN)), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void (f.state.trophies = Number.POSITIVE_INFINITY)), balance)).toBeNull();
    const infinite = serialize(richState(), NOW).replace('"lifetimeMoney":9876', '"lifetimeMoney":1e999');
    expect(infinite).toContain('1e999');
    expect(deserialize(infinite, balance)).toBeNull();
  });

  it('negative money, trophies or counters', () => {
    expect(deserialize(savedWith((f) => void (f.state.sports.basketball.money = -1)), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void (f.state.trophies = -1)), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void (f.state.sports.football.hits = -1)), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void (f.state.offline.pendingDouble = -5)), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void (f.state.rngState = -1)), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void (f.state.rngState = 2 ** 32)), balance)).toBeNull();
  });

  it('fractional levels and counters', () => {
    expect(deserialize(savedWith((f) => void (f.state.sports.basketball.upgrades.accuracy = 1.5)), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void (f.state.sports.basketball.roundsPlayed = 0.5)), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void (f.state.sports.basketball.limbs = 1.5)), balance)).toBeNull();
  });

  it('an unknown ball id', () => {
    expect(deserialize(savedWith((f) => void f.state.sports.basketball.ownedBalls.push('cannonball')), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void (f.state.sports.basketball.limbBalls[0] = 'cannonball')), balance)).toBeNull();
    // A ball from another sport is unknown in this one.
    expect(deserialize(savedWith((f) => void (f.state.sports.basketball.limbBalls[1] = 'match')), balance)).toBeNull();
  });

  it('a limb count that does not match limbBalls', () => {
    expect(deserialize(savedWith((f) => void (f.state.sports.basketball.limbs = 3)), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void f.state.sports.basketball.limbBalls.push('foam')), balance)).toBeNull();
  });

  it('fewer than one limb', () => {
    expect(deserialize(savedWith((f) => void ((f.state.sports.golf.limbs = 0), (f.state.sports.golf.limbBalls = []))), balance)).toBeNull();
  });

  it('upgrade levels above maxLevel', () => {
    expect(deserialize(savedWith((f) => void (f.state.sports.basketball.upgrades.income = balance.upgrades.maxLevel + 1)), balance)).toBeNull();
    expect(deserialize(savedWith((f) => void (f.state.sports.basketball.upgrades.income = balance.upgrades.maxLevel)), balance)).not.toBeNull();
  });

  it('never throws, whatever the input', () => {
    const inputs = [undefined, null, 5, {}, [], Symbol('x'), () => 1] as unknown as string[];
    for (const raw of inputs) expect(() => deserialize(raw, balance)).not.toThrow();
  });
});

describe('migrations', () => {
  afterEach(() => {
    delete migrations[0];
  });

  it('are applied in order and the result is validated', () => {
    migrations[0] = (old) => {
      const file = old as SaveFile;
      return { ...file, state: { ...file.state, trophies: file.state.trophies + 1 } };
    };
    const loaded = deserialize(savedWith((f) => void (f.saveVersion = 0)), balance);
    expect(loaded).not.toBeNull();
    expect(loaded?.trophies).toBe(richState().trophies + 1);
  });

  it('discard the save when they return nothing usable', () => {
    migrations[0] = () => null;
    expect(deserialize(savedWith((f) => void (f.saveVersion = 0)), balance)).toBeNull();
  });

  it('cannot smuggle an invalid state past validation', () => {
    migrations[0] = (old) => {
      const file = old as SaveFile;
      return { ...file, state: { ...file.state, trophies: -1 } };
    };
    expect(deserialize(savedWith((f) => void (f.saveVersion = 0)), balance)).toBeNull();
  });
});

describe('GameStateSchema', () => {
  it('accepts a fresh and a played-in state', () => {
    expect(GameStateSchema.safeParse(makeState()).success).toBe(true);
    expect(GameStateSchema.safeParse(richState()).success).toBe(true);
  });

  it('rejects an extra sport key', () => {
    const state = richState();
    const sports = { ...state.sports, tennis: state.sports.golf };
    expect(GameStateSchema.safeParse({ ...state, sports }).success).toBe(false);
  });
});
