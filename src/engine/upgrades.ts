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
import type { ActionResult, GameState, SportState, UpgradeId } from './types';

export function upgradeCost(_balance: Balance, _id: UpgradeId, _level: number): number {
  throw new Error('not implemented');
}

export function spreadDeg(_balance: Balance, _accuracyLevel: number, _ball: BallDef): number {
  throw new Error('not implemented');
}

export function shotsPerSec(_balance: Balance, _fireRateLevel: number, _ball: BallDef): number {
  throw new Error('not implemented');
}

export function incomeMult(_balance: Balance, _incomeLevel: number): number {
  throw new Error('not implemented');
}

export function isMastered(_balance: Balance, _sport: SportState): boolean {
  throw new Error('not implemented');
}

export function buyUpgrade(_state: GameState, _balance: Balance, _id: UpgradeId): ActionResult {
  throw new Error('not implemented');
}
