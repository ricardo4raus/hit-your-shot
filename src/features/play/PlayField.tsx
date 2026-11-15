/**
 * The play field: one Skia canvas with the world, the moving target, the character with its procedural limbs, the aim line and cone, and
 * every ball in flight. Ball positions are computed on the UI thread from the segments the engine produced (docs/architecture.md,
 * "The round, live"); React never re-renders per frame. Drag anywhere to aim; the first drag starts a round.
 */
import { Atlas, Canvas, Circle, Group, Line, Path, Rect, Skia, useClock, useRectBuffer, useRSXformBuffer, vec, type SkImage } from '@shopify/react-native-skia';
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

const SPRITE = 64;
const SEG = 7;
const MAX_BALLS = balance.physics.maxBallsInFlight;
const AIM_MIN = -0.35;
const AIM_MAX = 1.95;

function makeBallSprite(fill: string): SkImage | null {
  const surface = Skia.Surface.MakeOffscreen(SPRITE, SPRITE);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const c = SPRITE / 2;
  const ink = Skia.Paint();
  ink.setColor(Skia.Color(colors.ink));
  canvas.drawCircle(c, c, c, ink);
  const body = Skia.Paint();
  body.setColor(Skia.Color(fill));
  canvas.drawCircle(c, c, c - 5, body);
  // Two-tone split: a lighter top half, the only volume cue the design rules allow on round things.
  const light = Skia.Paint();
  light.setColor(Skia.Color('rgba(255,255,255,0.22)'));
  const top = Skia.PathBuilder.Make();
  top.addArc({ x: 5, y: 5, width: SPRITE - 10, height: SPRITE - 10 }, 180, 180);
  top.close();
  canvas.drawPath(top.detach(), light);
  surface.flush();
  return surface.makeImageSnapshot();
}

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

  const sprite = useMemo(() => makeBallSprite(palette.ball), [palette.ball]);

  // Shared values the UI thread reads every frame.
  const clock = useClock();
  const balls = useSharedValue<BallRec[]>([]);
  const aim = useSharedValue(Math.PI / 4);
  const spreadSV = useSharedValue(spread);
  const roundStart = useSharedValue(0);
  const phase = useSharedValue(0);
  const offsetsSV = useSharedValue<number[]>(offsets);

  useEffect(() => {
    spreadSV.value = spread;
  }, [spread, spreadSV]);
  useEffect(() => {
    offsetsSV.value = offsets;
  }, [offsets, offsetsSV]);
  useEffect(() => {
    roundStart.value = roundStartedAt;
    phase.value = roundPhase;
    if (!playing) return;
    balls.modify((list) => {
      'worklet';
      list.length = 0;
      return list;
    });
  }, [roundStartedAt, roundPhase, playing, roundStart, phase, balls]);

  // New shots arrive in batches once per store tick; they are appended on the UI thread and ended balls are dropped there.
  useEffect(() => {
    return onShots((batch: readonly ShotResult[]) => {
      const startMs = useGame.getState().round?.startedAt ?? Date.now();
      const recs: BallRec[] = batch.map((s) => {
        const seg: number[] = new Array(s.segments.length * SEG);
        for (let i = 0; i < s.segments.length; i++) {
          const g = s.segments[i]!;
          const o = i * SEG;
          seg[o] = g.t0;
          seg[o + 1] = g.t1;
          seg[o + 2] = g.x;
          seg[o + 3] = g.y;
          seg[o + 4] = g.vx;
          seg[o + 5] = g.vy;
          seg[o + 6] = g.gy;
        }
        return { startMs, seg, end: s.endSec, r: s.radius };
      });
      balls.modify((list) => {
        'worklet';
        const now = Date.now();
        let w = 0;
        for (let i = 0; i < list.length; i++) {
          const b = list[i]!;
          if ((now - b.startMs) / 1000 < b.end) list[w++] = b;
        }
        list.length = w;
        for (let i = 0; i < recs.length; i++) list.push(recs[i]!);
        if (list.length > MAX_BALLS) list.splice(0, list.length - MAX_BALLS);
        return list;
      });
    });
  }, [balls]);

  // One sprite rectangle for every slot; the transforms place and scale it.
  const sprites = useRectBuffer(MAX_BALLS, (val) => {
    'worklet';
    val.setXYWH(0, 0, SPRITE, SPRITE);
  });

  const transforms = useRSXformBuffer(MAX_BALLS, (val, i) => {
    'worklet';
    // Reading the clock makes this run every frame.
    const nowMs = clock.value > 0 ? Date.now() : Date.now();
    const list = balls.value;
    if (i >= list.length) {
      val.set(0, 0, -SPRITE, -SPRITE);
      return;
    }
    const b = list[i]!;
    const t = (nowMs - b.startMs) / 1000;
    const seg = b.seg;
    const n = seg.length / SEG;
    if (n === 0 || t < seg[0]! || t >= b.end) {
      val.set(0, 0, -SPRITE, -SPRITE);
      return;
    }
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
    const px = x * scale;
    const py = floorY - y * scale;
    const s = (2 * b.r * scale) / SPRITE;
    val.set(s, 0, px - b.r * scale, py - b.r * scale);
  });

  // Target position, smooth on the UI thread. Idle: keeps moving on the clock so the field is never static.
  const targetX = useDerivedValue(() => {
    const m = def.target.motion;
    const t = roundStart.value > 0 ? (Date.now() - roundStart.value) / 1000 : clock.value / 1000;
    if (m.periodSec <= 0) return (def.target.center.x + m.amplitude * Math.sin(phase.value)) * scale;
    return (def.target.center.x + m.amplitude * Math.sin((2 * Math.PI * t) / m.periodSec + phase.value)) * scale;
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

          {/* Target */}
          <Group transform={targetTransform}>
            <TargetView sport={sportId} toY={toY} scale={scale} palette={palette} />
          </Group>

          {/* Character: back limbs, body, front limbs */}
          <Path path={backLimbs} color={colors.ink} style="stroke" strokeWidth={limbStroke + 2 * border.width} strokeCap="round" />
          <Path path={backLimbs} color="#C9A27A" style="stroke" strokeWidth={limbStroke} strokeCap="round" />
          <Rect x={bodyX - torsoW / 2} y={torsoTop} width={torsoW} height={torsoBottom - torsoTop} color={colors.ink} />
          <Rect x={bodyX - torsoW / 2 + border.width} y={torsoTop + border.width} width={torsoW - 2 * border.width} height={torsoBottom - torsoTop - 2 * border.width} color={colors.paper} />
          <Rect x={bodyX - torsoW / 2} y={torsoBottom} width={torsoW} height={bodyBase - torsoBottom} color={colors.ink} />
          <Rect x={bodyX - torsoW / 2 + border.width} y={torsoBottom} width={torsoW - 2 * border.width} height={bodyBase - torsoBottom - border.width} color="#4A5E8A" />
          <Circle cx={bodyX} cy={torsoTop - headR} r={headR + border.width} color={colors.ink} />
          <Circle cx={bodyX} cy={torsoTop - headR} r={headR} color="#E8B890" />
          <Circle cx={bodyX + headR * 0.45} cy={torsoTop - headR * 1.1} r={Math.max(2, headR * 0.12)} color={colors.ink} />
          <Circle cx={bodyX + headR * 0.05} cy={torsoTop - headR * 1.1} r={Math.max(2, headR * 0.12)} color={colors.ink} />
          <Path path={frontLimbs} color={colors.ink} style="stroke" strokeWidth={limbStroke + 2 * border.width} strokeCap="round" />
          <Path path={frontLimbs} color="#E8B890" style="stroke" strokeWidth={limbStroke} strokeCap="round" />

          {/* Aim */}
          <Path path={conePath} color={colors.ink} style="stroke" strokeWidth={1.5} opacity={0.35} />
          <Path path={aimPath} color={colors.accent} style="stroke" strokeWidth={4} strokeCap="round" />

          {/* Balls */}
          {sprite ? <Atlas image={sprite} sprites={sprites} transforms={transforms} /> : null}
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

/** Static drawing of the target around x = 0; the parent group translates it. */
function TargetView({ sport, toY, scale, palette }: TargetViewProps) {
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
    const top = toY(def.target.center.y * 2);
    const bottom = toY(0);
    return (
      <>
        <Rect x={-hw - 4} y={top} width={hw * 2 + 8} height={bottom - top} color={colors.ink} />
        <Rect x={-hw} y={top + 4} width={hw * 2} height={bottom - top - 4} color={palette.target} opacity={0.5} />
      </>
    );
  }
  return <Circle cx={0} cy={toY(0)} r={hw} color={colors.ink} />;
}

const styles = StyleSheet.create({
  root: { width: '100%', overflow: 'hidden' },
});
