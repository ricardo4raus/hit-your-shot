/**
 * The camera of the play field: behind the character, a little above and to the right of it, turned to look at the target (owner decision
 * 2026-11-16, "third person like the reference"; the over-the-shoulder offset came from the first screenshots: from dead behind, the
 * shooting hand hides behind the head and the ball's arc is a vertical line). A pinhole projection with a yaw and no tilt, so straight
 * world lines stay straight on screen. Numbers here are the only place the view is tuned.
 *
 * World (meters, see src/engine/ballistics.ts): x depth toward the target, y height, z lateral (positive = right).
 * Screen (points): origin top-left, y down.
 */
export interface Camera {
  /** Camera position. */
  x: number;
  y: number;
  z: number;
  /** Unit forward vector in the ground plane (x, z) and the unit right vector. */
  fx: number;
  fz: number;
  rx: number;
  rz: number;
  /** Focal length in points: how many points one meter spans at one meter of depth. */
  f: number;
  /** Screen x of the camera's line of sight. */
  centerX: number;
  /** Screen y of the horizon (points at the camera's height). */
  horizonY: number;
}

/** Meters the camera stands behind the shot origin. */
const CAM_BACK = 3.8;
/** Meters the camera stands to the right of the character: it looks over the right shoulder. */
const CAM_SIDE = 1.0;
/** Camera height: a little below the character's eyes, so the hoop is clearly above and the floor clearly below. */
const CAM_HEIGHT = 1.5;
/** The horizon sits at this fraction of the field height from the top. */
const HORIZON_FRACTION = 0.5;
/** Focal length as a fraction of the field height: the character (3.8 m away) spans about 37% of the height (owner 2026-11-19: smaller). */
const FOCAL_FRACTION = 0.8;
/** Nothing closer than this is projected (it would blow up); points in front of it are clamped to it. */
const MIN_DEPTH = 0.4;

/** The camera looks at (targetX, 0): the target's line, so the target sits on the screen's center line and the character to the left. */
export function makeCamera(width: number, height: number, originX: number, targetX: number): Camera {
  const x = originX - CAM_BACK;
  const z = CAM_SIDE;
  const yaw = Math.atan2(0 - z, targetX - x);
  const fx = Math.cos(yaw);
  const fz = Math.sin(yaw);
  return { x, y: CAM_HEIGHT, z, fx, fz, rx: -fz, rz: fx, f: FOCAL_FRACTION * height, centerX: width / 2, horizonY: HORIZON_FRACTION * height };
}

/** Depth of a world point along the line of sight, never below MIN_DEPTH. */
function depthOf(cam: Camera, x: number, z: number): number {
  'worklet';
  const d = (x - cam.x) * cam.fx + (z - cam.z) * cam.fz;
  return d < MIN_DEPTH ? MIN_DEPTH : d;
}

/** Scale (points per meter) at a world point. */
export function scaleAt(cam: Camera, x: number, z = 0): number {
  'worklet';
  return cam.f / depthOf(cam, x, z);
}

export function screenX(cam: Camera, x: number, z: number): number {
  'worklet';
  const lateral = (x - cam.x) * cam.rx + (z - cam.z) * cam.rz;
  return cam.centerX + lateral * scaleAt(cam, x, z);
}

export function screenY(cam: Camera, x: number, y: number, z = 0): number {
  'worklet';
  return cam.horizonY - (y - cam.y) * scaleAt(cam, x, z);
}

/** Vertical squash of a horizontal circle at (x, y, z): a disc on the floor or the rim seen from above or below. */
export function flatRatio(cam: Camera, x: number, y: number, z = 0): number {
  'worklet';
  const r = Math.abs(y - cam.y) / depthOf(cam, x, z);
  return r > 1 ? 1 : r;
}

/** The world z where a screen x meets the plane x = planeX: used to turn the finger into an aim point on the target plane. */
export function worldZ(cam: Camera, planeX: number, sx: number): number {
  'worklet';
  // Two passes: the depth of the plane along the line of sight depends a little on the lateral position.
  let depth = (planeX - cam.x) / cam.fx;
  let lateral = ((sx - cam.centerX) * depth) / cam.f;
  depth = (planeX - cam.x - lateral * cam.rx) / cam.fx;
  lateral = ((sx - cam.centerX) * depth) / cam.f;
  return cam.z + depth * cam.fz + lateral * cam.rz;
}
