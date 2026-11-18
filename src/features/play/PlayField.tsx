/**
 * The play field, seen from behind the character (owner decision 2026-11-16): the character fills the lower middle of the screen with its
 * back to the player, the target sits ahead and smaller, balls fly into the picture. One Skia canvas: world, target, character with its
 * procedural limbs posed by the rig every frame (rig.ts: knees, elbows, wrists, the shot cycle), the aim line (the arc a perfect ball
 * flies, owner 2026-11-16) with the spread's edges beside it, every ball in flight with a flat shadow under it. Ball positions are computed on
 * the UI thread from the segments the engine produced (docs/architecture.md, "The round, live"); React never re-renders per frame.
 * Drag left or right anywhere on the field to aim: the finger's position over the target plane is the aim point. The round is started
 * by the play button (features/round/RoundControls.tsx), not by the drag.
 */
import { Canvas, Group, Path, Rect, Skia, useClock, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { ballDefOf, launchPitch, limbAnchors, limbRates, muzzleOffsets, spreadDeg, type ShotResult, type SportDef } from '@/engine';
import { balance, useGame } from '@/store/game';
import { onShots } from '@/store/shotBus';
import { pulseMoney } from '@/ui/feedback';
import { border, colors, sportColors } from '@/ui/theme';

import { flatRatio, makeCamera, scaleAt, screenX, screenY, worldZ, type Camera } from './camera';
import { BODY_H, HEAD_R, TORSO_HALF, poseBody, tauFor, type ArmTiming, type Vec } from './rig';

/** A ball on the UI thread: flat segment numbers [t0, t1, x, y, z, vx, vy, vz, gy] × n, plus when it stops being drawn. */
interface BallRec {
  startMs: number;
  seg: number[];
  end: number;
  r: number;
}

const SEG = 9;
/** A hit on the UI thread: wall time of the sensor crossing and the target's lateral position then. */
interface HitRec {
  atMs: number;
  z: number;
}
/** How long the hit feedback lasts, seconds, and how many hits are kept. */
const HIT_SEC = 0.6;
const MAX_HITS = 64;
/** Packed batch layout per shot: [end, r, segmentCount, then segmentCount × SEG numbers]. One flat array crosses to the UI thread per tick. */
const HEAD = 3;
const MAX_BALLS = balance.physics.maxBallsInFlight;
const MAX_YAW = (70 * Math.PI) / 180;
/** Balls nearer than this in front of the shot origin are drawn over the character. */
const NEAR_DEPTH = 0.35;
const TWO_PI = 2 * Math.PI;
/** Points along the aim arc. */
const ARC_STEPS = 24;
/** The pitch the engine solves, tabulated over the yaw range for the UI thread (the engine itself stays off that thread). */
const PITCH_TABLE = 141;

export interface PlayFieldProps {
  width: number;
  height: number;
}

export function PlayField({ width, height }: PlayFieldProps) {
  const sportId = useGame((s) => s.state.currentSport);
  const limbs = useGame((s) => s.state.sports[s.state.currentSport].limbs);
  const accuracy = useGame((s) => s.state.sports[s.state.currentSport].upgrades.accuracy);
  const firstBall = useGame((s) => s.state.sports[s.state.currentSport].limbBalls[0] ?? '');
  const roundStartedAt = useGame((s) => s.round?.startedAt ?? 0);
  const roundPhase = useGame((s) => s.round?.targetPhase ?? 0);
  const playing = useGame((s) => s.phase === 'playing');
  // Each limb's shots per second and ball radius, as a string so the selector stays stable between purchases.
  const scheduleKey = useGame((s) => {
    const sport = s.state.sports[s.state.currentSport];
    const def = balance.sports[s.state.currentSport];
    const rates = limbRates(s.state, balance, s.state.currentSport);
    const radii = sport.limbBalls.map((id) => (ballDefOf(balance, s.state.currentSport, id)?.radiusMult ?? 1) * def.ballRadius);
    return `${rates.join(',')}|${radii.join(',')}`;
  });

  const def = balance.sports[sportId];
  const palette = sportColors[sportId as keyof typeof sportColors];
  const cam = useMemo(() => makeCamera(width, height, def.field.origin.x, def.target.center.x), [width, height, def.field.origin.x, def.target.center.x]);
  const ox = def.field.origin.x;
  const oy = def.field.origin.y;
  const cx = def.target.center.x;
  const dx = cx - ox;
  /** Balls past this depth are drawn before the target (behind the board or the goal line). */
  const farDepth = def.target.kind === 'hoop' ? cx + (def.target.backboard?.dx ?? 0) : cx;

  const ball = ballDefOf(balance, sportId, firstBall) ?? def.balls[0]!;
  const spread = spreadDeg(balance, accuracy, ball);
  const offsets = useMemo(() => muzzleOffsets(limbs, def, balance), [limbs, def]);
  const anchors = useMemo(() => limbAnchors(limbs, def.limb), [limbs, def.limb]);
  // The rig's schedule: when each limb first fires after the round start and how often, as createRound schedules them.
  const schedule = useMemo(() => {
    const [ratesPart, radiiPart] = scheduleKey.split('|');
    const rates = (ratesPart ?? '').split(',').map(Number);
    const radii = (radiiPart ?? '').split(',').map(Number);
    const n = Math.max(1, rates.length);
    const period = rates.map((r) => (r > 0 && Number.isFinite(r) ? 1 / r : Number.POSITIVE_INFINITY));
    const first = period.map((p, i) => (Number.isFinite(p) ? (i * p) / n : Number.POSITIVE_INFINITY));
    return { period, first, radii };
  }, [scheduleKey]);

  // Shared values the UI thread reads every frame.
  const clock = useClock();
  const balls = useSharedValue<BallRec[]>([]);
  const hits = useSharedValue<HitRec[]>([]);
  const aim = useSharedValue(0);
  const spreadSV = useSharedValue(spread);
  const phase = useSharedValue(0);
  const offsetsSV = useSharedValue<number[]>(offsets);
  const scheduleSV = useSharedValue(schedule);
  const roundSV = useSharedValue({ startMs: 0, playing: false });

  useEffect(() => {
    spreadSV.value = spread;
  }, [spread, spreadSV]);
  useEffect(() => {
    offsetsSV.value = offsets;
  }, [offsets, offsetsSV]);
  useEffect(() => {
    scheduleSV.value = schedule;
  }, [schedule, scheduleSV]);
  useEffect(() => {
    roundSV.value = { startMs: roundStartedAt, playing };
  }, [roundStartedAt, playing, roundSV]);
  useEffect(() => {
    phase.value = roundPhase;
    if (!playing) return;
    balls.modify((list) => {
      'worklet';
      list.length = 0;
      return list;
    });
  }, [roundStartedAt, roundPhase, playing, phase, balls]);

  // New shots arrive in batches once per store tick; they are appended on the UI thread and ended balls are dropped there.
  useEffect(() => {
    return onShots((batch: readonly ShotResult[]) => {
      const startMs = useGame.getState().round?.startedAt ?? Date.now();
      let size = 0;
      for (const s of batch) size += HEAD + s.segments.length * SEG;
      const packed: number[] = new Array(size);
      let o = 0;
      for (const s of batch) {
        packed[o++] = s.endSec;
        packed[o++] = s.radius;
        packed[o++] = s.segments.length;
        for (const g of s.segments) {
          packed[o++] = g.t0;
          packed[o++] = g.t1;
          packed[o++] = g.x;
          packed[o++] = g.y;
          packed[o++] = g.z;
          packed[o++] = g.vx;
          packed[o++] = g.vy;
          packed[o++] = g.vz;
          packed[o++] = g.gy;
        }
      }
      // Hits: when and where (the target's lateral position at the crossing) for the swish, the coins and the pill's pop.
      const m = def.target.motion;
      const roundPhase = useGame.getState().round?.targetPhase ?? 0;
      const newHits: HitRec[] = [];
      for (const s of batch) {
        if (!s.hit) continue;
        const z = m.periodSec > 0 ? m.amplitude * Math.sin((TWO_PI * s.eventSec) / m.periodSec + roundPhase) : m.amplitude * Math.sin(roundPhase);
        newHits.push({ atMs: startMs + s.eventSec * 1000, z });
      }
      if (newHits.length > 0) {
        pulseMoney(Date.now());
        hits.modify((list) => {
          'worklet';
          const now = Date.now();
          let w = 0;
          for (let i = 0; i < list.length; i++) {
            const h = list[i]!;
            if (now - h.atMs < HIT_SEC * 1000) list[w++] = h;
          }
          list.length = w;
          for (let i = 0; i < newHits.length; i++) list.push(newHits[i]!);
          if (list.length > MAX_HITS) list.splice(0, list.length - MAX_HITS);
          return list;
        });
      }
      const count = batch.length;
      balls.modify((list) => {
        'worklet';
        const now = Date.now();
        let w = 0;
        for (let i = 0; i < list.length; i++) {
          const b = list[i]!;
          if ((now - b.startMs) / 1000 < b.end) list[w++] = b;
        }
        list.length = w;
        let p = 0;
        for (let i = 0; i < count; i++) {
          const end = packed[p]!;
          const r = packed[p + 1]!;
          const n = packed[p + 2]!;
          const seg = packed.slice(p + HEAD, p + HEAD + n * SEG);
          list.push({ startMs, seg, end, r });
          p += HEAD + n * SEG;
        }
        if (list.length > MAX_BALLS) list.splice(0, list.length - MAX_BALLS);
        return list;
      });
    });
  }, [balls, hits, def]);

  // Hit feedback (design rules section 9, "Hit"): the net swishes, a ring spreads from the rim and fades, a coin pops up from the
  // hoop and fades, the money pill pops (ui/feedback.ts). All from the hit records, on the UI thread.
  const hitPaths = useDerivedValue(() => {
    clock.value;
    const nowMs = Date.now();
    const list = hits.value;
    const rings = Skia.PathBuilder.Make();
    const coins = Skia.PathBuilder.Make();
    const coinsInk = Skia.PathBuilder.Make();
    let swish = 0;
    const cy = def.target.center.y;
    for (let i = 0; i < list.length; i++) {
      const h = list[i]!;
      const age = (nowMs - h.atMs) / 1000;
      if (age < 0 || age >= HIT_SEC) continue;
      const u = age / HIT_SEC;
      const s = scaleAt(cam, cx, h.z);
      const rx = def.target.halfWidth * s * (1 + 1.2 * u);
      const ry = rx * flatRatio(cam, cx, cy, h.z);
      const mx = screenX(cam, cx, h.z);
      const my = screenY(cam, cx, cy, h.z);
      if (u < 0.5) rings.addOval({ x: mx - rx, y: my - ry, width: 2 * rx, height: 2 * ry });
      // The coin rises from the rim and shrinks away.
      const rise = 0.9 * s * u;
      const cr = 0.11 * s * (1 - 0.6 * u);
      coinsInk.addCircle(mx, my - 0.3 * s - rise, cr + border.width);
      coins.addCircle(mx, my - 0.3 * s - rise, cr);
      // The net: a quick bulge that settles in 350 ms.
      if (age < 0.35) {
        const w = Math.sin((Math.PI * age) / 0.35) * (1 - age / 0.35);
        if (w > swish) swish = w;
      }
    }
    return { rings: rings.detach(), coins: coins.detach(), coinsInk: coinsInk.detach(), swish };
  });
  const hitRings = useDerivedValue(() => hitPaths.value.rings);
  const hitCoins = useDerivedValue(() => hitPaths.value.coins);
  const hitCoinsInk = useDerivedValue(() => hitPaths.value.coinsInk);
  const rimY = screenY(cam, cx, def.target.center.y);
  const netTransform = useDerivedValue(() => [{ translateY: rimY }, { scaleY: 1 + 0.35 * hitPaths.value.swish }, { translateY: -rimY }]);

  // Every ball in flight, rebuilt on the UI thread each frame from the engine's segments and sorted into three depth groups so the
  // target and the character occlude correctly: far (behind the board), mid, near (in front of the character). Each group is an ink
  // path of slightly larger circles under a fill path, so every ball keeps the same outline width at any size. One path of flat
  // ellipses on the floor is the shadows. The clock in the closure makes it run every frame.
  const ballPaths = useDerivedValue(() => {
    clock.value;
    const nowMs = Date.now();
    const list = balls.value;
    const far = Skia.PathBuilder.Make();
    const farInk = Skia.PathBuilder.Make();
    const mid = Skia.PathBuilder.Make();
    const midInk = Skia.PathBuilder.Make();
    const near = Skia.PathBuilder.Make();
    const nearInk = Skia.PathBuilder.Make();
    const shadow = Skia.PathBuilder.Make();
    const nearDepth = ox + NEAR_DEPTH;
    for (let i = 0; i < list.length; i++) {
      const b = list[i]!;
      const t = (nowMs - b.startMs) / 1000;
      const seg = b.seg;
      const n = seg.length / SEG;
      if (n === 0 || t < seg[0]! || t >= b.end) continue;
      let k = n - 1;
      for (let j = 0; j < n; j++) {
        if (t < seg[j * SEG + 1]!) {
          k = j;
          break;
        }
      }
      const o = k * SEG;
      const dt = Math.min(t, seg[o + 1]!) - seg[o]!;
      const x = seg[o + 2]! + seg[o + 5]! * dt;
      const y = seg[o + 3]! + seg[o + 6]! * dt + 0.5 * seg[o + 8]! * dt * dt;
      const z = seg[o + 4]! + seg[o + 7]! * dt;
      const s = scaleAt(cam, x, z);
      const sx = screenX(cam, x, z);
      const sy = screenY(cam, x, y, z);
      let rp = b.r * s;
      if (rp < 2) rp = 2;
      const ink = x >= farDepth ? farInk : x < nearDepth ? nearInk : midInk;
      const fill = x >= farDepth ? far : x < nearDepth ? near : mid;
      ink.addCircle(sx, sy, rp + border.width);
      fill.addCircle(sx, sy, rp);
      const ry = rp * flatRatio(cam, x, 0, z);
      const sy0 = screenY(cam, x, 0, z);
      shadow.addOval({ x: sx - rp, y: sy0 - ry, width: 2 * rp, height: 2 * ry });
    }
    return {
      far: far.detach(),
      farInk: farInk.detach(),
      mid: mid.detach(),
      midInk: midInk.detach(),
      near: near.detach(),
      nearInk: nearInk.detach(),
      shadow: shadow.detach(),
    };
  });
  const farBalls = useDerivedValue(() => ballPaths.value.far);
  const farBallsInk = useDerivedValue(() => ballPaths.value.farInk);
  const midBalls = useDerivedValue(() => ballPaths.value.mid);
  const midBallsInk = useDerivedValue(() => ballPaths.value.midInk);
  const nearBalls = useDerivedValue(() => ballPaths.value.near);
  const nearBallsInk = useDerivedValue(() => ballPaths.value.nearInk);
  const ballShadows = useDerivedValue(() => ballPaths.value.shadow);

  // Target motion, smooth on the UI thread and continuous across rounds: the store picks each round's phase so that the engine's
  // sin(2π t / period + phase) equals this idle curve sin(2π wallSeconds / period) at the moment the round starts. A target that
  // does not move during a round (golf) sits at the round's phase. The target moves sideways at one depth, so it is one translation.
  const targetScale = scaleAt(cam, cx);
  const targetTransform = useDerivedValue(() => {
    clock.value;
    const m = def.target.motion;
    let z = 0;
    if (m.periodSec <= 0) z = m.amplitude * Math.sin(phase.value);
    else z = m.amplitude * Math.sin((TWO_PI * (Date.now() / 1000)) / m.periodSec);
    return [{ translateX: z * targetScale }];
  });

  // The aim line is the arc a perfect ball flies from the hand to the aim point (owner, third phone test): the engine's own pitch for
  // the first limb's ball, sampled along the way and projected. The pitch is tabulated over the yaw range on the JS thread whenever the
  // ball changes; the UI thread interpolates. The spread cone is the same arc swung to the yaw's two edges.
  const gravity = balance.physics.gravity;
  const pitchTable = useMemo(() => {
    const out: number[] = new Array(PITCH_TABLE);
    for (let i = 0; i < PITCH_TABLE; i++) {
      const yaw = -MAX_YAW + (2 * MAX_YAW * i) / (PITCH_TABLE - 1);
      out[i] = launchPitch(def, ball, gravity, dx * Math.tan(yaw));
    }
    return out;
  }, [def, ball, gravity, dx]);
  const pitchTableSV = useSharedValue<number[]>(pitchTable);
  const speedSV = useSharedValue(ball.launchSpeed);
  useEffect(() => {
    pitchTableSV.value = pitchTable;
    speedSV.value = ball.launchSpeed;
  }, [pitchTable, ball.launchSpeed, pitchTableSV, speedSV]);
  const arcArgs = useMemo(() => ({ cam, ox, oy, dx, gravity }), [cam, ox, oy, dx, gravity]);
  const aimPath = useDerivedValue(() => {
    const p = Skia.PathBuilder.Make();
    appendArc(p, arcArgs, pitchTableSV.value, speedSV.value, aim.value);
    return p.detach();
  });
  const conePath = useDerivedValue(() => {
    const p = Skia.PathBuilder.Make();
    const half = (spreadSV.value * Math.PI) / 180;
    appendArc(p, arcArgs, pitchTableSV.value, speedSV.value, aim.value - half);
    appendArc(p, arcArgs, pitchTableSV.value, speedSV.value, aim.value + half);
    return p.detach();
  });

  // The character, posed by the rig every frame in its own frame (x forward from the shot origin, y up, z right), then projected.
  // Seen from behind, the arms anchored on the back are nearest to the camera and are drawn over the torso; the others under it.
  const bodyScale = scaleAt(cam, ox);
  const armStroke = Math.max(6, 0.06 * BODY_H * bodyScale);
  const legStroke = Math.max(8, 0.1 * BODY_H * bodyScale);
  const bodyPaths = useDerivedValue(() => {
    clock.value;
    const nowMs = Date.now();
    const round = roundSV.value;
    const sched = scheduleSV.value;
    const offs = offsetsSV.value;
    const aimZ = dx * Math.tan(aim.value);
    const t = (nowMs - round.startMs) / 1000;
    const timings: (ArmTiming | null)[] = new Array(anchors.length);
    for (let i = 0; i < anchors.length; i++) {
      const off = offs[i] ?? 0;
      const yaw = Math.atan2(aimZ - off, dx);
      if (round.playing) {
        const period = sched.period[i] ?? Number.POSITIVE_INFINITY;
        timings[i] = { tau: tauFor(t, sched.first[i] ?? 0, period), period, yaw, offset: off };
      } else {
        timings[i] = { tau: -10, period: Number.POSITIVE_INFINITY, yaw, offset: off };
      }
    }
    const pose = poseBody({ anchors, timings, releaseY: oy, time: nowMs / 1000 });

    const sx = (v: Vec) => screenX(cam, ox + v.x, v.z);
    const sy = (v: Vec) => screenY(cam, ox + v.x, v.y, v.z);

    const chestArms = Skia.PathBuilder.Make();
    const chestHands = Skia.PathBuilder.Make();
    const backArms = Skia.PathBuilder.Make();
    const backHands = Skia.PathBuilder.Make();
    const heldInkChest = Skia.PathBuilder.Make();
    const heldChest = Skia.PathBuilder.Make();
    const heldInkBack = Skia.PathBuilder.Make();
    const heldBack = Skia.PathBuilder.Make();
    for (let i = 0; i < pose.arms.length; i++) {
      const arm = pose.arms[i]!;
      const arms = arm.behind ? backArms : chestArms;
      const hands = arm.behind ? backHands : chestHands;
      const heldInk = arm.behind ? heldInkBack : heldInkChest;
      const held = arm.behind ? heldBack : heldChest;
      arms.moveTo(sx(arm.shoulder), sy(arm.shoulder));
      arms.lineTo(sx(arm.elbow), sy(arm.elbow));
      arms.lineTo(sx(arm.wrist), sy(arm.wrist));
      hands.moveTo(sx(arm.wrist), sy(arm.wrist));
      hands.lineTo(sx(arm.tip), sy(arm.tip));
      if (arm.holding > 0) {
        const r = sched.radii[i] ?? 0.1;
        // The ball sits just past the fingertips.
        const dxh = arm.tip.x - arm.wrist.x;
        const dyh = arm.tip.y - arm.wrist.y;
        const dzh = arm.tip.z - arm.wrist.z;
        const l = Math.sqrt(dxh * dxh + dyh * dyh + dzh * dzh) || 1;
        const c = { x: arm.tip.x + (dxh / l) * r * 0.9, y: arm.tip.y + (dyh / l) * r * 0.9, z: arm.tip.z + (dzh / l) * r * 0.9 };
        const rp = r * scaleAt(cam, ox + c.x, c.z);
        heldInk.addCircle(sx(c), sy(c), rp + border.width);
        held.addCircle(sx(c), sy(c), rp);
      }
    }

    const legs = Skia.PathBuilder.Make();
    const feet = Skia.PathBuilder.Make();
    for (const leg of pose.legs) {
      legs.moveTo(sx(leg.hip), sy(leg.hip));
      legs.lineTo(sx(leg.knee), sy(leg.knee));
      legs.lineTo(sx(leg.ankle), sy(leg.ankle));
      feet.moveTo(sx(leg.ankle), sy(leg.ankle));
      feet.lineTo(sx(leg.toe), sy(leg.toe));
    }

    // Torso: a trapezoid from the hips up to wider shoulders, leaning with them. Filled, then stroked with round joins for the
    // outline, so the corners come out rounded.
    const torso = Skia.PathBuilder.Make();
    const b = border.width;
    const shoulderTop = pose.shoulders.y - 0.01 * BODY_H;
    const hipBottom = pose.hips.y - 0.03 * BODY_H;
    const sl = { x: pose.shoulders.x, y: shoulderTop, z: -TORSO_HALF * BODY_H };
    const sr = { x: pose.shoulders.x, y: shoulderTop, z: TORSO_HALF * BODY_H };
    const hipL = { x: pose.hips.x, y: hipBottom, z: -0.8 * TORSO_HALF * BODY_H };
    const hipR = { x: pose.hips.x, y: hipBottom, z: 0.8 * TORSO_HALF * BODY_H };
    torso.moveTo(sx(sl), sy(sl));
    torso.lineTo(sx(sr), sy(sr));
    torso.lineTo(sx(hipR), sy(hipR));
    torso.lineTo(sx(hipL), sy(hipL));
    torso.close();
    const torsoShape = torso.detach();

    const neck = Skia.PathBuilder.Make();
    const nl = screenX(cam, ox + pose.shoulders.x, -0.05 * BODY_H);
    const nr = screenX(cam, ox + pose.shoulders.x, 0.05 * BODY_H);
    const nt = screenY(cam, ox + pose.shoulders.x, pose.shoulders.y + 0.08 * BODY_H);
    const nb = screenY(cam, ox + pose.shoulders.x, pose.shoulders.y);
    neck.addRect({ x: nl, y: nt, width: nr - nl, height: nb - nt });

    const head = Skia.PathBuilder.Make();
    const headInk = Skia.PathBuilder.Make();
    const ears = Skia.PathBuilder.Make();
    const hr = HEAD_R * BODY_H * scaleAt(cam, ox + pose.head.x);
    headInk.addCircle(sx(pose.head), sy(pose.head), hr + b);
    head.addCircle(sx(pose.head), sy(pose.head), hr);
    for (const side of [-1, 1]) {
      const e = { x: pose.head.x, y: pose.head.y - 0.01 * BODY_H, z: side * HEAD_R * BODY_H * 0.98 };
      ears.addCircle(sx(e), sy(e), 0.025 * BODY_H * bodyScale);
    }

    return {
      chestArms: chestArms.detach(),
      chestHands: chestHands.detach(),
      backArms: backArms.detach(),
      backHands: backHands.detach(),
      heldInkChest: heldInkChest.detach(),
      heldChest: heldChest.detach(),
      heldInkBack: heldInkBack.detach(),
      heldBack: heldBack.detach(),
      legs: legs.detach(),
      feet: feet.detach(),
      torso: torsoShape,
      torsoInk: torsoShape,
      neck: neck.detach(),
      head: head.detach(),
      headInk: headInk.detach(),
      ears: ears.detach(),
    };
  });
  const chestArms = useDerivedValue(() => bodyPaths.value.chestArms);
  const chestHands = useDerivedValue(() => bodyPaths.value.chestHands);
  const backArms = useDerivedValue(() => bodyPaths.value.backArms);
  const backHands = useDerivedValue(() => bodyPaths.value.backHands);
  const heldInkChest = useDerivedValue(() => bodyPaths.value.heldInkChest);
  const heldChest = useDerivedValue(() => bodyPaths.value.heldChest);
  const heldInkBack = useDerivedValue(() => bodyPaths.value.heldInkBack);
  const heldBack = useDerivedValue(() => bodyPaths.value.heldBack);
  const legsPath = useDerivedValue(() => bodyPaths.value.legs);
  const feetPath = useDerivedValue(() => bodyPaths.value.feet);
  const torsoPath = useDerivedValue(() => bodyPaths.value.torso);
  const torsoInkPath = useDerivedValue(() => bodyPaths.value.torsoInk);
  const neckPath = useDerivedValue(() => bodyPaths.value.neck);
  const headPath = useDerivedValue(() => bodyPaths.value.head);
  const headInkPath = useDerivedValue(() => bodyPaths.value.headInk);
  const earsPath = useDerivedValue(() => bodyPaths.value.ears);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          const yaw = yawFromScreenX(cam, cx, dx, e.x);
          aim.value = yaw;
          runOnJS(setAimFromGesture)(yaw);
        })
        .onUpdate((e) => {
          const yaw = yawFromScreenX(cam, cx, dx, e.x);
          aim.value = yaw;
          runOnJS(setAimFromGesture)(yaw);
        }),
    [cam, cx, dx, aim],
  );

  const world = useMemo(() => buildWorld(def, cam, width, height), [def, cam, width, height]);
  const bodyShadow = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.addOval(oval(cam, ox, 0, 0, 0.5));
    return p.detach();
  }, [cam, ox]);
  const target = useMemo(() => buildTarget(def, cam), [def, cam]);

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.root, { width, height }]}>
        <Canvas style={{ width, height }}>
          {/* World: wall, stands, floor, lane */}
          <Rect x={0} y={0} width={width} height={height} color={palette.sky} />
          <Path path={world.stands} color={colors.haze} opacity={0.6} />
          <Path path={world.floor} color={palette.floor} />
          <Path path={world.floorEdge} color={colors.ink} style="stroke" strokeWidth={border.width} />
          <Path path={world.lane} color={colors.paper} style="stroke" strokeWidth={2} opacity={0.7} />

          {/* Shadows of every ball, then the balls behind the target */}
          <Path path={ballShadows} color={colors.ink} opacity={0.22} />
          <Path path={farBallsInk} color={colors.ink} />
          <Path path={farBalls} color={palette.ball} />

          {/* Target: the fixed frame, then the moving part translated sideways */}
          <Path path={target.fixedInk} color={colors.ink} style="stroke" strokeWidth={target.frameWidth} strokeCap="round" />
          <Group transform={targetTransform}>
            <Path path={target.poleInk} color={colors.ink} style="stroke" strokeWidth={target.frameWidth} strokeCap="round" />
            <Path path={target.boardInk} color={colors.ink} />
            <Path path={target.board} color={colors.paper} />
            <Path path={target.boardMark} color={colors.ink} style="stroke" strokeWidth={2} />
            <Group transform={netTransform}>
              <Path path={target.net} color={colors.paper} style="stroke" strokeWidth={2} />
            </Group>
            <Path path={target.rim} color={colors.ink} style="stroke" strokeWidth={target.rimWidth + 2 * border.width} />
            <Path path={target.rim} color={palette.target} style="stroke" strokeWidth={target.rimWidth} />
            <Path path={target.block} color={colors.ink} />
          </Group>

          {/* Hit feedback: the ring from the rim, the coins */}
          <Path path={hitRings} color={palette.target} style="stroke" strokeWidth={border.width} opacity={0.7} />
          <Path path={hitCoinsInk} color={colors.ink} />
          <Path path={hitCoins} color={colors.good} />

          {/* Balls between the target and the character */}
          <Path path={midBallsInk} color={colors.ink} />
          <Path path={midBalls} color={palette.ball} />


          {/* Character from behind: shadow, arms on the far side, legs, torso, arms on the near side, head, the ball in the hands */}
          <Path path={bodyShadow} color={colors.ink} opacity={0.22} />
          <Path path={chestArms} color={colors.ink} style="stroke" strokeWidth={armStroke + 2 * border.width} strokeCap="round" strokeJoin="round" />
          <Path path={chestArms} color={colors.skinShade} style="stroke" strokeWidth={armStroke} strokeCap="round" strokeJoin="round" />
          <Path path={chestHands} color={colors.ink} style="stroke" strokeWidth={armStroke * 1.1 + 2 * border.width} strokeCap="round" />
          <Path path={chestHands} color={colors.skinShade} style="stroke" strokeWidth={armStroke * 1.1} strokeCap="round" />
          <Path path={heldInkChest} color={colors.ink} />
          <Path path={heldChest} color={palette.ball} />
          <Path path={legsPath} color={colors.ink} style="stroke" strokeWidth={legStroke + 2 * border.width} strokeCap="round" strokeJoin="round" />
          <Path path={legsPath} color={colors.trousers} style="stroke" strokeWidth={legStroke} strokeCap="round" strokeJoin="round" />
          <Path path={feetPath} color={colors.ink} style="stroke" strokeWidth={legStroke * 0.8} strokeCap="round" />
          <Path path={torsoInkPath} color={colors.ink} style="stroke" strokeWidth={2 * border.width + 0.05 * BODY_H * bodyScale} strokeJoin="round" />
          <Path path={torsoPath} color={colors.paper} />
          <Path path={torsoPath} color={colors.paper} style="stroke" strokeWidth={0.05 * BODY_H * bodyScale} strokeJoin="round" />
          <Path path={backArms} color={colors.ink} style="stroke" strokeWidth={armStroke + 2 * border.width} strokeCap="round" strokeJoin="round" />
          <Path path={backArms} color={colors.skin} style="stroke" strokeWidth={armStroke} strokeCap="round" strokeJoin="round" />
          <Path path={backHands} color={colors.ink} style="stroke" strokeWidth={armStroke * 1.1 + 2 * border.width} strokeCap="round" />
          <Path path={backHands} color={colors.skin} style="stroke" strokeWidth={armStroke * 1.1} strokeCap="round" />
          <Path path={neckPath} color={colors.skin} />
          <Path path={headInkPath} color={colors.ink} />
          <Path path={headPath} color={colors.hair} />
          <Path path={earsPath} color={colors.skin} />
          <Path path={heldInkBack} color={colors.ink} />
          <Path path={heldBack} color={palette.ball} />

          {/* Aim: the perfect arc from the hand, with the spread's edges */}
          <Path path={conePath} color={colors.ink} style="stroke" strokeWidth={1.5} opacity={0.35} />
          <Path path={aimPath} color={colors.accent} style="stroke" strokeWidth={4} strokeCap="round" strokeJoin="round" />

          {/* Balls in front of the character */}
          <Path path={nearBallsInk} color={colors.ink} />
          <Path path={nearBalls} color={palette.ball} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

interface ArcArgs {
  cam: Camera;
  ox: number;
  oy: number;
  dx: number;
  gravity: number;
}

/**
 * Appends the perfect flight arc for a yaw to a path: from the shot origin to the aim point on the target plane, with the pitch the engine
 * would use (interpolated from the table). Straight world lines are straight on screen, but a parabola is not, so it is sampled.
 */
function appendArc(p: { moveTo(x: number, y: number): unknown; lineTo(x: number, y: number): unknown }, a: ArcArgs, pitches: number[], speed: number, yaw: number): void {
  'worklet';
  const clamped = yaw > MAX_YAW ? MAX_YAW : yaw < -MAX_YAW ? -MAX_YAW : yaw;
  const pos = ((clamped + MAX_YAW) / (2 * MAX_YAW)) * (pitches.length - 1);
  const i0 = Math.floor(pos);
  const i1 = i0 + 1 < pitches.length ? i0 + 1 : i0;
  const frac = pos - i0;
  const pitch = (pitches[i0] ?? 0) * (1 - frac) + (pitches[i1] ?? 0) * frac;
  const lateral = a.dx * Math.tan(clamped);
  const horizontal = Math.sqrt(a.dx * a.dx + lateral * lateral);
  const vh = speed * Math.cos(pitch);
  const vy = speed * Math.sin(pitch);
  const flight = vh > 0 ? horizontal / vh : 0;
  for (let i = 0; i <= ARC_STEPS; i++) {
    const f = i / ARC_STEPS;
    const t = flight * f;
    const x = a.ox + a.dx * f;
    const z = lateral * f;
    const y = a.oy + vy * t - (a.gravity * t * t) / 2;
    const sx = screenX(a.cam, x, z);
    const sy = screenY(a.cam, x, y, z);
    if (i === 0) p.moveTo(sx, sy);
    else p.lineTo(sx, sy);
  }
}

/** The finger's screen x, read at the target's depth, is the aim point; the yaw follows from it. */
function yawFromScreenX(cam: Camera, cx: number, dx: number, sx: number): number {
  'worklet';
  const z = worldZ(cam, cx, sx);
  const yaw = Math.atan2(z, dx);
  return yaw > MAX_YAW ? MAX_YAW : yaw < -MAX_YAW ? -MAX_YAW : yaw;
}

function setAimFromGesture(yaw: number): void {
  useGame.getState().actions.setAim(yaw);
}

// ---------- Static geometry, built once per sport and size ----------

type Rect4 = { x: number; y: number; width: number; height: number };

function oval(cam: Camera, x: number, y: number, z: number, radius: number): Rect4 {
  const s = scaleAt(cam, x, z);
  const rx = radius * s;
  const ry = rx * flatRatio(cam, x, y, z);
  return { x: screenX(cam, x, z) - rx, y: screenY(cam, x, y, z) - ry, width: 2 * rx, height: 2 * ry };
}

/** An upright rectangle facing the character at one depth: z from z0 to z1, y from y0 to y1 (the camera's small yaw is ignored). */
function upright(cam: Camera, x: number, z0: number, z1: number, y0: number, y1: number): Rect4 {
  const zm = (z0 + z1) / 2;
  const left = screenX(cam, x, z0);
  const right = screenX(cam, x, z1);
  const top = screenY(cam, x, y1, zm);
  const bottom = screenY(cam, x, y0, zm);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

interface WorldPaths {
  stands: SkPath;
  floor: SkPath;
  floorEdge: SkPath;
  lane: SkPath;
}

function buildWorld(def: SportDef, cam: Camera, width: number, height: number): WorldPaths {
  const length = def.field.length;
  const hs = def.field.halfSpan;
  const nearX = cam.x + 0.6;
  const floor = Skia.PathBuilder.Make();
  const nearZ = hs + 2;
  floor.moveTo(screenX(cam, length, -hs), screenY(cam, length, 0, -hs));
  floor.lineTo(screenX(cam, length, hs), screenY(cam, length, 0, hs));
  floor.lineTo(screenX(cam, nearX, nearZ), screenY(cam, nearX, 0, nearZ));
  floor.lineTo(screenX(cam, nearX, -nearZ), screenY(cam, nearX, 0, -nearZ));
  floor.close();

  const edge = Skia.PathBuilder.Make();
  edge.moveTo(screenX(cam, length, -hs), screenY(cam, length, 0, -hs));
  edge.lineTo(screenX(cam, length, hs), screenY(cam, length, 0, hs));
  edge.moveTo(screenX(cam, length, -hs), screenY(cam, length, 0, -hs));
  edge.lineTo(screenX(cam, nearX, -hs), screenY(cam, nearX, 0, -hs));
  edge.moveTo(screenX(cam, length, hs), screenY(cam, length, 0, hs));
  edge.lineTo(screenX(cam, nearX, hs), screenY(cam, nearX, 0, hs));

  // A silhouette of stands along the far wall: a band above the far floor edge, with a step. Drawn as the wall's quads so the
  // camera's yaw keeps them in perspective.
  const stands = Skia.PathBuilder.Make();
  const wallZ = hs + 6;
  const quad = (yLo: number, yHi: number, zHalf: number) => {
    stands.moveTo(screenX(cam, length, -zHalf), screenY(cam, length, yHi, -zHalf));
    stands.lineTo(screenX(cam, length, zHalf), screenY(cam, length, yHi, zHalf));
    stands.lineTo(screenX(cam, length, zHalf), screenY(cam, length, yLo, zHalf));
    stands.lineTo(screenX(cam, length, -zHalf), screenY(cam, length, yLo, -zHalf));
    stands.close();
  };
  quad(0, 1.6, wallZ);
  quad(1.6, 2.4, hs * 0.8);

  // The lane: two lines from the character to the target's baseline and the baseline across.
  const lane = Skia.PathBuilder.Make();
  const laneHalf = Math.max(1.0, def.target.halfWidth * 1.4);
  const x0 = def.field.origin.x - 0.6;
  const x1 = Math.min(length - 0.2, def.target.center.x + 0.8);
  for (const z of [-laneHalf, laneHalf]) {
    lane.moveTo(screenX(cam, x0, z), screenY(cam, x0, 0, z));
    lane.lineTo(screenX(cam, x1, z), screenY(cam, x1, 0, z));
  }
  lane.moveTo(screenX(cam, x1, -laneHalf), screenY(cam, x1, 0, -laneHalf));
  lane.lineTo(screenX(cam, x1, laneHalf), screenY(cam, x1, 0, laneHalf));
  void height;
  return { stands: stands.detach(), floor: floor.detach(), floorEdge: edge.detach(), lane: lane.detach() };
}

interface TargetPaths {
  /** The part that never moves: the goal frame. Empty for the hoop and the hole. */
  fixedInk: SkPath;
  frameWidth: number;
  poleInk: SkPath;
  boardInk: SkPath;
  board: SkPath;
  boardMark: SkPath;
  net: SkPath;
  rim: SkPath;
  rimWidth: number;
  /** The keeper (football) as a solid block. Empty otherwise. */
  block: SkPath;
}

/** The target around z = 0; the moving parts are translated sideways by the parent group. */
function buildTarget(def: SportDef, cam: Camera): TargetPaths {
  const t = def.target;
  const cx = t.center.x;
  const cy = t.center.y;
  const s = scaleAt(cam, cx);
  const b = border.width;
  const fixedInk = Skia.PathBuilder.Make();
  const poleInk = Skia.PathBuilder.Make();
  const boardInk = Skia.PathBuilder.Make();
  const board = Skia.PathBuilder.Make();
  const boardMark = Skia.PathBuilder.Make();
  const net = Skia.PathBuilder.Make();
  const rim = Skia.PathBuilder.Make();
  const block = Skia.PathBuilder.Make();
  const frameWidth = Math.max(4, 0.07 * s);

  if (t.kind === 'hoop') {
    const bd = t.backboard;
    const bx = cx + (bd?.dx ?? 0.38);
    const boardHalf = bd?.halfSpan ?? 0.9;
    const by0 = cy + (bd?.yFrom ?? -0.15);
    const by1 = cy + (bd?.yTo ?? 0.95);
    // Pole behind the board, down to the floor.
    const px = bx + 0.3;
    poleInk.moveTo(screenX(cam, px, 0), screenY(cam, px, 0));
    poleInk.lineTo(screenX(cam, px, 0), screenY(cam, px, by0 + 0.2));
    poleInk.lineTo(screenX(cam, bx, 0), screenY(cam, bx, by0 + 0.2));
    // Board with the shooter's square.
    const r = upright(cam, bx, -boardHalf, boardHalf, by0, by1);
    boardInk.addRect({ x: r.x - b, y: r.y - b, width: r.width + 2 * b, height: r.height + 2 * b });
    board.addRect(r);
    boardMark.addRect(upright(cam, bx, -0.3, 0.3, cy, cy + 0.45));
    // Rim: a flat ellipse at the hoop's height; the net hangs to a smaller ellipse below.
    const rimOval = oval(cam, cx, cy, 0, t.halfWidth);
    rim.addOval(rimOval);
    const netBottomY = cy - 0.42;
    const low = oval(cam, cx, netBottomY, 0, t.halfWidth * 0.55);
    net.addOval(low);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TWO_PI;
      const zx = Math.cos(a);
      const zy = Math.sin(a);
      net.moveTo(rimOval.x + rimOval.width / 2 + (rimOval.width / 2) * zx, rimOval.y + rimOval.height / 2 + (rimOval.height / 2) * zy);
      net.lineTo(low.x + low.width / 2 + (low.width / 2) * zx, low.y + low.height / 2 + (low.height / 2) * zy);
    }
    return { fixedInk: fixedInk.detach(), frameWidth, poleInk: poleInk.detach(), boardInk: boardInk.detach(), board: board.detach(), boardMark: boardMark.detach(), net: net.detach(), rim: rim.detach(), rimWidth: Math.max(4, 0.06 * s), block: block.detach() };
  }

  if (t.kind === 'goal') {
    // Posts and bar at the goal line; the keeper block in front of it.
    const top = 2 * cy;
    for (const z of [-t.halfWidth, t.halfWidth]) {
      fixedInk.moveTo(screenX(cam, cx, z), screenY(cam, cx, 0, z));
      fixedInk.lineTo(screenX(cam, cx, z), screenY(cam, cx, top, z));
    }
    fixedInk.moveTo(screenX(cam, cx, -t.halfWidth), screenY(cam, cx, top, -t.halfWidth));
    fixedInk.lineTo(screenX(cam, cx, t.halfWidth), screenY(cam, cx, top, t.halfWidth));
    const kw = t.keeperHalfWidth ?? 0.35;
    const kh = t.keeperHeight ?? 1.9;
    const kx = cx - (t.keeperHalfDepth ?? 0.2);
    block.addRect(upright(cam, kx, -kw, kw, 0, kh));
    return { fixedInk: fixedInk.detach(), frameWidth, poleInk: poleInk.detach(), boardInk: boardInk.detach(), board: board.detach(), boardMark: boardMark.detach(), net: net.detach(), rim: rim.detach(), rimWidth: 4, block: block.detach() };
  }

  // Hole: a dark disc in the floor with a flag.
  block.addOval(oval(cam, cx, 0, 0, t.halfWidth));
  poleInk.moveTo(screenX(cam, cx, 0), screenY(cam, cx, 0));
  poleInk.lineTo(screenX(cam, cx, 0), screenY(cam, cx, 1.6));
  const flag = upright(cam, cx, 0, 0.45, 1.3, 1.6);
  boardInk.addRect({ x: flag.x - b, y: flag.y - b, width: flag.width + 2 * b, height: flag.height + 2 * b });
  board.addRect(flag);
  return { fixedInk: fixedInk.detach(), frameWidth: Math.max(3, 0.03 * s), poleInk: poleInk.detach(), boardInk: boardInk.detach(), board: board.detach(), boardMark: boardMark.detach(), net: net.detach(), rim: rim.detach(), rimWidth: 4, block: block.detach() };
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
});
