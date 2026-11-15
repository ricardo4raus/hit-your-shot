/**
 * The play field: one Skia canvas with the world, the moving target, the character with its procedural limbs, the aim line and cone, and
 * every ball in flight. Ball positions are computed on the UI thread from the segments the engine produced (docs/architecture.md,
 * "The round, live"); React never re-renders per frame. Drag anywhere to aim; the first drag starts a round.
 */
import { Canvas, Circle, Group, Line, Path, Rect, Skia, useClock, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { ballDefOf, limbAnchors, muzzleOffsets, spreadDeg, type ShotResult, type SportId } from '@/engine';
import { balance, useGame } from '@/store/game';
import { onShots } from '@/store/shotBus';
import { border, colors, sportColors } from '@/ui/theme';

/** A ball on the UI thread: flat segment numbers [t0, t1, x, y, vx, vy, gy] × n, plus when it stops being drawn. */
interface BallRec {
  startMs: number;
  seg: number[];
  end: number;
  r: number;
}

const SEG = 7;
/** Packed batch layout per shot: [end, r, segmentCount, then segmentCount × SEG numbers]. One flat array crosses to the UI thread per tick. */
const HEAD = 3;
const MAX_BALLS = balance.physics.maxBallsInFlight;
const AIM_MIN = -0.35;
const AIM_MAX = 1.95;

export interface PlayFieldProps {
  height: number;
}

export function PlayField({ height }: PlayFieldProps) {
  const { width } = useWindowDimensions();
  const sportId = useGame((s) => s.state.currentSport);
  const limbs = useGame((s) => s.state.sports[s.state.currentSport].limbs);
  const accuracy = useGame((s) => s.state.sports[s.state.currentSport].upgrades.accuracy);
  const firstBall = useGame((s) => s.state.sports[s.state.currentSport].limbBalls[0] ?? '');
  const roundStartedAt = useGame((s) => s.round?.startedAt ?? 0);
  const roundPhase = useGame((s) => s.round?.targetPhase ?? 0);
  const playing = useGame((s) => s.phase === 'playing');

  const def = balance.sports[sportId];
  const palette = sportColors[sportId as keyof typeof sportColors];
  // World to screen: meters to points, y up. The floor sits a little above the canvas bottom so the character's feet have ground.
  const scale = width / def.field.width;
  const groundPx = Math.round(height * 0.06);
  const floorY = height - groundPx;
  const toX = (x: number) => x * scale;
  const toY = (y: number) => floorY - y * scale;

  const originX = toX(def.field.origin.x);
  const originY = toY(def.field.origin.y);

  const ball = ballDefOf(balance, sportId, firstBall);
  const spread = ball ? spreadDeg(balance, accuracy, ball) : balance.upgrades.accuracy.baseSpreadDeg;
  const offsets = useMemo(() => muzzleOffsets(limbs, def, balance), [limbs, def]);
  const anchors = useMemo(() => limbAnchors(limbs, def.limb), [limbs, def.limb]);

  // Shared values the UI thread reads every frame.
  const clock = useClock();
  const balls = useSharedValue<BallRec[]>([]);
  const aim = useSharedValue(Math.PI / 4);
  const spreadSV = useSharedValue(spread);
  const phase = useSharedValue(0);
  const offsetsSV = useSharedValue<number[]>(offsets);

  useEffect(() => {
    spreadSV.value = spread;
  }, [spread, spreadSV]);
  useEffect(() => {
    offsetsSV.value = offsets;
  }, [offsets, offsetsSV]);
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
          packed[o++] = g.vx;
          packed[o++] = g.vy;
          packed[o++] = g.gy;
        }
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
  }, [balls]);

  // Every ball in flight as one path of circles, rebuilt on the UI thread each frame from the engine's segments. The clock in the
  // closure makes it run every frame; wall time keeps the playback on the engine's time base. Drawn twice: ink stroke, then fill.
  const ballsPath = useDerivedValue(() => {
    clock.value;
    const nowMs = Date.now();
    const list = balls.value;
    const path = Skia.PathBuilder.Make();
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
      const x = seg[o + 2]! + seg[o + 4]! * dt;
      const y = seg[o + 3]! + seg[o + 5]! * dt + 0.5 * seg[o + 6]! * dt * dt;
      path.addCircle(x * scale, floorY - y * scale, b.r * scale);
    }
    return path.detach();
  });

  // Target motion, smooth on the UI thread and continuous across rounds: the store picks each round's phase so that the engine's
  // sin(2π t / period + phase) equals this idle curve sin(2π wallSeconds / period) at the moment the round starts. A target that
  // does not move during a round (golf) sits at the round's phase.
  const targetX = useDerivedValue(() => {
    clock.value;
    const m = def.target.motion;
    if (m.periodSec <= 0) return (def.target.center.x + m.amplitude * Math.sin(phase.value)) * scale;
    const wall = Date.now() / 1000;
    return (def.target.center.x + m.amplitude * Math.sin((2 * Math.PI * wall) / m.periodSec)) * scale;
  });
  const targetTransform = useDerivedValue(() => [{ translateX: targetX.value }]);

  // Aim line and spread cone from the shot origin.
  const aimPath = useDerivedValue(() => {
    const p = Skia.PathBuilder.Make();
    const len = 2.6 * scale;
    const a = aim.value;
    p.moveTo(originX, originY);
    p.lineTo(originX + Math.cos(a) * len, originY - Math.sin(a) * len);
    return p.detach();
  });
  const conePath = useDerivedValue(() => {
    const p = Skia.PathBuilder.Make();
    const len = 2.6 * scale;
    const half = (spreadSV.value * Math.PI) / 180;
    for (const d of [-half, half]) {
      const a = aim.value + d;
      p.moveTo(originX, originY);
      p.lineTo(originX + Math.cos(a) * len, originY - Math.sin(a) * len);
    }
    return p.detach();
  });

  // Limbs: each one reaches from its body anchor to its muzzle point (origin + perpendicular offset + a hand's reach along the aim).
  const bodyH = 1.6 * scale;
  const bodyX = originX;
  const bodyBase = floorY;
  const limbPaths = useDerivedValue(() => {
    const front = Skia.PathBuilder.Make();
    const back = Skia.PathBuilder.Make();
    const a = aim.value;
    const dx = Math.cos(a);
    const dy = -Math.sin(a);
    const px = -dy;
    const py = dx;
    const reach = 0.42 * scale;
    const offs = offsetsSV.value;
    for (let i = 0; i < anchors.length; i++) {
      const an = anchors[i]!;
      const off = (offs[i] ?? 0) * scale;
      const ax = bodyX + an.x * bodyH + an.side * 0.06 * bodyH;
      const ay = bodyBase - an.y * bodyH;
      const hx = originX + px * off + dx * reach;
      const hy = originY + py * off + dy * reach;
      const path = an.behind ? back : front;
      path.moveTo(ax, ay);
      path.lineTo(hx, hy);
    }
    return { front: front.detach(), back: back.detach() };
  });
  const frontLimbs = useDerivedValue(() => limbPaths.value.front);
  const backLimbs = useDerivedValue(() => limbPaths.value.back);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          const a = Math.atan2(originY - e.y, e.x - originX);
          aim.value = Math.min(AIM_MAX, Math.max(AIM_MIN, a));
          runOnJS(startFromGesture)(aim.value);
        })
        .onUpdate((e) => {
          const a = Math.atan2(originY - e.y, e.x - originX);
          const clamped = Math.min(AIM_MAX, Math.max(AIM_MIN, a));
          aim.value = clamped;
          runOnJS(setAimFromGesture)(clamped);
        }),
    [originX, originY, aim],
  );

  const limbStroke = Math.max(6, 0.11 * bodyH);
  const headR = 0.16 * bodyH;
  const torsoW = 0.36 * bodyH;
  const torsoTop = bodyBase - 0.78 * bodyH;
  const torsoBottom = bodyBase - 0.42 * bodyH;

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.root, { height }]}>
        <Canvas style={{ width, height }}>
          {/* World */}
          <Rect x={0} y={0} width={width} height={height} color={palette.sky} />
          <Rect x={0} y={floorY - height * 0.42} width={width} height={height * 0.42} color={colors.haze} opacity={0.35} />
          <Rect x={0} y={floorY} width={width} height={groundPx} color={palette.floor} />
          <Line p1={vec(0, floorY)} p2={vec(width, floorY)} color={colors.ink} strokeWidth={border.width} />

          {/* Target: what moves is inside the translated group, the rest is static (football: the goal stays, the keeper drifts). */}
          <TargetStatic sport={sportId} toY={toY} scale={scale} palette={palette} />
          <Group transform={targetTransform}>
            <TargetMoving sport={sportId} toY={toY} scale={scale} palette={palette} />
          </Group>

          {/* Character: back limbs, body, front limbs */}
          <Path path={backLimbs} color={colors.ink} style="stroke" strokeWidth={limbStroke + 2 * border.width} strokeCap="round" />
          <Path path={backLimbs} color={colors.skinShade} style="stroke" strokeWidth={limbStroke} strokeCap="round" />
          <Rect x={bodyX - torsoW / 2} y={torsoTop} width={torsoW} height={torsoBottom - torsoTop} color={colors.ink} />
          <Rect x={bodyX - torsoW / 2 + border.width} y={torsoTop + border.width} width={torsoW - 2 * border.width} height={torsoBottom - torsoTop - 2 * border.width} color={colors.paper} />
          <Rect x={bodyX - torsoW / 2} y={torsoBottom} width={torsoW} height={bodyBase - torsoBottom} color={colors.ink} />
          <Rect x={bodyX - torsoW / 2 + border.width} y={torsoBottom} width={torsoW - 2 * border.width} height={bodyBase - torsoBottom - border.width} color={colors.trousers} />
          <Circle cx={bodyX} cy={torsoTop - headR} r={headR + border.width} color={colors.ink} />
          <Circle cx={bodyX} cy={torsoTop - headR} r={headR} color={colors.skin} />
          <Circle cx={bodyX + headR * 0.45} cy={torsoTop - headR * 1.1} r={Math.max(2, headR * 0.12)} color={colors.ink} />
          <Circle cx={bodyX + headR * 0.05} cy={torsoTop - headR * 1.1} r={Math.max(2, headR * 0.12)} color={colors.ink} />
          <Path path={frontLimbs} color={colors.ink} style="stroke" strokeWidth={limbStroke + 2 * border.width} strokeCap="round" />
          <Path path={frontLimbs} color={colors.skin} style="stroke" strokeWidth={limbStroke} strokeCap="round" />

          {/* Aim */}
          <Path path={conePath} color={colors.ink} style="stroke" strokeWidth={1.5} opacity={0.35} />
          <Path path={aimPath} color={colors.accent} style="stroke" strokeWidth={4} strokeCap="round" />

          {/* Balls: ink outline under the fill, same outline width as everything else */}
          <Path path={ballsPath} color={colors.ink} style="stroke" strokeWidth={border.width * 2} />
          <Path path={ballsPath} color={palette.ball} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}

function startFromGesture(angle: number): void {
  const g = useGame.getState();
  g.actions.setAim(angle);
  if (g.phase !== 'playing') g.actions.startRound();
}

function setAimFromGesture(angle: number): void {
  useGame.getState().actions.setAim(angle);
}

interface TargetViewProps {
  sport: SportId;
  toY: (y: number) => number;
  scale: number;
  palette: { target: string };
}

/** The part of the target that does not move. Football: the goal frame at its fixed center. */
function TargetStatic({ sport, toY, scale, palette }: TargetViewProps) {
  const def = balance.sports[sport];
  if (def.target.kind !== 'goal') return null;
  const cx = def.target.center.x * scale;
  const hw = def.target.halfWidth * scale;
  const top = toY(def.target.center.y * 2);
  const bottom = toY(0);
  return (
    <>
      <Rect x={cx - hw - 4} y={top} width={hw * 2 + 8} height={bottom - top} color={colors.ink} />
      <Rect x={cx - hw} y={top + 4} width={hw * 2} height={bottom - top - 4} color={palette.target} opacity={0.5} />
    </>
  );
}

/** The part of the target that moves, drawn around x = 0; the parent group translates it by the motion. */
function TargetMoving({ sport, toY, scale, palette }: TargetViewProps) {
  const def = balance.sports[sport];
  const cy = toY(def.target.center.y);
  const hw = def.target.halfWidth * scale;
  if (def.target.kind === 'hoop') {
    const board = def.target.backboard;
    const bx = (board?.dx ?? 0.38) * scale;
    const by1 = toY(def.target.center.y + (board?.yTo ?? 0.95));
    const by2 = toY(def.target.center.y + (board?.yFrom ?? -0.15));
    const net = Skia.PathBuilder.Make();
    const depth = 0.42 * scale;
    for (let i = 0; i <= 4; i++) {
      const x = -hw + (2 * hw * i) / 4;
      net.moveTo(x, cy);
      net.lineTo(x * 0.6, cy + depth);
    }
    net.moveTo(-hw * 0.6, cy + depth);
    net.lineTo(hw * 0.6, cy + depth);
    const netPath = net.detach();
    return (
      <>
        <Rect x={bx - 3} y={by1} width={10} height={by2 - by1} color={colors.ink} />
        <Rect x={bx} y={by1 + 3} width={4} height={by2 - by1 - 6} color={colors.paper} />
        <Path path={netPath} color={colors.paper} style="stroke" strokeWidth={2} />
        <Line p1={vec(-hw - 2, cy)} p2={vec(hw + 2, cy)} color={colors.ink} strokeWidth={9} strokeCap="round" />
        <Line p1={vec(-hw, cy)} p2={vec(hw, cy)} color={palette.target} strokeWidth={5} strokeCap="round" />
      </>
    );
  }
  if (def.target.kind === 'goal') {
    // The keeper block around the goal's center x: a cone on a stick, as the design rules put it.
    const kw = (def.target.keeperHalfWidth ?? 0.35) * scale;
    const kh = (def.target.keeperHeight ?? 1.9) * scale;
    const kx = def.target.center.x * scale;
    return <Rect x={kx - kw} y={toY(0) - kh} width={kw * 2} height={kh} color={colors.ink} />;
  }
  return <Circle cx={0} cy={toY(0)} r={hw} color={colors.ink} />;
}

const styles = StyleSheet.create({
  root: { width: '100%', overflow: 'hidden' },
});
