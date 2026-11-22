import { limbAnchors } from '@/engine';

import { BODY_H, CYCLE_SEC, chainEnd, cyclePhase, poseBody, solveJoint, tauFor, type ArmTiming, type Vec } from '../rig';

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const finite = (v: Vec) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

describe('solveJoint', () => {
  const root = { x: 0, y: 1, z: 0 };

  it('keeps both bone lengths when the target is in reach, bending toward the hint', () => {
    const target = { x: 0.2, y: 1.2, z: 0.1 };
    const joint = solveJoint(root, target, 0.3, 0.28, { x: 0, y: -1, z: 0 });
    expect(dist(root, joint)).toBeCloseTo(0.3, 9);
    expect(dist(joint, target)).toBeCloseTo(0.28, 9);
    // Below the root→target line, as the hint asked.
    expect(joint.y).toBeLessThan(1.1);
    expect(chainEnd(root, target, 0.3, 0.28, joint)).toEqual(target);
  });

  it('straightens toward a target out of reach and the end stops at full length', () => {
    const target = { x: 5, y: 1, z: 0 };
    const joint = solveJoint(root, target, 0.3, 0.28, { x: 0, y: -1, z: 0 });
    expect(dist(root, joint)).toBeCloseTo(0.3, 6);
    const end = chainEnd(root, target, 0.3, 0.28, joint);
    expect(dist(root, end)).toBeCloseTo(0.58, 6);
    expect(end.x).toBeGreaterThan(joint.x);
  });

  it('folds without NaN when the target sits on the root or along the hint', () => {
    for (const target of [root, { x: 0, y: 0.7, z: 0 }, { x: 0, y: 1.58, z: 0 }]) {
      const joint = solveJoint(root, target, 0.3, 0.28, { x: 0, y: -1, z: 0 });
      expect(finite(joint)).toBe(true);
      expect(finite(chainEnd(root, target, 0.3, 0.28, joint))).toBe(true);
    }
  });
});

describe('cyclePhase', () => {
  it('holds the ball still outside the cycle', () => {
    for (const tau of [-3, -0.5, 0.6, 4]) {
      const p = cyclePhase(tau, 2);
      expect(p.dip).toBe(0);
      expect(p.reach).toBe(0);
      expect(p.holding).toBe(1);
    }
  });

  it('dips, rises, flicks and returns in order, releasing the ball at the fire time', () => {
    const deepest = cyclePhase(-0.13, 2);
    expect(deepest.dip).toBeGreaterThan(0.95);
    expect(deepest.reach).toBe(0);
    const justBefore = cyclePhase(-0.001, 2);
    expect(justBefore.reach).toBeGreaterThan(0.95);
    expect(justBefore.flick).toBe(-1);
    expect(justBefore.holding).toBe(1);
    const release = cyclePhase(0, 2);
    expect(release.holding).toBe(0);
    expect(release.reach).toBe(1);
    const flicked = cyclePhase(0.1, 2);
    expect(flicked.flick).toBe(1);
    const back = cyclePhase(0.54, 2);
    expect(back.reach).toBeLessThan(0.05);
  });

  it('squeezes the whole cycle into a short period and keeps the release at zero', () => {
    const period = 0.3;
    const deep = cyclePhase((-0.13 * period) / CYCLE_SEC, period);
    expect(deep.dip).toBeGreaterThan(0.95);
    expect(cyclePhase(0, period).holding).toBe(0);
    expect(cyclePhase(period * 0.6, period).reach).toBeLessThan(0.05);
  });

  it('is continuous: no jumps bigger than a step allows', () => {
    let prev = cyclePhase(-0.6, 2);
    for (let tau = -0.6; tau <= 0.7; tau += 0.002) {
      const p = cyclePhase(tau, 2);
      expect(Math.abs(p.dip - prev.dip)).toBeLessThan(0.05);
      expect(Math.abs(p.reach - prev.reach)).toBeLessThan(0.08);
      expect(Math.abs(p.flick - prev.flick)).toBeLessThan(0.12);
      prev = p;
    }
  });
});

describe('tauFor', () => {
  it('counts down to the first shot, up after each shot, and down again toward the next', () => {
    expect(tauFor(0.5, 1, 2)).toBeCloseTo(-0.5, 12);
    expect(tauFor(1.2, 1, 2)).toBeCloseTo(0.2, 12);
    expect(tauFor(2.9, 1, 2)).toBeCloseTo(-0.1, 12);
    expect(tauFor(3.1, 1, 2)).toBeCloseTo(0.1, 12);
  });

  it('never anticipates for an arm that does not fire', () => {
    expect(tauFor(5, 1, 0)).toBeLessThan(-1);
    expect(tauFor(5, 1, Number.POSITIVE_INFINITY)).toBeLessThan(-1);
  });
});

describe('poseBody', () => {
  function timings(n: number, tau: number, period = 1): ArmTiming[] {
    return Array.from({ length: n }, (_, i) => ({ tau, period, yaw: 0.1 * (i % 3), offset: 0.1 * i - 0.05 * (n - 1) }));
  }

  it('stands with planted feet and bone lengths intact for 1 to 64 arms, idle and shooting', () => {
    for (const n of [1, 2, 3, 4, 7, 16, 64]) {
      const anchors = limbAnchors(n, 'arm');
      for (const tau of [null, -0.3, -0.05, 0.02, 0.2, 0.45]) {
        const pose = poseBody({ anchors, timings: tau === null ? anchors.map(() => null) : timings(n, tau), releaseY: 2.0, time: 1.3 });
        expect(pose.arms).toHaveLength(n);
        for (const leg of pose.legs) {
          expect(leg.ankle.y).toBeLessThan(0.1);
          expect(dist(leg.hip, leg.knee)).toBeCloseTo(0.25 * BODY_H, 6);
          expect(dist(leg.knee, leg.ankle)).toBeCloseTo(0.25 * BODY_H, 6);
          // Knees bend forward, never backward.
          expect(leg.knee.x).toBeGreaterThanOrEqual(leg.hip.x - 1e-9);
        }
        for (const arm of pose.arms) {
          expect(dist(arm.shoulder, arm.elbow)).toBeCloseTo(0.19 * BODY_H, 6);
          expect(dist(arm.elbow, arm.wrist)).toBeCloseTo(0.17 * BODY_H, 6);
          expect(dist(arm.wrist, arm.tip)).toBeCloseTo(0.085 * BODY_H, 6);
          for (const j of [arm.shoulder, arm.elbow, arm.wrist, arm.tip]) expect(finite(j)).toBe(true);
          // No anchor on the head.
          expect(arm.shoulder.y).toBeLessThan(pose.head.y - 0.5 * 0.095 * BODY_H);
        }
      }
    }
  });

  it('bends the knees in the dip and straightens them at the release', () => {
    const anchors = limbAnchors(1, 'arm');
    const standing = poseBody({ anchors, timings: [null], releaseY: 2.0, time: 0 });
    const dipped = poseBody({ anchors, timings: timings(1, -0.13), releaseY: 2.0, time: 0 });
    const released = poseBody({ anchors, timings: timings(1, 0.01), releaseY: 2.0, time: 0 });
    expect(dipped.dip).toBeGreaterThan(0.95);
    expect(dipped.hips.y).toBeLessThan(standing.hips.y - 0.05);
    expect(dipped.legs[0].knee.x).toBeGreaterThan(standing.legs[0].knee.x + 0.03);
    expect(released.dip).toBe(0);
    expect(released.hips.y).toBeCloseTo(standing.hips.y, 6);
  });

  it('raises the hand to the release height at the fire time and keeps it low in the hold', () => {
    const anchors = limbAnchors(2, 'arm');
    const hold = poseBody({ anchors, timings: [null, null], releaseY: 2.0, time: 0 });
    const release = poseBody({ anchors, timings: timings(2, 0), releaseY: 2.0, time: 0 });
    for (let i = 0; i < 2; i++) {
      expect(hold.arms[i]!.wrist.y).toBeLessThan(1.4);
      expect(hold.arms[i]!.holding).toBe(1);
      expect(release.arms[i]!.wrist.y).toBeGreaterThan(1.8);
      expect(release.arms[i]!.holding).toBe(0);
      // The release hand sits over this arm's lateral offset, not over the shoulder.
      expect(Math.abs(release.arms[i]!.wrist.z - timings(2, 0)[i]!.offset)).toBeLessThan(0.25);
    }
  });

  it('flicks the wrist: fingers point up before the release and forward-down after', () => {
    const anchors = limbAnchors(1, 'arm');
    const before = poseBody({ anchors, timings: timings(1, -0.01), releaseY: 2.0, time: 0 }).arms[0]!;
    const after = poseBody({ anchors, timings: timings(1, 0.1), releaseY: 2.0, time: 0 }).arms[0]!;
    const dirBefore = { x: before.tip.x - before.wrist.x, y: before.tip.y - before.wrist.y, z: 0 };
    const dirAfter = { x: after.tip.x - after.wrist.x, y: after.tip.y - after.wrist.y, z: 0 };
    expect(dirBefore.y).toBeGreaterThan(0);
    expect(dirAfter.x).toBeGreaterThan(dirBefore.x);
    expect(dirAfter.y).toBeLessThan(dirBefore.y);
  });

  it('elbows point down and out, and the knees follow the deepest arm', () => {
    const anchors = limbAnchors(3, 'arm');
    const pose = poseBody({ anchors, timings: [{ tau: -0.13, period: 1, yaw: 0, offset: 0 }, null, null], releaseY: 2.0, time: 0 });
    expect(pose.dip).toBeGreaterThan(0.95);
    for (const arm of pose.arms) {
      const mid = { x: (arm.shoulder.x + arm.wrist.x) / 2, y: (arm.shoulder.y + arm.wrist.y) / 2, z: (arm.shoulder.z + arm.wrist.z) / 2 };
      expect(arm.elbow.y).toBeLessThanOrEqual(mid.y + 1e-6);
    }
  });

  it('squashes the torso in the dip and stretches it around the release', () => {
    const anchors = limbAnchors(1, 'arm');
    const at = (tau: number) => poseBody({ anchors, timings: timings(1, tau), releaseY: 2.0, time: 0 }).torso;
    expect(poseBody({ anchors, timings: [null], releaseY: 2.0, time: 0 }).torso).toBeCloseTo(1, 6);
    expect(at(-0.13)).toBeLessThan(0.97);
    expect(at(0)).toBeGreaterThan(1.03);
    expect(at(0.45)).toBeCloseTo(1, 6);
  });

  it('is deterministic', () => {
    const anchors = limbAnchors(5, 'arm');
    const a = poseBody({ anchors, timings: timings(5, 0.1), releaseY: 2.0, time: 2 });
    const b = poseBody({ anchors, timings: timings(5, 0.1), releaseY: 2.0, time: 2 });
    expect(b).toEqual(a);
  });
});
