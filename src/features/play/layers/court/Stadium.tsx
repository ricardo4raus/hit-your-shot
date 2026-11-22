/**
 * Football's world: a stadium on a sunny day (art direction "polished arcade"). Blue sky with a warm glow from the upper left, a roof
 * edge with floodlight banks, raked stands full of people fading into the haze, LED boards along the far wall, mowed grass in light and
 * dark stripes with the goal line, goal area, penalty area, spot and arc painted on; a soft vignette. Built once per camera.
 */
import { LinearGradient, Path, Rect, Skia, vec, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { SportDef } from '@/engine';

import { screenY, type Camera } from '../../camera';
import { Vignette } from './Arena';
import { buildCrowd, type Crowd } from './crowd';
import { addBand, addPoly, flatArc, flatRect, floorScreen, proj, visibleZ, wallRect, type W3 } from './geometry';
import { SoftSpot, type Spot } from './SoftSpot';
import { BoardsView, buildBoards, CrowdView, type Boards } from './Stands';
import { alpha, arena, stadium as S } from './worldPalette';

interface StadiumPaths {
  farY: number;
  topY: number;
  crowd: Crowd;
  roof: SkPath;
  roofLip: SkPath;
  lampBanks: SkPath;
  glows: Spot[];
  wall: SkPath;
  boards: Boards;
  floor: SkPath;
  stripes: SkPath;
  lines: SkPath;
}

export function StadiumWorld({ def, cam, width, height }: { def: SportDef; cam: Camera; width: number; height: number }) {
  const w = useMemo(() => buildStadium(def, cam, width, height), [def, cam, width, height]);
  return (
    <>
      <Rect x={0} y={0} width={width} height={w.farY + 2}>
        <LinearGradient start={vec(0, 0)} end={vec(0, w.farY)} colors={[S.skyTop, S.skyBottom]} />
      </Rect>
      <SoftSpot spot={{ cx: width * 0.08, cy: 0, rx: width * 0.7, ry: width * 0.5 }} color="#FFF1C2" opacity={0.5} core={0.3} />

      <CrowdView crowd={w.crowd} riser={S.tier} lip={S.tierLip} />
      <Rect x={0} y={w.topY} width={width} height={w.farY - w.topY}>
        <LinearGradient start={vec(0, w.topY)} end={vec(0, w.farY)} colors={[alpha(S.haze, 0.7), alpha(S.haze, 0.5), alpha(S.haze, 0.35)]} positions={[0, 0.55, 1]} />
      </Rect>
      <Path path={w.roof} color={S.roof} />
      <Path path={w.roofLip} color={S.roofLight} />
      {w.glows.map((g, i) => (
        <SoftSpot key={`g${i}`} spot={g} color={S.lamp} opacity={0.7} core={0.2} />
      ))}
      <Path path={w.lampBanks} color={S.lamp} />

      <Path path={w.wall} color={S.wall} />
      <BoardsView boards={w.boards} base={arena.ledBase} gloss={0} />

      <Path path={w.floor} color={S.grass}>
        <LinearGradient start={vec(0, w.farY)} end={vec(width, height)} colors={[S.grassLight, S.grass, S.grassDark]} positions={[0, 0.5, 1]} />
      </Path>
      <Path path={w.stripes} color={alpha('#FFFFFF', 0.14)} />
      <Path path={w.lines} color={alpha(S.line, 0.92)} />
      <Path path={w.floor} color="black">
        <LinearGradient start={vec(0, w.farY)} end={vec(0, w.farY + (height - w.farY) * 0.15)} colors={[alpha('#0F2A14', 0.35), alpha('#0F2A14', 0)]} />
      </Path>

      <Vignette width={width} height={height} color="#0F2238" strength={0.4} />
    </>
  );
}

function buildStadium(def: SportDef, cam: Camera, width: number, height: number): StadiumPaths {
  const L = def.field.length;
  const t = def.target;
  const cx = t.center.x;
  const hw = t.halfWidth;
  const farY = screenY(cam, L, 0);
  const lineHw = 0.05;

  const crowd = buildCrowd(cam, {
    firstX: L + 0.8,
    rowDx: 0.8,
    rowDy: 0.65,
    bottomY: 0.9,
    firstSeatY: 1.55,
    stopScreenY: cam.horizonY * 0.42,
    maxRows: 40,
    width,
    shirts: ['#5576B8', '#C9554D', '#D8D2C4', '#4C7F6A', '#8A7A9A', '#3E5C99', '#B98A4C'],
    brightShirts: ['#FFC83D', '#E8564B', '#FFFFFF', '#3FC1FF'],
    heads: arena.heads,
    empty: 0.06,
    cheer: 0.12,
    seed: 23,
  });

  // The roof edge over the last row, with floodlight banks hanging from it.
  const roof = Skia.PathBuilder.Make();
  const roofLip = Skia.PathBuilder.Make();
  const lampBanks = Skia.PathBuilder.Make();
  const rx = crowd.lastX + 1.2;
  const ry0 = crowd.lastSeatY + 0.9;
  const ry1 = ry0 + 1.1;
  const [rz0, rz1] = visibleZ(cam, rx, width, 80);
  addPoly(roof, cam, wallRect(rx, rz0, rz1, ry0, ry1));
  addPoly(roofLip, cam, wallRect(rx - 0.01, rz0, rz1, ry0, ry0 + 0.14));
  const topY = proj(cam, [rx, ry1, 0]).y;
  const glows: Spot[] = [];
  const bankW = 1.3;
  for (let z = Math.floor(rz0 / 3.2) * 3.2 + 0.6; z < rz1; z += 3.2) {
    for (let k = 0; k < 4; k++) {
      const z0 = z + (k * bankW) / 4;
      addPoly(lampBanks, cam, wallRect(rx - 0.02, z0 + 0.04, z0 + bankW / 4 - 0.04, ry0 + 0.35, ry0 + 0.8));
    }
    const c = proj(cam, [rx, ry0 + 0.58, z + bankW / 2]);
    const r = (proj(cam, [rx, ry0, z + bankW]).x - proj(cam, [rx, ry0, z]).x) * 1.3;
    glows.push({ cx: c.x, cy: c.y, rx: r, ry: r * 0.75 });
  }

  const [wz0, wz1] = visibleZ(cam, L, width, 80);
  const wall = Skia.PathBuilder.Make();
  addPoly(wall, cam, wallRect(L, wz0, wz1, 0.8, 1.2));
  const boards = buildBoards(cam, L - 0.03, 0.8, width, [arena.ledA, arena.ledC, arena.ledB], 1);

  const floor = Skia.PathBuilder.Make();
  floorScreen(floor, cam, L, width, height);
  // Mowing stripes across the pitch, every 1.6 m of depth.
  const stripes = Skia.PathBuilder.Make();
  for (let x = Math.floor(cam.x / 3.2) * 3.2; x < L; x += 3.2) addPoly(stripes, cam, flatRect(x, Math.min(L, x + 1.6), wz0 - 40, wz1 + 40));

  // Lines: goal line, goal area, penalty area, spot and arc (outside the box only).
  const lines = Skia.PathBuilder.Make();
  const half = 12;
  addBand(lines, cam, [
    [cx, 0, -half],
    [cx, 0, half],
  ], lineHw);
  const box = (depth: number, zHalf: number): W3[] => [
    [cx, 0, -zHalf],
    [cx - depth, 0, -zHalf],
    [cx - depth, 0, zHalf],
    [cx, 0, zHalf],
  ];
  addBand(lines, cam, box(1.6, hw + 1.6), lineHw);
  const pen = 4.8;
  addBand(lines, cam, box(pen, hw + 4.4), lineHw);
  const spotX = cx - 3.4;
  addPoly(lines, cam, flatArc(spotX, 0, 0.11, 0, 2 * Math.PI, 16));
  const arcR = 2.6;
  const b = Math.acos(Math.min(1, (pen - 3.4) / arcR));
  addBand(lines, cam, flatArc(spotX, 0, arcR, Math.PI - b, Math.PI + b, 30), lineHw);
  return { farY, topY, crowd, roof: roof.detach(), roofLip: roofLip.detach(), lampBanks: lampBanks.detach(), glows, wall: wall.detach(), boards, floor: floor.detach(), stripes: stripes.detach(), lines: lines.detach() };
}
