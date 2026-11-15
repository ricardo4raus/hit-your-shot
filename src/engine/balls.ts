/**
 * MODULE: balls. Owner: agent "economy". docs/game-design.md "Ball types".
 * Buying balls and putting them on limbs.
 *
 * Rules:
 * - On the current sport. Ball ids must exist in balance.sports[sport].balls ('unknown_id' otherwise).
 * - buyBall: 'already_owned' if owned, 'not_enough_money' if cost > money. Subtract, add to ownedBalls, event ballBought.
 *   Buying does NOT change limb assignment (the player chooses; the UI offers "use on all limbs").
 * - assignLimbBall(state, balance, limb, ballId): limb index 0..limbs−1 ('invalid' otherwise), ball must be owned ('not_owned').
 * - assignAllLimbs(state, balance, ballId): same for every limb.
 * - Tests (src/engine/__tests__/balls.test.ts): buy, double buy, assign unowned, assign out of range, assign all.
 *
 * May import only: ./types, ./balance, ./state.
 */
import type { Balance } from './balance';
import type { ActionResult, BallId, GameState } from './types';

export function buyBall(_state: GameState, _balance: Balance, _ballId: BallId): ActionResult {
  throw new Error('not implemented');
}

export function assignLimbBall(_state: GameState, _balance: Balance, _limb: number, _ballId: BallId): ActionResult {
  throw new Error('not implemented');
}

export function assignAllLimbs(_state: GameState, _balance: Balance, _ballId: BallId): ActionResult {
  throw new Error('not implemented');
}
