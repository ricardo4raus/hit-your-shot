/**
 * The aim guide: the arc a perfect ball flies from the hand to the aim point (owner, third phone test), the engine's own pitch for the
 * first limb's ball, projected. The pitch is tabulated over the yaw range on the JS thread whenever the ball changes; the UI thread
 * interpolates. Drawn like a game guide, not a debug line: a row of ink-outlined dots that flow gently toward the target and taper at
 * both ends, a thin rim-sized landing ring on the target plane at the aim point, and the spread as two short rows of faint dots (the
 * arc swung to the yaw's two edges) near the target, so accuracy upgrades visibly pull them together.
 * Owner of this file: the "juice" agent.
 */
import { Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { launchPitch, type BallDef, type SportDef } from '@/engine';
import { balance } from '@/store/game';
import { border, colors } from '@/ui/theme';

import { fx } from '../fx/palette';
import { flatRatio, scaleAt, screenX, screenY, type Camera } from '../camera';

export const MAX_YAW = (70 * Math.PI) / 180;
/** Faint dots along each spread edge, over the flight from EDGE_FROM to the target plane. */
const EDGE_DOTS = 6;
const EDGE_FROM = 0.62;
/** Dots along the arc, and how many dot spacings they move per second. */
const DOTS = 22;
const FLOW_PER_SEC = 1.1;
/** Dot radius in meters at the dot's depth, plus a floor in points so far dots stay visible. */
const DOT_M = 0.024;
const DOT_MIN = 1.8;
/** The pitch the engine solves, tabulated over the yaw range for the UI thread (the engine itself stays off that thread). */
const PITCH_TABLE = 141;
/** The landing ring is never flatter than this (height / width). */
const MIN_FLAT = 0.38;

export interface AimLayerProps {
  def: SportDef;
  cam: Camera;
  ball: BallDef;
  aim: SharedValue<number>;
  /** Spread half-angle in degrees. */
  spread: SharedValue<number>;
  /** Skia's frame clock, for the flowing dots. */
  clock: SharedValue<number>;
}

export function AimLayer({ def, cam, ball, aim, spread, clock }: AimLayerProps) {
  const ox = def.field.origin.x;
  const oy = def.field.origin.y;
  const dx = def.target.center.x - ox;
  const ty = def.target.center.y;
  const kind = def.target.kind;
  // The landing ring is the rim's size at the hoop, a ball's size at the goal (the mouth is wide), a little over the hole's size.
  const ringR = kind === 'goal' ? 0.3 : kind === 'hole' ? Math.max(0.15, def.target.halfWidth) : def.target.halfWidth;
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

  const paths = useDerivedValue(() => {
    clock.value;
    const pitches = pitchTableSV.value;
    const speed = speedSV.value;
    const yaw = aim.value;
    const half = (spread.value * Math.PI) / 180;
    const pt = { x: 0, y: 0, s: 0 };

    // The spread: two short rows of faint dots along the arc swung to the yaw's two edges, over the last part of the flight, so the
    // gap between them at the target is the spread there. Never a disc over the target.
    const edges = Skia.PathBuilder.Make();
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < EDGE_DOTS; i++) {
        const f = EDGE_FROM + ((1 - EDGE_FROM) * i) / (EDGE_DOTS - 1);
        arcPoint(arcArgs, pitches, speed, yaw + side * half, f, pt);
        edges.addCircle(pt.x, pt.y, 0.62 * (DOT_M * pt.s + DOT_MIN));
      }
    }

    // A thin landing ring on the target plane at the aim point, rim-sized.
    const aimZ = dx * Math.tan(clampYaw(yaw));
    const tx = ox + dx;
    // Seen nearly edge-on a flat ring reads as a bar, so it is drawn a little tipped toward the camera.
    const fr = kind === 'goal' ? 1 : flatRatio(cam, tx, ty, aimZ);
    const flat = fr < MIN_FLAT ? MIN_FLAT : fr;
    const rr = ringR * scaleAt(cam, tx, aimZ);
    const zx = screenX(cam, tx, aimZ);
    const zy = screenY(cam, tx, ty, aimZ);
    const ring = Skia.PathBuilder.Make();
    ring.addOval({ x: zx - rr, y: zy - rr * flat, width: 2 * rr, height: 2 * rr * flat });

    // Flowing dots, tapered at the hand and at the ring.
    const dots = Skia.PathBuilder.Make();
    const dotsInk = Skia.PathBuilder.Make();
    const flow = ((Date.now() / 1000) * FLOW_PER_SEC) % 1;
    for (let i = 0; i < DOTS; i++) {
      const f = (i + flow) / DOTS;
      arcPoint(arcArgs, pitches, speed, yaw, f, pt);
      const inTaper = f < 0.05 ? f / 0.05 : 1;
      const outTaper = f > 0.88 ? (1 - f) / 0.12 : 1;
      const r = (DOT_M * pt.s + DOT_MIN) * inTaper * outTaper;
      if (r < 0.6) continue;
      dotsInk.addCircle(pt.x, pt.y, r + border.thin);
      dots.addCircle(pt.x, pt.y, r);
    }
    return { edges: edges.detach(), ring: ring.detach(), dots: dots.detach(), dotsInk: dotsInk.detach() };
  });
  const edges = useDerivedValue(() => paths.value.edges);
  const ring = useDerivedValue(() => paths.value.ring);
  const dots = useDerivedValue(() => paths.value.dots);
  const dotsInk = useDerivedValue(() => paths.value.dotsInk);
  return (
    <>
      <Path path={edges} color={fx.white} opacity={0.6} />
      <Path path={ring} color={colors.ink} style="stroke" strokeWidth={2 + 2 * border.thin} opacity={0.7} />
      <Path path={ring} color={fx.white} style="stroke" strokeWidth={2} />
      <Path path={dotsInk} color={colors.ink} />
      <Path path={dots} color={fx.white} />
    </>
  );
}

interface ArcArgs {
  cam: Camera;
  ox: number;
  oy: number;
  dx: number;
  gravity: number;
}

function clampYaw(yaw: number): number {
  'worklet';
  return yaw > MAX_YAW ? MAX_YAW : yaw < -MAX_YAW ? -MAX_YAW : yaw;
}

/**
 * The perfect flight for a yaw, at fraction f of the way from the shot origin to the aim point on the target plane, with the pitch the
 * engine would use (interpolated from the table): writes the screen point and the scale there into `out`.
 */
function arcPoint(a: ArcArgs, pitches: number[], speed: number, yaw: number, f: number, out: { x: number; y: number; s: number }): void {
  'worklet';
  const clamped = clampYaw(yaw);
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
  const t = flight * f;
  const x = a.ox + a.dx * f;
  const z = lateral * f;
  const y = a.oy + vy * t - (a.gravity * t * t) / 2;
  out.x = screenX(a.cam, x, z);
  out.y = screenY(a.cam, x, y, z);
  out.s = scaleAt(a.cam, x, z);
}
