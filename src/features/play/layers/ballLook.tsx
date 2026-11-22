/**
 * How a ball looks, shared by the balls in flight (Balls.tsx) and the ball in the character's hands (CharacterLayer.tsx).
 * Many balls are batched into a few paths per frame, lit by the one warm key light from the upper left: an ink outline, a dark shade
 * base, the lit body offset toward the light, a soft lighter patch and a small specular dot. The sport's markings (basketball seams,
 * football panel, golf dimples) turn with the ball's spin; they cost a few path commands per ball and are skipped on tiny balls.
 * A ball can be squashed on a floor bounce: wider and flatter, with its bottom kept on the floor.
 * Contract: makeBall / addBall / detachBall / BallPaint keep their signatures; new parameters and props are optional.
 * Owner of this file: the "juice" agent.
 */
import { Path, Skia, type SkPath } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import { border, colors, sportColors } from '@/ui/theme';

import { fx } from '../fx/palette';

type Builder = ReturnType<typeof Skia.PathBuilder.Make>;

export interface BallBuilders {
  ink: Builder;
  shade: Builder;
  body: Builder;
  light: Builder;
  spec: Builder;
  /** Stroked markings: basketball seams, football panel spokes. */
  seam: Builder;
  /** Filled markings: the football's center panel, golf dimples. */
  patch: Builder;
}

export interface BallPathSet {
  ink: SkPath;
  shade: SkPath;
  body: SkPath;
  light: SkPath;
  spec: SkPath;
  seam: SkPath;
  patch: SkPath;
}

/** Which markings a ball gets (addBall's `kind`). */
export const BALL_KIND = { plain: -1, basketball: 0, football: 1, golf: 2 } as const;

/** Markings are drawn only on balls at least this big on screen (points). */
const MARK_MIN_R = 4.5;

export function makeBall(): BallBuilders {
  'worklet';
  return {
    ink: Skia.PathBuilder.Make(),
    shade: Skia.PathBuilder.Make(),
    body: Skia.PathBuilder.Make(),
    light: Skia.PathBuilder.Make(),
    spec: Skia.PathBuilder.Make(),
    seam: Skia.PathBuilder.Make(),
    patch: Skia.PathBuilder.Make(),
  };
}

/**
 * Adds one ball of screen radius r at (x, y). `angle` turns the markings (radians), `kind` picks them (BALL_KIND; plain draws none),
 * `squash` 0..1 flattens the ball onto the floor.
 */
export function addBall(b: BallBuilders, x: number, y: number, r: number, angle = 0, kind = -1, squash = 0): void {
  'worklet';
  const bw = border.width;
  const kx = 1 + 0.5 * squash;
  const ky = 1 - squash;
  const cy = y + r * squash;
  const rx = r * kx;
  const ry = r * ky;
  b.ink.addOval({ x: x - rx - bw, y: cy - ry - bw, width: 2 * (rx + bw), height: 2 * (ry + bw) });
  b.shade.addOval({ x: x - rx, y: cy - ry, width: 2 * rx, height: 2 * ry });
  // The lit body: a slightly smaller disc pushed toward the key light leaves a crescent of shade on the lower right.
  b.body.addOval({ x: x - 0.11 * rx - 0.85 * rx, y: cy - 0.13 * ry - 0.85 * ry, width: 1.7 * rx, height: 1.7 * ry });
  b.light.addOval({ x: x - 0.62 * rx, y: cy - 0.66 * ry, width: 0.62 * rx, height: 0.44 * ry });
  b.spec.addOval({ x: x - 0.5 * rx, y: cy - 0.6 * ry, width: 0.2 * rx, height: 0.16 * ry });
  if (kind < 0 || r < MARK_MIN_R) return;
  const R = 0.98 * r;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const vx = -uy;
  const vy = ux;
  if (kind === 0) {
    // Two great circles across the ball and two side seams bowing toward the middle.
    b.seam.moveTo(x - ux * R * kx, cy - uy * R * ky);
    b.seam.lineTo(x + ux * R * kx, cy + uy * R * ky);
    b.seam.moveTo(x - vx * R * kx, cy - vy * R * ky);
    b.seam.lineTo(x + vx * R * kx, cy + vy * R * ky);
    for (let s = -1; s <= 1; s += 2) {
      const ax = s * 0.6 * ux - 0.8 * vx;
      const ay = s * 0.6 * uy - 0.8 * vy;
      const ex = s * 0.6 * ux + 0.8 * vx;
      const ey = s * 0.6 * uy + 0.8 * vy;
      b.seam.moveTo(x + ax * R * kx, cy + ay * R * ky);
      b.seam.quadTo(x + s * 0.16 * ux * R * kx, cy + s * 0.16 * uy * R * ky, x + ex * R * kx, cy + ey * R * ky);
    }
  } else if (kind === 1) {
    // A dark center panel and the seams running from its corners to the edge.
    const pr = 0.38 * R;
    for (let k = 0; k < 5; k++) {
      const a = angle + (k * 2 * Math.PI) / 5;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const px = x + ca * pr * kx;
      const py = cy + sa * pr * ky;
      if (k === 0) b.patch.moveTo(px, py);
      else b.patch.lineTo(px, py);
      b.seam.moveTo(px, py);
      b.seam.lineTo(x + ca * 0.95 * R * kx, cy + sa * 0.95 * R * ky);
    }
    b.patch.close();
  } else if (kind === 2) {
    // A ring of dimples.
    const dr = 0.09 * R;
    for (let k = 0; k < 6; k++) {
      const a = angle + k * 1.047;
      b.patch.addCircle(x + Math.cos(a) * 0.52 * R * kx, cy + Math.sin(a) * 0.52 * R * ky, dr);
    }
    b.patch.addCircle(x, cy, dr);
  }
}

export function detachBall(b: BallBuilders): BallPathSet {
  'worklet';
  return {
    ink: b.ink.detach(),
    shade: b.shade.detach(),
    body: b.body.detach(),
    light: b.light.detach(),
    spec: b.spec.detach(),
    seam: b.seam.detach(),
    patch: b.patch.detach(),
  };
}

export interface BallColors {
  shade: string;
  body: string;
  light: string;
  /** The specular dot. */
  spec: string;
  /** Markings. */
  mark: string;
  /** BALL_KIND for addBall. */
  kind: number;
}

/** The tones and markings of a sport's ball. */
export function ballColors(sportId: string): BallColors {
  const base = sportColors[sportId as keyof typeof sportColors]?.ball ?? colors.accent;
  const kind = sportId === 'basketball' ? BALL_KIND.basketball : sportId === 'football' ? BALL_KIND.football : sportId === 'golf' ? BALL_KIND.golf : BALL_KIND.plain;
  // A white ball has no lighter tone: its shade is cooler and its lit patch is pure white.
  const pale = isPale(base);
  return {
    shade: pale ? fx.paleShade : shadeOf(base, 0.66),
    body: base,
    light: pale ? fx.white : mixWhite(base, 0.38),
    spec: fx.white,
    mark: kind === BALL_KIND.golf ? fx.dimple : colors.ink,
    kind,
  };
}

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1)}`;
}

function shadeOf(hex: string, k: number): string {
  const [r, g, b] = channels(hex);
  // Darker and a touch warmer, so the shade side of an orange ball reads as brown-red, not grey.
  return toHex(r * k, g * k * 0.92, b * k * 0.85);
}

function mixWhite(hex: string, k: number): string {
  const [r, g, b] = channels(hex);
  return toHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k);
}

function isPale(hex: string): boolean {
  const [r, g, b] = channels(hex);
  return r > 220 && g > 220 && b > 200;
}

type PathInput = SkPath | SharedValue<SkPath>;

/** Draws a batch of balls built with addBall. `spec`, `seam` and `patch` are optional so older callers keep working. */
export function BallPaint({
  ink,
  shade,
  body,
  light,
  spec,
  seam,
  patch,
  look,
  opacity,
}: {
  ink: PathInput;
  shade: PathInput;
  body: PathInput;
  light: PathInput;
  spec?: PathInput;
  seam?: PathInput;
  patch?: PathInput;
  look: BallColors;
  opacity?: number | SharedValue<number>;
}) {
  return (
    <>
      <Path path={ink} color={colors.ink} opacity={opacity} />
      <Path path={shade} color={look.shade} opacity={opacity} />
      <Path path={body} color={look.body} opacity={opacity} />
      <Path path={light} color={look.light} opacity={opacity} />
      {patch ? <Path path={patch} color={look.mark} opacity={opacity} /> : null}
      {seam ? <Path path={seam} color={colors.ink} style="stroke" strokeWidth={1.4} strokeCap="round" opacity={opacity} /> : null}
      {spec ? <Path path={spec} color={look.spec} opacity={opacity} /> : null}
    </>
  );
}
