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
 * - shotInputFor(state, balance, round, limb, aim, t): ShotInput (aim = yaw) with spreadDeg from upgrades.spreadDeg, offset from limbs.muzzleOffsets,
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
 *
 * Implementation notes (decisions where the rules above were open):
 * - A limb whose ball id is not in the sport's ball list uses the sport's first ball, the same fallback as the resolver, so a bad save
 *   never breaks the round loop. A limb with a rate that is not a positive finite number never fires.
 * - dueShots picks the limb with the smallest nextFireAt each time (ties go to the lowest index), so when several limbs are behind the
 *   oldest missed interval of any limb is served first. A fire time is only served while it is strictly below round.seconds; a limb
 *   whose next fire time is at or past the end stays where it is.
 * - When nothing is due, dueShots returns the round object it was given unchanged (no allocation on an idle tick).
 * - shotInputFor and dueShots use round.sport, not state.currentSport, so a round keeps its sport even if the state switched.
 * - settleRound does not mark the round finished; the store keeps the settled round for the result panel and flags it itself.
 */
import { ballDefOf, type Balance, type BallDef } from './balance';
import { muzzleOffsets } from './limbs';
import { withSport } from './state';
import { awardMilestones, masteryBonus } from './trophies';
import { fail, succeed, type ActionResult, type GameEvent, type GameState, type Rng, type RoundState, type ShotInput, type ShotResult, type SportId, type SportState } from './types';
import { incomeMult, shotsPerSec, spreadDeg } from './upgrades';

/** The ball a limb fires, falling back to the sport's first ball for an unknown id. Throws only when the sport has no balls at all. */
function limbBall(balance: Balance, sportId: SportId, sport: SportState, limb: number): BallDef {
  const id = sport.limbBalls[limb];
  const def = id === undefined ? undefined : ballDefOf(balance, sportId, id);
  const ball = def ?? balance.sports[sportId].balls[0];
  if (ball === undefined) throw new Error('sport has no balls');
  return ball;
}

export function createRound(state: GameState, balance: Balance, now: number, rng: Rng): RoundState {
  const sportId = state.currentSport;
  const sport = state.sports[sportId];
  const rates = limbRates(state, balance, sportId);
  const limbs = Math.max(1, rates.length);
  const nextFireAt = rates.map((rate, i) => (rate > 0 && Number.isFinite(rate) ? (i * (1 / rate)) / limbs : Number.POSITIVE_INFINITY));
  return {
    sport: sportId,
    startedAt: now,
    seconds: balance.roundSeconds,
    targetPhase: rng() * 2 * Math.PI,
    nextFireAt,
    shots: 0,
    hits: 0,
    money: 0,
    doubled: false,
    finished: false,
  };
}

export function limbRates(state: GameState, balance: Balance, sportId: SportId): number[] {
  const sport = state.sports[sportId];
  const level = sport.upgrades.fireRate;
  const out: number[] = new Array(sport.limbs);
  for (let i = 0; i < sport.limbs; i++) out[i] = shotsPerSec(balance, level, limbBall(balance, sportId, sport, i));
  return out;
}

export function dueShots(round: RoundState, state: GameState, balance: Balance, t: number): { round: RoundState; limbs: number[] } {
  const limbs: number[] = [];
  if (round.finished || !(t < round.seconds)) return { round, limbs };

  const rates = limbRates(state, balance, round.sport);
  const count = Math.min(rates.length, round.nextFireAt.length);
  const cap = balance.physics.maxShotsPerTick;
  const end = round.seconds;
  let next: number[] | null = null;

  while (limbs.length < cap) {
    const times = next ?? round.nextFireAt;
    let best = -1;
    let bestAt = Number.POSITIVE_INFINITY;
    for (let i = 0; i < count; i++) {
      const at = times[i];
      if (at === undefined || !(at <= t) || !(at < end) || at >= bestAt) continue;
      const rate = rates[i];
      if (rate === undefined || !(rate > 0) || !Number.isFinite(rate)) continue;
      best = i;
      bestAt = at;
    }
    if (best < 0) break;
    if (next === null) next = round.nextFireAt.slice();
    limbs.push(best);
    next[best] = bestAt + 1 / (rates[best] as number);
  }

  if (next === null) return { round, limbs };
  return { round: { ...round, nextFireAt: next }, limbs };
}

export function hitValue(state: GameState, balance: Balance, sportId: SportId, ball: BallDef, doubled: boolean): number {
  const level = state.sports[sportId].upgrades.income;
  return ball.value * incomeMult(balance, level) * masteryBonus(state, balance) * (doubled ? balance.ads.x2RoundMult : 1);
}

export function shotInputFor(state: GameState, balance: Balance, round: RoundState, limb: number, aim: number, t: number): ShotInput {
  const sportId = round.sport;
  const sport = state.sports[sportId];
  const def = balance.sports[sportId];
  const ball = limbBall(balance, sportId, sport, limb);
  const offset = muzzleOffsets(sport.limbs, def, balance)[limb] ?? 0;
  return {
    sport: sportId,
    aim,
    spreadDeg: spreadDeg(balance, sport.upgrades.accuracy, ball),
    ballId: ball.id,
    offset,
    t,
    targetPhase: round.targetPhase,
    valueIfHit: hitValue(state, balance, sportId, ball, round.doubled),
  };
}

export function recordShot(round: RoundState, result: ShotResult): RoundState {
  return {
    ...round,
    shots: round.shots + 1,
    hits: round.hits + (result.hit ? 1 : 0),
    money: round.money + result.value,
  };
}

export function settleRound(state: GameState, balance: Balance, round: RoundState): ActionResult {
  if (round.finished) return fail(state, 'invalid');
  const sportId = round.sport;
  const sport = state.sports[sportId];
  const newBest = round.money > sport.bestRound;

  const nextSport: SportState = {
    ...sport,
    money: sport.money + round.money,
    lastRoundMoney: round.money,
    roundsPlayed: sport.roundsPlayed + 1,
    lifetimeMoney: sport.lifetimeMoney + round.money,
    shotsFired: sport.shotsFired + round.shots,
    hits: sport.hits + round.hits,
    bestRound: newBest ? round.money : sport.bestRound,
  };
  const settled: GameState = {
    ...withSport(state, sportId, nextSport),
    ads: { ...state.ads, roundsSinceX2: round.doubled ? 0 : state.ads.roundsSinceX2 + 1 },
  };

  const events: GameEvent[] = [{ type: 'roundEnded', sport: sportId, money: round.money, shots: round.shots, hits: round.hits, newBest }];
  if (newBest) events.push({ type: 'newBest', sport: sportId, money: round.money });

  const awarded = awardMilestones(settled, balance, sportId);
  events.push(...awarded.events);
  return succeed(awarded.state, events);
}
