/**
 * Golf's world: an open course on a bright day (art direction "polished arcade"). A deep blue sky with a sun glow from the upper left
 * and a few two-tone clouds, rolling hills that get bluer and paler with distance, a tree line on the horizon, framing trees at the
 * sides, rough with tufts, a mowed fairway in stripes with a lighter first cut, a bunker beyond the green; a soft vignette.
 * The far scenery (clouds, hills, tree line) is laid out in screen space around the horizon so it fits any lens; everything on the
 * ground comes from the camera projection. Built once per camera.
 */
import { Group, LinearGradient, Path, Rect, Skia, vec, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { SportDef } from '@/engine';
import { colors } from '@/ui/theme';

import { scaleAt, screenX, screenY, type Camera } from '../../camera';
import { Vignette } from './Arena';
import { addPoly, flatArc, flatRect, floorSpot, seeded, visibleZ, wallRect, type W3 } from './geometry';
import { SoftSpot, type Spot } from './SoftSpot';
import { alpha, course as C, mix } from './worldPalette';

interface CoursePaths {
  horizon: number;
  cloudShade: SkPath;
  cloud: SkPath;
  hillFar: SkPath;
  hillMid: SkPath;
  treeBack: SkPath;
  treeFront: SkPath;
  ground: SkPath;
  cut: SkPath;
  fairway: SkPath;
  stripes: SkPath;
  tufts: SkPath;
  bunkerLip: SkPath;
  bunker: SkPath;
  treeInk: SkPath;
  trunks: SkPath;
  canopyDark: SkPath;
  canopy: SkPath;
  canopyLight: SkPath;
  treeShadows: Spot[];
}

export function CourseWorld({ def, cam, width, height }: { def: SportDef; cam: Camera; width: number; height: number }) {
  const w = useMemo(() => buildCourse(def, cam, width, height), [def, cam, width, height]);
  const hz = w.horizon;
  return (
    <>
      <Rect x={0} y={0} width={width} height={hz + 4}>
        <LinearGradient start={vec(0, 0)} end={vec(0, hz)} colors={[C.skyTop, C.skyBottom]} />
      </Rect>
      <SoftSpot spot={{ cx: width * 0.1, cy: hz * 0.12, rx: width * 0.75, ry: width * 0.6 }} color={C.sun} opacity={0.65} core={0.25} />
      <Path path={w.cloudShade} color={C.cloudShade} />
      <Path path={w.cloud} color={C.cloud} />
      <Path path={w.hillFar} color={mix(C.hillFar, C.skyBottom, 0.25)} />
      <Path path={w.hillMid} color={C.hillMid}>
        <LinearGradient start={vec(0, hz - height * 0.06)} end={vec(0, hz)} colors={[mix(C.hillMid, C.skyBottom, 0.15), mix(C.hillMid, C.skyBottom, 0.4)]} />
      </Path>
      <Path path={w.treeBack} color={mix(C.treeDark, C.skyBottom, 0.3)} />
      <Path path={w.treeFront} color={mix(C.tree, C.skyBottom, 0.2)} />

      <Path path={w.ground} color={C.rough}>
        <LinearGradient start={vec(0, hz)} end={vec(width * 0.3, height)} colors={[mix(C.rough, C.skyBottom, 0.35), C.rough, C.roughDark]} positions={[0, 0.35, 1]} />
      </Path>
      <Path path={w.tufts} color={alpha(C.roughDark, 0.8)} style="stroke" strokeWidth={1.5} strokeCap="round" />
      <Path path={w.cut} color={C.fringe} />
      <Path path={w.fairway} color={C.fairway}>
        <LinearGradient start={vec(0, hz)} end={vec(width, height)} colors={[C.fairwayLight, C.fairway, mix(C.fairway, C.roughDark, 0.4)]} positions={[0, 0.5, 1]} />
      </Path>
      <Group clip={w.fairway}>
        <Path path={w.stripes} color={alpha('#FFFFFF', 0.1)} />
      </Group>
      <Path path={w.bunkerLip} color={mix(C.fringe, '#000000', 0.15)} />
      <Path path={w.bunker} color="#F2DDA4">
        <LinearGradient start={vec(0, hz)} end={vec(width, hz + height * 0.2)} colors={['#FBEBC0', '#E6C98A']} />
      </Path>

      {w.treeShadows.map((s, i) => (
        <SoftSpot key={i} spot={s} color={C.shadow} opacity={0.35} />
      ))}
      <Path path={w.treeInk} color={colors.ink} style="stroke" strokeWidth={4} strokeJoin="round" />
      <Path path={w.trunks} color="#7A5234" />
      <Path path={w.canopyDark} color={C.treeDark} />
      <Path path={w.canopy} color={C.tree} />
      <Path path={w.canopyLight} color={mix(C.tree, '#D8F27A', 0.35)} />

      <Vignette width={width} height={height} color="#0F2A1E" strength={0.35} />
    </>
  );
}

function buildCourse(def: SportDef, cam: Camera, width: number, height: number): CoursePaths {
  const L = def.field.length;
  const cx = def.target.center.x;
  const hz = cam.horizonY;
  const rand = seeded(5);
  const M = () => Skia.PathBuilder.Make();

  // Clouds: puffs of circles, a shade copy offset down-right under each.
  const cloudShade = M();
  const cloud = M();
  const clouds = [
    [0.22, 0.32, 1.0],
    [0.7, 0.18, 0.8],
    [0.95, 0.42, 0.65],
  ] as const;
  for (const [fx, fy, k] of clouds) {
    const x = width * fx;
    const y = Math.min(hz * fy + 10, hz - 50);
    const r = width * 0.06 * k;
    const puffs = [
      [-1.6, 0.3, 0.8],
      [-0.7, -0.2, 1.1],
      [0.4, -0.45, 1.25],
      [1.5, 0.1, 0.9],
      [0.2, 0.35, 1.0],
    ] as const;
    for (const [dx, dy, pr] of puffs) {
      cloudShade.addCircle(x + dx * r + r * 0.12, y + dy * r + r * 0.22, pr * r);
      cloud.addCircle(x + dx * r, y + dy * r, pr * r * 0.96);
    }
  }

  // Hills: smooth silhouettes rising from the horizon, the far range taller and paler.
  const hill = (amp: number, f1: number, f2: number, p: number) => {
    const b = M();
    b.moveTo(-10, hz + 4);
    for (let x = -10; x <= width + 10; x += 6) {
      const h = amp * (0.62 + 0.28 * Math.sin(x * f1 + p) + 0.14 * Math.sin(x * f2 + 2 * p));
      b.lineTo(x, hz - h);
    }
    b.lineTo(width + 10, hz + 4);
    b.close();
    return b.detach();
  };
  const hillFar = hill(height * 0.075, 0.011, 0.029, 1.2);
  const hillMid = hill(height * 0.045, 0.017, 0.041, 3.1);
  // Tree line: a row of round crowns on the horizon, lit tops in front.
  const treeBack = M();
  const treeFront = M();
  for (let x = -10; x < width + 20; x += 9 + rand() * 8) {
    const r = height * (0.01 + rand() * 0.012);
    treeBack.addCircle(x, hz - r * 0.55, r);
    treeFront.addCircle(x - r * 0.2, hz - r * 0.75, r * 0.62);
  }
  treeBack.addRect({ x: -10, y: hz - height * 0.008, width: width + 20, height: height * 0.012 });

  // Ground to the horizon.
  const ground = M();
  ground.addRect({ x: -10, y: hz, width: width + 20, height: height - hz + 10 });

  // Fairway: narrow near the player, widening toward the green, ending well past it; a lighter first cut around it.
  const far = L + 8;
  const fair = (grow: number): W3[] => {
    const pts: W3[] = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const x = cam.x + ((far - cam.x) * i) / n;
      const u = Math.min(1, Math.max(0, (x - 2) / (cx - 2)));
      pts.push([x, 0, -(1.5 + 0.9 * u + grow)]);
    }
    for (let i = n; i >= 0; i--) {
      const x = cam.x + ((far - cam.x) * i) / n;
      const u = Math.min(1, Math.max(0, (x - 2) / (cx - 2)));
      pts.push([x, 0, 1.6 + 0.9 * u + grow]);
    }
    return pts;
  };
  const cut = M();
  addPoly(cut, cam, fair(0.45));
  const fairway = M();
  addPoly(fairway, cam, fair(0));
  const stripes = M();
  for (let x = Math.floor(cam.x / 3) * 3; x < far; x += 3) addPoly(stripes, cam, flatRect(x, x + 1.5, -6, 6));

  // Tufts of rough: short V strokes scattered outside the fairway, sized by depth.
  const tufts = M();
  for (let i = 0; i < 260; i++) {
    const x = 2 + rand() * (far + 10 - 2);
    const [z0, z1] = visibleZ(cam, x, width, 10);
    const z = z0 + rand() * (z1 - z0);
    if (Math.abs(z) < 3.2) continue;
    const s = scaleAt(cam, x, z);
    const px = screenX(cam, x, z);
    const py = screenY(cam, x, 0, z);
    const h = Math.max(2, 0.08 * s);
    tufts.moveTo(px - h * 0.5, py - h);
    tufts.lineTo(px, py);
    tufts.lineTo(px + h * 0.4, py - h * 1.1);
  }

  // A bunker beyond the green, to the right.
  const bunkerLip = M();
  const bunker = M();
  const blob = (r: number): W3[] => flatArc(cx + 3.4, 1.8, r, 0, 2 * Math.PI, 28).map(([x, y, z]) => [cx + 3.4 + (x - cx - 3.4) * 1.5, y, z] as W3);
  addPoly(bunkerLip, cam, blob(0.95));
  addPoly(bunker, cam, blob(0.85));

  // Framing trees at the screen's sides just beyond the field.
  const treeInk = M();
  const trunks = M();
  const canopyDark = M();
  const canopy = M();
  const canopyLight = M();
  const treeShadows: Spot[] = [];
  const tree = (x: number, z: number, hgt: number) => {
    const s = scaleAt(cam, x, z);
    const tw = 0.16;
    addPoly(trunks, cam, wallRect(x, z - tw, z + tw, 0, hgt * 0.55));
    addPoly(treeInk, cam, wallRect(x, z - tw, z + tw, 0, hgt * 0.55));
    const cxs = screenX(cam, x, z);
    const cys = screenY(cam, x, hgt * 0.68, z);
    const r = hgt * 0.3 * s;
    const blobs = [
      [0, 0, 1],
      [-0.75, 0.3, 0.72],
      [0.75, 0.3, 0.72],
      [0, -0.55, 0.78],
    ] as const;
    for (const [dx, dy, k] of blobs) {
      canopyDark.addCircle(cxs + dx * r, cys + dy * r, k * r);
      treeInk.addCircle(cxs + dx * r, cys + dy * r, k * r);
      canopy.addCircle(cxs + dx * r - 0.12 * r, cys + dy * r - 0.14 * r, k * r * 0.78);
      canopyLight.addCircle(cxs + dx * r - 0.3 * r, cys + dy * r - 0.34 * r, k * r * 0.36);
    }
    treeShadows.push(floorSpot(cam, x + 0.3, z + 0.6, hgt * 0.32));
  };
  const tx = L + 6;
  const [tz0, tz1] = visibleZ(cam, tx, width, 0);
  tree(tx + 2, tz0 + 0.2, 3.4);
  tree(tx, tz1 - 0.1, 3.0);

  return {
    horizon: hz,
    cloudShade: cloudShade.detach(),
    cloud: cloud.detach(),
    hillFar,
    hillMid,
    treeBack: treeBack.detach(),
    treeFront: treeFront.detach(),
    ground: ground.detach(),
    cut: cut.detach(),
    fairway: fairway.detach(),
    stripes: stripes.detach(),
    tufts: tufts.detach(),
    bunkerLip: bunkerLip.detach(),
    bunker: bunker.detach(),
    treeInk: treeInk.detach(),
    trunks: trunks.detach(),
    canopyDark: canopyDark.detach(),
    canopy: canopy.detach(),
    canopyLight: canopyLight.detach(),
    treeShadows,
  };
}
