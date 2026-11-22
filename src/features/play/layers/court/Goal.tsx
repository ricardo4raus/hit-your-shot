/**
 * The football goal: white posts and crossbar in three tones with an ink outline, a deep net (translucent panels with a mesh and back
 * bars) and a keeper in a bright kit who slides along the line with the engine's keeper motion, arms up, gloves out. The keeper fills
 * the engine's keeper box (keeperHalfWidth x keeperHeight). Soft shadows on the grass. Built once per camera; the keeper moves in a
 * Group transform on the UI thread.
 */
import { Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { SportDef } from '@/engine';
import { border, colors } from '@/ui/theme';

import { scaleAt, type Camera } from '../../camera';
import type { TargetLayerProps } from '../shared';
import { addLine, addPoly, flatRect, floorSpot, proj, sideRect, wallRect, type Builder, type W3 } from './geometry';
import { useTargetSlide } from './motion';
import { SoftSpot, type Spot } from './SoftSpot';
import { alpha, stadium as S } from './worldPalette';

export function Goal({ def, cam, clock, phase }: TargetLayerProps) {
  const g = useMemo(() => buildGoal(def, cam), [def, cam]);
  const kx = def.target.center.x - (def.target.keeperHalfDepth ?? 0.2);
  const slide = useTargetSlide(def, cam, clock, phase, kx);
  const b2 = 2 * border.width;
  return (
    <>
      {g.shadows.map((s, i) => (
        <SoftSpot key={i} spot={s} color="#0F2A14" opacity={0.35} />
      ))}
      <Path path={g.netFill} color={alpha(S.net, 0.16)} />
      <Path path={g.mesh} color={alpha(S.net, 0.65)} style="stroke" strokeWidth={1} />
      <Path path={g.bars} color={S.postShade} style="stroke" strokeWidth={2.5} strokeCap="round" />

      <Path path={g.frameInk} color={colors.ink} style="stroke" strokeWidth={b2} strokeJoin="round" />
      <Path path={g.frame} color="#F2F5FA" />
      <Path path={g.frameShade} color={S.postShade} />
      <Path path={g.frameLight} color="#FFFFFF" />

      <Group transform={slide}>
        <SoftSpot spot={g.keeperShadow} color="#0F2A14" opacity={0.4} />
        <Path path={g.arms} color={colors.ink} style="stroke" strokeWidth={g.armW + b2} strokeCap="round" strokeJoin="round" />
        <Path path={g.arms} color={S.keeper} style="stroke" strokeWidth={g.armW} strokeCap="round" strokeJoin="round" />
        <Path path={g.bodyInk} color={colors.ink} style="stroke" strokeWidth={b2} strokeJoin="round" />
        <Path path={g.boots} color={colors.ink} />
        <Path path={g.knees} color={colors.skin} />
        <Path path={g.socks} color={S.keeper} />
        <Path path={g.shorts} color={S.keeperShorts} />
        <Path path={g.torso} color={S.keeper} />
        <Path path={g.torsoShade} color={S.keeperShade} />
        <Path path={g.stripe} color={colors.paper} />
        <Path path={g.gloves} color={S.gloves} />
        <Path path={g.skin} color={colors.skin} />
        <Path path={g.hair} color={colors.hair} />
      </Group>
    </>
  );
}

interface GoalPaths {
  shadows: Spot[];
  netFill: SkPath;
  mesh: SkPath;
  bars: SkPath;
  frameInk: SkPath;
  frame: SkPath;
  frameShade: SkPath;
  frameLight: SkPath;
  keeperShadow: Spot;
  arms: SkPath;
  armW: number;
  bodyInk: SkPath;
  boots: SkPath;
  socks: SkPath;
  knees: SkPath;
  shorts: SkPath;
  torso: SkPath;
  torsoShade: SkPath;
  stripe: SkPath;
  gloves: SkPath;
  skin: SkPath;
  hair: SkPath;
}

function buildGoal(def: SportDef, cam: Camera): GoalPaths {
  const t = def.target;
  const cx = t.center.x;
  const hw = t.halfWidth;
  const top = 2 * t.center.y;
  const pw = 0.06;
  const M = () => Skia.PathBuilder.Make();
  const face = (b: Builder, ink: Builder, pts: W3[]) => {
    addPoly(b, cam, pts);
    addPoly(ink, cam, pts);
  };

  // Net: roof, back and sides as translucent panels with a mesh, held by thin back bars.
  const backTop = cx + 0.9;
  const backBottom = cx + 1.6;
  const netFill = M();
  const mesh = M();
  const bars = M();
  const roofQ: W3[] = [
    [cx, top, -hw],
    [cx, top, hw],
    [backTop, top, hw],
    [backTop, top, -hw],
  ];
  const backQ: W3[] = [
    [backTop, top, -hw],
    [backTop, top, hw],
    [backBottom, 0, hw],
    [backBottom, 0, -hw],
  ];
  addPoly(netFill, cam, roofQ);
  addPoly(netFill, cam, backQ);
  for (const z of [-hw, hw]) {
    addPoly(netFill, cam, [
      [cx, 0, z],
      [backBottom, 0, z],
      [backTop, top, z],
      [cx, top, z],
    ]);
  }
  const lerp = (a: W3, b: W3, u: number): W3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  const cell = 0.18;
  for (let z = -hw; z <= hw + 1e-6; z += cell) {
    addLine(mesh, cam, [
      [backTop, top, z],
      [backBottom, 0, z],
    ]);
    addLine(mesh, cam, [
      [cx, top, z],
      [backTop, top, z],
    ]);
  }
  const rows = Math.round(top / cell);
  for (let j = 0; j <= rows; j++) {
    const u = j / rows;
    addLine(mesh, cam, [lerp(backQ[0]!, backQ[3]!, u), lerp(backQ[1]!, backQ[2]!, u)]);
    for (const z of [-hw, hw]) addLine(mesh, cam, [[cx, top * (1 - u), z], lerp([backTop, top, z], [backBottom, 0, z], u)]);
  }
  for (let x = cx; x <= backTop + 1e-6; x += cell) {
    addLine(mesh, cam, [
      [x, top, -hw],
      [x, top, hw],
    ]);
  }
  for (const z of [-hw, hw]) {
    addLine(bars, cam, [
      [backTop, top, z],
      [backBottom, 0, z],
      [cx, 0, z],
    ]);
  }
  addLine(bars, cam, [
    [backTop, top, -hw],
    [backTop, top, hw],
  ]);
  addLine(bars, cam, [
    [backBottom, 0, -hw],
    [backBottom, 0, hw],
  ]);

  // Frame: two posts and the crossbar, front faces white, the faces turned away from the key light shaded.
  const frameInk = M();
  const frame = M();
  const frameShade = M();
  const frameLight = M();
  for (const z of [-hw, hw]) {
    face(frameShade, frameInk, sideRect(z + pw, cx - pw, cx + pw, 0, top + pw));
    face(frame, frameInk, wallRect(cx - pw, z - pw, z + pw, 0, top + pw));
    addPoly(frameLight, cam, wallRect(cx - pw - 0.002, z - pw, z - pw + 0.035, 0, top));
  }
  face(frameShade, frameInk, flatRect(cx - pw, cx + pw, -hw - pw, hw + pw, top - pw));
  face(frame, frameInk, wallRect(cx - pw, -hw - pw, hw + pw, top - pw, top + pw));
  addPoly(frameLight, cam, wallRect(cx - pw - 0.002, -hw - pw, hw + pw, top + pw - 0.035, top + pw));
  addPoly(frameShade, cam, wallRect(cx - pw - 0.002, -hw + pw, hw - pw, top - pw, top - pw + 0.03));

  // Keeper, facing the shooter, filling the engine's keeper box.
  const kx = cx - (t.keeperHalfDepth ?? 0.2);
  const kw = t.keeperHalfWidth ?? 0.35;
  const kh = t.keeperHeight ?? 1.9;
  const s = scaleAt(cam, kx);
  const k = kh / 1.9;
  const at = (y: number, z: number) => proj(cam, [kx, y * k, z]);
  const rr = (b: Builder, y0: number, y1: number, zc: number, halfW: number, r: number) => {
    const p0 = at(y1, zc - halfW);
    const p1 = at(y0, zc + halfW);
    b.addRRect({ rect: { x: p0.x, y: p0.y, width: p1.x - p0.x, height: p1.y - p0.y }, rx: r * s, ry: r * s });
  };
  const bodyInk = M();
  const boots = M();
  const socks = M();
  const knees = M();
  const shorts = M();
  const torso = M();
  const torsoShade = M();
  const stripe = M();
  const gloves = M();
  const skin = M();
  const hair = M();
  const arms = M();
  for (const z of [-0.11, 0.11]) {
    rr(boots, 0, 0.1, z + 0.02, 0.09, 0.04);
    rr(bodyInk, 0, 0.1, z + 0.02, 0.09, 0.04);
    rr(knees, 0.4, 0.74, z, 0.065, 0.05);
    rr(bodyInk, 0.4, 0.74, z, 0.065, 0.05);
    rr(socks, 0.06, 0.46, z, 0.07, 0.05);
    rr(bodyInk, 0.06, 0.46, z, 0.07, 0.05);
  }
  rr(shorts, 0.66, 1.0, 0, 0.22, 0.08);
  rr(bodyInk, 0.66, 1.0, 0, 0.22, 0.08);
  rr(torso, 0.94, 1.58, 0, 0.25, 0.12);
  rr(bodyInk, 0.94, 1.58, 0, 0.25, 0.12);
  rr(torsoShade, 0.95, 1.56, 0.17, 0.07, 0.07);
  rr(stripe, 1.3, 1.38, 0, 0.245, 0.01);
  for (const side of [-1, 1]) {
    const sh = at(1.48, side * 0.2);
    const el = at(1.68, side * (kw * 0.75));
    const hand = at(1.84, side * (kw * 0.92));
    arms.moveTo(sh.x, sh.y);
    arms.lineTo(el.x, el.y);
    arms.lineTo(hand.x, hand.y);
    gloves.addCircle(hand.x, hand.y, 0.085 * s);
    bodyInk.addCircle(hand.x, hand.y, 0.085 * s);
  }
  const head = at(1.72, 0);
  const hr = 0.12 * s * k;
  skin.addCircle(head.x, head.y, hr);
  bodyInk.addCircle(head.x, head.y, hr);
  hair.addArc({ x: head.x - hr, y: head.y - hr, width: 2 * hr, height: 2 * hr }, 180, 180);
  hair.close();

  const keeperShadow = floorSpot(cam, kx + 0.1, 0.15, 0.55);
  const shadows = [floorSpot(cam, cx + 0.6, 0.4, hw + 0.8), floorSpot(cam, cx, -hw + 0.15, 0.35), floorSpot(cam, cx, hw + 0.15, 0.35)];

  return {
    shadows,
    netFill: netFill.detach(),
    mesh: mesh.detach(),
    bars: bars.detach(),
    frameInk: frameInk.detach(),
    frame: frame.detach(),
    frameShade: frameShade.detach(),
    frameLight: frameLight.detach(),
    keeperShadow,
    arms: arms.detach(),
    armW: Math.max(4, 0.11 * s),
    bodyInk: bodyInk.detach(),
    boots: boots.detach(),
    socks: socks.detach(),
    knees: knees.detach(),
    shorts: shorts.detach(),
    torso: torso.detach(),
    torsoShade: torsoShade.detach(),
    stripe: stripe.detach(),
    gloves: gloves.detach(),
    skin: skin.detach(),
    hair: hair.detach(),
  };
}
