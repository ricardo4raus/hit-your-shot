/**
 * MODULE: upgrades. Owner: agent "economy". docs/game-design.md "Upgrades", docs/architecture.md "Economy".
 * Costs and effects of the three cards, buying a level, mastery.
 *
 * Rules:
 * - All numbers from balance.upgrades. Levels are 0-based; `maxLevel` levels can be bought (level reaches maxLevel).
 * - upgradeCost(balance, id, level) = baseCost × costGrowth^level, rounded to a whole number (Math.round). Cost of the NEXT level given the current one.
 * - spreadDeg(balance, accuracyLevel, ball) = max(minSpreadDeg, baseSpreadDeg × spreadDecay^level) + ball.accuracyPenaltyDeg.
 * - shotsPerSec(balance, fireRateLevel, ball) = baseShotsPerSec × (1 + perLevel × level) × ball.fireRateMult.
 * - incomeMult(balance, incomeLevel) = 1 + perLevel × level.
 * - buyUpgrade(state, balance, id): on the current sport. Errors: 'max_level', 'not_enough_money'. Money is subtracted, level + 1,
 *   event upgradeBought. When all three cards reach maxLevel and `mastered` was false: set mastered = true and add event mastered.
 *   Trophy milestones are NOT awarded here; round.ts calls trophies.awardMilestones after each round, and the store calls it after a
 *   purchase (so put the milestone logic in trophies.ts, not here).
 * - isMastered(balance, sport) = every upgrade level >= maxLevel.
 * - Tests (src/engine/__tests__/upgrades.test.ts): cost table for the first levels, effects monotonic in level, buy fails without money,
 *   buy fails at max, mastery fires once.
 *
 * May import only: ./types, ./balance, ./state.
 */
import type { Balance, BallDef } from './balance';
import { currentSport, withSport } from './state';
import { fail, succeed, UPGRADE_IDS, type ActionResult, type GameEvent, type GameState, type SportState, type UpgradeId } from './types';

/** Price of the next level of a card when the player currently holds `level`. */
export function upgradeCost(balance: Balance, id: UpgradeId, level: number): number {
  const card = balance.upgrades[id];
  return Math.round(card.baseCost * Math.pow(card.costGrowth, level));
}

/** Total spread of the aiming cone in degrees: the accuracy card narrows it, the ball widens it. */
export function spreadDeg(balance: Balance, accuracyLevel: number, ball: BallDef): number {
  const card = balance.upgrades.accuracy;
  const fromUpgrade = Math.max(card.minSpreadDeg, card.baseSpreadDeg * Math.pow(card.spreadDecay, accuracyLevel));
  return fromUpgrade + ball.accuracyPenaltyDeg;
}

/** Shots per second of one limb: the fire-rate card speeds it up, heavier balls slow it down. */
export function shotsPerSec(balance: Balance, fireRateLevel: number, ball: BallDef): number {
  const card = balance.upgrades.fireRate;
  return card.baseShotsPerSec * (1 + card.perLevel * fireRateLevel) * ball.fireRateMult;
}

/** Income multiplier of the income card. */
export function incomeMult(balance: Balance, incomeLevel: number): number {
  return 1 + balance.upgrades.income.perLevel * incomeLevel;
}

/** True when every card of the sport is at max level. */
export function isMastered(balance: Balance, sport: SportState): boolean {
  const max = balance.upgrades.maxLevel;
  return UPGRADE_IDS.every((id) => sport.upgrades[id] >= max);
}

/** Buys one level of a card in the current sport. */
export function buyUpgrade(state: GameState, balance: Balance, id: UpgradeId): ActionResult {
  const sportId = state.currentSport;
  const sport = currentSport(state);
  const level = sport.upgrades[id];
  if (level >= balance.upgrades.maxLevel) return fail(state, 'max_level');
  const cost = upgradeCost(balance, id, level);
  if (cost > sport.money) return fail(state, 'not_enough_money');

  const next: SportState = {
    ...sport,
    money: sport.money - cost,
    upgrades: { ...sport.upgrades, [id]: level + 1 },
  };
  const events: GameEvent[] = [{ type: 'upgradeBought', sport: sportId, id, level: level + 1 }];
  if (!sport.mastered && isMastered(balance, next)) {
    next.mastered = true;
    events.push({ type: 'mastered', sport: sportId });
  }
  return succeed(withSport(state, sportId, next), events);
}
