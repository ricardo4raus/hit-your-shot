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
 */
import type { Balance, SportDef } from './balance';
import { gaussianish } from './rng';
import type { Rng, Segment, ShotInput, ShotResult, TargetPose, Vec2 } from './types';

export type Arc = 'high' | 'low';

export function spreadRoll(rng: Rng, spreadDeg: number): number {
  return (gaussianish(rng) * spreadDeg * Math.PI) / 180;
}

export function targetPose(_def: SportDef, _t: number, _phase: number): TargetPose {
  throw new Error('not implemented');
}

export function resolveShot(_input: ShotInput, _rng: Rng, _balance: Balance): ShotResult {
  throw new Error('not implemented');
}

export function positionAt(_segments: readonly Segment[], _t: number, _out: Vec2): boolean {
  'worklet';
  throw new Error('not implemented');
}

export function solveAim(_speed: number, _gravity: number, _dx: number, _dy: number, _arc: Arc): number | null {
  throw new Error('not implemented');
}
