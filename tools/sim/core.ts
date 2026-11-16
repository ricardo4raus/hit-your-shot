/**
 * Pacing simulator core (docs/analysis.md "Pacing targets", docs/architecture.md "Simulator").
 * A bot plays rounds through the REAL engine: the same createRound, dueShots, shotInputFor, resolveShot, recordShot and settleRound the
 * store uses, ticking every 1/30 s like the phone. The bot only decides where to aim and what to buy. No game rule is copied here.
 *
 * Aim: the bot predicts where the target will be when the ball arrives (ballistics.predictYaw) and adds a deterministic bell-shaped
 * yaw error of `skillDeg`; the engine solves the pitch, as it does for the player. Spend: after every round it buys the affordable option with the best estimated gain in
 * income per round per money spent (through incomePerRoundEstimate), repeats while something affordable improves, and switches all limbs
 * to a newly bought ball when that estimates higher.
 *
 * No file system access here, so Jest can import it.
 */
import {
  assignAllLimbs,
  ballDefOf,
  buyBall,
  buyCharacter,
  buyUpgrade,
  characterCost,
  createInitialState,
  createRng,
  createRound,
  dueShots,
  gaussianish,
  incomePerRoundEstimate,
  recordShot,
  resolveShot,
  settleRound,
  shotInputFor,
  predictYaw,
  upgradeCost,
  UPGRADE_IDS,
  type Balance,
  type GameState,
  type Rng,
  type SportId,
  type UpgradeId,
} from '../../src/engine';

export interface BotOptions {
  /** Aim error in degrees (bell-shaped, ±skillDeg at the extremes). 0 = perfect prediction. */
  skillDeg: number;
  /** Seconds the player spends between rounds looking at cards and buying. */
  spendPauseSec: number;
  /** Rounds to play. */
  rounds: number;
  /** Estimate samples per limb for spend decisions (lower = faster sim). */
  estimateSamples: number;
}

export const DEFAULT_BOT: BotOptions = { skillDeg: 4, spendPauseSec: 4, rounds: 400, estimateSamples: 64 };

/** The bot saves for an unaffordable option when its gain per cost beats the best affordable one by this factor. */
const SAVE_FACTOR = 1.5;

export interface Milestones {
  /** Play time in seconds (rounds plus spend pauses) when each thing first happened; null = never. */
  firstUpgrade: number | null;
  firstBallSwap: number | null;
  limbs2: number | null;
  limbs3: number | null;
  limbs4: number | null;
  mastered: number | null;
  trophies10: number | null;
}

export interface RoundLog {
  index: number;
  /** Play time at the end of the round. */
  timeSec: number;
  money: number;
  shots: number;
  hits: number;
  limbs: number;
  ball: string;
  levels: Record<UpgradeId, number>;
}

export interface CampaignResult {
  seed: number;
  rounds: RoundLog[];
  milestones: Milestones;
  /** Longest stretch (seconds) in the first hour without a visible step: a purchase of any kind. */
  longestQuietSec: number;
  finalState: GameState;
}

type Purchase = { kind: 'upgrade'; id: UpgradeId } | { kind: 'ball'; id: string } | { kind: 'character' };

function cloneWithMoney(state: GameState, money: number): GameState {
  const sport = state.sports[state.currentSport];
  return { ...state, sports: { ...state.sports, [state.currentSport]: { ...sport, money } } };
}

function applyPurchase(state: GameState, balance: Balance, p: Purchase): GameState | null {
  let r;
  if (p.kind === 'upgrade') r = buyUpgrade(state, balance, p.id);
  else if (p.kind === 'ball') r = buyBall(state, balance, p.id);
  else r = buyCharacter(state, balance);
  if (!r.ok) return null;
  let s = r.state;
  if (p.kind === 'ball') {
    const swapped = assignAllLimbs(s, balance, p.id);
    if (swapped.ok) s = swapped.state;
  }
  return s;
}

function purchaseCost(state: GameState, balance: Balance, p: Purchase): number {
  const sport = state.sports[state.currentSport];
  if (p.kind === 'upgrade') return upgradeCost(balance, p.id, sport.upgrades[p.id]);
  if (p.kind === 'ball') return ballDefOf(balance, state.currentSport, p.id)?.cost ?? Infinity;
  return characterCost(balance, sport.limbs + 1);
}

function candidates(state: GameState, balance: Balance): Purchase[] {
  const sportId = state.currentSport;
  const sport = state.sports[sportId];
  const out: Purchase[] = [];
  for (const id of UPGRADE_IDS) if (sport.upgrades[id] < balance.upgrades.maxLevel) out.push({ kind: 'upgrade', id });
  for (const b of balance.sports[sportId].balls) if (!sport.ownedBalls.includes(b.id)) out.push({ kind: 'ball', id: b.id });
  if (sport.limbs < balance.characters.softCapLimbs) out.push({ kind: 'character' });
  return out;
}

/**
 * Buys greedily by estimated gain per cost, and saves when something out of reach is clearly better than anything affordable
 * (a player eyeing the next trainer does not spend every coin on a tiny upgrade). Returns the new state and what was bought.
 */
export function spend(state: GameState, balance: Balance, samples: number): { state: GameState; bought: Purchase[] } {
  const bought: Purchase[] = [];
  let s = state;
  for (let guard = 0; guard < 50; guard++) {
    const sportId = s.currentSport;
    const money = s.sports[sportId].money;
    const now = incomePerRoundEstimate(s, balance, sportId, null, { samples });
    let bestAffordable: { p: Purchase; score: number } | null = null;
    let bestAny: { p: Purchase; score: number } | null = null;
    for (const p of candidates(s, balance)) {
      const cost = purchaseCost(s, balance, p);
      if (!Number.isFinite(cost)) continue;
      const after = applyPurchase(cloneWithMoney(s, Infinity), balance, p);
      if (!after) continue;
      const gain = incomePerRoundEstimate(after, balance, sportId, null, { samples }) - now;
      const score = gain / Math.max(1, cost);
      if (score <= 0) continue;
      if (!bestAny || score > bestAny.score) bestAny = { p, score };
      if (cost <= money && (!bestAffordable || score > bestAffordable.score)) bestAffordable = { p, score };
    }
    if (!bestAffordable) break;
    if (bestAny && bestAny !== bestAffordable && bestAny.score > bestAffordable.score * SAVE_FACTOR) break;
    const next = applyPurchase(s, balance, bestAffordable.p);
    if (!next) break;
    s = next;
    bought.push(bestAffordable.p);
  }
  return { state: s, bought };
}

/** The bot's aim for one shot at round time t: the yaw that meets the target where the ball will arrive, plus its error. */
export function botAim(state: GameState, balance: Balance, phase: number, t: number, skillDeg: number, rng: Rng): number {
  const sportId = state.currentSport;
  const def = balance.sports[sportId];
  const sport = state.sports[sportId];
  const ball = ballDefOf(balance, sportId, sport.limbBalls[0] ?? '') ?? def.balls[0]!;
  const yaw = predictYaw(def, ball, balance.physics.gravity, t, phase);
  return yaw + (gaussianish(rng) * skillDeg * Math.PI) / 180;
}

/** Plays one round with the bot and returns the settled state plus the round's numbers. */
export function playRound(state: GameState, balance: Balance, rng: Rng, skillDeg: number): { state: GameState; money: number; shots: number; hits: number } {
  const tickSec = 1 / 30;
  let round = createRound(state, balance, 0, rng);
  for (let t = 0; t < round.seconds; t += tickSec) {
    const due = dueShots(round, state, balance, t);
    round = due.round;
    if (due.limbs.length === 0) continue;
    const aim = botAim(state, balance, round.targetPhase, t, skillDeg, rng);
    for (const limb of due.limbs) {
      const input = shotInputFor(state, balance, round, limb, aim, t);
      const result = resolveShot(input, rng, balance);
      result.limb = limb;
      round = recordShot(round, result);
    }
  }
  const settled = settleRound(state, balance, round);
  return { state: settled.ok ? settled.state : state, money: round.money, shots: round.shots, hits: round.hits };
}

export function simulateCampaign(balance: Balance, seed: number, options: Partial<BotOptions> = {}, sportId: SportId = 'basketball'): CampaignResult {
  const o = { ...DEFAULT_BOT, ...options };
  const rng = createRng(seed);
  let state = createInitialState(balance, 0, seed);
  state = { ...state, currentSport: sportId };
  const rounds: RoundLog[] = [];
  const m: Milestones = { firstUpgrade: null, firstBallSwap: null, limbs2: null, limbs3: null, limbs4: null, mastered: null, trophies10: null };
  let time = 0;
  let lastStepAt = 0;
  let longestQuiet = 0;
  const startBall = state.sports[sportId].limbBalls[0];

  for (let i = 0; i < o.rounds; i++) {
    const r = playRound(state, balance, rng, o.skillDeg);
    state = r.state;
    time += balance.roundSeconds;
    const sp = spend(state, balance, o.estimateSamples);
    state = sp.state;
    time += o.spendPauseSec;
    const sport = state.sports[sportId];
    if (sp.bought.length > 0) {
      if (time <= 3600) longestQuiet = Math.max(longestQuiet, time - lastStepAt);
      lastStepAt = time;
    }
    if (m.firstUpgrade === null && sp.bought.some((p) => p.kind === 'upgrade')) m.firstUpgrade = time;
    if (m.firstBallSwap === null && sport.limbBalls[0] !== startBall) m.firstBallSwap = time;
    if (m.limbs2 === null && sport.limbs >= 2) m.limbs2 = time;
    if (m.limbs3 === null && sport.limbs >= 3) m.limbs3 = time;
    if (m.limbs4 === null && sport.limbs >= 4) m.limbs4 = time;
    if (m.mastered === null && sport.mastered) m.mastered = time;
    if (m.trophies10 === null && state.trophies >= balance.sports.football.unlockTrophies) m.trophies10 = time;
    rounds.push({ index: i, timeSec: time, money: r.money, shots: r.shots, hits: r.hits, limbs: sport.limbs, ball: sport.limbBalls[0] ?? '', levels: { ...sport.upgrades } });
  }
  if (time <= 3600) longestQuiet = Math.max(longestQuiet, time - lastStepAt);
  return { seed, rounds, milestones: m, longestQuietSec: longestQuiet, finalState: state };
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Median of a milestone over campaigns; campaigns that never reached it count as Infinity. */
export function medianMilestone(cs: CampaignResult[], key: keyof Milestones): number {
  return median(cs.map((c) => c.milestones[key] ?? Infinity));
}

export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec)) return 'never';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}
