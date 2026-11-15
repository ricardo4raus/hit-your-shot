/**
 * MODULE: ballistics. Owner: agent "ballistics". docs/architecture.md "Shot resolution".
 * The heart of the game: where the target is, where a shot goes, whether it scores, and where the ball is at any time.
 *
 * Rules:
 * - Pure. No Math.random, no Date. All randomness through `rng`. Fixed time step `balance.physics.stepSec`; never adapt the step.
 * - World units are meters, origin bottom-left, y up. Gravity `balance.physics.gravity` acts downward (segment.gy = -gravity).
 * - `targetPose(def, t, phase)`:
 *     hoop: center.x + motion.amplitude × sin(2π t / motion.periodSec + phase) (periodSec 0 → no motion), keeper null.
 *     goal: center fixed; keeper at center.x + amplitude × sin(...) with y = keeperHeight / 2.
 *     hole: center.x + amplitude × sin(phase) (static during the round, differs per round), keeper null.
 * - `resolveShot`:
 *     1. direction = input.aim + spreadRoll(rng, input.spreadDeg).
 *     2. start = field.origin + perpendicular(direction) × input.offset; speed = ball.launchSpeed; radius = ballRadius × radiusMult.
 *     3. March t from input.t in steps. Each step: integrate the parabola, then test in this order: sensor, floor, left wall, right wall,
 *        ceiling, backboard (hoop), rim circles (hoop), keeper block (goal). A contact reflects the velocity with the surface's
 *        restitution and keeps `friction` of the tangential speed, pushes the ball out of the surface, and closes the current segment /
 *        opens a new one at that time.
 *     4. Sensor: the ball center crosses the sensor segment (hoop: horizontal segment through center ± halfWidth, downward crossing;
 *        goal: vertical plane at center.x from y=0 to 2 × center.y, crossing rightward, and not inside the keeper block; hole: center
 *        within halfWidth of center.x while touching the floor and moving downward or resting). A hit ends the flight after
 *        `hitLingerSec` with a short falling segment (hoop: straight down through the net; hole: stop; goal: continue into the net and stop).
 *     5. Rest: on the floor with speed < restSpeed → the ball stops; endSec = t + restLingerSec. Also stop at maxFlightSec.
 *     6. value = input.valueIfHit on a hit, 0 otherwise. The result's `limb` is filled by the caller (round.ts), set it to 0 here.
 * - Segments must be contiguous: segments[i].t1 === segments[i+1].t0, first t0 === input.t, last t1 === endSec.
 * - `positionAt(segments, t, out)`: writes the position into `out`, returns false when t is before the first or at/after the last segment.
 *   Worklet-safe: plain loops and arithmetic, no closures over module state, no allocation. The UI runs this per ball per frame.
 * - `solveAim(speed, gravity, dx, dy, arc)`: launch angle to pass through (dx, dy) from the origin, 'high' or 'low' arc, or null when out
 *   of range. Used by the estimate and the simulator bot.
 * - Performance target: one 6 s flight in under 60 µs on a laptop (Node). Avoid allocation inside the step loop; `segments` is the
 *   only array built per shot.
 * - Tests (src/engine/__tests__/ballistics.test.ts): determinism (same input, same output), a straight shot at the hoop center with zero
 *   spread hits, a shot into the floor rests, contiguity of segments, positionAt matches segment math, solveAim round-trips through
 *   resolveShot with zero spread, energy never grows on a bounce, no NaN for any angle in [0, π].
 *
 * May import only: ./types, ./balance, ./rng.
 *
 * Implementation notes (decisions where the rules above were open):
 * - Within a segment the position is always evaluated from the segment start with the exact parabola, never accumulated step by step,
 *   so what the resolver tested is exactly what `positionAt` plays back.
 * - The hoop sensor uses a continuous crossing test between the previous and the current step position, so a fast ball cannot skip
 *   it. The crossing time is linearly interpolated and the crossing point is then taken from the parabola at that time.
 * - Solid surfaces use a per-step penetration test with push-out. Pushing a ball upward adds potential energy; that amount is removed
 *   from the kinetic energy afterwards, so the total mechanical energy never increases at a contact, whatever the restitution.
 * - A floor bounce whose rebound speed is below what gravity adds in one step (gravity × stepSec) leaves the ball rolling: vertical
 *   speed 0 and a segment with gy = 0. This avoids an endless chain of microscopic bounces, each of which would be a new segment.
 * - Rest is tested at every contact while the ball is on the floor (a bounce or a roll); a rolling ball only changes speed at contacts.
 * - After a hoop hit the ball drops straight down from the crossing point, slowed by the net so that it reaches the floor exactly at
 *   endSec (never faster than it was falling). After a goal it stops in the net; after a hole it stops on the floor at the hole.
 * - The keeper block (goal) is a solid rectangle; it uses wallRestitution because the balance has no keeper restitution.
 * - A start point outside the field (very wide limb offsets) is clamped to the field so the ball never starts inside a wall or floor.
 * - An unknown ball id falls back to the sport's first ball instead of throwing, so a bad save can never break the round loop.
 */
import type { Balance, SportDef } from './balance';
import { gaussianish } from './rng';
import type { Rng, Segment, ShotInput, ShotResult, TargetPose, Vec2 } from './types';

export type Arc = 'high' | 'low';

export function spreadRoll(rng: Rng, spreadDeg: number): number {
  return (gaussianish(rng) * spreadDeg * Math.PI) / 180;
}

/** Horizontal offset of a moving target at round time t. periodSec 0 means the target does not move. */
function motionOffset(amplitude: number, periodSec: number, t: number, phase: number): number {
  if (periodSec <= 0 || amplitude === 0) return 0;
  return amplitude * Math.sin((2 * Math.PI * t) / periodSec + phase);
}

export function targetPose(def: SportDef, t: number, phase: number): TargetPose {
  const target = def.target;
  const motion = target.motion;
  if (target.kind === 'hoop') {
    return {
      center: { x: target.center.x + motionOffset(motion.amplitude, motion.periodSec, t, phase), y: target.center.y },
      halfWidth: target.halfWidth,
      keeper: null,
    };
  }
  if (target.kind === 'goal') {
    const keeperHeight = target.keeperHeight ?? 0;
    return {
      center: { x: target.center.x, y: target.center.y },
      halfWidth: target.halfWidth,
      keeper: { x: target.center.x + motionOffset(motion.amplitude, motion.periodSec, t, phase), y: keeperHeight / 2 },
    };
  }
  return {
    center: { x: target.center.x + motion.amplitude * Math.sin(phase), y: target.center.y },
    halfWidth: target.halfWidth,
    keeper: null,
  };
}

/**
 * Factor to apply to the velocity after a ball was pushed out of a surface by `dy` meters upward, so the potential energy gained by the
 * push is paid from the kinetic energy and the total mechanical energy never grows. Returns 1 when nothing has to be paid.
 */
function pushOutScale(gravity: number, dy: number, vx: number, vy: number): number {
  if (dy <= 0) return 1;
  const kinetic = (vx * vx + vy * vy) / 2;
  const gain = gravity * dy;
  if (gain >= kinetic) return 0;
  return Math.sqrt((kinetic - gain) / kinetic);
}

export function resolveShot(input: ShotInput, rng: Rng, balance: Balance): ShotResult {
  const physics = balance.physics;
  const sport = balance.sports[input.sport];
  const target = sport.target;
  const surfaces = sport.surfaces;

  let ball = sport.balls[0];
  for (let i = 0; i < sport.balls.length; i++) {
    const candidate = sport.balls[i];
    if (candidate !== undefined && candidate.id === input.ballId) {
      ball = candidate;
      break;
    }
  }
  if (ball === undefined) throw new Error('sport has no balls');

  const g = physics.gravity;
  const dt = physics.stepSec;
  const r = sport.ballRadius * ball.radiusMult;
  const width = sport.field.width;
  const height = sport.field.height;
  const floorE = surfaces.floorRestitution;
  const wallE = surfaces.wallRestitution;
  const ceilingE = surfaces.ceilingRestitution;
  const boardE = surfaces.backboardRestitution;
  const rimE = surfaces.rimRestitution;
  const friction = surfaces.friction;
  const restSpeed2 = physics.restSpeed * physics.restSpeed;
  const rollSpeed = g * dt;

  // Launch.
  const direction = input.aim + spreadRoll(rng, input.spreadDeg);
  const cos = Math.cos(direction);
  const sin = Math.sin(direction);
  let x = sport.field.origin.x - sin * input.offset;
  let y = sport.field.origin.y + cos * input.offset;
  if (x < r) x = r;
  if (x > width - r) x = width - r;
  if (y < r) y = r;
  if (y > height - r) y = height - r;
  let vx = ball.launchSpeed * cos;
  let vy = ball.launchSpeed * sin;

  // Target geometry, resolved once. The horizontal position of a moving target is evaluated per step where it matters.
  const isHoop = target.kind === 'hoop';
  const isGoal = target.kind === 'goal';
  const cx = target.center.x;
  const cy = target.center.y;
  const hw = target.halfWidth;
  const amp = target.motion.amplitude;
  const period = target.motion.periodSec;
  const moves = period > 0 && amp !== 0;
  const omega = moves ? (2 * Math.PI) / period : 0;
  const phase = input.targetPhase;
  // Hoop: rim circles and backboard.
  const rimR = target.rimRadius ?? 0;
  const reach = r + rimR;
  const reach2 = reach * reach;
  const board = target.backboard;
  const hasBoard = isHoop && board !== undefined;
  const boardDx = board !== undefined ? board.dx : 0;
  const boardY0 = cy + (board !== undefined ? board.yFrom : 0);
  const boardY1 = cy + (board !== undefined ? board.yTo : 0);
  let bandLo = cy - reach;
  let bandHi = cy + reach;
  if (hasBoard) {
    if (boardY0 < bandLo) bandLo = boardY0;
    if (boardY1 > bandHi) bandHi = boardY1;
  }
  // Goal: keeper block and goal mouth.
  const keeperHw = target.keeperHalfWidth ?? 0;
  const keeperH = target.keeperHeight ?? 0;
  const hasKeeper = isGoal && keeperHw > 0 && keeperH > 0;
  const goalTop = 2 * cy;
  // Hole: fixed during the round.
  const holeX = cx + amp * Math.sin(phase);

  const segments: Segment[] = [];
  const tStart = input.t;
  const maxSteps = Math.round(physics.maxFlightSec / dt);
  let segT0 = tStart;
  let segX = x;
  let segY = y;
  let segVx = vx;
  let segVy = vy;
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
    vx = segVx;
    vy = segVy + segGy * tau;
    let contact = false;
    let onFloor = false;

    // --- Sensor ---
    if (isHoop) {
      if (py > cy && y <= cy) {
        const frac = (py - cy) / (py - y);
        const tc = tPrev + frac * dt;
        const tauC = tc - segT0;
        const xc = segX + segVx * tauC;
        const hoopX = moves ? cx + amp * Math.sin(omega * tc + phase) : cx;
        if (xc >= hoopX - hw && xc <= hoopX + hw) {
          const yc = segY + segVy * tauC + (segGy * tauC * tauC) / 2;
          segments.push({ t0: segT0, t1: tc, x: segX, y: segY, vx: segVx, vy: segVy, gy: segGy });
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
          segments.push({ t0: tc, t1: endSec, x: xc, y: yc, vx: 0, vy: vyDrop, gy: -g });
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
        if (yc >= 0 && yc <= goalTop) {
          let blocked = false;
          if (hasKeeper) {
            const keeperX = moves ? cx + amp * Math.sin(omega * tc + phase) : cx;
            blocked = Math.abs(cx - keeperX) < keeperHw + r && yc - r < keeperH;
          }
          if (!blocked) {
            const xc = segX + segVx * tauC;
            segments.push({ t0: segT0, t1: tc, x: segX, y: segY, vx: segVx, vy: segVy, gy: segGy });
            endSec = tc + physics.hitLingerSec;
            segments.push({ t0: tc, t1: endSec, x: xc, y: yc, vx: 0, vy: 0, gy: 0 });
            eventSec = tc;
            hit = true;
            done = true;
            break;
          }
        }
      }
    } else if (y - r <= 0 && vy <= 0 && x >= holeX - hw && x <= holeX + hw) {
      segments.push({ t0: segT0, t1: t, x: segX, y: segY, vx: segVx, vy: segVy, gy: segGy });
      endSec = t + physics.hitLingerSec;
      segments.push({ t0: t, t1: endSec, x, y: r, vx: 0, vy: 0, gy: 0 });
      eventSec = t;
      hit = true;
      done = true;
      break;
    }

    // --- Floor ---
    if (y - r < 0) {
      const pen = r - y;
      y = r;
      if (vy < 0) vy = -vy * floorE;
      vx *= friction;
      const s = pushOutScale(g, pen, vx, vy);
      vx *= s;
      vy *= s;
      if (vy < rollSpeed) {
        vy = 0;
        rolling = true;
      }
      onFloor = true;
      contact = true;
    }

    // --- Walls ---
    if (x - r < 0) {
      x = r;
      if (vx < 0) vx = -vx * wallE;
      vy *= friction;
      contact = true;
    } else if (x + r > width) {
      x = width - r;
      if (vx > 0) vx = -vx * wallE;
      vy *= friction;
      contact = true;
    }

    // --- Ceiling ---
    if (y + r > height) {
      y = height - r;
      if (vy > 0) vy = -vy * ceilingE;
      vx *= friction;
      rolling = false;
      contact = true;
    }

    // --- Backboard and rim circles (hoop) ---
    if (isHoop && y >= bandLo && y <= bandHi) {
      const hoopX = moves ? cx + amp * Math.sin(omega * t + phase) : cx;
      if (hasBoard) {
        const bx = hoopX + boardDx;
        if (vx > 0 && x < bx && x + r > bx && y >= boardY0 && y <= boardY1) {
          x = bx - r;
          vx = -vx * boardE;
          vy *= friction;
          contact = true;
        }
      }
      for (let side = -1; side <= 1; side += 2) {
        const rimX = hoopX + side * hw;
        const dx = x - rimX;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < reach2) {
          let nx = 0;
          let ny = 1;
          if (d2 > 0) {
            const d = Math.sqrt(d2);
            nx = dx / d;
            ny = dy / d;
          }
          const yOld = y;
          x = rimX + nx * reach;
          y = cy + ny * reach;
          const vn = vx * nx + vy * ny;
          if (vn < 0) {
            const tx = (vx - vn * nx) * friction;
            const ty = (vy - vn * ny) * friction;
            const bounce = -vn * rimE;
            vx = tx + bounce * nx;
            vy = ty + bounce * ny;
          }
          const s = pushOutScale(g, y - yOld, vx, vy);
          vx *= s;
          vy *= s;
          rolling = false;
          contact = true;
        }
      }
    }

    // --- Keeper block (goal) ---
    if (hasKeeper && y - r < keeperH) {
      const keeperX = moves ? cx + amp * Math.sin(omega * t + phase) : cx;
      const dx = x - keeperX;
      const adx = Math.abs(dx);
      if (adx < keeperHw + r) {
        const penX = keeperHw + r - adx;
        const penY = keeperH - (y - r);
        if (penX < penY) {
          x = dx < 0 ? keeperX - (keeperHw + r) : keeperX + (keeperHw + r);
          if ((dx < 0 && vx > 0) || (dx >= 0 && vx < 0)) vx = -vx * wallE;
          vy *= friction;
        } else {
          const yOld = y;
          y = keeperH + r;
          if (vy < 0) vy = -vy * wallE;
          vx *= friction;
          const s = pushOutScale(g, y - yOld, vx, vy);
          vx *= s;
          vy *= s;
          rolling = false;
        }
        contact = true;
      }
    }

    if (contact) {
      segments.push({ t0: segT0, t1: t, x: segX, y: segY, vx: segVx, vy: segVy, gy: segGy });
      if ((onFloor || rolling) && vx * vx + vy * vy < restSpeed2) {
        endSec = t + physics.restLingerSec;
        segments.push({ t0: t, t1: endSec, x, y, vx: 0, vy: 0, gy: 0 });
        eventSec = t;
        done = true;
        break;
      }
      segT0 = t;
      segX = x;
      segY = y;
      segVx = vx;
      segVy = vy;
      segGy = rolling ? 0 : -g;
    }
  }

  if (!done) {
    const tEnd = tStart + maxSteps * dt;
    segments.push({ t0: segT0, t1: tEnd, x: segX, y: segY, vx: segVx, vy: segVy, gy: segGy });
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

export function positionAt(segments: readonly Segment[], t: number, out: Vec2): boolean {
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
