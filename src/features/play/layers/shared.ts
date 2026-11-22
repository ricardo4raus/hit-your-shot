/**
 * Types and small geometry helpers shared by the play field's layers (PlayField.tsx composes them in depth order).
 * Each layer is one file with one owner; the props in this file are the contract between them.
 */
import type { SharedValue } from 'react-native-reanimated';

import type { LimbAnchor, SportDef } from '@/engine';

import { flatRatio, scaleAt, screenX, screenY, type Camera } from '../camera';

export const TWO_PI = 2 * Math.PI;

/** A hit on the UI thread: wall time of the sensor crossing and the target's lateral position then. Layers may read more fields later. */
export interface HitRec {
  atMs: number;
  z: number;
}

/** When each limb first fires after the round start, how often, and its ball radius in meters. */
export interface Schedule {
  period: number[];
  first: number[];
  radii: number[];
}

export interface RoundClock {
  startMs: number;
  playing: boolean;
}

/** What every world layer gets. */
export interface SceneProps {
  def: SportDef;
  sportId: string;
  cam: Camera;
  width: number;
  height: number;
  /** Skia's frame clock; reading it in a derived value makes that value update every frame. */
  clock: SharedValue<number>;
}

export interface TargetLayerProps extends SceneProps {
  /** The round's target phase; a still target (golf) sits at it. */
  phase: SharedValue<number>;
  hits: SharedValue<HitRec[]>;
}

export interface CharacterLayerProps extends SceneProps {
  anchors: LimbAnchor[];
  /** Aim yaw in radians. */
  aim: SharedValue<number>;
  round: SharedValue<RoundClock>;
  schedule: SharedValue<Schedule>;
  /** Lateral muzzle offset of each limb, meters. */
  offsets: SharedValue<number[]>;
}

type Rect4 = { x: number; y: number; width: number; height: number };

/** A flat disc of a radius lying at height y: its screen bounding box. */
export function oval(cam: Camera, x: number, y: number, z: number, radius: number): Rect4 {
  const s = scaleAt(cam, x, z);
  const rx = radius * s;
  const ry = rx * flatRatio(cam, x, y, z);
  return { x: screenX(cam, x, z) - rx, y: screenY(cam, x, y, z) - ry, width: 2 * rx, height: 2 * ry };
}

/** An upright rectangle facing the character at one depth: z from z0 to z1, y from y0 to y1 (the camera's small yaw is ignored). */
export function upright(cam: Camera, x: number, z0: number, z1: number, y0: number, y1: number): Rect4 {
  const zm = (z0 + z1) / 2;
  const left = screenX(cam, x, z0);
  const right = screenX(cam, x, z1);
  const top = screenY(cam, x, y1, zm);
  const bottom = screenY(cam, x, y0, zm);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
