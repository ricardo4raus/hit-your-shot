/**
 * The play field, seen from behind the character (owner decision 2026-11-16): the character fills the lower middle of the screen with its
 * back to the player, the target sits ahead and smaller, balls fly into the picture. One Skia canvas composed of layers in depth order
 * (layers/): world, ball shadows, balls behind the target, target, hit effects, balls between target and character, the character posed
 * by the rig every frame, the aim guide, balls in front of the character. Ball positions are computed on the UI thread from the segments
 * the engine produced (docs/architecture.md, "The round, live"); React never re-renders per frame.
 * Drag left or right anywhere on the field to aim: the finger's position over the target plane is the aim point. The round is started
 * by the play button (features/round/RoundControls.tsx), not by the drag.
 * Owner of this file: the "juice" agent (wiring only; each layer has its own owner).
 */
import { Canvas, useClock } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { ballDefOf, limbAnchors, limbRates, muzzleOffsets, spreadDeg, type ShotResult } from '@/engine';
import { balance, useGame } from '@/store/game';
import { onShots } from '@/store/shotBus';
import { pulseMoney } from '@/ui/feedback';

import { makeCamera, worldZ, type Camera } from './camera';
import { AimLayer, MAX_YAW } from './layers/AimLayer';
import { BallGroup, BallShadows, SEG, useBallFrame, type BallRec } from './layers/Balls';
import { CharacterLayer } from './layers/CharacterLayer';
import { HIT_SEC, HitFx } from './layers/HitFx';
import { TWO_PI, type HitRec, type RoundClock, type Schedule } from './layers/shared';
import { TargetLayer } from './layers/TargetLayer';
import { WorldLayer } from './layers/WorldLayer';
import { useShotSounds } from './useShotSounds';

const MAX_HITS = 64;
/** Packed batch layout per shot: [end, r, segmentCount, then segmentCount × SEG numbers]. One flat array crosses to the UI thread per tick. */
const HEAD = 3;
const MAX_BALLS = balance.physics.maxBallsInFlight;
/** Balls nearer than this in front of the shot origin are drawn over the character. */
const NEAR_DEPTH = 0.35;

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
  const cam = useMemo(() => makeCamera(width, height, def.field.origin.x, def.target.center.x), [width, height, def.field.origin.x, def.target.center.x]);
  const ox = def.field.origin.x;
  const cx = def.target.center.x;
  const dx = cx - ox;
  /** Balls past this depth are drawn before the target (behind the board or the goal line). */
  const farDepth = def.target.kind === 'hoop' ? cx + (def.target.backboard?.dx ?? 0) : cx;

  const ball = ballDefOf(balance, sportId, firstBall) ?? def.balls[0]!;
  const spread = spreadDeg(balance, accuracy, ball);
  const offsets = useMemo(() => muzzleOffsets(limbs, def, balance), [limbs, def]);
  const anchors = useMemo(() => limbAnchors(limbs, def.limb), [limbs, def.limb]);
  // The rig's schedule: when each limb first fires after the round start and how often, as createRound schedules them.
  const schedule = useMemo<Schedule>(() => {
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
  const scheduleSV = useSharedValue<Schedule>(schedule);
  const roundSV = useSharedValue<RoundClock>({ startMs: 0, playing: false });

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

  useShotSounds();

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
      // Hits: when and where (the target's lateral position at the crossing) for the swish, the effects and the pill's pop.
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

  const ballFrame = useBallFrame({ clock, balls, cam, farDepth, nearDepth: ox + NEAR_DEPTH });

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

  const scene = { def, sportId, cam, width, height, clock };
  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.root, { width, height }]}>
        <Canvas style={{ width, height }}>
          <WorldLayer {...scene} />
          <BallShadows frame={ballFrame} />
          <BallGroup frame={ballFrame} depth="far" sportId={sportId} />
          <TargetLayer {...scene} phase={phase} hits={hits} />
          <HitFx def={def} sportId={sportId} cam={cam} clock={clock} hits={hits} />
          <BallGroup frame={ballFrame} depth="mid" sportId={sportId} />
          <CharacterLayer {...scene} anchors={anchors} aim={aim} round={roundSV} schedule={scheduleSV} offsets={offsetsSV} />
          <AimLayer def={def} cam={cam} ball={ball} aim={aim} spread={spreadSV} />
          <BallGroup frame={ballFrame} depth="near" sportId={sportId} />
        </Canvas>
      </View>
    </GestureDetector>
  );
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

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
});
