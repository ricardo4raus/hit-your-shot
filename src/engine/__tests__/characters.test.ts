import { buyCharacter, characterCost, characterName } from '../characters';
import { balance, makeState, makeStateWith } from '../testing';

const names = balance.characters.names;
const { baseCost, costGrowth, softCapLimbs } = balance.characters;

describe('characterCost', () => {
  it('is free for the starting character and anything below it', () => {
    expect(characterCost(balance, 1)).toBe(0);
    expect(characterCost(balance, 0)).toBe(0);
  });

  it('follows base × growth^(limbs − 2), rounded', () => {
    for (let limbs = 2; limbs <= 8; limbs++) {
      expect(characterCost(balance, limbs)).toBe(Math.round(baseCost * Math.pow(costGrowth, limbs - 2)));
    }
    expect(characterCost(balance, 2)).toBe(baseCost);
  });

  it('matches the current balance table for the first four paid characters', () => {
    expect([2, 3, 4, 5].map((n) => characterCost(balance, n))).toEqual([600, 1560, 4056, 10546]);
  });
});

describe('characterName', () => {
  it('uses the list in order for the first pass', () => {
    for (let limbs = 1; limbs <= names.length; limbs++) {
      expect(characterName(balance, limbs)).toBe(names[limbs - 1]);
    }
  });

  it('cycles with roman numerals after the first pass', () => {
    expect(characterName(balance, names.length + 1)).toBe(`${names[0]} II`);
    expect(characterName(balance, names.length * 2)).toBe(`${names[names.length - 1]} II`);
    expect(characterName(balance, names.length * 2 + 1)).toBe(`${names[0]} III`);
    expect(characterName(balance, names.length * 3 + 2)).toBe(`${names[1]} IV`);
    expect(characterName(balance, names.length * 8 + 1)).toBe(`${names[0]} IX`);
  });

  it('never mentions limbs or a number in the first pass', () => {
    for (let limbs = 1; limbs <= names.length; limbs++) {
      expect(characterName(balance, limbs)).not.toMatch(/\d|limb|arm|foot|feet/i);
    }
  });
});

describe('buyCharacter', () => {
  it('adds one limb, copies the ball of limb 0 and subtracts the cost', () => {
    const [foam, regulation] = balance.sports.basketball.balls.map((b) => b.id) as [string, string];
    const cost = characterCost(balance, 2);
    const state = makeStateWith('basketball', { money: cost + 1, ownedBalls: [foam, regulation], limbBalls: [regulation] });
    const result = buyCharacter(state, balance);
    expect(result.ok).toBe(true);
    expect(result.state.sports.basketball.limbs).toBe(2);
    expect(result.state.sports.basketball.limbBalls).toEqual([regulation, regulation]);
    expect(result.state.sports.basketball.money).toBe(1);
    expect(result.events).toEqual([{ type: 'characterBought', sport: 'basketball', limbs: 2 }]);
    expect(state.sports.basketball.limbs).toBe(1);
    expect(state.sports.basketball.limbBalls).toEqual([regulation]);
  });

  it('charges the price of the character with limbs + 1 limbs', () => {
    const cost = characterCost(balance, 4);
    const foam = balance.sports.basketball.balls[0]!.id;
    const state = makeStateWith('basketball', { money: cost, limbs: 3, limbBalls: [foam, foam, foam] });
    const result = buyCharacter(state, balance);
    expect(result.ok).toBe(true);
    expect(result.state.sports.basketball.money).toBe(0);
    expect(result.state.sports.basketball.limbs).toBe(4);
    expect(result.state.sports.basketball.limbBalls).toHaveLength(4);
  });

  it('fails without money', () => {
    const result = buyCharacter(makeState(), balance);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_enough_money');
    expect(result.state.sports.basketball.limbs).toBe(1);
  });

  it('stops at the soft cap', () => {
    const foam = balance.sports.basketball.balls[0]!.id;
    const limbBalls = Array.from({ length: softCapLimbs }, () => foam);
    const state = makeStateWith('basketball', { money: Number.MAX_SAFE_INTEGER, limbs: softCapLimbs, limbBalls });
    const result = buyCharacter(state, balance);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_available');

    const below = makeStateWith('basketball', { money: characterCost(balance, softCapLimbs), limbs: softCapLimbs - 1, limbBalls: limbBalls.slice(1) });
    const last = buyCharacter(below, balance);
    expect(last.ok).toBe(true);
    expect(last.state.sports.basketball.limbs).toBe(softCapLimbs);
    expect(last.state.sports.basketball.money).toBe(0);
  });

  it('is per sport', () => {
    const state = makeStateWith('football', { money: characterCost(balance, 2), unlocked: true });
    const result = buyCharacter(state, balance);
    expect(result.ok).toBe(true);
    expect(result.state.sports.football.limbs).toBe(2);
    expect(result.state.sports.basketball.limbs).toBe(1);
  });
});
