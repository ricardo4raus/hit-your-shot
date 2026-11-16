/**
 * The camera of the play field: behind and a little above the character, looking down the field at the target (owner decision 2026-11-16,
 * "third person like the reference"). A plain pinhole projection with no tilt, so straight world lines stay straight on screen and every
 * object at one depth is a flat shape scaled by one factor. Numbers here are the only place the view is tuned.
 *
 * World (meters, see src/engine/ballistics.ts): x depth toward the target, y height, z lateral (positive = right).
 * Screen (points): origin top-left, y down.
 */
export interface Camera {
  /** Camera depth (x), behind the shot origin. */
  x: number;
  /** Camera height (y). */
  y: number;
  /** Focal length in points: how many points one meter spans at one meter of depth. */
  f: number;
  /** Screen x of z = 0. */
  centerX: number;
  /** Screen y of the horizon (points at the camera's height). */
  horizonY: number;
}

/** Meters the camera stands behind the shot origin. */
const CAM_BACK = 2.4;
/** Camera height: a little below the character's eyes, so the hoop is clearly above and the floor clearly below. */
const CAM_HEIGHT = 1.5;
/** The horizon sits at this fraction of the field height from the top. */
const HORIZON_FRACTION = 0.48;
/** Focal length as a fraction of the field height: the character (2.4 m away) spans about 60% of the height. */
const FOCAL_FRACTION = 0.8;
/** Nothing closer than this is projected (it would blow up); points in front of it are clamped to it. */
const MIN_DEPTH = 0.4;

export function makeCamera(width: number, height: number, originX: number): Camera {
  return { x: originX - CAM_BACK, y: CAM_HEIGHT, f: FOCAL_FRACTION * height, centerX: width / 2, horizonY: HORIZON_FRACTION * height };
}

/** Scale (points per meter) at world depth x. */
export function scaleAt(cam: Camera, x: number): number {
  'worklet';
  const d = x - cam.x;
  return cam.f / (d < MIN_DEPTH ? MIN_DEPTH : d);
}

export function screenX(cam: Camera, x: number, z: number): number {
  'worklet';
  return cam.centerX + z * scaleAt(cam, x);
}

export function screenY(cam: Camera, x: number, y: number): number {
  'worklet';
  return cam.horizonY - (y - cam.y) * scaleAt(cam, x);
}

/** Vertical squash of a horizontal circle at (x, y): a disc on the floor or the rim seen from above or below. */
export function flatRatio(cam: Camera, x: number, y: number): number {
  'worklet';
  const d = x - cam.x;
  const r = Math.abs(y - cam.y) / (d < MIN_DEPTH ? MIN_DEPTH : d);
  return r > 1 ? 1 : r;
}

/** The world z under a screen x at a given depth: used to turn the finger into an aim point on the target plane. */
export function worldZ(cam: Camera, x: number, sx: number): number {
  'worklet';
  return (sx - cam.centerX) / scaleAt(cam, x);
}
