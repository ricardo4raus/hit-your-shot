/**
 * Decides on the JS thread, once per shot batch, what each shot gets in the play field: the hit streak (in firing order; a miss resets
 * it), whether its ball flies on fire, how big its hit effect is after throttling, which popup word it shows, and whether the screen
 * shakes. Throttling keeps a flood of hits at high fire rates readable and cheap: at most one burst per FX_GAP_MS, one ordinary word
 * per WORD_GAP_MS, while streak milestones always get their word and burst.
 * Pure TypeScript with plain state, so it is tested without a renderer.
 * Owner of this file: the "juice" agent.
 */
import type { ShotResult, SportDef } from '@/engine';

type TargetKind = SportDef['target']['kind'];

/** Balls fly on fire once the shooter has this many hits in a row. */
export const FIRE_STREAK = 5;
/** Streak counts that get a milestone word, a big burst and a light shake. */
export const MILESTONES = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] as const;
/** At most one hit burst per this many ms of hit time. */
export const FX_GAP_MS = 80;
/** At most one ordinary popup word per this many ms. */
export const WORD_GAP_MS = 700;
/** At most one screen shake per this many ms. */
export const SHAKE_GAP_MS = 1200;

export interface PlannerState {
  streak: number;
  lastFxAt: number;
  lastWordAt: number;
  lastShakeAt: number;
}

export function makePlanner(): PlannerState {
  return { streak: 0, lastFxAt: -Infinity, lastWordAt: -Infinity, lastShakeAt: -Infinity };
}

/** A new round: the streak and the throttles start over, so the round's first hit always gets its word. */
export function resetPlanner(p: PlannerState): void {
  p.streak = 0;
  p.lastFxAt = -Infinity;
  p.lastWordAt = -Infinity;
  p.lastShakeAt = -Infinity;
}

export interface ShotPlan {
  /** The ball flies with a fire trail (the streak before this shot reached FIRE_STREAK). */
  fire: boolean;
  /** Streak including this shot; 0 after a miss. */
  streak: number;
  /** Effect level: 0 none, 1 burst, 2 milestone burst. Always 0 for a miss. */
  fx: number;
  /** Popup word, or null. */
  word: string | null;
  /** The popup is a streak milestone: bigger, gold, higher. */
  big: boolean;
  /** Screen shake strength in points, 0 for none. */
  shake: number;
  /** No rim, board or keeper contact before the hit. */
  clean: boolean;
}

/** The word for a streak milestone. */
export function milestoneWord(streak: number): string {
  if (streak < 10) return 'ON FIRE!';
  if (streak < 25) return 'HOT STREAK!';
  if (streak < 50) return 'RED HOT!';
  return `${streak} IN A ROW!`;
}

/** The word for an ordinary hit. */
export function hitWord(kind: TargetKind, clean: boolean): string {
  if (kind === 'hoop') return clean ? 'SWISH!' : 'NICE!';
  if (kind === 'goal') return 'GOAL!';
  return clean ? 'SUNK!' : 'NICE!';
}

/** A hit that flew straight in: the flight segment and the segment after the hit, nothing in between. */
export function isClean(shot: ShotResult): boolean {
  return shot.hit && shot.segments.length <= 2;
}

/** Plans one shot. `atMs` is the wall time of the shot's event (the hit's sensor crossing). Mutates the planner. */
export function planShot(p: PlannerState, shot: ShotResult, kind: TargetKind, atMs: number): ShotPlan {
  const fire = p.streak >= FIRE_STREAK;
  if (!shot.hit) {
    p.streak = 0;
    return { fire, streak: 0, fx: 0, word: null, big: false, shake: 0, clean: false };
  }
  p.streak += 1;
  const streak = p.streak;
  const clean = isClean(shot);
  if ((MILESTONES as readonly number[]).includes(streak)) {
    p.lastFxAt = Math.max(p.lastFxAt, atMs);
    p.lastWordAt = Math.max(p.lastWordAt, atMs);
    let shake = 0;
    if (atMs - p.lastShakeAt >= SHAKE_GAP_MS) {
      p.lastShakeAt = atMs;
      shake = streak >= 25 ? 6 : streak >= 10 ? 5 : 4;
    }
    return { fire, streak, fx: 2, word: milestoneWord(streak), big: true, shake, clean };
  }
  let fx = 0;
  if (atMs - p.lastFxAt >= FX_GAP_MS) {
    p.lastFxAt = atMs;
    fx = 1;
  }
  let word: string | null = null;
  if (atMs - p.lastWordAt >= WORD_GAP_MS) {
    p.lastWordAt = atMs;
    word = hitWord(kind, clean);
  }
  return { fire, streak, fx, word, big: false, shake: 0, clean };
}
