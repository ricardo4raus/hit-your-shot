import type { Segment, ShotResult } from '@/engine';

import { FIRE_STREAK, FX_GAP_MS, makePlanner, milestoneWord, planShot, resetPlanner, WORD_GAP_MS } from '../hitPlan';

const seg = (): Segment => ({ t0: 0, t1: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, gy: 0 });
const shot = (hit: boolean, segments = 2): ShotResult => ({
  hit,
  value: hit ? 1 : 0,
  segments: Array.from({ length: segments }, seg),
  endSec: 1,
  eventSec: 1,
  radius: 0.12,
  ballId: 'standard',
  limb: 0,
});

describe('planShot', () => {
  it('counts the streak in firing order and resets it on a miss', () => {
    const p = makePlanner();
    expect(planShot(p, shot(true), 'hoop', 0).streak).toBe(1);
    expect(planShot(p, shot(true), 'hoop', 1000).streak).toBe(2);
    expect(planShot(p, shot(false), 'hoop', 2000).streak).toBe(0);
    expect(planShot(p, shot(true), 'hoop', 3000).streak).toBe(1);
  });

  it('sets the ball on fire once the streak before it reaches the threshold', () => {
    const p = makePlanner();
    for (let i = 0; i < FIRE_STREAK; i++) expect(planShot(p, shot(true), 'hoop', i * 1000).fire).toBe(false);
    expect(planShot(p, shot(false), 'hoop', 99_000).fire).toBe(true);
    expect(planShot(p, shot(true), 'hoop', 100_000).fire).toBe(false);
  });

  it('names clean hoop hits SWISH and the rest NICE', () => {
    const p = makePlanner();
    expect(planShot(p, shot(true, 2), 'hoop', 0).word).toBe('SWISH!');
    expect(planShot(p, shot(true, 4), 'hoop', 10_000).word).toBe('NICE!');
    expect(planShot(p, shot(true, 2), 'goal', 20_000).word).toBe('GOAL!');
  });

  it('throttles bursts and words in a flood of hits, but never a milestone', () => {
    const p = makePlanner();
    let bursts = 0;
    let words = 0;
    let milestones = 0;
    // 200 hits in one second.
    for (let i = 0; i < 200; i++) {
      const plan = planShot(p, shot(true), 'hoop', i * 5);
      if (plan.fx > 0) bursts++;
      if (plan.word) words++;
      if (plan.big) milestones++;
    }
    expect(bursts).toBeLessThanOrEqual(Math.ceil(1000 / FX_GAP_MS) + milestones);
    expect(words).toBeLessThanOrEqual(Math.ceil(1000 / WORD_GAP_MS) + milestones);
    // 5, 10, 25, 50, 100.
    expect(milestones).toBe(5);
  });

  it('starts over on a new round', () => {
    const p = makePlanner();
    planShot(p, shot(true), 'hoop', 0);
    resetPlanner(p);
    const plan = planShot(p, shot(true), 'hoop', 1);
    expect(plan.streak).toBe(1);
    expect(plan.word).not.toBeNull();
  });
});

describe('milestoneWord', () => {
  it('counts big streaks', () => {
    expect(milestoneWord(5)).toBe('ON FIRE!');
    expect(milestoneWord(100)).toBe('100 IN A ROW!');
  });
});
