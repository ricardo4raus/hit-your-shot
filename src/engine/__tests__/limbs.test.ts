import { limbAnchors, muzzleOffsets, type LimbAnchor } from '../limbs';
import { balance } from '../testing';
import { SPORT_IDS, type LimbKind } from '../types';

const KINDS: readonly LimbKind[] = ['arm', 'foot'];
const HEAD_Y = 0.78;
const SOFT_CAP = balance.characters.softCapLimbs;

function at(anchors: LimbAnchor[], i: number): LimbAnchor {
  const a = anchors[i];
  if (!a) throw new Error(`no anchor at ${i}`);
  return a;
}

describe('limbAnchors', () => {
  it.each(KINDS)('%s: returns n anchors sorted by index', (kind) => {
    for (let n = 0; n <= SOFT_CAP; n++) {
      const anchors = limbAnchors(n, kind);
      expect(anchors).toHaveLength(n);
      anchors.forEach((a, i) => expect(a.index).toBe(i));
    }
  });

  it.each(KINDS)('%s: limbAnchors(n) is a prefix of limbAnchors(n + 1) up to 64', (kind) => {
    let previous = limbAnchors(0, kind);
    for (let n = 1; n <= 64; n++) {
      const next = limbAnchors(n, kind);
      expect(next.slice(0, previous.length)).toEqual(previous);
      previous = next;
    }
  });

  it.each(KINDS)('%s: is deterministic', (kind) => {
    expect(limbAnchors(SOFT_CAP, kind)).toEqual(limbAnchors(SOFT_CAP, kind));
  });

  it.each(KINDS)('%s: never anchors on the head and never below the hips', (kind) => {
    for (const a of limbAnchors(SOFT_CAP, kind)) {
      expect(a.y).toBeLessThan(HEAD_Y);
      expect(a.y).toBeGreaterThanOrEqual(0.42 - 1e-9);
    }
  });

  it.each(KINDS)('%s: stays within the torso width', (kind) => {
    for (const a of limbAnchors(SOFT_CAP, kind)) {
      expect(Math.abs(a.x)).toBeLessThanOrEqual(0.18 + 1e-9);
      expect(Math.sign(a.x)).toBe(a.side);
    }
  });

  it.each(KINDS)('%s: sides alternate from limb 5 on', (kind) => {
    const anchors = limbAnchors(SOFT_CAP, kind);
    for (let i = 4; i < anchors.length; i++) {
      expect(at(anchors, i).side).toBe(-at(anchors, i - 1).side);
    }
  });

  it.each(KINDS)('%s: rest angles stay within a quarter radian', (kind) => {
    for (const a of limbAnchors(SOFT_CAP, kind)) {
      expect(Math.abs(a.restAngle)).toBeLessThanOrEqual(0.25);
    }
  });

  it.each(KINDS)('%s: neighbouring limbs vary in height, length and rest angle', (kind) => {
    const anchors = limbAnchors(SOFT_CAP, kind);
    const ys = new Set<number>();
    const lengths = new Set<number>();
    const angles = new Set<number>();
    for (const a of anchors.slice(4)) {
      ys.add(a.y);
      lengths.add(a.length);
      angles.add(a.restAngle);
    }
    // 60 walking limbs over 8 base positions: the hash must keep them from stacking exactly.
    expect(ys.size).toBe(anchors.length - 4);
    expect(lengths.size).toBe(anchors.length - 4);
    expect(angles.size).toBe(anchors.length - 4);
  });

  it.each(KINDS)('%s: walking limbs visit both the front and the back', (kind) => {
    const walking = limbAnchors(SOFT_CAP, kind).slice(4);
    expect(walking.some((a) => a.behind)).toBe(true);
    expect(walking.some((a) => !a.behind)).toBe(true);
  });

  it('arms: the first four follow the body', () => {
    const [a1, a2, a3, a4] = limbAnchors(4, 'arm');
    expect(a1).toMatchObject({ side: 1, behind: false });
    expect(a2).toMatchObject({ side: -1, behind: false });
    expect(a1!.y).toBeCloseTo(a2!.y);
    expect(a1!.y).toBeGreaterThan(0.7);
    expect(a3).toMatchObject({ side: -1, behind: true });
    expect(a3!.y).toBeCloseTo(0.68, 1);
    expect(a4).toMatchObject({ side: 1, behind: false });
    expect(a4!.y).toBeCloseTo(0.45, 1);
  });

  it('arms: lengths are between 0.26 and 0.34', () => {
    for (const a of limbAnchors(SOFT_CAP, 'arm')) {
      expect(a.length).toBeGreaterThanOrEqual(0.26);
      expect(a.length).toBeLessThanOrEqual(0.34);
    }
  });

  it('feet: the first four follow the body', () => {
    const [f1, f2, f3, f4] = limbAnchors(4, 'foot');
    expect(f1).toMatchObject({ side: 1, behind: false });
    expect(f2).toMatchObject({ side: -1, behind: false });
    expect(f1!.y).toBeCloseTo(0.42, 1);
    expect(f2!.y).toBeCloseTo(0.42, 1);
    expect(f3).toMatchObject({ side: 1, behind: false });
    expect(f3!.y).toBeCloseTo(0.55, 1);
    expect(f4).toMatchObject({ side: -1, behind: true });
    expect(f4!.y).toBeCloseTo(0.5, 1);
  });

  it('feet: lengths are between 0.38 and 0.44', () => {
    for (const a of limbAnchors(SOFT_CAP, 'foot')) {
      expect(a.length).toBeGreaterThanOrEqual(0.38);
      expect(a.length).toBeLessThanOrEqual(0.44);
    }
  });

  it('tolerates bad counts', () => {
    expect(limbAnchors(0, 'arm')).toEqual([]);
    expect(limbAnchors(-3, 'arm')).toEqual([]);
    expect(limbAnchors(2.9, 'arm')).toHaveLength(2);
    expect(limbAnchors(Number.NaN, 'foot')).toEqual([]);
  });
});

describe('muzzleOffsets', () => {
  it.each(SPORT_IDS)('%s: n = 1 gives [0]', (sportId) => {
    expect(muzzleOffsets(1, balance.sports[sportId], balance)).toEqual([0]);
  });

  it.each(SPORT_IDS)('%s: n = 0 gives []', (sportId) => {
    expect(muzzleOffsets(0, balance.sports[sportId], balance)).toEqual([]);
  });

  it.each(SPORT_IDS)('%s: two limbs both fire inside a centered target of the sport width', (sportId) => {
    const sport = balance.sports[sportId];
    const offsets = muzzleOffsets(2, sport, balance);
    expect(offsets).toHaveLength(2);
    for (const o of offsets) expect(Math.abs(o)).toBeLessThan(sport.target.halfWidth);
  });

  it.each(SPORT_IDS)('%s: offsets are sorted ascending and symmetric for n up to the soft cap', (sportId) => {
    const sport = balance.sports[sportId];
    for (let n = 1; n <= SOFT_CAP; n++) {
      const offsets = muzzleOffsets(n, sport, balance);
      expect(offsets).toHaveLength(n);
      for (let i = 0; i < n; i++) {
        const o = offsets[i]!;
        expect(o).toBeCloseTo(-offsets[n - 1 - i]!, 9);
        if (i > 0) expect(o).toBeGreaterThan(offsets[i - 1]!);
      }
      const sum = offsets.reduce((acc, o) => acc + o, 0);
      expect(Math.abs(sum)).toBeLessThan(1e-9);
    }
  });

  it.each(SPORT_IDS)('%s: the whole group stays within the span cap for n up to the soft cap', (sportId) => {
    const sport = balance.sports[sportId];
    const maxSpan = balance.limbs.maxSpanFraction * 2 * sport.field.halfSpan;
    for (let n = 1; n <= SOFT_CAP; n++) {
      const offsets = muzzleOffsets(n, sport, balance);
      const span = offsets[n - 1]! - offsets[0]!;
      expect(span).toBeLessThanOrEqual(maxSpan + 1e-9);
    }
  });

  it.each(SPORT_IDS)('%s: spacing follows the target width until the span cap binds', (sportId) => {
    const sport = balance.sports[sportId];
    const byTarget = balance.limbs.spacingFraction * 2 * sport.target.halfWidth;
    const maxSpan = balance.limbs.maxSpanFraction * 2 * sport.field.halfSpan;
    for (let n = 2; n <= SOFT_CAP; n++) {
      const offsets = muzzleOffsets(n, sport, balance);
      const spacing = offsets[1]! - offsets[0]!;
      expect(spacing).toBeCloseTo(Math.min(byTarget, maxSpan / (n - 1)), 9);
    }
  });

  it('is deterministic', () => {
    const sport = balance.sports.basketball;
    expect(muzzleOffsets(7, sport, balance)).toEqual(muzzleOffsets(7, sport, balance));
  });
});
