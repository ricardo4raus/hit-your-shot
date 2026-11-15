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
import type { ActionResult, GameState } from './types';

export function characterCost(_balance: Balance, _limbs: number): number {
  throw new Error('not implemented');
}

export function characterName(_balance: Balance, _limbs: number): string {
  throw new Error('not implemented');
}

export function buyCharacter(_state: GameState, _balance: Balance): ActionResult {
  throw new Error('not implemented');
}
