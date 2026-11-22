/**
 * Build-time geometry for the court files: world polygons and polylines projected through the camera, clipped so nothing behind or
 * right next to the camera blows up, plus the screen extent of a depth plane. Everything here runs once in useMemo, never per frame,
 * so it may allocate freely. World: x depth, y height, z lateral (see camera.ts).
 */
import { Skia } from '@shopify/react-native-skia';

import { scaleAt, screenX, screenY, worldZ, type Camera } from '../../camera';

export type Builder = ReturnType<typeof Skia.PathBuilder.Make>;
export type W3 = readonly [number, number, number];

/** Geometry nearer than this depth (meters along the line of sight) is cut off; it is below the screen at any sane camera. */
const NEAR = 0.9;

export function depth(cam: Camera, x: number, z: number): number {
  return (x - cam.x) * cam.fx + (z - cam.z) * cam.fz;
}

export function proj(cam: Camera, p: W3): { x: number; y: number } {
  return { x: screenX(cam, p[0], p[2]), y: screenY(cam, p[0], p[1], p[2]) };
}

function cut(cam: Camera, a: W3, b: W3): W3 {
  const da = depth(cam, a[0], a[2]);
  const db = depth(cam, b[0], b[2]);
  const t = (NEAR - da) / (db - da);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A closed world polygon, clipped to the near plane (Sutherland-Hodgman against one plane). */
export function addPoly(b: Builder, cam: Camera, pts: readonly W3[]): void {
  const out: W3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    const pIn = depth(cam, p[0], p[2]) >= NEAR;
    const qIn = depth(cam, q[0], q[2]) >= NEAR;
    if (pIn) out.push(p);
    if (pIn !== qIn) out.push(cut(cam, p, q));
  }
  if (out.length < 3) return;
  const s0 = proj(cam, out[0]!);
  b.moveTo(s0.x, s0.y);
  for (let i = 1; i < out.length; i++) {
    const s = proj(cam, out[i]!);
    b.lineTo(s.x, s.y);
  }
  b.close();
}

/** An open world polyline, each segment clipped to the near plane. */
export function addLine(b: Builder, cam: Camera, pts: readonly W3[], closed = false): void {
  const n = closed ? pts.length : pts.length - 1;
  let pen = false;
  for (let i = 0; i < n; i++) {
    let p = pts[i]!;
    let q = pts[(i + 1) % pts.length]!;
    const pIn = depth(cam, p[0], p[2]) >= NEAR;
    const qIn = depth(cam, q[0], q[2]) >= NEAR;
    if (!pIn && !qIn) {
      pen = false;
      continue;
    }
    if (!pIn) p = cut(cam, p, q);
    if (!qIn) q = cut(cam, p, q);
    const sp = proj(cam, p);
    const sq = proj(cam, q);
    if (!pen || !pIn) b.moveTo(sp.x, sp.y);
    b.lineTo(sq.x, sq.y);
    pen = qIn;
  }
}

/** A rectangle lying flat at height y. */
export function flatRect(x0: number, x1: number, z0: number, z1: number, y = 0): W3[] {
  return [
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
  ];
}

/** An upright rectangle facing the camera at depth x. */
export function wallRect(x: number, z0: number, z1: number, y0: number, y1: number): W3[] {
  return [
    [x, y0, z0],
    [x, y0, z1],
    [x, y1, z1],
    [x, y1, z0],
  ];
}

/** An upright rectangle seen from the side: the plane z, from depth x0 to x1. */
export function sideRect(z: number, x0: number, x1: number, y0: number, y1: number): W3[] {
  return [
    [x0, y0, z],
    [x1, y0, z],
    [x1, y1, z],
    [x0, y1, z],
  ];
}

/** Points on a flat circle (or arc) at height y; angle 0 points along +x (away from the camera), angles in radians. */
export function flatArc(cx: number, cz: number, r: number, from: number, to: number, steps: number, y = 0): W3[] {
  const out: W3[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    out.push([cx + r * Math.cos(a), y, cz + r * Math.sin(a)]);
  }
  return out;
}

/** World z at the left and right screen edges (plus a margin in points) on the depth plane x. */
export function visibleZ(cam: Camera, x: number, width: number, margin = 40): [number, number] {
  return [worldZ(cam, x, -margin), worldZ(cam, x, width + margin)];
}

/** World height at screen y on the depth plane x (at lateral z). */
export function heightAt(cam: Camera, x: number, z: number, sy: number): number {
  return cam.y + (cam.horizonY - sy) / scaleAt(cam, x, z);
}

/** A small seeded random source, so the crowd and the planks look the same on every build. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A painted line on the floor: a band of half width hw (meters) along a world polyline, so it narrows with depth like real paint. */
export function addBand(b: Builder, cam: Camera, pts: readonly W3[], hw: number, closed = false): void {
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    const dx = q[0] - p[0];
    const dz = q[2] - p[2];
    const len = Math.hypot(dx, dz) || 1;
    const ux = (dx / len) * hw;
    const uz = (dz / len) * hw;
    const y = p[1];
    addPoly(b, cam, [
      [p[0] - ux - uz, y, p[2] - uz + ux],
      [q[0] + ux - uz, y, q[2] + uz + ux],
      [q[0] + ux + uz, y, q[2] + uz - ux],
      [p[0] - ux + uz, y, p[2] - uz - ux],
    ]);
  }
}

/** Dashes along a world polyline: every other piece of about `dash` meters, as painted bands. */
export function addDashes(b: Builder, cam: Camera, pts: readonly W3[], hw: number, dash: number): void {
  let on = true;
  let acc = 0;
  let piece: W3[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1]!;
    const q = pts[i]!;
    acc += Math.hypot(q[0] - p[0], q[2] - p[2]);
    piece.push(q);
    if (acc >= dash) {
      if (on) addBand(b, cam, piece, hw);
      on = !on;
      acc = 0;
      piece = [q];
    }
  }
  if (on && piece.length > 1) addBand(b, cam, piece, hw);
}

/** The floor seen from the camera, as a screen polygon: from the far edge (the wall at depth farX) down past the screen bottom. */
export function floorScreen(b: Builder, cam: Camera, farX: number, width: number, height: number): number {
  const [z0, z1] = visibleZ(cam, farX, width, 80);
  const a = proj(cam, [farX, 0, z0]);
  const c = proj(cam, [farX, 0, z1]);
  b.moveTo(a.x, a.y);
  b.lineTo(c.x, c.y);
  b.lineTo(width + 80, height + 80);
  b.lineTo(-80, height + 80);
  b.close();
  return Math.min(a.y, c.y);
}

/** A soft round spot (shadow, light pool) lying on the floor: the screen ellipse of a flat disc. */
export function floorSpot(cam: Camera, x: number, z: number, r: number, y = 0): { cx: number; cy: number; rx: number; ry: number } {
  const s = scaleAt(cam, x, z);
  const rx = r * s;
  const d = depth(cam, x, z);
  const ratio = Math.min(1, Math.max(0.05, Math.abs(y - cam.y) / Math.max(0.4, d)));
  return { cx: screenX(cam, x, z), cy: screenY(cam, x, y, z), rx, ry: rx * ratio };
}
