/**
 * Pieces every stadium-like backdrop shares: the crowd (built by crowd.ts) as a few batched paths, and the glowing LED ad boards along
 * the foot of the far wall, with their mirror image on a glossy floor. Static, built once per camera.
 */
import { LinearGradient, Path, Skia, vec, type SkPath } from '@shopify/react-native-skia';

import { colors } from '@/ui/theme';

import type { Camera } from '../../camera';
import type { Crowd } from './crowd';
import { addPoly, proj, visibleZ, wallRect, type W3 } from './geometry';
import { alpha } from './worldPalette';

export function CrowdView({ crowd, riser, lip }: { crowd: Crowd; riser: string; lip: string }) {
  return (
    <>
      <Path path={crowd.risers} color={riser} />
      <Path path={crowd.lips} color={lip} />
      {crowd.shirts.map((s) => (
        <Path key={`s${s.color}`} path={s.path} color={s.color} />
      ))}
      <Path path={crowd.hair} color="#2A1E1A" />
      {crowd.heads.map((h) => (
        <Path key={`h${h.color}`} path={h.path} color={h.color} />
      ))}
    </>
  );
}

export interface Boards {
  base: SkPath;
  panels: { color: string; path: SkPath }[];
  marks: SkPath;
  /** Mirror images on the floor, for a glossy floor. */
  mirror: { color: string; path: SkPath }[];
  /** Screen y of the boards' top and bottom at z = 0, for the gloss gradient. */
  top: number;
  bottom: number;
}

/** LED boards on the wall at depth x, from the floor to height h, panels cycling through the given colors. */
export function buildBoards(cam: Camera, x: number, h: number, width: number, panelColors: readonly string[], seed = 0): Boards {
  const [z0, z1] = visibleZ(cam, x, width, 80);
  const base = Skia.PathBuilder.Make();
  addPoly(base, cam, wallRect(x, z0, z1, 0, h));
  const panels = panelColors.map(() => Skia.PathBuilder.Make());
  const mirror = panelColors.map(() => Skia.PathBuilder.Make());
  const marks = Skia.PathBuilder.Make();
  const pw = 2.7;
  const gap = 0.14;
  const yLo = 0.12 * h;
  const yHi = 0.86 * h;
  let i = Math.floor(z0 / pw) + seed;
  for (let z = Math.floor(z0 / pw) * pw; z < z1; z += pw, i++) {
    const k = ((i % panelColors.length) + panelColors.length) % panelColors.length;
    const a = z + gap / 2;
    const b = z + pw - gap / 2;
    addPoly(panels[k]!, cam, wallRect(x, a, b, yLo, yHi));
    addPoly(mirror[k]!, cam, wallRect(x, a, b, -yHi * 0.7, -yLo));
    // A "logo" on each panel: a fat chevron and a long bar, never a real brand.
    const m = (a + b) / 2;
    const yc = (yLo + yHi) / 2;
    const ch = (yHi - yLo) * 0.32;
    const chev: W3[] = [
      [x, yc + ch, m - 0.95],
      [x, yc + ch, m - 0.75],
      [x, yc, m - 0.5],
      [x, yc - ch, m - 0.75],
      [x, yc - ch, m - 0.95],
      [x, yc, m - 0.7],
    ];
    addPoly(marks, cam, chev);
    addPoly(marks, cam, wallRect(x, m - 0.35, m + 0.95, yc - ch * 0.42, yc + ch * 0.42));
  }
  return {
    base: base.detach(),
    panels: panels.map((p, j) => ({ color: panelColors[j]!, path: p.detach() })),
    marks: marks.detach(),
    mirror: mirror.map((p, j) => ({ color: panelColors[j]!, path: p.detach() })),
    top: proj(cam, [x, h, 0]).y,
    bottom: proj(cam, [x, 0, 0]).y,
  };
}

export function BoardsView({ boards, base, gloss }: { boards: Boards; base: string; gloss: number }) {
  const mirrorDepth = (boards.bottom - boards.top) * 0.8;
  return (
    <>
      <Path path={boards.base} color={base} />
      {boards.panels.map((p) => (
        <Path key={p.color} path={p.path} color={p.color} />
      ))}
      <Path path={boards.marks} color={alpha(colors.paper, 0.85)} />
      {/* A glossy top half on every panel, as LED boards have. */}
      <Path path={boards.base} color="white">
        <LinearGradient start={vec(0, boards.top)} end={vec(0, boards.bottom)} colors={[alpha('#FFFFFF', 0.28), alpha('#FFFFFF', 0.06), alpha('#FFFFFF', 0)]} positions={[0, 0.45, 0.5]} />
      </Path>
      {gloss > 0 &&
        boards.mirror.map((p) => (
          <Path key={`m${p.color}`} path={p.path} color={p.color}>
            <LinearGradient start={vec(0, boards.bottom)} end={vec(0, boards.bottom + mirrorDepth)} colors={[alpha(p.color, gloss), alpha(p.color, 0)]} />
          </Path>
        ))}
      <Path path={boards.base} color={colors.ink} style="stroke" strokeWidth={1.5} opacity={0.6} />
    </>
  );
}
