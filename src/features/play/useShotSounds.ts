/**
 * Sounds of the live round, timed to what the player sees: the shot leaving the hand, the swish of a hit, the rim and the floor, and the
 * crowd on a hit streak (at the popup milestones of fx/hitPlan.ts, counted in the order the hits land).
 * Each batch from the shot bus is turned into timed events (round time → wall time from round.startedAt) in one min-heap drained by one
 * timer. Repeats of the same sound are thinned before they are queued (one per time slot), and the audio service rate-limits again, so
 * hundreds of shots per second stay cheap. Bounces come from the segment boundaries of each ShotResult: near the hoop ring or the board is
 * the rim, low is the floor, anything else (walls, ceiling) sounds like the floor too. The round's end lets the last balls land for a
 * moment, then everything is dropped; a new round, leaving the round or unmounting clears the queue.
 * Mounted once by the play field. Owner of this file: the "audio" agent.
 */
import { useEffect } from 'react';

import { targetPose, type ShotResult, type SportDef } from '@/engine';
import { services, type SfxId } from '@/services';
import { balance, useGame } from '@/store/game';
import { onShots } from '@/store/shotBus';

import { MILESTONES } from './fx/hitPlan';

/** Event codes in the queue: a sound, or the outcome of a shot (a hit plays the swish and counts toward the streak). */
const SHOT = 0;
const RIM = 1;
const FLOOR = 2;
const HIT = 3;
const MISS = 4;
const SOUND_OF: readonly SfxId[] = ['shot', 'rim', 'floor'];
/** Minimum spacing (ms) between queued copies of the same sound; the service limit sits just under it. */
const SLOT_MS: readonly number[] = [100, 120, 120];
/** Bounces softer than this change of speed (m/s) are rolling, not worth a sound. */
const MIN_IMPACT = 1.2;
/** At most this many bounce sounds per ball. */
const MAX_BOUNCES = 3;
/** A sound more than this late (ms) is dropped instead of played out of sync (the app was busy or in the background). */
const STALE_MS = 250;
/** After the round ends, balls still in the air keep their sounds this long (ms). */
const TAIL_MS = 1500;
/** The crowd cheers at the same streaks as the popup words (fx/hitPlan.ts). */
const STREAK_CHEERS: ReadonlySet<number> = new Set(MILESTONES);

/** Classifies a bounce at (x, y, z) at round time t: rim (ring or board) or floor. */
function bounceSound(def: SportDef, x: number, y: number, z: number, t: number, phase: number, radius: number): number {
  const target = def.target;
  const pose = targetPose(def, t, phase);
  const c = pose.center;
  if (target.kind === 'hoop') {
    const ring = Math.hypot(x - c.x, z - c.z);
    if (Math.abs(y - c.y) < 0.35 && ring < pose.halfWidth + 0.3) return RIM;
    const board = target.backboard;
    if (
      board &&
      x > c.x + board.dx - 0.3 &&
      y > c.y + board.yFrom - 0.2 &&
      y < c.y + board.yTo + 0.2 &&
      Math.abs(z - c.z) < board.halfSpan + 0.2
    ) {
      return RIM;
    }
  } else if (y > radius * 2 && Math.hypot(x - c.x, y - c.y, z - c.z) < pose.halfWidth + 0.4) {
    // Goal posts and the like.
    return RIM;
  }
  return FLOOR;
}

function createScheduler() {
  // Min-heap of (time ms, code) in two parallel arrays.
  const times: number[] = [];
  const codes: number[] = [];
  /** Occupied slots per sound code: code * 1e11 + slot index. */
  const slots = new Set<number>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timerAt = Infinity;
  let streak = 0;
  let cutoff = Infinity;

  function push(at: number, code: number): void {
    let i = times.length;
    times.push(at);
    codes.push(code);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (times[p]! <= at) break;
      times[i] = times[p]!;
      codes[i] = codes[p]!;
      i = p;
    }
    times[i] = at;
    codes[i] = code;
  }

  function pop(): void {
    const lastT = times.pop()!;
    const lastC = codes.pop()!;
    const n = times.length;
    if (n === 0) return;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= n) break;
      const r = l + 1;
      const m = r < n && times[r]! < times[l]! ? r : l;
      if (times[m]! >= lastT) break;
      times[i] = times[m]!;
      codes[i] = codes[m]!;
      i = m;
    }
    times[i] = lastT;
    codes[i] = lastC;
  }

  /** Queues a thinned sound: dropped when another copy already holds its time slot. */
  function pushSound(at: number, code: number): void {
    const key = code * 1e11 + Math.floor(at / SLOT_MS[code]!);
    if (slots.has(key)) return;
    slots.add(key);
    push(at, code);
  }

  function arm(): void {
    if (times.length === 0) return;
    const next = times[0]!;
    if (timer !== null && timerAt <= next) return;
    if (timer !== null) clearTimeout(timer);
    timerAt = next;
    timer = setTimeout(drain, Math.max(0, next - Date.now()));
  }

  function drain(): void {
    timer = null;
    timerAt = Infinity;
    const now = Date.now();
    const audio = services.audio;
    while (times.length > 0 && times[0]! <= now + 4) {
      const at = times[0]!;
      const code = codes[0]!;
      pop();
      if (at > cutoff) {
        clear();
        return;
      }
      const fresh = now - at <= STALE_MS;
      if (code === HIT) {
        streak++;
        if (fresh) audio.play('hit');
        if (fresh && STREAK_CHEERS.has(streak)) audio.play('cheer');
      } else if (code === MISS) {
        streak = 0;
      } else if (fresh) {
        audio.play(SOUND_OF[code]!);
      }
    }
    if (slots.size > 4096) slots.clear();
    arm();
  }

  function clear(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    timerAt = Infinity;
    times.length = 0;
    codes.length = 0;
    slots.clear();
  }

  function onBatch(batch: readonly ShotResult[]): void {
    const { round, state } = useGame.getState();
    if (!round || round.finished || !state.settings.sound) return;
    const def = balance.sports[round.sport];
    const startMs = round.startedAt;
    for (const shot of batch) {
      const segs = shot.segments;
      const first = segs[0];
      if (!first) continue;
      pushSound(startMs + first.t0 * 1000, SHOT);
      let bounces = 0;
      for (let i = 1; i < segs.length && bounces < MAX_BOUNCES; i++) {
        const prev = segs[i - 1]!;
        const s = segs[i]!;
        // Change of velocity across the contact: the end of the previous parabola against the start of this one.
        const dt = s.t0 - prev.t0;
        const impact = Math.hypot(s.vx - prev.vx, s.vy - (prev.vy + prev.gy * dt), s.vz - prev.vz);
        if (impact < MIN_IMPACT) continue;
        bounces++;
        pushSound(startMs + s.t0 * 1000, bounceSound(def, s.x, s.y, s.z, s.t0, round.targetPhase, shot.radius));
      }
      push(startMs + shot.eventSec * 1000, shot.hit ? HIT : MISS);
    }
    arm();
  }

  return {
    onBatch,
    /** A new round, or the round left: forget everything. */
    reset(): void {
      clear();
      streak = 0;
      cutoff = Infinity;
    },
    /** The round ended: balls in the air may still land for a moment. */
    ended(): void {
      cutoff = Date.now() + TAIL_MS;
      arm();
    },
    dispose: clear,
  };
}

export function useShotSounds(): void {
  useEffect(() => {
    const scheduler = createScheduler();
    const offShots = onShots(scheduler.onBatch);
    const offStore = useGame.subscribe((s, prev) => {
      if (s.round === prev.round) return;
      if (s.round?.startedAt !== prev.round?.startedAt) scheduler.reset();
      else if (s.round?.finished && !prev.round?.finished) scheduler.ended();
    });
    return () => {
      offShots();
      offStore();
      scheduler.dispose();
    };
  }, []);
}
