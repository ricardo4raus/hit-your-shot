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
import { ballDefOf, type Balance } from './balance';
import { currentSport, withSport } from './state';
import { fail, succeed, type ActionResult, type BallId, type GameState } from './types';

/** Buys a ball for the current sport. The limbs keep the balls they had. */
export function buyBall(state: GameState, balance: Balance, ballId: BallId): ActionResult {
  const sportId = state.currentSport;
  const sport = currentSport(state);
  const def = ballDefOf(balance, sportId, ballId);
  if (!def) return fail(state, 'unknown_id');
  if (sport.ownedBalls.includes(ballId)) return fail(state, 'already_owned');
  if (def.cost > sport.money) return fail(state, 'not_enough_money');

  const next = { ...sport, money: sport.money - def.cost, ownedBalls: [...sport.ownedBalls, ballId] };
  return succeed(withSport(state, sportId, next), [{ type: 'ballBought', sport: sportId, id: ballId }]);
}

/** Puts an owned ball on one limb of the current sport. */
export function assignLimbBall(state: GameState, balance: Balance, limb: number, ballId: BallId): ActionResult {
  const sportId = state.currentSport;
  const sport = currentSport(state);
  if (!ballDefOf(balance, sportId, ballId)) return fail(state, 'unknown_id');
  if (!Number.isInteger(limb) || limb < 0 || limb >= sport.limbs) return fail(state, 'invalid');
  if (!sport.ownedBalls.includes(ballId)) return fail(state, 'not_owned');

  const limbBalls = sport.limbBalls.slice();
  limbBalls[limb] = ballId;
  return succeed(withSport(state, sportId, { ...sport, limbBalls }));
}

/** Puts an owned ball on every limb of the current sport. */
export function assignAllLimbs(state: GameState, balance: Balance, ballId: BallId): ActionResult {
  const sportId = state.currentSport;
  const sport = currentSport(state);
  if (!ballDefOf(balance, sportId, ballId)) return fail(state, 'unknown_id');
  if (!sport.ownedBalls.includes(ballId)) return fail(state, 'not_owned');

  const limbBalls = sport.limbBalls.map(() => ballId);
  return succeed(withSport(state, sportId, { ...sport, limbBalls }));
}
