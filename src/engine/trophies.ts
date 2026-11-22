/**
 * MODULE: trophies. Owner: agent "economy". docs/game-design.md "Sports" (Trophies, mastery bonus), docs/open-decisions.md items 3 and 5.
 * Trophies are a small global currency earned at milestones in every sport. They buy sports and nothing else.
 *
 * Rules:
 * - Milestone ids (strings, stored in sport.trophyMilestones once paid):
 *     "upgrade:<id>:<tier>"  every balance.trophies.upgradeTierEvery levels of a card (tier = level / upgradeTierEvery, from 1) → perUpgradeTier
 *     "ball:<ballId>"        each owned ball except the first in the list → perNewBall
 *     "best:<decade>"        bestRound >= bestRoundFirstDecade × 10^(decade) for decade 0, 1, 2, ... → perBestRoundDecade
 * - dueMilestones(sport, balance): all milestones the sport's numbers justify that are not yet in trophyMilestones, in a stable order
 *   (upgrades by UPGRADE_IDS then tier, balls in balance order, best by decade).
 * - awardMilestones(state, balance, sportId): pays every due milestone: trophies += amount, append ids, one `trophy` event per milestone.
 *   Returns { state, events }. Called by round.ts at settle and by the store after purchases.
 * - masteryBonus(state, balance): 1 + incomeBonusPerSport × (number of mastered sports). Applies in every sport.
 * - unlockSport(state, balance, sportId): 'already_owned' if unlocked, 'not_enough_trophies' if trophies < unlockTrophies. Subtract,
 *   set unlocked, event sportUnlocked. Does not switch the current sport.
 * - selectSport(state, sportId): 'locked' if not unlocked; sets currentSport. The income boost is global and keeps running.
 * - Tests (src/engine/__tests__/trophies.test.ts): each milestone kind pays once, order stable, mastery bonus counts sports, unlock and select.
 *
 * May import only: ./types, ./balance, ./state.
 */
import type { Balance } from './balance';
import { withSport } from './state';
import { fail, SPORT_IDS, succeed, UPGRADE_IDS, type ActionResult, type GameEvent, type GameState, type SportId, type SportState } from './types';

export interface Milestone {
  id: string;
  amount: number;
}

/** A decade is a factor of ten by definition. The tunable threshold is balance.trophies.bestRoundFirstDecade. */
const DECADE = 10;

/**
 * Every milestone the sport has earned but not yet been paid for.
 * A SportState does not carry its sport id, so the ball milestones scan every sport's ball list in balance order and pay for any owned
 * ball that is not the first of its list. Ball ids are unique across sports, so a ball is never matched twice.
 */
export function dueMilestones(sport: SportState, balance: Balance): Milestone[] {
  const t = balance.trophies;
  const paid = new Set(sport.trophyMilestones);
  const due: Milestone[] = [];
  const add = (id: string, amount: number) => {
    if (!paid.has(id)) due.push({ id, amount });
  };

  for (const id of UPGRADE_IDS) {
    const tiers = Math.floor(sport.upgrades[id] / t.upgradeTierEvery);
    for (let tier = 1; tier <= tiers; tier++) add(`upgrade:${id}:${tier}`, t.perUpgradeTier);
  }

  for (const sportId of SPORT_IDS) {
    const balls = balance.sports[sportId].balls;
    for (let i = 1; i < balls.length; i++) {
      const ballId = balls[i]?.id;
      if (ballId !== undefined && sport.ownedBalls.includes(ballId)) add(`ball:${ballId}`, t.perNewBall);
    }
  }

  if (sport.bestRound > 0) {
    let threshold = t.bestRoundFirstDecade;
    for (let decade = 0; sport.bestRound >= threshold; decade++) {
      add(`best:${decade}`, t.perBestRoundDecade);
      threshold *= DECADE;
    }
  }

  return due;
}

/** Pays every due milestone of one sport. */
export function awardMilestones(state: GameState, balance: Balance, sportId: SportId): { state: GameState; events: GameEvent[] } {
  const sport = state.sports[sportId];
  const due = dueMilestones(sport, balance);
  if (due.length === 0) return { state, events: [] };

  const total = due.reduce((sum, m) => sum + m.amount, 0);
  const next: SportState = { ...sport, trophyMilestones: [...sport.trophyMilestones, ...due.map((m) => m.id)] };
  const events: GameEvent[] = due.map((m) => ({ type: 'trophy', amount: m.amount, milestone: m.id }));
  return { state: { ...withSport(state, sportId, next), trophies: state.trophies + total }, events };
}

/** Income multiplier from mastered sports; applies everywhere. */
export function masteryBonus(state: GameState, balance: Balance): number {
  const mastered = SPORT_IDS.filter((id) => state.sports[id].mastered).length;
  return 1 + balance.mastery.incomeBonusPerSport * mastered;
}

/** Spends Trophies on a sport. The player stays in the current sport. */
export function unlockSport(state: GameState, balance: Balance, sportId: SportId): ActionResult {
  const sport = state.sports[sportId];
  if (sport.unlocked) return fail(state, 'already_owned');
  const price = balance.sports[sportId].unlockTrophies;
  if (state.trophies < price) return fail(state, 'not_enough_trophies');

  const next = withSport(state, sportId, { ...sport, unlocked: true });
  return succeed({ ...next, trophies: state.trophies - price }, [{ type: 'sportUnlocked', sport: sportId }]);
}

/** Switches to an unlocked sport. The income boost is global and keeps running. */
export function selectSport(state: GameState, balance: Balance, sportId: SportId): ActionResult {
  if (!state.sports[sportId].unlocked) return fail(state, 'locked');
  return succeed({ ...state, currentSport: sportId });
}
