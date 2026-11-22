/**
 * The aim guide: the arc a perfect ball flies from the hand to the aim point (owner, third phone test), the engine's own pitch for the
 * first limb's ball, sampled along the way and projected. The pitch is tabulated over the yaw range on the JS thread whenever the ball
 * changes; the UI thread interpolates. The spread cone is the same arc swung to the yaw's two edges.
 * Owner of this file: the "juice" agent.
 */
import { Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { launchPitch, type BallDef, type SportDef } from '@/engine';
import { balance } from '@/store/game';
import { colors } from '@/ui/theme';

import { screenX, screenY, type Camera } from '../camera';

export const MAX_YAW = (70 * Math.PI) / 180;
/** Points along the aim arc. */
const ARC_STEPS = 24;
/** The pitch the engine solves, tabulated over the yaw range for the UI thread (the engine itself stays off that thread). */
const PITCH_TABLE = 141;

export interface AimLayerProps {
  def: SportDef;
  cam: Camera;
  ball: BallDef;
  aim: SharedValue<number>;
  /** Spread half-angle in degrees. */
  spread: SharedValue<number>;
}

export function AimLayer({ def, cam, ball, aim, spread }: AimLayerProps) {
  const ox = def.field.origin.x;
  const oy = def.field.origin.y;
  const dx = def.target.center.x - ox;
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
    const half = (spread.value * Math.PI) / 180;
    appendArc(p, arcArgs, pitchTableSV.value, speedSV.value, aim.value - half);
    appendArc(p, arcArgs, pitchTableSV.value, speedSV.value, aim.value + half);
    return p.detach();
  });
  return (
    <>
      <Path path={conePath} color={colors.ink} style="stroke" strokeWidth={1.5} opacity={0.35} />
      <Path path={aimPath} color={colors.accent} style="stroke" strokeWidth={4} strokeCap="round" strokeJoin="round" />
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
