/**
 * MODULE: characters. Owner: agent "economy". docs/game-design.md "Characters (multi-limb)".
 * The next character always has one more limb than the current one. No cap except balance.characters.softCapLimbs (a performance guard).
 *
 * Rules:
 * - characterCost(balance, limbs): price of the character WITH `limbs` limbs, for limbs >= 2: baseCost × costGrowth^(limbs − 2), rounded.
 *   limbs <= 1 → 0 (the starting character is free).
 * - characterName(balance, limbs): names[(limbs − 1) % names.length]; after one pass through the list, append a roman numeral of the
 *   pass ("Doug II"). Never mention limbs in the name.
 * - buyCharacter(state, balance): on the current sport; buys limbs + 1. 'not_available' when limbs >= softCapLimbs, 'not_enough_money'.
 *   The new limb gets the ball of limb 0. Event characterBought with the new limb count.
 * - Tests (src/engine/__tests__/characters.test.ts): costs, names cycle with numerals, buy adds one limb and copies the ball, soft cap.
 *
 * May import only: ./types, ./balance, ./state.
 */
import type { Balance } from './balance';
import { currentSport, withSport } from './state';
import { fail, succeed, type ActionResult, type GameState } from './types';

/** Price of the character that has `limbs` limbs. The one-limb starting character is free. */
export function characterCost(balance: Balance, limbs: number): number {
  if (limbs <= 1) return 0;
  const { baseCost, costGrowth } = balance.characters;
  return Math.round(baseCost * Math.pow(costGrowth, limbs - 2));
}

/** Roman numeral notation in its standard subtractive form (IV, IX, XL, ...). Notation, not a game number. */
const ROMAN: ReadonlyArray<readonly [number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

function romanNumeral(n: number): string {
  let rest = n;
  let out = '';
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

/** Name of the character with `limbs` limbs. The list cycles; the second pass is "Doug II", the third "Doug III", and so on. */
export function characterName(balance: Balance, limbs: number): string {
  const names = balance.characters.names;
  const index = Math.max(0, limbs - 1);
  const name = names[index % names.length] ?? names[0] ?? '';
  const pass = Math.floor(index / names.length);
  return pass === 0 ? name : `${name} ${romanNumeral(pass + 1)}`;
}

/** Buys the next character of the current sport: one more limb, holding the same ball as limb 0. */
export function buyCharacter(state: GameState, balance: Balance): ActionResult {
  const sportId = state.currentSport;
  const sport = currentSport(state);
  if (sport.limbs >= balance.characters.softCapLimbs) return fail(state, 'not_available');
  const limbs = sport.limbs + 1;
  const cost = characterCost(balance, limbs);
  if (cost > sport.money) return fail(state, 'not_enough_money');

  const firstBall = sport.limbBalls[0] ?? sport.ownedBalls[0] ?? '';
  const next = { ...sport, money: sport.money - cost, limbs, limbBalls: [...sport.limbBalls, firstBall] };
  return succeed(withSport(state, sportId, next), [{ type: 'characterBought', sport: sportId, limbs }]);
}
