/**
 * MODULE: ballistics. Owner: agent "ballistics". docs/architecture.md "Shot resolution".
 * The heart of the game: where the target is, where a shot goes, whether it scores, and where the ball is at any time.
 *
 * The world is seen from behind the character (third person, owner decision 2026-11-16). Units are meters:
 *   x = depth, from the camera toward the target (0 = back wall behind the character, field.length = far wall),
 *   y = height, 0 = floor, up positive,
 *   z = lateral, 0 = the character's spine, positive = the player's right. Side walls at z = ±field.halfSpan.
 * The target's x and y are fixed per sport; what moves is its z (the hoop slides sideways, the keeper drifts sideways, the hole sits at a
 * different z each round). Gravity `balance.physics.gravity` acts downward (segment.gy = -gravity); nothing acts on z between contacts.
 *
 * Rules:
 * - Pure. No Math.random, no Date. All randomness through `rng`. Fixed time step `balance.physics.stepSec`; never adapt the step.
 * - The player aims a **yaw** only (`ShotInput.aim`, radians, 0 = straight down the field, positive = right). It defines an **aim point**
 *   on the target plane: z = tan(aim) × (target.x − origin.x) at the target's height. Every limb shoots at that point from its own lateral
 *   offset (the limbs converge; lead decision 2026-11-16, so extra limbs are extra shots and not extra misses). The launch **pitch** is
 *   solved by `launchPitch` so that a perfect shot passes through the aim point ('high' arc for the hoop, 'low' for the goal and the hole).
 *   The spread is a cone around that direction: one `spreadRoll` for the size of the deviation and one uniform angle for its direction,
 *   split into a yaw part and a pitch part. A player with perfect accuracy therefore only has to track the target sideways.
 * - `targetPose(def, t, phase)`:
 *     hoop: center (center.x, center.y, amplitude × sin(2π t / periodSec + phase)) (periodSec 0 → z = 0), keeper null.
 *     goal: center fixed at z = 0; keeper at (center.x − keeperHalfDepth, keeperHeight / 2, amplitude × sin(...)).
 *     hole: center (center.x, 0, amplitude × sin(phase)) (static during the round, differs per round), keeper null.
 * - `resolveShot`:
 *     1. start = (origin.x, origin.y, offset); limbYaw = atan2(aimPointZ − offset, dx); yaw = limbYaw + deviation × cos(angle),
 *        pitch = launchPitch(lateral distance to the aim point) + deviation × sin(angle).
 *     2. speed = ball.launchSpeed; radius = ballRadius × radiusMult.
 *     3. March t from input.t in steps. Each step: integrate the parabola, then test in this order: sensor, floor, back and far wall,
 *        side walls, ceiling, backboard (hoop), rim ring (hoop), keeper box (goal). A contact reflects the velocity with the surface's
 *        restitution and keeps `friction` of the tangential speed, pushes the ball out of the surface, and closes the current segment /
 *        opens a new one at that time.
 *     4. Sensor: hoop: the ball center crosses the plane y = center.y downward inside the circle of radius halfWidth around the hoop
 *        center; goal: crosses the plane x = center.x forward with 0 ≤ y ≤ 2 × center.y and |z| ≤ halfWidth, and not inside the keeper;
 *        hole: the ball's center reaches the floor (y = radius, interpolated between steps) or rolls on it within halfWidth of the hole.
 *        A hit ends the flight after
 *        `hitLingerSec` with a short falling segment (hoop: straight down through the net; hole: stop; goal: stop in the net).
 *     5. Rest: on the floor with speed < restSpeed → the ball stops; endSec = t + restLingerSec. Also stop at maxFlightSec.
 *     6. value = input.valueIfHit on a hit, 0 otherwise. The result's `limb` is filled by the caller (round.ts), set it to 0 here.
 * - Segments must be contiguous: segments[i].t1 === segments[i+1].t0, first t0 === input.t, last t1 === endSec.
 * - `positionAt(segments, t, out)`: writes the position into `out`, returns false when t is before the first or at/after the last segment.
 *   Worklet-safe: plain loops and arithmetic, no closures over module state, no allocation. The UI runs this per ball per frame.
 * - `solveAim(speed, gravity, dx, dy, arc)`: launch angle to pass through (dx, dy) from the origin, 'high' or 'low' arc, or null when out
 *   of range. `launchPitch(def, ball, gravity, lateral)` wraps it for the sport's target at a lateral distance `lateral` from the shooter.
 * - `predictYaw(def, ball, gravity, t, phase)`: the yaw that meets the moving target where it will be when the ball arrives. The estimate
 *   and the bot aim with it; the UI may show it as a hint.
 * - Performance target: one 6 s flight in under 60 µs on a laptop (Node). Avoid allocation inside the step loop; `segments` is the
 *   only array built per shot.
 *
 * May import only: ./types, ./balance, ./rng.
 *
 * Implementation notes (decisions where the rules above were open):
 * - Within a segment the position is always evaluated from the segment start with the exact parabola, never accumulated step by step,
 *   so what the resolver tested is exactly what `positionAt` plays back.
 * - The hoop and goal sensors use a continuous crossing test between the previous and the current step position, so a fast ball cannot
 *   skip them. The crossing time is linearly interpolated and the crossing point is then taken from the parabola at that time.
 * - Solid surfaces use a per-step penetration test with push-out. Pushing a ball upward adds potential energy; that amount is removed
 *   from the kinetic energy afterwards, so the total mechanical energy never increases at a contact, whatever the restitution.
 * - A floor bounce whose rebound speed is below what gravity adds in one step (gravity × stepSec) leaves the ball rolling: vertical
 *   speed 0 and a segment with gy = 0. This avoids an endless chain of microscopic bounces, each of which would be a new segment.
 * - Rest is tested at every contact while the ball is on the floor (a bounce or a roll); a rolling ball only changes speed at contacts.
 * - After a hoop hit the ball drops straight down from the crossing point, slowed by the net so that it reaches the floor exactly at
 *   endSec (never faster than it was falling). After a goal it stops in the net; after a hole it stops on the floor at the hole.
 * - The rim is a ring (torus) of radius halfWidth in the horizontal plane through the hoop center, with tube radius rimRadius. The
 *   contact normal points from the nearest ring point to the ball center.
 * - The keeper is a solid box in front of the goal line (depth 2 × keeperHalfDepth) that uses wallRestitution. The ball leaves it through
 *   the face it penetrated least.
 * - The pitch is solved for the true horizontal distance from the limb to the aim point, so aiming at the side of the rail does not fall
 *   short. A target out of range of the ball falls back to 45°.
 * - A start point outside the field (very wide limb offsets) is clamped to the field so the ball never starts inside a wall or floor.
 * - An unknown ball id falls back to the sport's first ball instead of throwing, so a bad save can never break the round loop.
 */
import type { Balance, BallDef, SportDef } from './balance';
import { gaussianish } from './rng';
import type { Rng, Segment, ShotInput, ShotResult, TargetPose, Vec3 } from './types';

export type Arc = 'high' | 'low';

const TWO_PI = 2 * Math.PI;
const FALLBACK_PITCH = Math.PI / 4;
/** The aim point is clamped to yaws up to this; beyond it the distance along the yaw would explode. */
const MAX_AIM_YAW = (80 * Math.PI) / 180;

export function spreadRoll(rng: Rng, spreadDeg: number): number {
  return (gaussianish(rng) * spreadDeg * Math.PI) / 180;
}

/** Lateral offset of a moving target at round time t. periodSec 0 means the target does not move. */
function motionOffset(amplitude: number, periodSec: number, t: number, phase: number): number {
  if (periodSec <= 0 || amplitude === 0) return 0;
  return amplitude * Math.sin((TWO_PI * t) / periodSec + phase);
}

/** The arc a sport is played with: lobs into the hoop, flat shots at the goal and the hole. */
export function arcFor(kind: SportDef['target']['kind']): Arc {
  return kind === 'hoop' ? 'high' : 'low';
}

export function targetPose(def: SportDef, t: number, phase: number): TargetPose {
  const target = def.target;
  const motion = target.motion;
  if (target.kind === 'hoop') {
    return {
      center: { x: target.center.x, y: target.center.y, z: motionOffset(motion.amplitude, motion.periodSec, t, phase) },
      halfWidth: target.halfWidth,
      keeper: null,
    };
  }
  if (target.kind === 'goal') {
    const keeperHeight = target.keeperHeight ?? 0;
    const keeperHalfDepth = target.keeperHalfDepth ?? 0;
    return {
      center: { x: target.center.x, y: target.center.y, z: 0 },
      halfWidth: target.halfWidth,
      keeper: { x: target.center.x - keeperHalfDepth, y: keeperHeight / 2, z: motionOffset(motion.amplitude, motion.periodSec, t, phase) },
    };
  }
  return {
    center: { x: target.center.x, y: target.center.y, z: motion.amplitude * Math.sin(phase) },
    halfWidth: target.halfWidth,
    keeper: null,
  };
}

/** The ball a shot uses: the named one, or the sport's first ball for an unknown id. */
export function ballForShot(def: SportDef, ballId: string): BallDef {
  let ball = def.balls[0];
  for (let i = 0; i < def.balls.length; i++) {
    const candidate = def.balls[i];
    if (candidate !== undefined && candidate.id === ballId) {
      ball = candidate;
      break;
    }
  }
  if (ball === undefined) throw new Error('sport has no balls');
  return ball;
}

/** Lateral position of the aim point on the target plane for a yaw. */
export function aimPointZ(def: SportDef, yaw: number): number {
  const dx = def.target.center.x - def.field.origin.x;
  const clamped = Math.max(-MAX_AIM_YAW, Math.min(MAX_AIM_YAW, yaw));
  return dx * Math.tan(clamped);
}

/**
 * The launch pitch (radians above horizontal) that sends the ball through the target's center height at the target plane, from a shooter
 * `lateral` meters to the side of the aim point, with the sport's arc. Out of range (a slow ball, a wild yaw) gives 45°.
 */
export function launchPitch(def: SportDef, ball: BallDef, gravity: number, lateral: number): number {
  const dx = def.target.center.x - def.field.origin.x;
  // A hole is hit by the ball's center touching the floor over it, so the aim height is one ball radius.
  const aimY = def.target.kind === 'hole' ? def.ballRadius * ball.radiusMult : def.target.center.y;
  const dy = aimY - def.field.origin.y;
  const dh = Math.sqrt(dx * dx + lateral * lateral);
  return solveAim(ball.launchSpeed, gravity, dh, dy, arcFor(def.target.kind)) ?? FALLBACK_PITCH;
}

/** Flight time from the shooter to the target plane for a pitch, before any contact. */
function flightTime(ball: BallDef, pitch: number, horizontalDistance: number): number {
  const horizontal = ball.launchSpeed * Math.cos(pitch);
  return horizontal > 0 ? horizontalDistance / horizontal : 0;
}

/**
 * The yaw that meets the target where it will be when a ball fired at round time t arrives: two fixed-point steps on the flight time,
 * which is enough for the slow rails of this game. A still target gives 0.
 */
export function predictYaw(def: SportDef, ball: BallDef, gravity: number, t: number, phase: number): number {
  const dx = def.target.center.x - def.field.origin.x;
  if (!(dx > 0)) return 0;
  let z = 0;
  for (let i = 0; i < 2; i++) {
    const pitch = launchPitch(def, ball, gravity, z);
    const arrival = t + flightTime(ball, pitch, Math.sqrt(dx * dx + z * z));
    z = targetPose(def, arrival, phase).center.z;
  }
  return Math.atan2(z, dx);
}

/**
 * Factor to apply to the velocity after a ball was pushed out of a surface by `dy` meters upward, so the potential energy gained by the
 * push is paid from the kinetic energy and the total mechanical energy never grows. Returns 1 when nothing has to be paid.
 */
function pushOutScale(gravity: number, dy: number, vx: number, vy: number, vz: number): number {
  if (dy <= 0) return 1;
  const kinetic = (vx * vx + vy * vy + vz * vz) / 2;
  const gain = gravity * dy;
  if (gain >= kinetic) return 0;
  return Math.sqrt((kinetic - gain) / kinetic);
}

export function resolveShot(input: ShotInput, rng: Rng, balance: Balance): ShotResult {
  const physics = balance.physics;
  const sport = balance.sports[input.sport];
  const target = sport.target;
  const surfaces = sport.surfaces;
  const ball = ballForShot(sport, input.ballId);

  const g = physics.gravity;
  const dt = physics.stepSec;
  const r = sport.ballRadius * ball.radiusMult;
  const length = sport.field.length;
  const height = sport.field.height;
  const halfSpan = sport.field.halfSpan;
  const floorE = surfaces.floorRestitution;
  const wallE = surfaces.wallRestitution;
  const ceilingE = surfaces.ceilingRestitution;
  const boardE = surfaces.backboardRestitution;
  const rimE = surfaces.rimRestitution;
  const friction = surfaces.friction;
  const restSpeed2 = physics.restSpeed * physics.restSpeed;
  const rollSpeed = g * dt;

  // Launch: this limb's line to the aim point, then a cone of deviation around it. The rng is consumed the same way for every shot.
  const lateral = aimPointZ(sport, input.aim) - input.offset;
  const deviation = spreadRoll(rng, input.spreadDeg);
  const angle = rng() * TWO_PI;
  const yaw = Math.atan2(lateral, target.center.x - sport.field.origin.x) + deviation * Math.cos(angle);
  const pitch = launchPitch(sport, ball, g, lateral) + deviation * Math.sin(angle);
  const cosPitch = Math.cos(pitch);
  let x = sport.field.origin.x;
  let y = sport.field.origin.y;
  let z = input.offset;
  if (x < r) x = r;
  if (x > length - r) x = length - r;
  if (y < r) y = r;
  if (y > height - r) y = height - r;
  if (z < -halfSpan + r) z = -halfSpan + r;
  if (z > halfSpan - r) z = halfSpan - r;
  let vx = ball.launchSpeed * cosPitch * Math.cos(yaw);
  let vz = ball.launchSpeed * cosPitch * Math.sin(yaw);
  let vy = ball.launchSpeed * Math.sin(pitch);

  // Target geometry, resolved once. The lateral position of a moving target is evaluated per step where it matters.
  const isHoop = target.kind === 'hoop';
  const isGoal = target.kind === 'goal';
  const cx = target.center.x;
  const cy = target.center.y;
  const hw = target.halfWidth;
  const hw2 = hw * hw;
  const amp = target.motion.amplitude;
  const period = target.motion.periodSec;
  const moves = period > 0 && amp !== 0;
  const omega = moves ? TWO_PI / period : 0;
  const phase = input.targetPhase;
  // Hoop: rim ring and backboard.
  const rimR = target.rimRadius ?? 0;
  const reach = r + rimR;
  const reach2 = reach * reach;
  const board = target.backboard;
  const hasBoard = isHoop && board !== undefined;
  const boardDx = board !== undefined ? board.dx : 0;
  const boardHalfSpan = board !== undefined ? board.halfSpan : 0;
  const boardY0 = cy + (board !== undefined ? board.yFrom : 0);
  const boardY1 = cy + (board !== undefined ? board.yTo : 0);
  let bandLo = cy - reach;
  let bandHi = cy + reach;
  if (hasBoard) {
    if (boardY0 < bandLo) bandLo = boardY0;
    if (boardY1 > bandHi) bandHi = boardY1;
  }
  // Goal: keeper box and goal mouth.
  const keeperHw = target.keeperHalfWidth ?? 0;
  const keeperH = target.keeperHeight ?? 0;
  const keeperHd = target.keeperHalfDepth ?? 0;
  const hasKeeper = isGoal && keeperHw > 0 && keeperH > 0 && keeperHd > 0;
  const keeperMidX = cx - keeperHd;
  const goalTop = 2 * cy;
  // Hole: fixed during the round.
  const holeZ = amp * Math.sin(phase);

  const segments: Segment[] = [];
  const tStart = input.t;
  const maxSteps = Math.round(physics.maxFlightSec / dt);
  let segT0 = tStart;
  let segX = x;
  let segY = y;
  let segZ = z;
  let segVx = vx;
  let segVy = vy;
  let segVz = vz;
  let segGy = -g;
  let rolling = false;
  let hit = false;
  let done = false;
  let eventSec = tStart;
  let endSec = tStart;

  for (let k = 1; k <= maxSteps; k++) {
    const tPrev = tStart + (k - 1) * dt;
    const t = tStart + k * dt;
    const tau = t - segT0;
    const px = x;
    const py = y;
    x = segX + segVx * tau;
    y = segY + segVy * tau + (segGy * tau * tau) / 2;
    z = segZ + segVz * tau;
    vx = segVx;
    vy = segVy + segGy * tau;
    vz = segVz;
    let contact = false;
    let onFloor = false;

    // --- Sensor ---
    if (isHoop) {
      if (py > cy && y <= cy) {
        const frac = (py - cy) / (py - y);
        const tc = tPrev + frac * dt;
        const tauC = tc - segT0;
        const xc = segX + segVx * tauC;
        const zc = segZ + segVz * tauC;
        const hoopZ = moves ? amp * Math.sin(omega * tc + phase) : 0;
        const ddx = xc - cx;
        const ddz = zc - hoopZ;
        if (ddx * ddx + ddz * ddz <= hw2) {
          const yc = segY + segVy * tauC + (segGy * tauC * tauC) / 2;
          segments.push({ t0: segT0, t1: tc, x: segX, y: segY, z: segZ, vx: segVx, vy: segVy, vz: segVz, gy: segGy });
          const linger = physics.hitLingerSec;
          endSec = tc + linger;
          // The net slows the ball: it drops straight down and reaches the floor exactly when it stops being drawn, but never
          // faster than it was already falling.
          let vyDrop = 0;
          if (linger > 0) {
            vyDrop = -((yc - r - (g * linger * linger) / 2) / linger);
            if (vyDrop > 0) vyDrop = 0;
          }
          const vyCross = segVy + segGy * tauC;
          if (vyDrop < vyCross) vyDrop = vyCross;
          segments.push({ t0: tc, t1: endSec, x: xc, y: yc, z: zc, vx: 0, vy: vyDrop, vz: 0, gy: -g });
          eventSec = tc;
          hit = true;
          done = true;
          break;
        }
      }
    } else if (isGoal) {
      if (px < cx && x >= cx) {
        const frac = (cx - px) / (x - px);
        const tc = tPrev + frac * dt;
        const tauC = tc - segT0;
        const yc = segY + segVy * tauC + (segGy * tauC * tauC) / 2;
        const zc = segZ + segVz * tauC;
        if (yc >= 0 && yc <= goalTop && zc >= -hw && zc <= hw) {
          let blocked = false;
          if (hasKeeper) {
            const keeperZ = moves ? amp * Math.sin(omega * tc + phase) : 0;
            blocked = Math.abs(zc - keeperZ) < keeperHw + r && yc - r < keeperH;
          }
          if (!blocked) {
            const xc = segX + segVx * tauC;
            segments.push({ t0: segT0, t1: tc, x: segX, y: segY, z: segZ, vx: segVx, vy: segVy, vz: segVz, gy: segGy });
            endSec = tc + physics.hitLingerSec;
            segments.push({ t0: tc, t1: endSec, x: xc, y: yc, z: zc, vx: 0, vy: 0, vz: 0, gy: 0 });
            eventSec = tc;
            hit = true;
            done = true;
            break;
          }
        }
      }
    } else if (y - r <= 0 && vy <= 0) {
      // Where the ball meets the floor: interpolated between the steps for a falling ball (a fast ball must not skip the hole), the
      // current point for a ball already rolling on the floor.
      let tc = t;
      let xc = x;
      let zc = z;
      if (py - r > 0) {
        const frac = (py - r) / (py - y);
        tc = tPrev + frac * dt;
        const tauC = tc - segT0;
        xc = segX + segVx * tauC;
        zc = segZ + segVz * tauC;
      }
      const ddx = xc - cx;
      const ddz = zc - holeZ;
      if (ddx * ddx + ddz * ddz <= hw2) {
        segments.push({ t0: segT0, t1: tc, x: segX, y: segY, z: segZ, vx: segVx, vy: segVy, vz: segVz, gy: segGy });
        endSec = tc + physics.hitLingerSec;
        segments.push({ t0: tc, t1: endSec, x: xc, y: r, z: zc, vx: 0, vy: 0, vz: 0, gy: 0 });
        eventSec = tc;
        hit = true;
        done = true;
        break;
      }
    }

    // --- Floor ---
    if (y - r < 0) {
      const pen = r - y;
      y = r;
      if (vy < 0) vy = -vy * floorE;
      vx *= friction;
      vz *= friction;
      const s = pushOutScale(g, pen, vx, vy, vz);
      vx *= s;
      vy *= s;
      vz *= s;
      if (vy < rollSpeed) {
        vy = 0;
        rolling = true;
      }
      onFloor = true;
      contact = true;
    }

    // --- Back wall (behind the character) and far wall ---
    if (x - r < 0) {
      x = r;
      if (vx < 0) vx = -vx * wallE;
      vy *= friction;
      vz *= friction;
      contact = true;
    } else if (x + r > length) {
      x = length - r;
      if (vx > 0) vx = -vx * wallE;
      vy *= friction;
      vz *= friction;
      contact = true;
    }

    // --- Side walls ---
    if (z - r < -halfSpan) {
      z = -halfSpan + r;
      if (vz < 0) vz = -vz * wallE;
      vx *= friction;
      vy *= friction;
      contact = true;
    } else if (z + r > halfSpan) {
      z = halfSpan - r;
      if (vz > 0) vz = -vz * wallE;
      vx *= friction;
      vy *= friction;
      contact = true;
    }

    // --- Ceiling ---
    if (y + r > height) {
      y = height - r;
      if (vy > 0) vy = -vy * ceilingE;
      vx *= friction;
      vz *= friction;
      rolling = false;
      contact = true;
    }

    // --- Backboard and rim ring (hoop) ---
    if (isHoop && y >= bandLo && y <= bandHi) {
      const hoopZ = moves ? amp * Math.sin(omega * t + phase) : 0;
      if (hasBoard) {
        const bx = cx + boardDx;
        if (vx > 0 && x < bx && x + r > bx && y >= boardY0 && y <= boardY1 && Math.abs(z - hoopZ) <= boardHalfSpan) {
          x = bx - r;
          vx = -vx * boardE;
          vy *= friction;
          vz *= friction;
          contact = true;
        }
      }
      const dxr = x - cx;
      const dzr = z - hoopZ;
      const rho = Math.sqrt(dxr * dxr + dzr * dzr);
      const ux = rho > 0 ? dxr / rho : 1;
      const uz = rho > 0 ? dzr / rho : 0;
      const ringX = cx + ux * hw;
      const ringZ = hoopZ + uz * hw;
      const ddx = x - ringX;
      const ddy = y - cy;
      const ddz = z - ringZ;
      const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
      if (d2 < reach2) {
        let nx = 0;
        let ny = 1;
        let nz = 0;
        if (d2 > 0) {
          const d = Math.sqrt(d2);
          nx = ddx / d;
          ny = ddy / d;
          nz = ddz / d;
        }
        const yOld = y;
        x = ringX + nx * reach;
        y = cy + ny * reach;
        z = ringZ + nz * reach;
        const vn = vx * nx + vy * ny + vz * nz;
        if (vn < 0) {
          const tx = (vx - vn * nx) * friction;
          const ty = (vy - vn * ny) * friction;
          const tz = (vz - vn * nz) * friction;
          const bounce = -vn * rimE;
          vx = tx + bounce * nx;
          vy = ty + bounce * ny;
          vz = tz + bounce * nz;
        }
        const s = pushOutScale(g, y - yOld, vx, vy, vz);
        vx *= s;
        vy *= s;
        vz *= s;
        rolling = false;
        contact = true;
      }
    }

    // --- Keeper box (goal) ---
    if (hasKeeper && y - r < keeperH) {
      const keeperZ = moves ? amp * Math.sin(omega * t + phase) : 0;
      const dxk = x - keeperMidX;
      const dzk = z - keeperZ;
      const penX = keeperHd + r - Math.abs(dxk);
      const penZ = keeperHw + r - Math.abs(dzk);
      const penY = keeperH - (y - r);
      if (penX > 0 && penZ > 0 && penY > 0) {
        if (penX <= penZ && penX <= penY) {
          x = dxk < 0 ? keeperMidX - (keeperHd + r) : keeperMidX + (keeperHd + r);
          if ((dxk < 0 && vx > 0) || (dxk >= 0 && vx < 0)) vx = -vx * wallE;
          vy *= friction;
          vz *= friction;
        } else if (penZ <= penY) {
          z = dzk < 0 ? keeperZ - (keeperHw + r) : keeperZ + (keeperHw + r);
          if ((dzk < 0 && vz > 0) || (dzk >= 0 && vz < 0)) vz = -vz * wallE;
          vx *= friction;
          vy *= friction;
        } else {
          const yOld = y;
          y = keeperH + r;
          if (vy < 0) vy = -vy * wallE;
          vx *= friction;
          vz *= friction;
          const s = pushOutScale(g, y - yOld, vx, vy, vz);
          vx *= s;
          vy *= s;
          vz *= s;
          rolling = false;
        }
        contact = true;
      }
    }

    if (contact) {
      segments.push({ t0: segT0, t1: t, x: segX, y: segY, z: segZ, vx: segVx, vy: segVy, vz: segVz, gy: segGy });
      if ((onFloor || rolling) && vx * vx + vy * vy + vz * vz < restSpeed2) {
        endSec = t + physics.restLingerSec;
        segments.push({ t0: t, t1: endSec, x, y, z, vx: 0, vy: 0, vz: 0, gy: 0 });
        eventSec = t;
        done = true;
        break;
      }
      segT0 = t;
      segX = x;
      segY = y;
      segZ = z;
      segVx = vx;
      segVy = vy;
      segVz = vz;
      segGy = rolling ? 0 : -g;
    }
  }

  if (!done) {
    const tEnd = tStart + maxSteps * dt;
    segments.push({ t0: segT0, t1: tEnd, x: segX, y: segY, z: segZ, vx: segVx, vy: segVy, vz: segVz, gy: segGy });
    eventSec = tEnd;
    endSec = tEnd;
  }

  return {
    hit,
    value: hit ? input.valueIfHit : 0,
    segments,
    endSec,
    eventSec,
    radius: r,
    ballId: ball.id,
    limb: 0,
  };
}

export function positionAt(segments: readonly Segment[], t: number, out: Vec3): boolean {
  'worklet';
  const n = segments.length;
  if (n === 0) return false;
  const first = segments[0];
  if (first === undefined || t < first.t0) return false;
  for (let i = 0; i < n; i++) {
    const s = segments[i];
    if (s !== undefined && t < s.t1) {
      const tau = t - s.t0;
      out.x = s.x + s.vx * tau;
      out.y = s.y + s.vy * tau + (s.gy * tau * tau) / 2;
      out.z = s.z + s.vz * tau;
      return true;
    }
  }
  return false;
}

export function solveAim(speed: number, gravity: number, dx: number, dy: number, arc: Arc): number | null {
  if (!(speed > 0) || !(gravity > 0) || !Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const v2 = speed * speed;
  if (dx === 0) {
    // Straight up (or down): reachable when the ball can climb to dy.
    if (dy > 0 && v2 < 2 * gravity * dy) return null;
    if (arc === 'low' && dy < 0) return -Math.PI / 2;
    return Math.PI / 2;
  }
  const ax = Math.abs(dx);
  const disc = v2 * v2 - gravity * (gravity * ax * ax + 2 * dy * v2);
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const tangent = arc === 'high' ? (v2 + root) / (gravity * ax) : (v2 - root) / (gravity * ax);
  const theta = Math.atan(tangent);
  return dx > 0 ? theta : Math.PI - theta;
}
