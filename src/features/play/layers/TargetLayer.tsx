/**
 * The target: hoop with backboard and net, goal with keeper, or hole with flag. The moving part slides sideways with the engine's
 * target motion, smooth on the UI thread and continuous across rounds: the store picks each round's phase so that the engine's
 * sin(2π t / period + phase) equals the idle curve sin(2π wallSeconds / period) at the moment the round starts. A target that does not
 * move during a round (golf) sits at the round's phase. The net swishes on a hit.
 * Owner of this file: the "court" agent. Props are fixed by layers/shared.ts.
 */
import { Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';

import type { SportDef } from '@/engine';
import { border, colors, sportColors } from '@/ui/theme';

import { scaleAt, screenX, screenY, type Camera } from '../camera';
import { oval, TWO_PI, upright, type TargetLayerProps } from './shared';

/** How long the net's swish lasts, seconds. */
const SWISH_SEC = 0.35;

export function TargetLayer({ def, sportId, cam, clock, phase, hits }: TargetLayerProps) {
  const palette = sportColors[sportId as keyof typeof sportColors];
  const cx = def.target.center.x;
  const target = useMemo(() => buildTarget(def, cam), [def, cam]);

  const targetScale = scaleAt(cam, cx);
  const targetTransform = useDerivedValue(() => {
    clock.value;
    const m = def.target.motion;
    let z = 0;
    if (m.periodSec <= 0) z = m.amplitude * Math.sin(phase.value);
    else z = m.amplitude * Math.sin((TWO_PI * (Date.now() / 1000)) / m.periodSec);
    return [{ translateX: z * targetScale }];
  });

  // The net: a quick bulge that settles in 350 ms after any hit.
  const rimY = screenY(cam, cx, def.target.center.y);
  const netTransform = useDerivedValue(() => {
    clock.value;
    const now = Date.now();
    const list = hits.value;
    let swish = 0;
    for (let i = 0; i < list.length; i++) {
      const age = (now - list[i]!.atMs) / 1000;
      if (age < 0 || age >= SWISH_SEC) continue;
      const w = Math.sin((Math.PI * age) / SWISH_SEC) * (1 - age / SWISH_SEC);
      if (w > swish) swish = w;
    }
    return [{ translateY: rimY }, { scaleY: 1 + 0.35 * swish }, { translateY: -rimY }];
  });

  return (
    <>
      <Path path={target.fixedInk} color={colors.ink} style="stroke" strokeWidth={target.frameWidth} strokeCap="round" />
      <Group transform={targetTransform}>
        <Path path={target.poleInk} color={colors.ink} style="stroke" strokeWidth={target.frameWidth} strokeCap="round" />
        <Path path={target.boardInk} color={colors.ink} />
        <Path path={target.board} color={colors.paper} />
        <Path path={target.boardMark} color={colors.ink} style="stroke" strokeWidth={2} />
        <Group transform={netTransform}>
          <Path path={target.net} color={colors.paper} style="stroke" strokeWidth={2} />
        </Group>
        <Path path={target.rim} color={colors.ink} style="stroke" strokeWidth={target.rimWidth + 2 * border.width} />
        <Path path={target.rim} color={palette.target} style="stroke" strokeWidth={target.rimWidth} />
        <Path path={target.block} color={colors.ink} />
      </Group>
    </>
  );
}

interface TargetPaths {
  /** The part that never moves: the goal frame. Empty for the hoop and the hole. */
  fixedInk: SkPath;
  frameWidth: number;
  poleInk: SkPath;
  boardInk: SkPath;
  board: SkPath;
  boardMark: SkPath;
  net: SkPath;
  rim: SkPath;
  rimWidth: number;
  /** The keeper (football) as a solid block. Empty otherwise. */
  block: SkPath;
}

/** The target around z = 0; the moving parts are translated sideways by the parent group. */
function buildTarget(def: SportDef, cam: Camera): TargetPaths {
  const t = def.target;
  const cx = t.center.x;
  const cy = t.center.y;
  const s = scaleAt(cam, cx);
  const b = border.width;
  const fixedInk = Skia.PathBuilder.Make();
  const poleInk = Skia.PathBuilder.Make();
  const boardInk = Skia.PathBuilder.Make();
  const board = Skia.PathBuilder.Make();
  const boardMark = Skia.PathBuilder.Make();
  const net = Skia.PathBuilder.Make();
  const rim = Skia.PathBuilder.Make();
  const block = Skia.PathBuilder.Make();
  const frameWidth = Math.max(4, 0.07 * s);

  if (t.kind === 'hoop') {
    const bd = t.backboard;
    const bx = cx + (bd?.dx ?? 0.38);
    const boardHalf = bd?.halfSpan ?? 0.9;
    const by0 = cy + (bd?.yFrom ?? -0.15);
    const by1 = cy + (bd?.yTo ?? 0.95);
    // Pole behind the board, down to the floor.
    const px = bx + 0.3;
    poleInk.moveTo(screenX(cam, px, 0), screenY(cam, px, 0));
    poleInk.lineTo(screenX(cam, px, 0), screenY(cam, px, by0 + 0.2));
    poleInk.lineTo(screenX(cam, bx, 0), screenY(cam, bx, by0 + 0.2));
    // Board with the shooter's square.
    const r = upright(cam, bx, -boardHalf, boardHalf, by0, by1);
    boardInk.addRect({ x: r.x - b, y: r.y - b, width: r.width + 2 * b, height: r.height + 2 * b });
    board.addRect(r);
    boardMark.addRect(upright(cam, bx, -0.3, 0.3, cy, cy + 0.45));
    // Rim: a flat ellipse at the hoop's height; the net hangs to a smaller ellipse below.
    const rimOval = oval(cam, cx, cy, 0, t.halfWidth);
    rim.addOval(rimOval);
    const netBottomY = cy - 0.42;
    const low = oval(cam, cx, netBottomY, 0, t.halfWidth * 0.55);
    net.addOval(low);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TWO_PI;
      const zx = Math.cos(a);
      const zy = Math.sin(a);
      net.moveTo(rimOval.x + rimOval.width / 2 + (rimOval.width / 2) * zx, rimOval.y + rimOval.height / 2 + (rimOval.height / 2) * zy);
      net.lineTo(low.x + low.width / 2 + (low.width / 2) * zx, low.y + low.height / 2 + (low.height / 2) * zy);
    }
    return { fixedInk: fixedInk.detach(), frameWidth, poleInk: poleInk.detach(), boardInk: boardInk.detach(), board: board.detach(), boardMark: boardMark.detach(), net: net.detach(), rim: rim.detach(), rimWidth: Math.max(4, 0.06 * s), block: block.detach() };
  }

  if (t.kind === 'goal') {
    // Posts and bar at the goal line; the keeper block in front of it.
    const top = 2 * cy;
    for (const z of [-t.halfWidth, t.halfWidth]) {
      fixedInk.moveTo(screenX(cam, cx, z), screenY(cam, cx, 0, z));
      fixedInk.lineTo(screenX(cam, cx, z), screenY(cam, cx, top, z));
    }
    fixedInk.moveTo(screenX(cam, cx, -t.halfWidth), screenY(cam, cx, top, -t.halfWidth));
    fixedInk.lineTo(screenX(cam, cx, t.halfWidth), screenY(cam, cx, top, t.halfWidth));
    const kw = t.keeperHalfWidth ?? 0.35;
    const kh = t.keeperHeight ?? 1.9;
    const kx = cx - (t.keeperHalfDepth ?? 0.2);
    block.addRect(upright(cam, kx, -kw, kw, 0, kh));
    return { fixedInk: fixedInk.detach(), frameWidth, poleInk: poleInk.detach(), boardInk: boardInk.detach(), board: board.detach(), boardMark: boardMark.detach(), net: net.detach(), rim: rim.detach(), rimWidth: 4, block: block.detach() };
  }

  // Hole: a dark disc in the floor with a flag.
  block.addOval(oval(cam, cx, 0, 0, t.halfWidth));
  poleInk.moveTo(screenX(cam, cx, 0), screenY(cam, cx, 0));
  poleInk.lineTo(screenX(cam, cx, 0), screenY(cam, cx, 1.6));
  const flag = upright(cam, cx, 0, 0.45, 1.3, 1.6);
  boardInk.addRect({ x: flag.x - b, y: flag.y - b, width: flag.width + 2 * b, height: flag.height + 2 * b });
  board.addRect(flag);
  return { fixedInk: fixedInk.detach(), frameWidth: Math.max(3, 0.03 * s), poleInk: poleInk.detach(), boardInk: boardInk.detach(), board: board.detach(), boardMark: boardMark.detach(), net: net.detach(), rim: rim.detach(), rimWidth: 4, block: block.detach() };
}
