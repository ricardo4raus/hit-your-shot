/**
 * Worklet helpers that draw the character's limbs as lit, tapered tubes in screen space, batched into a few paths per frame.
 * A limb segment is a tapered capsule (two circles joined by their outer tangents), added to four builders:
 *   ink    the outline: the capsule grown by the outline width, all segments in one path so joints merge without seams;
 *   shade  the full capsule in the shade tone;
 *   base   a thinner capsule moved toward the key light (upper left), so a crescent of shade stays on the lower right;
 *   light  a thin stripe further toward the light, the highlight.
 * Every contour winds the same way, so overlapping capsules in one path fill as a union.
 * Owner of this file: the "character" agent.
 */
import { Skia, type SkPath } from '@shopify/react-native-skia';

type Builder = ReturnType<typeof Skia.PathBuilder.Make>;

export interface LitBuilders {
  ink: Builder;
  shade: Builder;
  base: Builder;
  light: Builder;
  /** Cloth over the limb (wristbands, socks): filled after the skin. */
  band: Builder;
  bandShade: Builder;
  /** Flat-ended cloth rings (wristbands): filled and outlined on their own, over everything else in the batch. */
  cuff: Builder;
}

export interface LitPaths {
  ink: SkPath;
  shade: SkPath;
  base: SkPath;
  light: SkPath;
  band: SkPath;
  bandShade: SkPath;
  cuff: SkPath;
}

/** Direction toward the key light on screen (upper left), unit length. */
export const LIGHT_X = -0.58;
export const LIGHT_Y = -0.81;
const DEG = 180 / Math.PI;

export function makeLit(): LitBuilders {
  'worklet';
  return {
    ink: Skia.PathBuilder.Make(),
    shade: Skia.PathBuilder.Make(),
    base: Skia.PathBuilder.Make(),
    light: Skia.PathBuilder.Make(),
    band: Skia.PathBuilder.Make(),
    bandShade: Skia.PathBuilder.Make(),
    cuff: Skia.PathBuilder.Make(),
  };
}

export function detachLit(b: LitBuilders): LitPaths {
  'worklet';
  return {
    ink: b.ink.detach(),
    shade: b.shade.detach(),
    base: b.base.detach(),
    light: b.light.detach(),
    band: b.band.detach(),
    bandShade: b.bandShade.detach(),
    cuff: b.cuff.detach(),
  };
}

/** A tapered capsule from (ax, ay) with radius ra to (bx, by) with radius rb, as one clockwise contour. */
export function capsule(b: Builder, ax: number, ay: number, ra: number, bx: number, by: number, rb: number): void {
  'worklet';
  const dx = bx - ax;
  const dy = by - ay;
  const l = Math.sqrt(dx * dx + dy * dy);
  if (!(ra > 0) || !(rb > 0)) return;
  if (l <= Math.abs(ra - rb) + 1e-3) {
    if (ra >= rb) b.addCircle(ax, ay, ra);
    else b.addCircle(bx, by, rb);
    return;
  }
  const phi = Math.atan2(dy, dx) * DEG;
  const g = Math.acos((ra - rb) / l) * DEG;
  // The far side of the first circle, then the near side of the second, both clockwise; the tangent lines join them.
  b.arcToOval({ x: ax - ra, y: ay - ra, width: 2 * ra, height: 2 * ra }, phi + g, 360 - 2 * g, true);
  b.arcToOval({ x: bx - rb, y: by - rb, width: 2 * rb, height: 2 * rb }, phi - g, 2 * g, false);
  b.close();
}

/** One lit limb segment. `stripe` adds the highlight stripe along its middle. */
export function litSegment(L: LitBuilders, ax: number, ay: number, ra: number, bx: number, by: number, rb: number, inkW: number, stripe: boolean): void {
  'worklet';
  capsule(L.ink, ax, ay, ra + inkW, bx, by, rb + inkW);
  capsule(L.shade, ax, ay, ra, bx, by, rb);
  const oa = 0.2 * ra;
  const ob = 0.2 * rb;
  capsule(L.base, ax + LIGHT_X * oa, ay + LIGHT_Y * oa, 0.78 * ra, bx + LIGHT_X * ob, by + LIGHT_Y * ob, 0.78 * rb);
  if (stripe) {
    const px = ax + (bx - ax) * 0.2;
    const py = ay + (by - ay) * 0.2;
    const qx = ax + (bx - ax) * 0.68;
    const qy = ay + (by - ay) * 0.68;
    const rp = ra + (rb - ra) * 0.2;
    const rq = ra + (rb - ra) * 0.68;
    capsule(L.light, px + LIGHT_X * 0.46 * rp, py + LIGHT_Y * 0.46 * rp, 0.22 * rp, qx + LIGHT_X * 0.46 * rq, qy + LIGHT_Y * 0.46 * rq, 0.18 * rq);
  }
}

/** A cloth band over a limb segment (wristband, sock): outline in the ink path, fill and its own shade crescent in the band paths. */
export function bandSegment(L: LitBuilders, ax: number, ay: number, ra: number, bx: number, by: number, rb: number, inkW: number): void {
  'worklet';
  capsule(L.ink, ax, ay, ra + inkW, bx, by, rb + inkW);
  capsule(L.bandShade, ax, ay, ra, bx, by, rb);
  const oa = 0.2 * ra;
  const ob = 0.2 * rb;
  capsule(L.band, ax + LIGHT_X * oa, ay + LIGHT_Y * oa, 0.8 * ra, bx + LIGHT_X * ob, by + LIGHT_Y * ob, 0.8 * rb);
}

/** A strip across a tapered tube between fractions f0 and f1 of its length (sock stripes, wristbands): a quad. */
export function tubeBand(b: Builder, ax: number, ay: number, ra: number, bx: number, by: number, rb: number, f0: number, f1: number): void {
  'worklet';
  const dx = bx - ax;
  const dy = by - ay;
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / l;
  const py = dx / l;
  const x0 = ax + dx * f0;
  const y0 = ay + dy * f0;
  const x1 = ax + dx * f1;
  const y1 = ay + dy * f1;
  const r0 = ra + (rb - ra) * f0;
  const r1 = ra + (rb - ra) * f1;
  b.moveTo(x0 + px * r0, y0 + py * r0);
  b.lineTo(x1 + px * r1, y1 + py * r1);
  b.lineTo(x1 - px * r1, y1 - py * r1);
  b.lineTo(x0 - px * r0, y0 - py * r0);
  b.close();
}
