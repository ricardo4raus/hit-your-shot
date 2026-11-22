/**
 * The court behind everything: wall, stands, floor, lines. Static per sport and screen size, built once.
 * Owner of this file: the "court" agent. Props are fixed by layers/shared.ts.
 */
import { Path, Rect, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { SportDef } from '@/engine';
import { border, colors, sportColors } from '@/ui/theme';

import { screenX, screenY, type Camera } from '../camera';
import type { SceneProps } from './shared';

export function WorldLayer({ def, sportId, cam, width, height }: SceneProps) {
  const palette = sportColors[sportId as keyof typeof sportColors];
  const world = useMemo(() => buildWorld(def, cam), [def, cam]);
  return (
    <>
      <Rect x={0} y={0} width={width} height={height} color={palette.sky} />
      <Path path={world.stands} color={colors.haze} opacity={0.6} />
      <Path path={world.floor} color={palette.floor} />
      <Path path={world.floorEdge} color={colors.ink} style="stroke" strokeWidth={border.width} />
      <Path path={world.lane} color={colors.paper} style="stroke" strokeWidth={2} opacity={0.7} />
    </>
  );
}

interface WorldPaths {
  stands: SkPath;
  floor: SkPath;
  floorEdge: SkPath;
  lane: SkPath;
}

function buildWorld(def: SportDef, cam: Camera): WorldPaths {
  const length = def.field.length;
  const hs = def.field.halfSpan;
  const nearX = cam.x + 0.6;
  const floor = Skia.PathBuilder.Make();
  const nearZ = hs + 2;
  floor.moveTo(screenX(cam, length, -hs), screenY(cam, length, 0, -hs));
  floor.lineTo(screenX(cam, length, hs), screenY(cam, length, 0, hs));
  floor.lineTo(screenX(cam, nearX, nearZ), screenY(cam, nearX, 0, nearZ));
  floor.lineTo(screenX(cam, nearX, -nearZ), screenY(cam, nearX, 0, -nearZ));
  floor.close();

  const edge = Skia.PathBuilder.Make();
  edge.moveTo(screenX(cam, length, -hs), screenY(cam, length, 0, -hs));
  edge.lineTo(screenX(cam, length, hs), screenY(cam, length, 0, hs));
  edge.moveTo(screenX(cam, length, -hs), screenY(cam, length, 0, -hs));
  edge.lineTo(screenX(cam, nearX, -hs), screenY(cam, nearX, 0, -hs));
  edge.moveTo(screenX(cam, length, hs), screenY(cam, length, 0, hs));
  edge.lineTo(screenX(cam, nearX, hs), screenY(cam, nearX, 0, hs));

  // A silhouette of stands along the far wall: a band above the far floor edge, with a step. Drawn as the wall's quads so the
  // camera's yaw keeps them in perspective.
  const stands = Skia.PathBuilder.Make();
  const wallZ = hs + 6;
  const quad = (yLo: number, yHi: number, zHalf: number) => {
    stands.moveTo(screenX(cam, length, -zHalf), screenY(cam, length, yHi, -zHalf));
    stands.lineTo(screenX(cam, length, zHalf), screenY(cam, length, yHi, zHalf));
    stands.lineTo(screenX(cam, length, zHalf), screenY(cam, length, yLo, zHalf));
    stands.lineTo(screenX(cam, length, -zHalf), screenY(cam, length, yLo, -zHalf));
    stands.close();
  };
  quad(0, 1.6, wallZ);
  quad(1.6, 2.4, hs * 0.8);

  // The lane: two lines from the character to the target's baseline and the baseline across.
  const lane = Skia.PathBuilder.Make();
  const laneHalf = Math.max(1.0, def.target.halfWidth * 1.4);
  const x0 = def.field.origin.x - 0.6;
  const x1 = Math.min(length - 0.2, def.target.center.x + 0.8);
  for (const z of [-laneHalf, laneHalf]) {
    lane.moveTo(screenX(cam, x0, z), screenY(cam, x0, 0, z));
    lane.lineTo(screenX(cam, x1, z), screenY(cam, x1, 0, z));
  }
  lane.moveTo(screenX(cam, x1, -laneHalf), screenY(cam, x1, 0, -laneHalf));
  lane.lineTo(screenX(cam, x1, laneHalf), screenY(cam, x1, 0, laneHalf));
  return { stands: stands.detach(), floor: floor.detach(), floorEdge: edge.detach(), lane: lane.detach() };
}
