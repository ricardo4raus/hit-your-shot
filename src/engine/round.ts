/**
 * MODULE: round. Owner: agent "round". docs/architecture.md "The round, live".
 * The live round: when each limb fires, what each shot is, what the round pays.
 *
 * Rules:
 * - createRound(state, balance, now, rng): sport = state.currentSport, seconds = balance.roundSeconds, targetPhase = rng() × 2π,
 *   nextFireAt[i] = i × stagger where stagger = (1 / rate_i) / limbs (limbs fire interleaved, not in a burst), shots/hits/money 0,
 *   doubled false, finished false.
 * - limbRates(state, balance, sportId): shots per second per limb = upgrades.shotsPerSec(fireRate level, the limb's ball).
 * - dueShots(round, state, balance, t): returns the limb indexes that should fire at round time t (nextFireAt[i] <= t), oldest first,
 *   at most balance.physics.maxShotsPerTick in one call, and the round with nextFireAt advanced by 1 / rate for each returned limb
 *   (a limb that is far behind may appear several times in the list, once per missed interval, still within the cap). Never fires at
 *   t >= round.seconds. Never fires when round.finished.
 * - shotInputFor(state, balance, round, limb, aim, t): ShotInput with spreadDeg from upgrades.spreadDeg, offset from limbs.muzzleOffsets,
 *   valueIfHit from hitValue.
 * - hitValue(state, balance, sportId, ball, doubled) = ball.value × upgrades.incomeMult(income level) × trophies.masteryBonus(state)
 *   × (doubled ? balance.ads.x2RoundMult : 1). Not rounded; money is rounded only for display.
 * - recordShot(round, result): shots + 1, hits + (hit ? 1 : 0), money + result.value. Returns a new round.
 * - settleRound(state, balance, round): round must not be finished ('invalid' otherwise). Sport money += round.money,
 *   lastRoundMoney = round.money, roundsPlayed + 1, lifetimeMoney, shotsFired, hits, bestRound (newBest when round.money > bestRound,
 *   strictly). ads.roundsSinceX2 + 1 unless round.doubled (then 0). Then trophies.awardMilestones for the sport. Events: roundEnded
 *   (always, first), newBest (if so), then the trophy events.
 * - Tests (src/engine/__tests__/round.test.ts): interleaved first fire times, due shots respect the cap and never go past the end,
 *   shot input carries the right spread, offset and value, settle updates every counter and emits in order, ×2 doubles value.
 *
 * May import: ./types, ./balance, ./state, ./rng, ./ballistics (targetPose only), ./limbs, ./upgrades, ./trophies.
 */
import type { Balance, BallDef } from './balance';
import type { ActionResult, GameState, Rng, RoundState, ShotInput, ShotResult, SportId } from './types';

export function createRound(_state: GameState, _balance: Balance, _now: number, _rng: Rng): RoundState {
  throw new Error('not implemented');
}

export function limbRates(_state: GameState, _balance: Balance, _sportId: SportId): number[] {
  throw new Error('not implemented');
}

export function dueShots(_round: RoundState, _state: GameState, _balance: Balance, _t: number): { round: RoundState; limbs: number[] } {
  throw new Error('not implemented');
}

export function hitValue(_state: GameState, _balance: Balance, _sportId: SportId, _ball: BallDef, _doubled: boolean): number {
  throw new Error('not implemented');
}

export function shotInputFor(_state: GameState, _balance: Balance, _round: RoundState, _limb: number, _aim: number, _t: number): ShotInput {
  throw new Error('not implemented');
}

export function recordShot(_round: RoundState, _result: ShotResult): RoundState {
  throw new Error('not implemented');
}

export function settleRound(_state: GameState, _balance: Balance, _round: RoundState): ActionResult {
  throw new Error('not implemented');
}
