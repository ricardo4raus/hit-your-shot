import { parseBalance, type Balance } from '../balance';
import { aimPointZ, ballForShot, launchPitch, positionAt, predictYaw, resolveShot, solveAim, spreadRoll, targetPose } from '../ballistics';
import { createRng } from '../rng';
import { balance, fixedRng, rng } from '../testing';
import type { Segment, ShotInput, ShotResult, SportId, Vec3 } from '../types';

const DEG = Math.PI / 180;

/** The default balance with the basketball hoop standing still, for shots that must land exactly where they are aimed. */
function withStaticHoop(): Balance {
  const raw = JSON.parse(JSON.stringify(balance)) as Balance;
  raw.sports.basketball.target.motion.amplitude = 0;
  return parseBalance(raw);
}

/** The default balance with the football keeper standing still in the middle of the goal. */
function withStaticKeeper(): Balance {
  const raw = JSON.parse(JSON.stringify(balance)) as Balance;
  raw.sports.football.target.motion.amplitude = 0;
  return parseBalance(raw);
}

function shot(overrides: Partial<ShotInput> = {}): ShotInput {
  return {
    sport: 'basketball',
    aim: 0,
    spreadDeg: 0,
    ballId: 'foam',
    offset: 0,
    t: 1.25,
    targetPhase: 0.7,
    valueIfHit: 4,
    ...overrides,
  };
}

function ballOf(b: Balance, sport: SportId, id: string) {
  const def = b.sports[sport].balls.find((ball) => ball.id === id);
  if (!def) throw new Error(`no ball ${id}`);
  return def;
}

/**
 * An rng that makes the spread roll a chosen pitch error: the three uniforms give the deviation (+spread for 1, −spread for 0) and the
 * fourth value 0.25 turns the cone angle to π/2, so the whole deviation goes into the pitch. `pitchErrorRng(1)` with spreadDeg 3 fires 3°
 * too steep (short), `pitchErrorRng(0)` 3° too flat (long).
 */
function pitchErrorRng(sign: 0 | 1) {
  return fixedRng(sign, sign, sign, 0.25);
}

/** As above, but the deviation goes into the yaw (cone angle 0). */
function yawErrorRng(sign: 0 | 1) {
  return fixedRng(sign, sign, sign, 0);
}

function expectContiguous(result: ShotResult, input: ShotInput): void {
  const segs = result.segments;
  expect(segs.length).toBeGreaterThan(0);
  expect(segs[0]?.t0).toBe(input.t);
  for (let i = 1; i < segs.length; i++) {
    expect(segs[i]?.t0).toBe(segs[i - 1]?.t1);
  }
  for (const s of segs) expect(s.t1).toBeGreaterThan(s.t0);
  expect(segs[segs.length - 1]?.t1).toBe(result.endSec);
  expect(result.eventSec).toBeGreaterThanOrEqual(input.t);
  expect(result.eventSec).toBeLessThanOrEqual(result.endSec);
}

function expectFinite(result: ShotResult): void {
  expect(Number.isFinite(result.endSec)).toBe(true);
  expect(Number.isFinite(result.eventSec)).toBe(true);
  for (const s of result.segments) {
    for (const v of [s.t0, s.t1, s.x, s.y, s.z, s.vx, s.vy, s.vz, s.gy]) expect(Number.isFinite(v)).toBe(true);
  }
}

/** Position and velocity at the end of a segment, from the segment's own parabola. */
function endOf(s: Segment): { x: number; y: number; z: number; vx: number; vy: number; vz: number } {
  const tau = s.t1 - s.t0;
  return { x: s.x + s.vx * tau, y: s.y + s.vy * tau + (s.gy * tau * tau) / 2, z: s.z + s.vz * tau, vx: s.vx, vy: s.vy + s.gy * tau, vz: s.vz };
}

function speed2(v: { vx: number; vy: number; vz: number }): number {
  return v.vx * v.vx + v.vy * v.vy + v.vz * v.vz;
}

function randomShots(count: number, seed: number, sport: SportId = 'basketball'): ShotInput[] {
  const r = createRng(seed);
  const def = balance.sports[sport];
  const out: ShotInput[] = [];
  for (let i = 0; i < count; i++) {
    const ball = def.balls[Math.floor(r() * def.balls.length)];
    out.push(
      shot({
        sport,
        aim: (r() - 0.5) * 120 * DEG,
        spreadDeg: r() * 14,
        ballId: ball?.id ?? def.balls[0]?.id ?? '',
        offset: (r() - 0.5) * 0.8,
        t: r() * balance.roundSeconds,
        targetPhase: r() * 2 * Math.PI,
      }),
    );
  }
  return out;
}

describe('targetPose', () => {
  const hoop = balance.sports.basketball;
  const goal = balance.sports.football;
  const hole = balance.sports.golf;

  it('slides the hoop sideways on a sine with the given phase and keeps its depth and height', () => {
    const def = hoop.target;
    const p0 = targetPose(hoop, 0, 0);
    expect(p0.center.x).toBe(def.center.x);
    expect(p0.center.y).toBe(def.center.y);
    expect(p0.center.z).toBeCloseTo(0, 12);
    expect(p0.halfWidth).toBe(def.halfWidth);
    expect(p0.keeper).toBeNull();
    const quarter = def.motion.periodSec / 4;
    expect(targetPose(hoop, quarter, 0).center.z).toBeCloseTo(def.motion.amplitude, 10);
    expect(targetPose(hoop, 0, Math.PI / 2).center.z).toBeCloseTo(def.motion.amplitude, 10);
    expect(targetPose(hoop, def.motion.periodSec, 0.3).center.z).toBeCloseTo(targetPose(hoop, 0, 0.3).center.z, 10);
    expect(targetPose(hoop, quarter, 0).center.x).toBe(def.center.x);
  });

  it('keeps a hoop with period 0 still', () => {
    const still = JSON.parse(JSON.stringify(balance)) as Balance;
    still.sports.basketball.target.motion.periodSec = 0;
    const def = parseBalance(still).sports.basketball;
    expect(targetPose(def, 2.2, 1.1).center.z).toBe(0);
  });

  it('keeps the goal fixed and moves the keeper sideways in front of the line at half its height', () => {
    const def = goal.target;
    const p = targetPose(goal, def.motion.periodSec / 4, 0);
    expect(p.center).toEqual({ x: def.center.x, y: def.center.y, z: 0 });
    expect(p.keeper).not.toBeNull();
    expect(p.keeper?.z).toBeCloseTo(def.motion.amplitude, 10);
    expect(p.keeper?.x).toBeCloseTo(def.center.x - (def.keeperHalfDepth ?? 0), 12);
    expect(p.keeper?.y).toBe((def.keeperHeight ?? 0) / 2);
  });

  it('places the hole sideways by phase only, static during the round', () => {
    const def = hole.target;
    const a = targetPose(hole, 0, Math.PI / 2);
    const b = targetPose(hole, 7.3, Math.PI / 2);
    expect(a.center.z).toBeCloseTo(def.motion.amplitude, 10);
    expect(b.center.z).toBe(a.center.z);
    expect(a.center.x).toBe(def.center.x);
    expect(a.center.y).toBe(0);
    expect(a.keeper).toBeNull();
  });
});

describe('spreadRoll', () => {
  it('is zero for zero spread and bounded by the spread otherwise', () => {
    expect(Math.abs(spreadRoll(rng(1), 0))).toBe(0);
    const r = rng(9);
    for (let i = 0; i < 500; i++) {
      const roll = spreadRoll(r, 10);
      expect(Math.abs(roll)).toBeLessThanOrEqual(10 * DEG);
    }
    expect(spreadRoll(fixedRng(1, 1, 1), 10)).toBeCloseTo(10 * DEG, 12);
    expect(spreadRoll(fixedRng(0.5), 10)).toBeCloseTo(0, 12);
  });
});

describe('aim helpers', () => {
  const def = balance.sports.basketball;
  const g = balance.physics.gravity;
  const foam = ballOf(balance, 'basketball', 'foam');

  it('aimPointZ puts yaw 0 on the center line and grows with the tangent, clamped at wild yaws', () => {
    const dx = def.target.center.x - def.field.origin.x;
    expect(aimPointZ(def, 0)).toBe(0);
    expect(aimPointZ(def, 0.3)).toBeCloseTo(dx * Math.tan(0.3), 12);
    expect(aimPointZ(def, -0.3)).toBeCloseTo(-aimPointZ(def, 0.3), 12);
    expect(aimPointZ(def, 1.5)).toBe(aimPointZ(def, 3));
    expect(Number.isFinite(aimPointZ(def, Math.PI / 2))).toBe(true);
  });

  it('launchPitch lobs into the hoop, kicks flat at the goal, and is steeper for a farther aim point', () => {
    const pitch = launchPitch(def, foam, g, 0);
    expect(pitch).toBeGreaterThan(45 * DEG);
    expect(pitch).toBeLessThan(90 * DEG);
    // Farther along the side: the high arc flattens toward 45° to reach.
    expect(launchPitch(def, foam, g, 2)).toBeLessThan(pitch);
    const goal = balance.sports.football;
    const kick = launchPitch(goal, ballOf(balance, 'football', 'match'), g, 0);
    expect(kick).toBeGreaterThan(0);
    expect(kick).toBeLessThan(45 * DEG);
    // The solved arc really passes through the target height at the target plane.
    const dx = def.target.center.x - def.field.origin.x;
    const t = dx / (foam.launchSpeed * Math.cos(pitch));
    const y = def.field.origin.y + foam.launchSpeed * Math.sin(pitch) * t - (g * t * t) / 2;
    expect(y).toBeCloseTo(def.target.center.y, 9);
  });

  it('launchPitch falls back to 45° when the ball cannot reach', () => {
    const raw = JSON.parse(JSON.stringify(balance)) as Balance;
    raw.sports.basketball.balls[0]!.launchSpeed = 1;
    const slow = parseBalance(raw);
    expect(launchPitch(slow.sports.basketball, slow.sports.basketball.balls[0]!, g, 0)).toBe(Math.PI / 4);
  });

  it('predictYaw is 0 for a still target and points at where a moving hoop will be', () => {
    const still = withStaticHoop().sports.basketball;
    expect(predictYaw(still, foam, g, 3, 1)).toBe(0);
    const dx = def.target.center.x - def.field.origin.x;
    for (const phase of [0, 1, 2.5, 4]) {
      const yaw = predictYaw(def, foam, g, 0.4, phase);
      const pitch = launchPitch(def, foam, g, aimPointZ(def, yaw));
      const flight = Math.hypot(dx, aimPointZ(def, yaw)) / (foam.launchSpeed * Math.cos(pitch));
      const z = targetPose(def, 0.4 + flight, phase).center.z;
      expect(aimPointZ(def, yaw)).toBeCloseTo(z, 2);
    }
  });

  it('ballForShot names the ball or falls back to the first one', () => {
    expect(ballForShot(def, 'medicine').id).toBe('medicine');
    expect(ballForShot(def, 'nope').id).toBe(def.balls[0]?.id);
  });
});

describe('resolveShot', () => {
  it('is deterministic: same input and seed give the same output', () => {
    for (const input of randomShots(30, 5)) {
      const a = resolveShot(input, rng(77), balance);
      const b = resolveShot(input, rng(77), balance);
      expect(b).toEqual(a);
    }
  });

  it('consumes the rng so different seeds spread the shot differently', () => {
    const input = shot({ spreadDeg: 10 });
    const a = resolveShot(input, rng(1), balance);
    const b = resolveShot(input, rng(2), balance);
    expect(a.segments[0]?.vy).not.toBe(b.segments[0]?.vy);
    expect(a.segments[0]?.vz).not.toBe(b.segments[0]?.vz);
  });

  it('starts at the origin shifted sideways by the offset, with the launch speed, converging on the aim point', () => {
    const def = balance.sports.basketball;
    const ball = ballOf(balance, 'basketball', 'regulation');
    const input = shot({ aim: 0, offset: 0.3, ballId: 'regulation' });
    const result = resolveShot(input, rng(), balance);
    const first = result.segments[0];
    if (!first) throw new Error('no segment');
    expect(first.x).toBeCloseTo(def.field.origin.x, 12);
    expect(first.y).toBeCloseTo(def.field.origin.y, 12);
    expect(first.z).toBeCloseTo(0.3, 12);
    expect(Math.sqrt(speed2(first))).toBeCloseTo(ball.launchSpeed, 9);
    // From the right of the spine the ball flies back toward the center line.
    expect(first.vz).toBeLessThan(0);
    expect(first.vx).toBeGreaterThan(0);
    expect(first.gy).toBe(-balance.physics.gravity);
    expect(result.radius).toBeCloseTo(def.ballRadius * ball.radiusMult, 12);
    expect(result.ballId).toBe('regulation');
    expect(result.limb).toBe(0);
  });

  it('a yaw deviation goes sideways, a pitch deviation goes up or down', () => {
    const straight = resolveShot(shot(), rng(), withStaticHoop()).segments[0]!;
    const right = resolveShot(shot({ spreadDeg: 5 }), yawErrorRng(1), withStaticHoop()).segments[0]!;
    const steep = resolveShot(shot({ spreadDeg: 5 }), pitchErrorRng(1), withStaticHoop()).segments[0]!;
    expect(straight.vz).toBeCloseTo(0, 12);
    expect(right.vz).toBeGreaterThan(0);
    expect(right.vy).toBeCloseTo(straight.vy, 9);
    expect(steep.vz).toBeCloseTo(0, 9);
    expect(steep.vy).toBeGreaterThan(straight.vy);
  });

  it('hits with a straight shot at the center of a still hoop and pays valueIfHit', () => {
    const b = withStaticHoop();
    const def = b.sports.basketball;
    for (const ballId of ['foam', 'regulation', 'medicine']) {
      const input = shot({ aim: 0, ballId, valueIfHit: 7.5 });
      const result = resolveShot(input, rng(), b);
      expect(result.hit).toBe(true);
      expect(result.value).toBe(7.5);
      expectContiguous(result, input);
      // One flight segment, then the drop through the net.
      expect(result.segments.length).toBe(2);
      const drop = result.segments[1];
      if (!drop) throw new Error('no drop segment');
      expect(drop.vx).toBe(0);
      expect(drop.vz).toBe(0);
      expect(drop.t0).toBe(result.eventSec);
      expect(result.endSec).toBeCloseTo(result.eventSec + b.physics.hitLingerSec, 12);
      // The crossing point is on the sensor plane and inside the rim.
      expect(drop.y).toBeCloseTo(def.target.center.y, 3);
      expect(Math.hypot(drop.x - def.target.center.x, drop.z)).toBeLessThan(def.target.halfWidth);
      // The ball drops straight down through the net and reaches the floor exactly when it stops being drawn.
      expect(drop.vy).toBeLessThanOrEqual(0);
      expect(endOf(drop).y).toBeCloseTo(result.radius, 9);
      expect(endOf(drop).x).toBe(drop.x);
    }
  });

  it('every limb of a wide character hits the still hoop when the aim is on it', () => {
    const b = withStaticHoop();
    for (const offset of [-0.6, -0.2, 0.2, 0.6]) {
      expect(resolveShot(shot({ offset }), rng(), b).hit).toBe(true);
    }
  });

  it('hits a moving hoop when aimed where the hoop will be', () => {
    const def = balance.sports.basketball;
    const ball = ballOf(balance, 'basketball', 'foam');
    const g = balance.physics.gravity;
    let hits = 0;
    const phases = [0, 0.9, 2.1, 3.3, 4.6, 5.8];
    for (const targetPhase of phases) {
      const t0 = 0.4;
      const aim = predictYaw(def, ball, g, t0, targetPhase);
      if (resolveShot(shot({ aim, t: t0, targetPhase }), rng(), balance).hit) hits++;
    }
    expect(hits).toBe(phases.length);
  });

  it('misses a hoop when aimed far from it', () => {
    const result = resolveShot(shot({ aim: 0.5 }), rng(), withStaticHoop());
    expect(result.hit).toBe(false);
    expect(result.value).toBe(0);
  });

  it('never scores by passing the sensor upward', () => {
    // A hoop right above the shot origin: the ball goes straight up through it, then falls back down into it.
    const raw = JSON.parse(JSON.stringify(balance)) as Balance;
    raw.sports.basketball.target.motion.amplitude = 0;
    raw.sports.basketball.target.center = { x: raw.sports.basketball.field.origin.x, y: raw.sports.basketball.field.origin.y + 0.5 };
    delete raw.sports.basketball.target.backboard;
    const b = parseBalance(raw);
    const input = shot({ ballId: 'foam' });
    const result = resolveShot(input, rng(), b);
    expect(result.hit).toBe(true);
    // The hit is the downward crossing after the apex, not the first (upward) crossing.
    const vyUp = ballOf(b, 'basketball', 'foam').launchSpeed;
    const apexSec = input.t + vyUp / b.physics.gravity;
    expect(result.eventSec).toBeGreaterThan(apexSec);
  });

  it('rests after a shot straight into the floor', () => {
    // A pitch error of −160° on a 75° lob points the ball at the floor.
    const input = shot({ spreadDeg: 160 });
    const result = resolveShot(input, pitchErrorRng(0), balance);
    expect(result.segments[0]!.vy).toBeLessThan(0);
    expect(result.hit).toBe(false);
    expect(result.value).toBe(0);
    expectContiguous(result, input);
    const last = result.segments[result.segments.length - 1];
    expect(last?.vx).toBe(0);
    expect(last?.vy).toBe(0);
    expect(last?.vz).toBe(0);
    expect(last?.gy).toBe(0);
    expect(last?.y).toBeCloseTo(result.radius, 12);
    expect(last?.t0).toBe(result.eventSec);
    expect(result.endSec).toBeCloseTo(result.eventSec + balance.physics.restLingerSec, 12);
    expect(result.eventSec).toBeLessThan(input.t + balance.physics.maxFlightSec);
    // Every bounce is a new segment and the ball never goes below the floor at a segment start.
    expect(result.segments.length).toBeGreaterThan(2);
    for (const s of result.segments) expect(s.y).toBeGreaterThanOrEqual(result.radius - 1e-12);
  });

  it('bounces off a side wall', () => {
    const b = withStaticHoop();
    const def = b.sports.basketball;
    const input = shot({ aim: 60 * DEG });
    const result = resolveShot(input, rng(), b);
    expectContiguous(result, input);
    const bounce = result.segments.find((s, i) => i > 0 && s.vz < 0 && (result.segments[i - 1]?.vz ?? 0) > 0);
    expect(bounce).toBeDefined();
    expect(bounce?.z).toBeCloseTo(def.field.halfSpan - result.radius, 9);
  });

  it('stops at maxFlightSec when the ball is still moving', () => {
    // A frictionless, perfectly elastic world: the ball never rests.
    const raw = JSON.parse(JSON.stringify(balance)) as Balance;
    const s = raw.sports.basketball.surfaces;
    s.floorRestitution = 1;
    s.wallRestitution = 1;
    s.ceilingRestitution = 1;
    s.backboardRestitution = 1;
    s.rimRestitution = 1;
    s.friction = 1;
    const b = parseBalance(raw);
    const input = shot({ aim: 0.4 });
    const result = resolveShot(input, rng(), b);
    expect(result.hit).toBe(false);
    expectContiguous(result, input);
    expect(result.endSec).toBeCloseTo(input.t + b.physics.maxFlightSec, 9);
    expect(result.eventSec).toBe(result.endSec);
  });

  it('keeps segments contiguous for random shots in every sport', () => {
    for (const sport of ['basketball', 'football', 'golf'] as SportId[]) {
      for (const input of randomShots(60, 11, sport)) {
        const result = resolveShot(input, rng(3), balance);
        expectContiguous(result, input);
        expectFinite(result);
      }
    }
  });

  it('never increases mechanical energy at a contact', () => {
    const g = balance.physics.gravity;
    let contacts = 0;
    for (const sport of ['basketball', 'football', 'golf'] as SportId[]) {
      for (const input of randomShots(80, 23, sport)) {
        const result = resolveShot(input, rng(4), balance);
        const segs = result.segments;
        for (let i = 1; i < segs.length; i++) {
          const prev = segs[i - 1];
          const next = segs[i];
          if (!prev || !next) continue;
          const e = endOf(prev);
          const before = speed2(e) / 2 + g * e.y;
          const after = speed2(next) / 2 + g * next.y;
          expect(after).toBeLessThanOrEqual(before + 1e-9);
          // Speed alone never grows either.
          expect(speed2(next)).toBeLessThanOrEqual(speed2(e) + 1e-9);
          contacts++;
        }
      }
    }
    expect(contacts).toBeGreaterThan(100);
  });

  it('bounces off the backboard when the shot is long', () => {
    const b = withStaticHoop();
    const def = b.sports.basketball;
    const board = def.target.backboard;
    if (!board) throw new Error('hoop has no backboard');
    // A lob 3° too flat overshoots the hoop and meets the board behind it (and banks in).
    const input = shot({ spreadDeg: 3 });
    const result = resolveShot(input, pitchErrorRng(0), b);
    const bounce = result.segments.find((s, i) => i > 0 && s.vx < 0 && (result.segments[i - 1]?.vx ?? 0) > 0);
    expect(bounce).toBeDefined();
    expect(bounce?.x).toBeLessThanOrEqual(def.target.center.x + board.dx - result.radius + 1e-9);
    expect(Math.abs(bounce?.z ?? 0)).toBeLessThanOrEqual(board.halfSpan);
  });

  it('bounces off the rim when the shot is a little short', () => {
    const b = withStaticHoop();
    const def = b.sports.basketball;
    // Shooting 1.5° too steep lands on the front of the rim.
    const input = shot({ spreadDeg: 1.5, ballId: 'regulation' });
    const result = resolveShot(input, pitchErrorRng(1), b);
    const reach = result.radius + (def.target.rimRadius ?? 0);
    const ringDistance = (s: Segment) => Math.hypot(Math.hypot(s.x - def.target.center.x, s.z) - def.target.halfWidth, s.y - def.target.center.y);
    const atRim = result.segments.find((s, i) => i > 0 && ringDistance(s) < reach + 1e-6);
    expect(atRim).toBeDefined();
    if (!atRim) return;
    // The ball sits on the ring surface after the push-out, and on the near side of it.
    expect(ringDistance(atRim)).toBeGreaterThanOrEqual(reach - 1e-9);
    expect(atRim.x).toBeLessThan(def.target.center.x);
  });

  it('produces no NaN and stays inside the field for any yaw in ±80° in every sport', () => {
    for (const sport of ['basketball', 'football', 'golf'] as SportId[]) {
      const def = balance.sports[sport];
      for (const ball of def.balls) {
        for (let i = 0; i <= 40; i++) {
          const input = shot({ sport, aim: (-80 + 4 * i) * DEG, ballId: ball.id, t: 0 });
          const result = resolveShot(input, rng(), balance);
          expectFinite(result);
          expectContiguous(result, input);
          for (const s of result.segments) {
            expect(s.x).toBeGreaterThanOrEqual(result.radius - 1e-9);
            expect(s.x).toBeLessThanOrEqual(def.field.length - result.radius + 1e-9);
            expect(s.y).toBeLessThanOrEqual(def.field.height - result.radius + 1e-9);
            expect(Math.abs(s.z)).toBeLessThanOrEqual(def.field.halfSpan - result.radius + 1e-9);
          }
        }
      }
    }
  });

  it('falls back to the first ball for an unknown ball id', () => {
    const result = resolveShot(shot({ ballId: 'nope' }), rng(), balance);
    expect(result.ballId).toBe(balance.sports.basketball.balls[0]?.id);
  });

  it('positionAt follows the segment math and is false outside the flight', () => {
    const input = shot({ aim: 0.3, spreadDeg: 6 });
    const result = resolveShot(input, rng(8), balance);
    const out: Vec3 = { x: 0, y: 0, z: 0 };
    expect(positionAt(result.segments, input.t - 1e-6, out)).toBe(false);
    expect(positionAt(result.segments, result.endSec, out)).toBe(false);
    expect(positionAt(result.segments, result.endSec + 1, out)).toBe(false);
    expect(positionAt([], 1, out)).toBe(false);
    let checked = 0;
    for (let t = input.t; t < result.endSec; t += 0.0137) {
      expect(positionAt(result.segments, t, out)).toBe(true);
      const s = result.segments.find((seg) => t >= seg.t0 && t < seg.t1);
      if (!s) throw new Error('no segment');
      const tau = t - s.t0;
      expect(out.x).toBe(s.x + s.vx * tau);
      expect(out.y).toBe(s.y + s.vy * tau + (s.gy * tau * tau) / 2);
      expect(out.z).toBe(s.z + s.vz * tau);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
    // Exactly at a segment boundary the later segment wins.
    const second = result.segments[1];
    if (second) {
      expect(positionAt(result.segments, second.t0, out)).toBe(true);
      expect(out.x).toBe(second.x);
      expect(out.y).toBe(second.y);
      expect(out.z).toBe(second.z);
    }
  });

  it('plays back continuously: no jumps inside a flight segment and small ones at contacts', () => {
    const input = shot({ aim: 0.2 });
    const result = resolveShot(input, rng(), balance);
    const a: Vec3 = { x: 0, y: 0, z: 0 };
    const b: Vec3 = { x: 0, y: 0, z: 0 };
    for (const s of result.segments) {
      const mid = (s.t0 + s.t1) / 2;
      positionAt(result.segments, mid, a);
      positionAt(result.segments, mid + 1e-4, b);
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.01);
    }
  });
});

describe('football and golf', () => {
  it('scores a football goal that passes beside the keeper', () => {
    const b = withStaticKeeper();
    const def = b.sports.football;
    const dx = def.target.center.x - def.field.origin.x;
    const aim = Math.atan2(0.8, dx);
    const input = shot({ sport: 'football', ballId: 'match', aim, valueIfHit: 3 });
    const result = resolveShot(input, rng(), b);
    expect(result.hit).toBe(true);
    expect(result.value).toBe(3);
    expectContiguous(result, input);
    const net = result.segments[result.segments.length - 1];
    expect(net?.x).toBeCloseTo(def.target.center.x, 6);
    expect(net?.z).toBeCloseTo(0.8, 1);
    expect(net?.vx).toBe(0);
    expect(net?.vy).toBe(0);
  });

  it('is blocked by the keeper and bounces back', () => {
    const b = withStaticKeeper();
    const def = b.sports.football;
    const input = shot({ sport: 'football', ballId: 'match', aim: 0 });
    const result = resolveShot(input, rng(), b);
    expect(result.hit).toBe(false);
    expectContiguous(result, input);
    const back = result.segments.find((s) => s.vx < 0);
    expect(back).toBeDefined();
    expect(back?.x).toBeLessThanOrEqual(def.target.center.x - 2 * (def.target.keeperHalfDepth ?? 0) - result.radius + 1e-9);
  });

  it('misses a football shot over the crossbar', () => {
    const b = withStaticKeeper();
    // 25° too steep on a 20° kick sends the ball over the goal.
    const result = resolveShot(shot({ sport: 'football', ballId: 'match', spreadDeg: 25 }), pitchErrorRng(1), b);
    expect(result.hit).toBe(false);
  });

  it('misses a football shot wide of the post', () => {
    const b = withStaticKeeper();
    const def = b.sports.football;
    const aim = Math.atan2(def.target.halfWidth + 0.5, def.target.center.x - def.field.origin.x);
    const result = resolveShot(shot({ sport: 'football', ballId: 'match', aim }), rng(), b);
    expect(result.hit).toBe(false);
  });

  it('holes a golf shot aimed at the hole', () => {
    const def = balance.sports.golf;
    const targetPhase = 0.4;
    const pose = targetPose(def, 0, targetPhase);
    const aim = Math.atan2(pose.center.z, pose.center.x - def.field.origin.x);
    for (const ballId of ['pingpong', 'golf', 'steel']) {
      const radius = def.ballRadius * ballOf(balance, 'golf', ballId).radiusMult;
      const input = shot({ sport: 'golf', ballId, aim, targetPhase, valueIfHit: 2 });
      const result = resolveShot(input, rng(), balance);
      expect(result.hit).toBe(true);
      expect(result.value).toBe(2);
      expectContiguous(result, input);
      const last = result.segments[result.segments.length - 1];
      expect(last?.y).toBeCloseTo(radius, 12);
      expect(last?.vx).toBe(0);
      expect(Math.hypot((last?.x ?? 0) - pose.center.x, (last?.z ?? 0) - pose.center.z)).toBeLessThanOrEqual(def.target.halfWidth);
    }
  });

  it('a golf shot far from the hole rests on the floor', () => {
    const input = shot({ sport: 'golf', ballId: 'golf', aim: 0.8, targetPhase: Math.PI / 2 });
    const result = resolveShot(input, rng(), balance);
    expect(result.hit).toBe(false);
    expectContiguous(result, input);
  });
});

describe('solveAim', () => {
  const g = balance.physics.gravity;

  function flightPasses(speed: number, aim: number, dx: number, dy: number): boolean {
    const vx = speed * Math.cos(aim);
    const vy = speed * Math.sin(aim);
    const t = dx / vx;
    const y = vy * t - (g * t * t) / 2;
    return t > 0 && Math.abs(y - dy) < 1e-9;
  }

  it('finds high and low arcs that pass through the point', () => {
    for (const [dx, dy] of [
      [5.5, 1.45],
      [3, -1],
      [7, 0],
      [1, 2],
    ] as const) {
      const high = solveAim(9.2, g, dx, dy, 'high');
      const low = solveAim(9.2, g, dx, dy, 'low');
      expect(high).not.toBeNull();
      expect(low).not.toBeNull();
      if (high === null || low === null) return;
      expect(high).toBeGreaterThan(low);
      expect(flightPasses(9.2, high, dx, dy)).toBe(true);
      expect(flightPasses(9.2, low, dx, dy)).toBe(true);
    }
  });

  it('mirrors for targets to the left', () => {
    const right = solveAim(9.2, g, 5.5, 1.45, 'high');
    const left = solveAim(9.2, g, -5.5, 1.45, 'high');
    expect(right).not.toBeNull();
    expect(left).not.toBeNull();
    if (right === null || left === null) return;
    expect(left).toBeCloseTo(Math.PI - right, 12);
    expect(flightPasses(9.2, left, -5.5, 1.45)).toBe(true);
  });

  it('returns null when out of range or for degenerate input', () => {
    expect(solveAim(9.2, g, 50, 0, 'high')).toBeNull();
    expect(solveAim(9.2, g, 0, 100, 'high')).toBeNull();
    expect(solveAim(0, g, 1, 1, 'high')).toBeNull();
    expect(solveAim(9.2, 0, 1, 1, 'high')).toBeNull();
    expect(solveAim(9.2, g, Number.NaN, 1, 'high')).toBeNull();
  });

  it('shoots straight up for a point directly above', () => {
    expect(solveAim(9.2, g, 0, 1, 'high')).toBe(Math.PI / 2);
    expect(solveAim(9.2, g, 0, -1, 'low')).toBe(-Math.PI / 2);
  });

  it('the solved pitch round-trips through resolveShot with zero spread', () => {
    const b = withStaticHoop();
    const def = b.sports.basketball;
    const target = { x: def.target.center.x, y: def.target.center.y };
    const result = resolveShot(shot({ ballId: 'regulation', t: 0 }), rng(), b);
    // The first flight segment passes through the target point (before any contact).
    const first = result.segments[0];
    if (!first) throw new Error('no segment');
    const t = (target.x - first.x) / first.vx;
    const y = first.y + first.vy * t + (first.gy * t * t) / 2;
    // The segment ends at the interpolated crossing time, a hair before the exact one.
    expect(t).toBeLessThanOrEqual(first.t1 - first.t0 + 1e-3);
    expect(y).toBeCloseTo(target.y, 6);
    expect(first.z + first.vz * t).toBeCloseTo(0, 9);
    expect(result.hit).toBe(true);
  });
});

describe('performance', () => {
  it('resolves 2000 random basketball shots quickly', () => {
    const inputs = randomShots(2000, 99);
    const r = rng(1);
    // Warm up.
    for (let i = 0; i < 300; i++) resolveShot(inputs[i % inputs.length] as ShotInput, r, balance);
    const start = process.hrtime.bigint();
    let segments = 0;
    for (const input of inputs) segments += resolveShot(input, r, balance).segments.length;
    const micros = Number(process.hrtime.bigint() - start) / 1000 / inputs.length;
    console.log(`resolveShot mean: ${micros.toFixed(1)} µs per shot, ${(segments / inputs.length).toFixed(1)} segments per shot`);
    expect(micros).toBeLessThan(2000);
  });
});
