/**
 * Basketball's world: an indoor arena at night (art direction "polished arcade"). Deep blue rafters with warm lamps, light beams and
 * hanging banners; raked stands full of people fading into blue haze; LED boards on the far wall; a warm glossy wooden court with
 * planks, a painted key, free-throw circle, three-point arc and baseline; a vignette. Everything is built from the camera projection
 * (so it follows any reframing) once per camera in useMemo; nothing here changes per frame.
 */
import { Group, LinearGradient, Path, RadialGradient, Rect, Skia, vec, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { SportDef } from '@/engine';
import { colors } from '@/ui/theme';

import { screenY, type Camera } from '../../camera';
import { buildCrowd, type Crowd } from './crowd';
import { addBand, addDashes, addLine, addPoly, flatArc, flatRect, floorScreen, floorSpot, proj, seeded, visibleZ, wallRect, type W3 } from './geometry';
import { SoftSpot, type Spot } from './SoftSpot';
import { BoardsView, buildBoards, CrowdView, type Boards } from './Stands';
import { alpha, arena as A, mix } from './worldPalette';

interface Lamp {
  x: number;
  y: number;
  w: number;
}

interface ArenaPaths {
  farY: number;
  topY: number;
  crowd: Crowd;
  suites: SkPath;
  windows: SkPath;
  truss: SkPath;
  lamps: Lamp[];
  lampBodies: SkPath;
  beams: SkPath;
  banners: { color: string; body: SkPath; shade: SkPath; mark: SkPath }[];
  bannerInk: SkPath;
  wall: SkPath;
  rail: SkPath;
  boards: Boards;
  floor: SkPath;
  apron: SkPath;
  paint: SkPath;
  strips: SkPath;
  seams: SkPath;
  lines: SkPath;
  dashes: SkPath;
  pool: Spot;
  glints: Spot[];
  seamShadow: SkPath;
}

export function ArenaWorld({ def, cam, width, height }: { def: SportDef; cam: Camera; width: number; height: number }) {
  const w = useMemo(() => buildArena(def, cam, width, height), [def, cam, width, height]);
  return (
    <>
      {/* Rafters: almost black at the very top, deep blue toward the stands. */}
      <Rect x={0} y={0} width={width} height={w.farY + 2}>
        <LinearGradient start={vec(0, 0)} end={vec(0, w.farY)} colors={[A.roofTop, A.roofBottom, A.haze]} positions={[0, 0.45, 1]} />
      </Rect>
      <Path path={w.truss} color={alpha(A.tierLip, 0.55)} style="stroke" strokeWidth={1.5} />
      <Path path={w.suites} color={A.roofBottom} />
      <Path path={w.windows} color={alpha(A.glow, 0.8)} />

      <CrowdView crowd={w.crowd} riser={A.tier} lip={A.tierLip} />
      {/* Atmospheric depth: the higher (farther) the row, the more it sinks into the blue. */}
      <Rect x={0} y={0} width={width} height={w.farY}>
        <LinearGradient start={vec(0, w.topY)} end={vec(0, w.farY)} colors={[alpha(A.haze, 0.88), alpha(A.haze, 0.62), alpha(A.haze, 0.42)]} positions={[0, 0.5, 1]} />
      </Rect>

      {w.banners.map((b, i) => (
        <Group key={`b${i}`}>
          <Path path={b.body} color={b.color} />
          <Path path={b.shade} color={A.bannerShade} />
          <Path path={b.mark} color={colors.paper} />
        </Group>
      ))}
      <Path path={w.bannerInk} color={colors.ink} style="stroke" strokeWidth={2} strokeJoin="round" />

      <Path path={w.beams} color={A.glow}>
        <LinearGradient start={vec(0, w.lamps[0]?.y ?? 0)} end={vec(0, w.farY)} colors={[alpha(A.glow, 0.22), alpha(A.glow, 0.07), alpha(A.glow, 0)]} positions={[0, 0.6, 1]} />
      </Path>
      {w.lamps.map((l, i) => (
        <SoftSpot key={`g${i}`} spot={{ cx: l.x, cy: l.y, rx: l.w * 2.6, ry: l.w * 2.0 }} color={A.glow} opacity={0.55} core={0.25} />
      ))}
      <Path path={w.lampBodies} color={A.lamp} />

      <Path path={w.wall} color={A.wall} />
      <Path path={w.rail} color={alpha(A.rail, 0.55)} />
      <BoardsView boards={w.boards} base={A.ledBase} gloss={0} />

      {/* The court: warm wood lit from the upper left, painted areas, planks over the paint, white lines. */}
      <Path path={w.floor} color={A.wood}>
        <LinearGradient start={vec(0, w.farY)} end={vec(width, height)} colors={[A.woodLight, A.wood, A.woodDark]} positions={[0, 0.5, 1]} />
      </Path>
      <Path path={w.apron} color={A.apron} />
      <Path path={w.paint} color={A.paint}>
        <LinearGradient start={vec(0, w.farY)} end={vec(width, height)} colors={[A.paint, A.paintDark]} />
      </Path>
      <Path path={w.strips} color={alpha(A.plank, 0.16)} />
      <Path path={w.seams} color={alpha(A.plank, 0.42)} style="stroke" strokeWidth={1.2} />
      <Path path={w.lines} color={A.line} />
      <Path path={w.dashes} color={A.line} />
      <BoardsReflection boards={w.boards} />
      <Path path={w.seamShadow} color={A.vignette}>
        <LinearGradient start={vec(0, w.farY)} end={vec(0, w.farY + (height - w.farY) * 0.12)} colors={[alpha(A.vignette, 0.45), alpha(A.vignette, 0)]} />
      </Path>
      <SoftSpot spot={w.pool} color={A.shine} opacity={0.4} core={0.35} />
      {w.glints.map((g, i) => (
        <SoftSpot key={`r${i}`} spot={g} color={A.shine} opacity={0.32} core={0.2} />
      ))}

      <Vignette width={width} height={height} color={A.vignette} strength={0.55} />
    </>
  );
}

function BoardsReflection({ boards }: { boards: Boards }) {
  const depth = (boards.bottom - boards.top) * 0.7;
  return (
    <>
      {boards.mirror.map((p, i) => (
        <Path key={`m${i}`} path={p.path} color={p.color}>
          <LinearGradient start={vec(0, boards.bottom)} end={vec(0, boards.bottom + depth)} colors={[alpha(p.color, 0.3), alpha(p.color, 0)]} />
        </Path>
      ))}
    </>
  );
}

/** Darkens the screen's edges and corners so the eye goes to the middle. */
export function Vignette({ width, height, color, strength }: { width: number; height: number; color: string; strength: number }) {
  const r = Math.hypot(width, height) * 0.62;
  return (
    <Rect x={0} y={0} width={width} height={height}>
      <RadialGradient c={vec(width / 2, height * 0.42)} r={r} colors={[alpha(color, 0), alpha(color, 0), alpha(color, strength)]} positions={[0, 0.55, 1]} />
    </Rect>
  );
}

function buildArena(def: SportDef, cam: Camera, width: number, height: number): ArenaPaths {
  const L = def.field.length;
  const t = def.target;
  const cx = t.center.x;
  const bx = cx + (t.backboard?.dx ?? 0.38);
  // Court lines, in meters, scaled with the oversized hoop so the key and the arc frame it.
  const xB = Math.min(L - 0.9, bx + 1.0);
  const keyHalf = 1.9;
  const xFT = xB - 5.5;
  const ftR = 1.5;
  const r3 = 6.4;
  const corner = 5.8;
  const courtHalf = 7.2;
  const lineHw = 0.03;

  const farY = screenY(cam, L, 0);
  const rand = seeded(7);

  // Stands: rows rise until about the top quarter of the space above the horizon is left for the rafters.
  const crowd = buildCrowd(cam, {
    firstX: L + 1.2,
    rowDx: 0.75,
    rowDy: 0.58,
    bottomY: 0.9,
    firstSeatY: 1.6,
    stopScreenY: cam.horizonY * 0.3,
    maxRows: 40,
    width,
    shirts: A.shirts,
    brightShirts: A.brightShirts,
    heads: A.heads,
    empty: 0.08,
    cheer: 0.08,
    seed: 11,
  });

  // The suite level above the last row: a dark band with warm windows.
  const suites = Skia.PathBuilder.Make();
  const windows = Skia.PathBuilder.Make();
  const sx = crowd.lastX + 1.2;
  const sy0 = crowd.lastSeatY + 0.7;
  const sy1 = sy0 + 1.6;
  const [sz0, sz1] = visibleZ(cam, sx, width, 80);
  addPoly(suites, cam, wallRect(sx, sz0, sz1, crowd.lastSeatY - 0.2, sy1));
  for (let z = Math.floor(sz0 / 1.6) * 1.6; z < sz1; z += 1.6) addPoly(windows, cam, wallRect(sx - 0.01, z + 0.15, z + 1.3, sy0 + 0.35, sy0 + 1.05));
  const topY = proj(cam, [sx, sy1, 0]).y;

  // Rafters: one truss across, lamps hanging under it, beams down to the court.
  const truss = Skia.PathBuilder.Make();
  const lamps: Lamp[] = [];
  const lampBodies = Skia.PathBuilder.Make();
  const beams = Skia.PathBuilder.Make();
  const roof = Math.max(topY, 24);
  const ty0 = roof * 0.18;
  const ty1 = roof * 0.36;
  truss.moveTo(-10, ty0);
  truss.lineTo(width + 10, ty0);
  truss.moveTo(-10, ty1);
  truss.lineTo(width + 10, ty1);
  const step = (ty1 - ty0) * 1.4;
  for (let x = -10, up = true; x < width + 10; x += step, up = !up) {
    truss.moveTo(x, up ? ty0 : ty1);
    truss.lineTo(x + step, up ? ty1 : ty0);
  }
  const lampN = 4;
  const lw = Math.max(10, width * 0.055);
  for (let i = 0; i < lampN; i++) {
    const lx = (width * (i + 0.5)) / lampN;
    const ly = ty1 + lw * 0.45;
    lamps.push({ x: lx, y: ly, w: lw });
    lampBodies.addRRect({ rect: { x: lx - lw / 2, y: ly - lw * 0.22, width: lw, height: lw * 0.44 }, rx: lw * 0.2, ry: lw * 0.2 });
    // Beams lean outward from the middle, like spots aimed at the court.
    const lean = (lx - width / 2) * 0.35;
    const spread = width * 0.16;
    beams.moveTo(lx - lw * 0.4, ly);
    beams.lineTo(lx + lw * 0.4, ly);
    beams.lineTo(lx + lean + spread, farY);
    beams.lineTo(lx + lean - spread, farY);
    beams.close();
  }

  // Championship banners hanging from the truss at the sides, clear of the middle where the hoop is.
  const banners: ArenaPaths['banners'] = [];
  const bannerInk = Skia.PathBuilder.Make();
  const bw = Math.max(16, width * 0.07);
  const bh = Math.min(Math.max(30, (farY - ty0) * 0.38), bw * 2.6);
  const slots = [0.07, 0.18, 0.82, 0.93];
  const bannerColors = [A.bannerA, A.bannerC, A.bannerB, A.bannerA];
  slots.forEach((f, i) => {
    const x0 = width * f - bw / 2;
    const y0 = ty0;
    const body = Skia.PathBuilder.Make();
    const shape = (b: typeof body) => {
      b.moveTo(x0, y0);
      b.lineTo(x0 + bw, y0);
      b.lineTo(x0 + bw, y0 + bh);
      b.lineTo(x0 + bw / 2, y0 + bh - bw * 0.35);
      b.lineTo(x0, y0 + bh);
      b.close();
    };
    shape(body);
    shape(bannerInk);
    const shade = Skia.PathBuilder.Make();
    shade.moveTo(x0 + bw * 0.68, y0);
    shade.lineTo(x0 + bw, y0);
    shade.lineTo(x0 + bw, y0 + bh);
    shade.lineTo(x0 + bw * 0.68, y0 + bh - bw * 0.24);
    shade.close();
    const mark = Skia.PathBuilder.Make();
    // A star over two stripes.
    const scx = x0 + bw / 2;
    const scy = y0 + bh * 0.34;
    const R = bw * 0.24;
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 === 0 ? R : R * 0.45;
      if (k === 0) mark.moveTo(scx + rr * Math.cos(a), scy + rr * Math.sin(a));
      else mark.lineTo(scx + rr * Math.cos(a), scy + rr * Math.sin(a));
    }
    mark.close();
    mark.addRect({ x: x0 + bw * 0.15, y: y0 + bh * 0.58, width: bw * 0.7, height: bh * 0.05 });
    mark.addRect({ x: x0 + bw * 0.15, y: y0 + bh * 0.67, width: bw * 0.7, height: bh * 0.05 });
    banners.push({ color: bannerColors[i]!, body: body.detach(), shade: shade.detach(), mark: mark.detach() });
  });

  // Far wall: a fascia with a rail under the first row, LED boards at the floor.
  const [wz0, wz1] = visibleZ(cam, L, width, 80);
  const wall = Skia.PathBuilder.Make();
  addPoly(wall, cam, wallRect(L, wz0, wz1, 0.6, 1.1));
  const rail = Skia.PathBuilder.Make();
  addPoly(rail, cam, wallRect(L - 0.02, wz0, wz1, 1.05, 1.11));
  const boards = buildBoards(cam, L - 0.03, 0.62, width, [A.ledA, A.ledC, A.ledB].map((c) => mix(c, A.ledBase, 0.3)));

  // Floor.
  const floor = Skia.PathBuilder.Make();
  floorScreen(floor, cam, L, width, height);
  const nearX = cam.x;
  const apron = Skia.PathBuilder.Make();
  addPoly(apron, cam, flatRect(xB, L, wz0 - 5, wz1 + 5));
  addPoly(apron, cam, flatRect(nearX, xB, courtHalf, courtHalf + 30));
  addPoly(apron, cam, flatRect(nearX, xB, -courtHalf - 30, -courtHalf));
  const paint = Skia.PathBuilder.Make();
  addPoly(paint, cam, flatRect(xFT, xB, -keyHalf, keyHalf));

  // Planks run along the court: alternate strips a shade darker, seams between them, staggered end joints.
  const strips = Skia.PathBuilder.Make();
  const seams = Skia.PathBuilder.Make();
  const pw = 0.3;
  for (let i = -36; i < 36; i++) {
    const z = i * pw;
    if (i % 2 === 0) addPoly(strips, cam, flatRect(nearX, L, z, z + pw));
    addLine(seams, cam, [
      [nearX, 0, z],
      [L, 0, z],
    ]);
    for (let x = L - rand() * 2.4; x > nearX + 1; x -= 1.8 + rand() * 1.6) {
      addLine(seams, cam, [
        [x, 0, z],
        [x, 0, z + pw],
      ]);
    }
  }

  // Lines: baseline, key, free-throw circle (dashed inside the key), restricted arc, three-point line, sidelines, hash marks.
  const lines = Skia.PathBuilder.Make();
  const dashes = Skia.PathBuilder.Make();
  addBand(lines, cam, [
    [xB, 0, -courtHalf],
    [xB, 0, courtHalf],
  ], lineHw);
  addBand(lines, cam, flatRect(xFT, xB, -keyHalf, keyHalf), lineHw, true);
  addBand(lines, cam, flatArc(xFT, 0, ftR, Math.PI / 2, (3 * Math.PI) / 2, 40), lineHw);
  addDashes(dashes, cam, flatArc(xFT, 0, ftR, -Math.PI / 2, Math.PI / 2, 60), lineHw, 0.3);
  const ra: W3[] = [[bx, 0, -1.25], ...flatArc(cx, 0, 1.25, (3 * Math.PI) / 2, Math.PI / 2, 36), [bx, 0, 1.25]];
  addBand(lines, cam, ra, lineHw);
  const alpha3 = Math.asin(Math.min(1, corner / r3));
  const xc = cx - r3 * Math.cos(alpha3);
  const arc: W3[] = [[xB, 0, -corner], [xc, 0, -corner], ...flatArc(cx, 0, r3, Math.PI + alpha3, Math.PI - alpha3, 80), [xc, 0, corner], [xB, 0, corner]];
  addBand(lines, cam, arc, lineHw);
  for (const z of [-courtHalf, courtHalf])
    addBand(lines, cam, [
      [xB, 0, z],
      [nearX, 0, z],
    ], lineHw);
  for (const side of [-1, 1]) {
    for (const [i, d] of [1.75, 2.6, 3.45, 4.3].entries()) {
      const x = xB - d;
      const z0 = side * keyHalf;
      const z1 = side * (keyHalf + 0.28);
      if (i === 0) addPoly(lines, cam, flatRect(x - 0.15, x + 0.15, Math.min(z0, z1), Math.max(z0, z1)));
      else
        addBand(lines, cam, [
          [x, 0, z0],
          [x, 0, z1],
        ], lineHw);
    }
  }

  // Shadow along the foot of the wall.
  const seamShadow = Skia.PathBuilder.Make();
  addPoly(seamShadow, cam, flatRect(L - 1.2, L, wz0 - 5, wz1 + 5));

  // Light on the glossy wood: a broad pool over the key toward the key light, and a soft glint under each lamp.
  const pool = floorSpot(cam, cx - 2.2, -1.2, 3.6);
  const glints: Spot[] = lamps.map((l) => {
    const gy = farY + (height - farY) * 0.1;
    return { cx: l.x + (l.x - width / 2) * 0.2, cy: gy, rx: l.w * 1.1, ry: (height - farY) * 0.09 };
  });

  return {
    farY,
    topY,
    crowd,
    suites: suites.detach(),
    windows: windows.detach(),
    truss: truss.detach(),
    lamps,
    lampBodies: lampBodies.detach(),
    beams: beams.detach(),
    banners,
    bannerInk: bannerInk.detach(),
    wall: wall.detach(),
    rail: rail.detach(),
    boards,
    floor: floor.detach(),
    apron: apron.detach(),
    paint: paint.detach(),
    strips: strips.detach(),
    seams: seams.detach(),
    lines: lines.detach(),
    dashes: dashes.detach(),
    pool,
    glints,
    seamShadow: seamShadow.detach(),
  };
}
