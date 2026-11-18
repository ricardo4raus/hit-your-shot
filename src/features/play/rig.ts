/**
 * The character's skeleton and its shooting motion (design rules section 8 and 9; owner 2026-11-16: "not realistic, but good movement:
 * bend the knees before shooting, stretch the arm, flick the hand like a basketball is thrown, and each added arm knows how to move").
 *
 * Pure math in meters, in the character's frame: x forward (toward the target), y up, z lateral (positive = the character's right).
 * The play field adds the shot origin's depth and projects. Everything here is a worklet so the UI thread can pose the body every frame;
 * helpers are defined before they are used (the worklet transform needs that). No React, no engine imports besides the limb anchors.
 *
 * The body: a standing figure BODY_H tall. Hips at HIP_Y, shoulders at SHOULDER_Y, head above. Two legs. Any number of arms, one per
 * limb anchor from limbs.ts: arm i hangs from its anchor on the torso and reaches with two bones (upper arm, forearm) and a hand to wherever
 * the motion puts it. Two-bone IK with a bend hint decides the elbow: elbows point down and out for a set shot, which is why the arms
 * read as arms at any count.
 *
 * The shot cycle of one arm, in seconds around its fire time (0 = the ball leaves):
 *   −0.40 … −0.12  dip: knees bend, the ball comes down to the chest
 *   −0.12 …  0.00  rise: knees extend, the arm straightens up to the release point, wrist cocked back
 *    0.00 …  0.08  flick: the wrist snaps forward
 *    0.08 …  0.30  follow-through: the arm stays up
 *    0.30 …  0.55  return to the hold
 * At fire rates where a period is shorter than the cycle, the cycle is squeezed into the period, so a fast arm pumps instead of freezing.
 * The knees follow the deepest dip of any arm; the torso leans a little into it. Idle: the hold pose with a slow breath.
 */
import type { LimbAnchor } from '@/engine';

export const BODY_H = 1.75;
const HIP_Y = 0.5;
const SHOULDER_Y = 0.8;
const HEAD_Y = 0.9;
export const HEAD_R = 0.09;
const UPPER_ARM = 0.19;
const FOREARM = 0.17;
const HAND = 0.085;
const THIGH = 0.25;
const SHIN = 0.25;
const FOOT = 0.11;
const HIP_HALF = 0.1;
export const TORSO_HALF = 0.13;
/** How far the hips drop at a full knee bend, in body units. */
const DIP_DROP = 0.08;
/** How far the shoulders move forward at a full dip. */
const DIP_LEAN = 0.05;
/** Breath: shoulder rise, body units, and its period in seconds. */
const BREATH = 0.006;
const BREATH_PERIOD = 2.4;

/** Full cycle length in seconds; shorter periods squeeze it. */
export const CYCLE_SEC = 0.95;
const DIP_START = -0.4;
const RISE_START = -0.12;
const FLICK_END = 0.08;
const FOLLOW_END = 0.3;
const RETURN_END = 0.55;

export interface Vec {
  x: number;
  y: number;
  z: number;
}

export interface ArmPose {
  /** Anchor on the torso, elbow, wrist, fingertip. */
  shoulder: Vec;
  elbow: Vec;
  wrist: Vec;
  tip: Vec;
  /** 1 while the hand carries the ball (from the start of the dip to the release), else 0. */
  holding: number;
  /** Drawn over the torso (anchored on the back) or under it. */
  behind: boolean;
}

export interface LegPose {
  hip: Vec;
  knee: Vec;
  ankle: Vec;
  toe: Vec;
}

export interface BodyPose {
  /** Center of the hips and of the shoulders, head center. */
  hips: Vec;
  shoulders: Vec;
  head: Vec;
  /** 0 standing, 1 full knee bend. */
  dip: number;
  arms: ArmPose[];
  legs: [LegPose, LegPose];
}

/** One arm's place in the shot cycle: seconds relative to its fire time, or null when it is not in a cycle. */
export interface ArmTiming {
  /** Seconds since (positive) or until (negative) the arm's nearest fire time. */
  tau: number;
  /** Seconds between this arm's shots; squeezes the cycle when shorter than CYCLE_SEC. */
  period: number;
  /** Which way this arm aims, radians, 0 = forward, positive = right. */
  yaw: number;
  /** Lateral offset of the release point, meters. */
  offset: number;
}

// ---------- Small vector helpers ----------

function vec(x: number, y: number, z: number): Vec {
  'worklet';
  return { x, y, z };
}

function add(a: Vec, b: Vec): Vec {
  'worklet';
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub(a: Vec, b: Vec): Vec {
  'worklet';
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(a: Vec, s: number): Vec {
  'worklet';
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function dot(a: Vec, b: Vec): number {
  'worklet';
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec, b: Vec): Vec {
  'worklet';
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function length(a: Vec): number {
  'worklet';
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

function normalize(a: Vec): Vec {
  'worklet';
  const l = length(a);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 1, z: 0 };
}

function lerp(a: Vec, b: Vec, t: number): Vec {
  'worklet';
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

function clamp01(v: number): number {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Ease-in-out for things the game shows; ease-out for things that snap. */
function smooth(t: number): number {
  'worklet';
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function easeOut(t: number): number {
  'worklet';
  const c = clamp01(t);
  return 1 - (1 - c) * (1 - c);
}

/** Rotates v around the unit axis by angle (Rodrigues). */
function rotate(v: Vec, axis: Vec, angle: number): Vec {
  'worklet';
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = axis;
  const kxv = cross(k, v);
  const kdv = dot(k, v);
  return { x: v.x * c + kxv.x * s + k.x * kdv * (1 - c), y: v.y * c + kxv.y * s + k.y * kdv * (1 - c), z: v.z * c + kxv.z * s + k.z * kdv * (1 - c) };
}

// ---------- Two-bone IK ----------

/**
 * The middle joint of a two-bone chain from `root` toward `target`, bones l1 and l2, bending toward `hint`. When the target is out of
 * reach the chain points straight at it; when it is too close the joint folds toward the hint.
 */
export function solveJoint(root: Vec, target: Vec, l1: number, l2: number, hint: Vec): Vec {
  'worklet';
  const d = sub(target, root);
  let dist = length(d);
  const maxReach = l1 + l2 - 1e-6;
  const minReach = Math.abs(l1 - l2) + 1e-6;
  if (dist > maxReach) dist = maxReach;
  if (dist < minReach) dist = minReach;
  const dir = normalize(d);
  // Perpendicular part of the hint, so the bend plane is root→target × hint.
  const perp = normalize(sub(hint, scale(dir, dot(hint, dir))));
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const hSq = l1 * l1 - a * a;
  const h = hSq > 0 ? Math.sqrt(hSq) : 0;
  return add(add(root, scale(dir, a)), scale(perp, h));
}

/** The end of a chain whose middle joint was solved: the target when reachable, else the clamped point along the chain. */
export function chainEnd(root: Vec, target: Vec, l1: number, l2: number, joint: Vec): Vec {
  'worklet';
  const reach = l1 + l2 - 1e-6;
  const d = sub(target, root);
  if (length(d) <= reach) return target;
  return add(joint, scale(normalize(sub(target, joint)), l2));
}

// ---------- The shot cycle ----------

export interface CyclePhase {
  /** Knee bend of this arm's cycle, 0..1. */
  dip: number;
  /** 0 at the hold, 1 at the release point. */
  reach: number;
  /** Wrist: −1 cocked back, +1 flicked forward. */
  flick: number;
  /** 1 while the ball is in the hand. */
  holding: number;
}

/** Where an arm is in its cycle for a time `tau` (seconds around its fire time) and a shot period. */
export function cyclePhase(tau: number, period: number): CyclePhase {
  'worklet';
  // A period shorter than the cycle squeezes the whole cycle into it; the release stays at tau = 0.
  const squeeze = period > 0 && period < CYCLE_SEC ? period / CYCLE_SEC : 1;
  const t = tau / squeeze;
  if (t < DIP_START || t >= RETURN_END) return { dip: 0, reach: 0, flick: -0.3, holding: 1 };
  if (t < RISE_START) {
    const u = smooth((t - DIP_START) / (RISE_START - DIP_START));
    return { dip: u, reach: 0, flick: -0.3 - 0.7 * u, holding: 1 };
  }
  if (t < 0) {
    const u = easeOut((t - RISE_START) / (0 - RISE_START));
    return { dip: 1 - u, reach: u, flick: -1, holding: 1 };
  }
  if (t < FLICK_END) {
    const u = easeOut(t / FLICK_END);
    return { dip: 0, reach: 1, flick: -1 + 2 * u, holding: 0 };
  }
  if (t < FOLLOW_END) return { dip: 0, reach: 1, flick: 1, holding: 0 };
  const u = smooth((t - FOLLOW_END) / (RETURN_END - FOLLOW_END));
  return { dip: 0, reach: 1 - u, flick: 1 - 1.3 * u, holding: u > 0.6 ? 1 : 0 };
}

// ---------- Posing ----------

export interface PoseInput {
  anchors: readonly LimbAnchor[];
  /** One per anchor; null when the character is not shooting (idle hold). */
  timings: readonly (ArmTiming | null)[];
  /** Release height of the sport (field.origin.y), meters. */
  releaseY: number;
  /** Seconds, for the breath. */
  time: number;
}

/** The whole body for one frame. */
export function poseBody(input: PoseInput): BodyPose {
  'worklet';
  const n = input.anchors.length;
  // Knees follow the deepest dip of any arm; the breath lifts the shoulders a hair.
  let dip = 0;
  const phases: CyclePhase[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const timing = input.timings[i] ?? null;
    const phase = timing ? cyclePhase(timing.tau, timing.period) : { dip: 0, reach: 0, flick: -0.3, holding: 1 };
    phases[i] = phase;
    if (phase.dip > dip) dip = phase.dip;
  }
  const breath = BREATH * Math.sin((2 * Math.PI * input.time) / BREATH_PERIOD);
  const hipY = (HIP_Y - DIP_DROP * dip) * BODY_H;
  const lean = DIP_LEAN * dip * BODY_H;
  const hips = vec(0, hipY, 0);
  const shoulders = vec(lean, hipY + (SHOULDER_Y - HIP_Y + breath) * BODY_H, 0);
  const head = vec(lean * 1.2, shoulders.y + (HEAD_Y - SHOULDER_Y) * BODY_H, 0);

  // Legs: feet planted, knees bend forward as the hips drop.
  const legs: LegPose[] = [];
  for (const side of [-1, 1]) {
    const hip = vec(0, hipY, side * HIP_HALF * BODY_H);
    const ankle = vec(0.02 * BODY_H, 0.03 * BODY_H, side * (HIP_HALF + 0.01) * BODY_H);
    const knee = solveJoint(hip, ankle, THIGH * BODY_H, SHIN * BODY_H, vec(1, 0, 0));
    const toe = add(ankle, vec(FOOT * BODY_H, -0.03 * BODY_H, 0));
    legs.push({ hip, knee, ankle, toe });
  }

  // Arms.
  const arms: ArmPose[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const an = input.anchors[i]!;
    const phase = phases[i]!;
    const timing = input.timings[i] ?? null;
    const yaw = timing ? timing.yaw : 0;
    const offset = timing ? timing.offset : 0;
    // The anchor rides on the torso: its height follows the hips and the lean, back anchors sit a little behind.
    const shoulder = vec((an.behind ? -0.06 : 0.02) * BODY_H + lean * (an.y - HIP_Y) / (SHOULDER_Y - HIP_Y), hipY + (an.y - HIP_Y) * BODY_H, an.x * BODY_H);
    // Hold: the ball at the chin with the elbows out, so the forearms show beside the torso from behind; the dip lowers it to the
    // chest. Release: up at the release height, a hand's reach forward along this arm's aim, over its lateral offset.
    const side = an.side;
    const hold = vec(0.2 * BODY_H, (SHOULDER_Y - 0.03 - 0.1 * phase.dip) * BODY_H - DIP_DROP * dip * BODY_H, side * 0.13 * BODY_H + an.x * BODY_H * 0.25);
    const release = vec(0.08 * BODY_H + 0.12 * Math.cos(yaw), input.releaseY, offset + 0.12 * Math.sin(yaw));
    const target = lerp(hold, release, phase.reach);
    // Elbows point down and out; an arm from the back bends outward and a little back.
    const hint = vec(an.behind ? -0.4 : -0.15, -1, side * 0.7);
    const elbow = solveJoint(shoulder, target, UPPER_ARM * BODY_H, FOREARM * BODY_H, hint);
    const wrist = chainEnd(shoulder, target, UPPER_ARM * BODY_H, FOREARM * BODY_H, elbow);
    // The hand: cocked back (fingers up and back) before the release, snapped forward after. Rotation around the arm's side axis.
    const forearm = normalize(sub(wrist, elbow));
    const forward = vec(Math.cos(yaw), 0, Math.sin(yaw));
    let axis = cross(forearm, forward);
    if (length(axis) < 1e-6) axis = vec(0, 0, 1);
    axis = normalize(axis);
    // flick −1 → 70° back (fingers up and back), +1 → 45° forward (fingers down the arc). The axis points to the arm's left, so a
    // negative angle turns the hand back.
    const angle = ((phase.flick * 57.5 - 12.5) * Math.PI) / 180;
    const handDir = rotate(forearm, axis, angle);
    const tip = add(wrist, scale(handDir, HAND * BODY_H));
    arms[i] = { shoulder, elbow, wrist, tip, holding: phase.holding, behind: an.behind };
  }

  return { hips, shoulders, head, dip, arms, legs: [legs[0]!, legs[1]!] };
}

/** Seconds around the nearest fire time for a periodic schedule: negative before it, positive after. */
export function tauFor(time: number, firstFireAt: number, period: number): number {
  'worklet';
  if (!(period > 0) || !Number.isFinite(period)) return -10;
  if (time < firstFireAt) return time - firstFireAt;
  const k = Math.floor((time - firstFireAt) / period);
  const sinceLast = time - firstFireAt - k * period;
  const untilNext = period - sinceLast;
  // After the follow-through of the last shot, count down to the next one once its anticipation window starts; the windows are
  // squeezed like the cycle, so a short period hands over seamlessly.
  const squeeze = period < CYCLE_SEC ? period / CYCLE_SEC : 1;
  if (sinceLast <= RETURN_END * squeeze) return sinceLast;
  if (untilNext <= -DIP_START * squeeze) return -untilNext;
  return sinceLast;
}
