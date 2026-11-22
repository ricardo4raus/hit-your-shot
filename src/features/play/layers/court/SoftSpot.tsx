/**
 * A soft elliptical spot: a radial gradient squashed into an ellipse. Used for contact shadows and pools of light on the floor and for
 * glows around lamps. Cheaper than a blur on the GPU (one gradient fill, no offscreen pass), so it is safe to draw every frame.
 */
import { Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';

import { alpha } from './worldPalette';

export interface Spot {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export function SoftSpot({ spot, color, opacity, core = 0.45 }: { spot: Spot; color: string; opacity: number; core?: number }) {
  if (!(spot.rx > 0.5) || !(spot.ry > 0.2)) return null;
  return (
    <Group transform={[{ translateX: spot.cx }, { translateY: spot.cy }, { scaleY: spot.ry / spot.rx }]}>
      <Circle cx={0} cy={0} r={spot.rx}>
        <RadialGradient c={vec(0, 0)} r={spot.rx} colors={[alpha(color, opacity), alpha(color, opacity * 0.55), alpha(color, 0)]} positions={[0, core, 1]} />
      </Circle>
    </Group>
  );
}
