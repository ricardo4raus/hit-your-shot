/**
 * Hit feedback drawn in the play field (design rules section 9, "Hit"). Today: a ring spreads from the rim and fades.
 * Owner of this file: the "juice" agent.
 */
import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { SportDef } from '@/engine';
import { border, sportColors } from '@/ui/theme';

import { flatRatio, scaleAt, screenX, screenY, type Camera } from '../camera';
import type { HitRec } from './shared';

/** How long the hit feedback lasts, seconds. */
export const HIT_SEC = 0.6;

export function HitFx({ def, sportId, cam, clock, hits }: { def: SportDef; sportId: string; cam: Camera; clock: SharedValue<number>; hits: SharedValue<HitRec[]> }) {
  const palette = sportColors[sportId as keyof typeof sportColors];
  const cx = def.target.center.x;
  const cy = def.target.center.y;
  const rings = useDerivedValue(() => {
    clock.value;
    const nowMs = Date.now();
    const list = hits.value;
    const p = Skia.PathBuilder.Make();
    for (let i = 0; i < list.length; i++) {
      const h = list[i]!;
      const u = (nowMs - h.atMs) / 1000 / HIT_SEC;
      if (u < 0 || u >= 0.5) continue;
      const s = scaleAt(cam, cx, h.z);
      const rx = def.target.halfWidth * s * (1 + 1.2 * u);
      const ry = rx * flatRatio(cam, cx, cy, h.z);
      p.addOval({ x: screenX(cam, cx, h.z) - rx, y: screenY(cam, cx, cy, h.z) - ry, width: 2 * rx, height: 2 * ry });
    }
    return p.detach();
  });
  return <Path path={rings} color={palette.target} style="stroke" strokeWidth={border.width} opacity={0.7} />;
}
