/**
 * How a ball looks, shared by the balls in flight (Balls.tsx) and the ball in the character's hands (CharacterLayer.tsx).
 * Many balls are batched into a few paths per frame: an ink outline, a shade base, a lit body offset toward the key light (upper left),
 * and a small highlight. Contract: makeBall / addBall / detachBall / BallPaint keep their signatures; the look inside may change.
 */
import { Path, Skia, type SkPath } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import { border, colors, sportColors } from '@/ui/theme';

type Builder = ReturnType<typeof Skia.PathBuilder.Make>;

export interface BallBuilders {
  ink: Builder;
  shade: Builder;
  body: Builder;
  light: Builder;
}

export interface BallPathSet {
  ink: SkPath;
  shade: SkPath;
  body: SkPath;
  light: SkPath;
}

export function makeBall(): BallBuilders {
  'worklet';
  return { ink: Skia.PathBuilder.Make(), shade: Skia.PathBuilder.Make(), body: Skia.PathBuilder.Make(), light: Skia.PathBuilder.Make() };
}

/** Adds one ball of screen radius r at (x, y). */
export function addBall(b: BallBuilders, x: number, y: number, r: number): void {
  'worklet';
  b.ink.addCircle(x, y, r + border.width);
  b.shade.addCircle(x, y, r);
  b.body.addCircle(x - 0.12 * r, y - 0.12 * r, 0.82 * r);
  b.light.addCircle(x - 0.38 * r, y - 0.4 * r, 0.18 * r);
}

export function detachBall(b: BallBuilders): BallPathSet {
  'worklet';
  return { ink: b.ink.detach(), shade: b.shade.detach(), body: b.body.detach(), light: b.light.detach() };
}

export interface BallColors {
  shade: string;
  body: string;
  light: string;
}

/** The three tones of a sport's ball. */
export function ballColors(sportId: string): BallColors {
  const base = sportColors[sportId as keyof typeof sportColors]?.ball ?? colors.accent;
  return { shade: shadeOf(base, 0.72), body: base, light: colors.paper };
}

function shadeOf(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const bl = Math.round((n & 255) * k);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

type PathInput = SkPath | SharedValue<SkPath>;

/** Draws a batch of balls built with addBall. */
export function BallPaint({ ink, shade, body, light, look, opacity }: { ink: PathInput; shade: PathInput; body: PathInput; light: PathInput; look: BallColors; opacity?: number | SharedValue<number> }) {
  return (
    <>
      <Path path={ink} color={colors.ink} opacity={opacity} />
      <Path path={shade} color={look.shade} opacity={opacity} />
      <Path path={body} color={look.body} opacity={opacity} />
      <Path path={light} color={look.light} opacity={opacity} />
    </>
  );
}
