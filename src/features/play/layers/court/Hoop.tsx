/**
 * The basketball hoop: a sturdy stanchion (floor base, padded pole, arm and brace, steel in three tones), a framed glass backboard with
 * a shine and a red shooter's square, a padded bottom edge, a three-tone rim split into a back half (behind the net) and a front half
 * (over it), and a tapering diamond-mesh net that swishes on a hit while the rim flashes. A soft shadow sits on the floor.
 * Built once per camera around z = 0; the whole hoop slides sideways in one Group transform on the UI thread.
 * Outlines use the "ink stroke under the fill" trick: each part's faces are stroked in ink at twice the border width, then filled, so
 * only the silhouette keeps a line.
 */
import { Group, LinearGradient, Path, Skia, vec, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';

import type { SportDef } from '@/engine';
import { border, colors } from '@/ui/theme';

import { flatRatio, scaleAt, screenX, screenY, type Camera } from '../../camera';
import type { TargetLayerProps } from '../shared';
import { addPoly, flatRect, floorSpot, proj, sideRect, wallRect, type Builder, type W3 } from './geometry';
import { useHitFlash, useHitPulse, useTargetSlide } from './motion';
import { SoftSpot, type Spot } from './SoftSpot';
import { alpha, hoop as H } from './worldPalette';

/** How long the net's swish lasts, seconds. */
const SWISH_SEC = 0.35;
/** How long the rim flashes after a hit, seconds. */
const FLASH_SEC = 0.25;

const NET_STRANDS = 16;
const NET_LEVELS = 5;
const NET_DROP = 0.5;
/** The flattest the rim's ellipse may look, as height over width. */
const MIN_TILT = 0.2;

export function Hoop({ def, cam, clock, phase, hits }: TargetLayerProps) {
  const h = useMemo(() => buildHoop(def, cam), [def, cam]);
  const slide = useTargetSlide(def, cam, clock, phase, def.target.center.x);
  const swish = useHitPulse(clock, hits, SWISH_SEC);
  const flash = useHitFlash(clock, hits, FLASH_SEC);
  const { rimX, rimY } = h;
  const netTransform = useDerivedValue(() => {
    const k = swish.value;
    return [{ translateX: rimX }, { translateY: rimY }, { scaleX: 1 - 0.14 * k }, { scaleY: 1 + 0.38 * k }, { translateX: -rimX }, { translateY: -rimY }];
  });
  const glow = useDerivedValue(() => 0.55 * flash.value);
  const b2 = 2 * border.width;
  return (
    <Group transform={slide}>
      {h.shadows.map((s, i) => (
        <SoftSpot key={i} spot={s} color={H.shadow} opacity={0.45} core={0.4} />
      ))}

      <Path path={h.standInk} color={colors.ink} style="stroke" strokeWidth={b2} strokeJoin="round" />
      <Path path={h.steel} color={H.steel} />
      <Path path={h.steelLight} color={H.steelLight} />
      <Path path={h.steelDark} color={H.steelDark} />
      <Path path={h.pad} color={H.post} />
      <Path path={h.padLight} color={H.postLight} />
      <Path path={h.padDark} color={H.postDark} />

      <Path path={h.boardInk} color={colors.ink} style="stroke" strokeWidth={b2} strokeJoin="round" />
      <Path path={h.boardSide} color={H.frame} />
      <Path path={h.frame} color={H.frame} />
      <Path path={h.frameLight} color={H.frameLight} />
      <Path path={h.glass} color={H.glassTop}>
        <LinearGradient start={vec(h.glassBox.x, h.glassBox.y)} end={vec(h.glassBox.x + h.glassBox.width, h.glassBox.y + h.glassBox.height)} colors={[H.glassTop, H.glassBottom]} />
      </Path>
      <Path path={h.shine} color={alpha(H.glassShine, 0.7)} />
      <Path path={h.square} color={colors.ink} style="stroke" strokeWidth={h.squareW + 2} strokeJoin="round" />
      <Path path={h.square} color={H.square} style="stroke" strokeWidth={h.squareW} strokeJoin="round" />
      <Path path={h.boardPadInk} color={colors.ink} style="stroke" strokeWidth={b2} strokeJoin="round" />
      <Path path={h.boardPad} color={H.pad} />
      <Path path={h.boardPadLight} color={H.padLight} />

      <Path path={h.bracket} color={colors.ink} style="stroke" strokeWidth={b2} strokeJoin="round" />
      <Path path={h.bracket} color={H.steelDark} />

      <Path path={h.rimBack} color={colors.ink} style="stroke" strokeWidth={h.rimW + b2} strokeCap="round" />
      <Path path={h.rimBack} color={H.rimDark} style="stroke" strokeWidth={h.rimW} strokeCap="round" />
      <Group transform={netTransform}>
        <Path path={h.netBack} color={H.netBack} style="stroke" strokeWidth={h.netW} strokeCap="round" />
        <Path path={h.netFront} color={colors.ink} style="stroke" strokeWidth={h.netW + 2} strokeCap="round" strokeJoin="round" />
        <Path path={h.netFront} color={H.netFront} style="stroke" strokeWidth={h.netW} strokeCap="round" strokeJoin="round" />
      </Group>
      <Path path={h.rimFront} color={colors.ink} style="stroke" strokeWidth={h.rimW + b2} strokeCap="round" />
      <Path path={h.rimFront} color={H.rim} style="stroke" strokeWidth={h.rimW} strokeCap="round" />
      <Path path={h.rimLight} color={H.rimLight} style="stroke" strokeWidth={Math.max(1.5, h.rimW * 0.34)} strokeCap="round" />

      <Path path={h.rimAll} color={H.flash} style="stroke" strokeWidth={h.rimW * 3.2} opacity={glow} strokeCap="round" />
      <Path path={h.rimAll} color={H.flash} style="stroke" strokeWidth={h.rimW * 1.3} opacity={flash} strokeCap="round" />
    </Group>
  );
}

interface HoopPaths {
  rimX: number;
  rimY: number;
  shadows: Spot[];
  standInk: SkPath;
  steel: SkPath;
  steelLight: SkPath;
  steelDark: SkPath;
  pad: SkPath;
  padLight: SkPath;
  padDark: SkPath;
  boardInk: SkPath;
  boardSide: SkPath;
  frame: SkPath;
  frameLight: SkPath;
  glass: SkPath;
  glassBox: { x: number; y: number; width: number; height: number };
  shine: SkPath;
  square: SkPath;
  squareW: number;
  boardPadInk: SkPath;
  boardPad: SkPath;
  boardPadLight: SkPath;
  bracket: SkPath;
  rimBack: SkPath;
  rimFront: SkPath;
  rimLight: SkPath;
  rimAll: SkPath;
  rimW: number;
  netBack: SkPath;
  netFront: SkPath;
  netW: number;
}

function buildHoop(def: SportDef, cam: Camera): HoopPaths {
  const t = def.target;
  const cx = t.center.x;
  const cy = t.center.y;
  const R = t.halfWidth;
  const bd = t.backboard;
  const bx = cx + (bd?.dx ?? 0.38);
  const half = bd?.halfSpan ?? 0.9;
  const by0 = cy + (bd?.yFrom ?? -0.15);
  const by1 = cy + (bd?.yTo ?? 0.95);
  const s = scaleAt(cam, cx);
  const P = (p: W3) => proj(cam, p);
  const M = () => Skia.PathBuilder.Make();
  const face = (b: Builder, ink: Builder, pts: W3[]) => {
    addPoly(b, cam, pts);
    addPoly(ink, cam, pts);
  };

  // Stanchion: base box on the floor behind the baseline, padded pole, arm forward to the board, a diagonal brace.
  const px = bx + 1.7;
  const pw = 0.1;
  const padW = 0.15;
  const hb = 0.24;
  const yA = by0 + 0.38;
  const standInk = M();
  const steel = M();
  const steelLight = M();
  const steelDark = M();
  const pad = M();
  const padLight = M();
  const padDark = M();
  const bx0 = px - 0.3;
  const bx1 = px + 0.45;
  const bz = 0.32;
  face(steelDark, standInk, sideRect(bz, bx0, bx1, 0, hb));
  face(steel, standInk, wallRect(bx0, -bz, bz, 0, hb));
  face(steelLight, standInk, flatRect(bx0, bx1, -bz, bz, hb));
  // Upper pole (steel), then the padded lower part over it.
  const poleTop = yA + 0.22;
  face(steelDark, standInk, sideRect(pw, px - pw, px + pw, hb, poleTop));
  face(steel, standInk, wallRect(px - pw, -pw, pw, hb, poleTop));
  addPoly(steelLight, cam, wallRect(px - pw - 0.005, -pw, -pw + 0.07, hb, poleTop));
  const padTop = hb + 1.7;
  face(padDark, standInk, sideRect(padW, px - padW, px + padW, hb, padTop));
  face(pad, standInk, wallRect(px - padW, -padW, padW, hb, padTop));
  face(padLight, standInk, flatRect(px - padW, px + padW, -padW, padW, padTop));
  addPoly(padLight, cam, wallRect(px - padW - 0.005, -padW, -padW + 0.09, hb, padTop));
  // Brace from the pole up to the arm, then the arm itself (its side and, seen from below, its underside).
  const armZ = 0.09;
  const armLo = yA - 0.09;
  const armHi = yA + 0.09;
  const brace: W3[] = [
    [px - pw, yA - 1.0, 0.05],
    [px - pw, yA - 0.82, 0.05],
    [bx + 0.75, armLo, 0.05],
    [bx + 0.5, armLo, 0.05],
  ];
  face(steel, standInk, brace);
  face(steelDark, standInk, flatRect(bx, px - pw, -armZ, armZ, armLo));
  face(steel, standInk, sideRect(armZ, bx, px - pw, armLo, armHi));
  addPoly(steelLight, cam, sideRect(armZ + 0.001, bx, px - pw, armHi - 0.04, armHi));

  // Backboard: thickness on its right side, a thick frame, glass with a gradient and a shine, the shooter's square, a pad underneath.
  const ft = 0.07;
  const boardInk = M();
  const boardSide = M();
  const frame = M();
  const frameLight = M();
  const glass = M();
  const shine = M();
  const square = M();
  face(boardSide, boardInk, sideRect(half + ft, bx, bx + 0.08, by0 - ft, by1 + ft));
  face(frame, boardInk, wallRect(bx, -half - ft, half + ft, by0 - ft, by1 + ft));
  addPoly(frameLight, cam, wallRect(bx - 0.002, -half - ft, half + ft, by1, by1 + ft));
  addPoly(frameLight, cam, wallRect(bx - 0.002, -half - ft, -half, by0 - ft, by1 + ft));
  addPoly(glass, cam, wallRect(bx - 0.004, -half, half, by0, by1));
  const g0 = P([bx, by1, -half]);
  const g1 = P([bx, by0, half]);
  const glassBox = { x: g0.x, y: g0.y, width: g1.x - g0.x, height: g1.y - g0.y };
  const sh = (zb0: number, zb1: number, lean: number): W3[] => [
    [bx - 0.006, by0, -half + zb0],
    [bx - 0.006, by0, -half + zb1],
    [bx - 0.006, by1, -half + zb1 + lean],
    [bx - 0.006, by1, -half + zb0 + lean],
  ];
  addPoly(shine, cam, sh(0.05, 0.32, 0.45));
  addPoly(shine, cam, sh(0.42, 0.5, 0.45));
  const sq: W3[] = [
    [bx - 0.008, cy + 0.03, -0.3],
    [bx - 0.008, cy + 0.03, 0.3],
    [bx - 0.008, cy + 0.48, 0.3],
    [bx - 0.008, cy + 0.48, -0.3],
  ];
  const sq0 = P(sq[0]!);
  square.moveTo(sq0.x, sq0.y);
  for (let i = 1; i < sq.length; i++) {
    const p = P(sq[i]!);
    square.lineTo(p.x, p.y);
  }
  square.close();
  const boardPadInk = M();
  const boardPad = M();
  const boardPadLight = M();
  face(boardPad, boardPadInk, wallRect(bx - 0.03, -half - ft, half + ft, by0 - ft - 0.11, by0 - ft + 0.03));
  face(boardPad, boardPadInk, flatRect(bx - 0.03, bx + 0.08, -half - ft, half + ft, by0 - ft - 0.11));
  addPoly(boardPadLight, cam, wallRect(bx - 0.032, -half - ft, half + ft, by0 - ft - 0.0, by0 - ft + 0.03));

  // The bracket from the board to the back of the rim, seen from below.
  const bracket = M();
  addPoly(bracket, cam, flatRect(cx + R - 0.03, bx, -0.11, 0.11, cy - 0.01));

  // Rim: the half nearer the camera is drawn over the net.
  // Seen almost edge-on the rim would be a flat line, so its ellipse never gets flatter than MIN_TILT (a stylized tilt toward the
  // camera). From below, the near half sits higher on screen; from above, lower.
  const rimCx = screenX(cam, cx, 0);
  const tilt = (cam.y < cy ? 1 : -1) * Math.max(flatRatio(cam, cx, cy, 0), MIN_TILT);
  const rimPt = (a: number, y: number, r: number) => ({ x: rimCx + r * s * Math.sin(a), y: screenY(cam, cx, y) + tilt * r * s * Math.cos(a) });
  const arcPath = (from: number, to: number, dy = 0, dx = 0) => {
    const p = M();
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const q = rimPt(from + ((to - from) * i) / n, cy, R);
      if (i === 0) p.moveTo(q.x + dx, q.y + dy);
      else p.lineTo(q.x + dx, q.y + dy);
    }
    return p.detach();
  };
  const rimW = Math.max(4, 0.075 * s);
  const rimBack = arcPath(-Math.PI / 2, Math.PI / 2);
  const rimFront = arcPath(Math.PI / 2, (3 * Math.PI) / 2);
  const rimLight = arcPath(Math.PI * 0.62, Math.PI * 1.2, -rimW * 0.22, -rimW * 0.05);
  const rimAll = arcPath(0, 2 * Math.PI);

  // Net: diamond mesh from the rim down, tapering; strands nearer the camera are bright and outlined, the far ones shaded.
  const netBack = M();
  const netFront = M();
  const node = (k: number, i: number) => {
    const u = k / (NET_LEVELS - 1);
    const r = R * (1 - 0.4 * Math.pow(u, 1.1)) * (k === 0 ? 0.97 : 1);
    const a = ((i + 0.5 * k) * 2 * Math.PI) / NET_STRANDS;
    return { a, ...rimPt(a, cy - NET_DROP * u * (1 + 0.08 * Math.sin(a * 3)), r) };
  };
  for (let k = 0; k < NET_LEVELS - 1; k++) {
    for (let i = 0; i < NET_STRANDS; i++) {
      const p = node(k, i);
      for (const j of [i, i - 1]) {
        const q = node(k + 1, j);
        const front = Math.cos((p.a + q.a) / 2) < 0;
        const b = front ? netFront : netBack;
        b.moveTo(p.x, p.y);
        b.lineTo(q.x, q.y);
      }
    }
  }
  const netW = Math.max(1.5, 0.022 * s);

  // Soft contact shadows: under the stanchion base and under the board, pushed right by the key light from the upper left.
  const shadows: Spot[] = [floorSpot(cam, px + 0.1, 0.35, 1.0), floorSpot(cam, cx + 0.4, 0.5, 1.3)];

  return {
    rimX: rimCx,
    rimY: screenY(cam, cx, cy),
    shadows,
    standInk: standInk.detach(),
    steel: steel.detach(),
    steelLight: steelLight.detach(),
    steelDark: steelDark.detach(),
    pad: pad.detach(),
    padLight: padLight.detach(),
    padDark: padDark.detach(),
    boardInk: boardInk.detach(),
    boardSide: boardSide.detach(),
    frame: frame.detach(),
    frameLight: frameLight.detach(),
    glass: glass.detach(),
    glassBox,
    shine: shine.detach(),
    square: square.detach(),
    squareW: Math.max(2.5, 0.045 * s),
    boardPadInk: boardPadInk.detach(),
    boardPad: boardPad.detach(),
    boardPadLight: boardPadLight.detach(),
    bracket: bracket.detach(),
    rimBack,
    rimFront,
    rimLight,
    rimAll,
    rimW,
    netBack: netBack.detach(),
    netFront: netFront.detach(),
    netW,
  };
}
