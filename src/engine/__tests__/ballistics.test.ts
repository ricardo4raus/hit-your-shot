import { parseBalance, type Balance } from '../balance';
import { positionAt, resolveShot, solveAim, spreadRoll, targetPose } from '../ballistics';
import { createRng } from '../rng';
import { balance, fixedRng, rng } from '../testing';
import type { Segment, ShotInput, ShotResult, SportId } from '../types';

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
    aim: Math.PI / 4,
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

/** Aim from the sport's origin at a world point with zero spread, through solveAim. */
function aimAt(b: Balance, sport: SportId, ballId: string, x: number, y: number, arc: 'high' | 'low'): number {
  const def = b.sports[sport];
  const ball = ballOf(b, sport, ballId);
  const aim = solveAim(ball.launchSpeed, b.physics.gravity, x - def.field.origin.x, y - def.field.origin.y, arc);
  if (aim === null) throw new Error('target out of range');
  return aim;
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
    for (const v of [s.t0, s.t1, s.x, s.y, s.vx, s.vy, s.gy]) expect(Number.isFinite(v)).toBe(true);
  }
}

/** Position and velocity at the end of a segment, from the segment's own parabola. */
function endOf(s: Segment): { x: number; y: number; vx: number; vy: number } {
  const tau = s.t1 - s.t0;
  return { x: s.x + s.vx * tau, y: s.y + s.vy * tau + (s.gy * tau * tau) / 2, vx: s.vx, vy: s.vy + s.gy * tau };
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
        aim: r() * (Math.PI / 2),
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

  it('moves the hoop on a sine with the given phase and keeps the sensor height', () => {
    const def = hoop.target;
    const p0 = targetPose(hoop, 0, 0);
    expect(p0.center.x).toBeCloseTo(def.center.x, 12);
    expect(p0.center.y).toBe(def.center.y);
    expect(p0.halfWidth).toBe(def.halfWidth);
    expect(p0.keeper).toBeNull();
    const quarter = def.motion.periodSec / 4;
    expect(targetPose(hoop, quarter, 0).center.x).toBeCloseTo(def.center.x + def.motion.amplitude, 10);
    expect(targetPose(hoop, 0, Math.PI / 2).center.x).toBeCloseTo(def.center.x + def.motion.amplitude, 10);
    expect(targetPose(hoop, def.motion.periodSec, 0.3).center.x).toBeCloseTo(targetPose(hoop, 0, 0.3).center.x, 10);
  });

  it('keeps a hoop with period 0 still', () => {
    const still = JSON.parse(JSON.stringify(balance)) as Balance;
    still.sports.basketball.target.motion.periodSec = 0;
    const def = parseBalance(still).sports.basketball;
    expect(targetPose(def, 2.2, 1.1).center.x).toBe(def.target.center.x);
  });

  it('keeps the goal fixed and moves the keeper at half its height', () => {
    const def = goal.target;
    const p = targetPose(goal, def.motion.periodSec / 4, 0);
    expect(p.center).toEqual(def.center);
    expect(p.keeper).not.toBeNull();
    expect(p.keeper?.x).toBeCloseTo(def.center.x + def.motion.amplitude, 10);
    expect(p.keeper?.y).toBe((def.keeperHeight ?? 0) / 2);
  });

  it('places the hole by phase only, static during the round', () => {
    const def = hole.target;
    const a = targetPose(hole, 0, Math.PI / 2);
    const b = targetPose(hole, 7.3, Math.PI / 2);
    expect(a.center.x).toBeCloseTo(def.center.x + def.motion.amplitude, 10);
    expect(b.center.x).toBe(a.center.x);
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
      expect(Math.abs(roll)).toBeLessThanOrEqual((10 * Math.PI) / 180);
    }
    expect(spreadRoll(fixedRng(1, 1, 1), 10)).toBeCloseTo((10 * Math.PI) / 180, 12);
    expect(spreadRoll(fixedRng(0.5), 10)).toBeCloseTo(0, 12);
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
  });

  it('starts at the origin shifted by the perpendicular offset, with the launch speed', () => {
    const def = balance.sports.basketball;
    const ball = ballOf(balance, 'basketball', 'regulation');
    const input = shot({ aim: 0, offset: 0.3, ballId: 'regulation' });
    const result = resolveShot(input, rng(), balance);
    const first = result.segments[0];
    expect(first?.x).toBeCloseTo(def.field.origin.x, 12);
    expect(first?.y).toBeCloseTo(def.field.origin.y + 0.3, 12);
    expect(first?.vx).toBeCloseTo(ball.launchSpeed, 12);
    expect(first?.vy).toBeCloseTo(0, 12);
    expect(first?.gy).toBe(-balance.physics.gravity);
    expect(result.radius).toBeCloseTo(def.ballRadius * ball.radiusMult, 12);
    expect(result.ballId).toBe('regulation');
    expect(result.limb).toBe(0);
  });

  it('hits with a straight shot at the center of a still hoop and pays valueIfHit', () => {
    const b = withStaticHoop();
    const def = b.sports.basketball;
    // The medicine ball (8.0 m/s) cannot reach the hoop center from the origin, so it is left out here.
    for (const ballId of ['foam', 'regulation']) {
      const aim = aimAt(b, 'basketball', ballId, def.target.center.x, def.target.center.y, 'high');
      const input = shot({ aim, ballId, valueIfHit: 7.5 });
      const result = resolveShot(input, rng(), b);
      expect(result.hit).toBe(true);
      expect(result.value).toBe(7.5);
      expectContiguous(result, input);
      // One flight segment, then the drop through the net.
      expect(result.segments.length).toBe(2);
      const drop = result.segments[1];
      expect(drop?.vx).toBe(0);
      expect(drop?.t0).toBe(result.eventSec);
      expect(result.endSec).toBeCloseTo(result.eventSec + b.physics.hitLingerSec, 12);
      // The crossing point is on the sensor line and inside the rim.
      expect(drop?.y).toBeCloseTo(def.target.center.y, 3);
      expect(Math.abs((drop?.x ?? 0) - def.target.center.x)).toBeLessThan(def.target.halfWidth);
      // The ball drops straight down through the net and reaches the floor exactly when it stops being drawn.
      if (!drop) throw new Error('no drop segment');
      expect(drop.vy).toBeLessThanOrEqual(0);
      expect(endOf(drop).y).toBeCloseTo(result.radius, 9);
      expect(endOf(drop).x).toBe(drop.x);
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
      // Fixed-point iteration: aim at the hoop position at the predicted arrival time.
      let arrival = t0;
      let aim = 0;
      for (let i = 0; i < 12; i++) {
        const pose = targetPose(def, arrival, targetPhase);
        const dx = pose.center.x - def.field.origin.x;
        const solved = solveAim(ball.launchSpeed, g, dx, pose.center.y - def.field.origin.y, 'high');
        if (solved === null) throw new Error('out of range');
        aim = solved;
        arrival = t0 + dx / (ball.launchSpeed * Math.cos(aim));
      }
      const result = resolveShot(shot({ aim, t: t0, targetPhase }), rng(), balance);
      if (result.hit) hits++;
    }
    expect(hits).toBe(phases.length);
  });

  it('misses a hoop when aimed far from it', () => {
    const result = resolveShot(shot({ aim: 0.1, ballId: 'foam' }), rng(), balance);
    expect(result.hit).toBe(false);
    expect(result.value).toBe(0);
  });

  it('never scores by passing the sensor upward', () => {
    // A hoop sitting just above the shot origin: the ball passes up through it right away, then falls back down into it.
    const raw = JSON.parse(JSON.stringify(balance)) as Balance;
    raw.sports.basketball.target.motion.amplitude = 0;
    raw.sports.basketball.target.center = { x: raw.sports.basketball.field.origin.x, y: raw.sports.basketball.field.origin.y + 0.5 };
    delete raw.sports.basketball.target.backboard;
    const b = parseBalance(raw);
    const input = shot({ aim: Math.PI / 2, ballId: 'foam' });
    const result = resolveShot(input, rng(), b);
    expect(result.hit).toBe(true);
    // The hit is the downward crossing after the apex, not the first (upward) crossing.
    const vyUp = ballOf(b, 'basketball', 'foam').launchSpeed;
    const apexSec = input.t + vyUp / b.physics.gravity;
    expect(result.eventSec).toBeGreaterThan(apexSec);
  });

  it('rests after a shot straight into the floor', () => {
    const input = shot({ aim: -Math.PI / 2 });
    const result = resolveShot(input, rng(), balance);
    expect(result.hit).toBe(false);
    expect(result.value).toBe(0);
    expectContiguous(result, input);
    const last = result.segments[result.segments.length - 1];
    expect(last?.vx).toBe(0);
    expect(last?.vy).toBe(0);
    expect(last?.gy).toBe(0);
    expect(last?.y).toBeCloseTo(result.radius, 12);
    expect(last?.t0).toBe(result.eventSec);
    expect(result.endSec).toBeCloseTo(result.eventSec + balance.physics.restLingerSec, 12);
    expect(result.eventSec).toBeLessThan(input.t + balance.physics.maxFlightSec);
    // Every bounce is a new segment and the ball never goes below the floor at a segment start.
    expect(result.segments.length).toBeGreaterThan(2);
    for (const s of result.segments) expect(s.y).toBeGreaterThanOrEqual(result.radius - 1e-12);
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
    const input = shot({ aim: 0.2 });
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
          const before = (e.vx * e.vx + e.vy * e.vy) / 2 + g * e.y;
          const after = (next.vx * next.vx + next.vy * next.vy) / 2 + g * next.y;
          expect(after).toBeLessThanOrEqual(before + 1e-9);
          // Speed alone never grows either.
          expect(next.vx * next.vx + next.vy * next.vy).toBeLessThanOrEqual(e.vx * e.vx + e.vy * e.vy + 1e-9);
          contacts++;
        }
      }
    }
    expect(contacts).toBeGreaterThan(100);
  });

  it('bounces off the backboard', () => {
    const b = withStaticHoop();
    const def = b.sports.basketball;
    const board = def.target.backboard;
    if (!board) throw new Error('hoop has no backboard');
    // Aim at the middle of the board with a low arc so the ball arrives moving right.
    const aim = aimAt(b, 'basketball', 'foam', def.target.center.x + board.dx, def.target.center.y + board.yTo / 2, 'low');
    const input = shot({ aim });
    const result = resolveShot(input, rng(), b);
    const bounce = result.segments.find((s, i) => i > 0 && s.vx < 0 && (result.segments[i - 1]?.vx ?? 0) > 0);
    expect(bounce).toBeDefined();
    expect(bounce?.x).toBeLessThanOrEqual(def.target.center.x + board.dx - result.radius + 1e-9);
  });

  it('bounces off the rim when aimed at it', () => {
    const b = withStaticHoop();
    const def = b.sports.basketball;
    const aim = aimAt(b, 'basketball', 'regulation', def.target.center.x - def.target.halfWidth, def.target.center.y, 'high');
    const input = shot({ aim, ballId: 'regulation' });
    const result = resolveShot(input, rng(), b);
    // A new segment starts near the front rim, with the ball pushed out of the rim circle.
    const reach = result.radius + (def.target.rimRadius ?? 0);
    const rimX = def.target.center.x - def.target.halfWidth;
    const atRim = result.segments.find((s) => Math.hypot(s.x - rimX, s.y - def.target.center.y) < reach + 1e-6);
    expect(atRim).toBeDefined();
    expect(Math.hypot((atRim?.x ?? 0) - rimX, (atRim?.y ?? 0) - def.target.center.y)).toBeGreaterThanOrEqual(reach - 1e-9);
  });

  it('produces no NaN for any angle in [0, π] in every sport', () => {
    for (const sport of ['basketball', 'football', 'golf'] as SportId[]) {
      const def = balance.sports[sport];
      for (const ball of def.balls) {
        for (let i = 0; i <= 90; i++) {
          const input = shot({ sport, aim: (Math.PI * i) / 90, ballId: ball.id, t: 0 });
          const result = resolveShot(input, rng(), balance);
          expectFinite(result);
          expectContiguous(result, input);
          // The ball stays inside the field at every segment start.
          for (const s of result.segments) {
            expect(s.x).toBeGreaterThanOrEqual(result.radius - 1e-9);
            expect(s.x).toBeLessThanOrEqual(def.field.width - result.radius + 1e-9);
            expect(s.y).toBeLessThanOrEqual(def.field.height - result.radius + 1e-9);
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
    const input = shot({ aim: 0.9, spreadDeg: 6 });
    const result = resolveShot(input, rng(8), balance);
    const out = { x: 0, y: 0 };
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
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
    // Exactly at a segment boundary the later segment wins.
    const second = result.segments[1];
    if (second) {
      expect(positionAt(result.segments, second.t0, out)).toBe(true);
      expect(out.x).toBe(second.x);
      expect(out.y).toBe(second.y);
    }
  });

  it('plays back continuously: no jumps inside a flight segment and small ones at contacts', () => {
    const input = shot({ aim: 0.6 });
    const result = resolveShot(input, rng(), balance);
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    for (const s of result.segments) {
      const mid = (s.t0 + s.t1) / 2;
      positionAt(result.segments, mid, a);
      positionAt(result.segments, mid + 1e-4, b);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.01);
    }
  });
});

describe('football and golf', () => {
  it('scores a football goal that passes over the keeper', () => {
    const b = withStaticKeeper();
    const def = b.sports.football;
    const keeperH = def.target.keeperHeight ?? 0;
    const y = (keeperH + 2 * def.target.center.y) / 2;
    const aim = aimAt(b, 'football', 'match', def.target.center.x, y, 'low');
    const input = shot({ sport: 'football', ballId: 'match', aim, valueIfHit: 3 });
    const result = resolveShot(input, rng(), b);
    expect(result.hit).toBe(true);
    expect(result.value).toBe(3);
    expectContiguous(result, input);
    const net = result.segments[result.segments.length - 1];
    expect(net?.x).toBeCloseTo(def.target.center.x, 6);
    expect(net?.vx).toBe(0);
    expect(net?.vy).toBe(0);
  });

  it('is blocked by the keeper and bounces back', () => {
    const b = withStaticKeeper();
    const def = b.sports.football;
    const aim = aimAt(b, 'football', 'match', def.target.center.x, (def.target.keeperHeight ?? 0) / 2, 'low');
    const input = shot({ sport: 'football', ballId: 'match', aim });
    const result = resolveShot(input, rng(), b);
    expect(result.hit).toBe(false);
    expectContiguous(result, input);
    const back = result.segments.find((s) => s.vx < 0);
    expect(back).toBeDefined();
    expect(back?.x).toBeLessThanOrEqual(def.target.center.x - (def.target.keeperHalfWidth ?? 0) - result.radius + 1e-9);
  });

  it('misses a football shot over the crossbar', () => {
    const b = withStaticKeeper();
    const def = b.sports.football;
    const aim = aimAt(b, 'football', 'match', def.target.center.x, 2 * def.target.center.y + 0.5, 'low');
    const result = resolveShot(shot({ sport: 'football', ballId: 'match', aim }), rng(), b);
    expect(result.hit).toBe(false);
  });

  it('holes a golf shot that drops on the hole', () => {
    const def = balance.sports.golf;
    const targetPhase = 0.4;
    const pose = targetPose(def, 0, targetPhase);
    // The steel ball is the only golf ball whose high arc stays under the 8 m ceiling; aim at the point where the ball touches the floor.
    const radius = def.ballRadius * ballOf(balance, 'golf', 'steel').radiusMult;
    const aim = aimAt(balance, 'golf', 'steel', pose.center.x, radius, 'high');
    const input = shot({ sport: 'golf', ballId: 'steel', aim, targetPhase, valueIfHit: 2 });
    const result = resolveShot(input, rng(), balance);
    expect(result.hit).toBe(true);
    expect(result.value).toBe(2);
    expectContiguous(result, input);
    const last = result.segments[result.segments.length - 1];
    expect(last?.y).toBeCloseTo(radius, 12);
    expect(last?.vx).toBe(0);
    expect(Math.abs((last?.x ?? 0) - pose.center.x)).toBeLessThanOrEqual(def.target.halfWidth);
  });

  it('golf shot far from the hole rests on the floor', () => {
    const input = shot({ sport: 'golf', ballId: 'golf', aim: Math.PI / 3, targetPhase: Math.PI / 2 });
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

  it('round-trips through resolveShot with zero spread', () => {
    const b = withStaticHoop();
    const def = b.sports.basketball;
    const ball = ballOf(b, 'basketball', 'regulation');
    const target = { x: def.target.center.x, y: def.target.center.y };
    for (const arc of ['high', 'low'] as const) {
      const aim = solveAim(ball.launchSpeed, g, target.x - def.field.origin.x, target.y - def.field.origin.y, arc);
      expect(aim).not.toBeNull();
      if (aim === null) return;
      const result = resolveShot(shot({ aim, ballId: 'regulation', t: 0 }), rng(), b);
      // The first flight segment passes through the target point (before any contact).
      const first = result.segments[0];
      if (!first) throw new Error('no segment');
      const t = (target.x - first.x) / first.vx;
      const y = first.y + first.vy * t + (first.gy * t * t) / 2;
      if (t <= first.t1 - first.t0) {
        expect(y).toBeCloseTo(target.y, 6);
      }
      if (arc === 'high') expect(result.hit).toBe(true);
    }
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
