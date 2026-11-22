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

/**
 * Telephoto framing (2026-11-22, visual overhaul): the camera stands far back with a long focal length, so the far hoop is large on screen
 * while the near character keeps about the size the owner asked for on 2026-11-19 (scale at the character ~165 pt/m on an 812 pt screen,
 * as before; the hoop went from ~83 to ~112 pt/m). The long lens also flattens depth, which reads as a TV broadcast of an arena.
 * On 375 x 812: hoop rim at y ~206, backboard top ~105, a 4.1 m arc apex at ~57, the character's head top ~391 and hips ~534, just above
 * the cards tray (top at 70% of the height), and the character standing at x ~54, so the ball and the shooting arm stay left of the
 * centered play button (which sits on the tray's top edge, features/round/RoundControls.tsx).
 */
/** Meters the camera stands behind the shot origin. */
const CAM_BACK = 8;
/**
 * How far (meters) the character stands left of the camera's line of sight: it keeps the character left of center, looking over the right
 * shoulder. The camera's own sideways offset follows from it per sport (cameraSide), because the target distance differs: a fixed offset
 * put the character off the left edge in football and golf (2026-11-22 screenshots).
 */
const CHARACTER_OFFSET = 0.65;
/** Camera height: above the character's head, so the court floor opens up below the hoop and the hips land at the cards' top edge. */
const CAM_HEIGHT = 2.5;
/** The horizon sits at this fraction of the field height from the top: the hoop fills the upper half of the space above the cards. */
const HORIZON_FRACTION = 0.33;
/** Focal length as a fraction of the field height: 1.68 x 812 pt over 8.2 m to the character is ~165 pt per meter there. */
const FOCAL_FRACTION = 1.68;
/** Nothing closer than this is projected (it would blow up); points in front of it are clamped to it. */
const MIN_DEPTH = 0.4;

/** The camera's sideways offset that puts the character CHARACTER_OFFSET left of the line from the camera to the target (similar triangles). */
export function cameraSide(dx: number): number {
  const d = dx > 0.5 ? dx : 0.5;
  return (CHARACTER_OFFSET * (d + CAM_BACK)) / d;
}

/** The camera looks at (targetX, 0): the target's line, so the target sits on the screen's center line and the character to the left. */
export function makeCamera(width: number, height: number, originX: number, targetX: number): Camera {
  const x = originX - CAM_BACK;
  const z = cameraSide(targetX - originX);
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
