/**
 * CONTRACT FILE. Owned by the lead.
 * Initial state. The first sport is unlocked and starts with its first ball on its single limb.
 */
import type { Balance } from './balance';
import { SPORT_IDS, type GameState, type SportId, type SportState } from './types';

export function createSportState(balance: Balance, sport: SportId): SportState {
  const def = balance.sports[sport];
  const firstBall = def.balls[0]?.id ?? '';
  return {
    unlocked: def.unlockTrophies === 0,
    money: 0,
    upgrades: { accuracy: 0, fireRate: 0, income: 0 },
    ownedBalls: firstBall ? [firstBall] : [],
    limbs: 1,
    limbBalls: firstBall ? [firstBall] : [],
    bestRound: 0,
    lastRoundMoney: 0,
    roundsPlayed: 0,
    lifetimeMoney: 0,
    shotsFired: 0,
    hits: 0,
    trophyMilestones: [],
    mastered: false,
  };
}

export function createInitialState(balance: Balance, now: number, seed = (now >>> 0) ^ 0x9e3779b9): GameState {
  const sports = {} as Record<SportId, SportState>;
  for (const id of SPORT_IDS) sports[id] = createSportState(balance, id);
  return {
    createdAt: now,
    lastSeenAt: now,
    clockHighWater: now,
    currentSport: 'basketball',
    sports,
    trophies: 0,
    offline: { pendingDouble: 0, lastSeconds: 0 },
    ads: { roundsSinceX2: 0 },
    removeAds: false,
    settings: { sound: true, haptics: true },
    rngState: seed >>> 0,
  };
}

/** The sport the player is looking at. */
export function currentSport(state: GameState): SportState {
  return state.sports[state.currentSport];
}

/** Returns a new state with one sport replaced. */
export function withSport(state: GameState, sport: SportId, next: SportState): GameState {
  return { ...state, sports: { ...state.sports, [sport]: next } };
}
