/**
 * Every ball in flight, rebuilt on the UI thread each frame from the engine's segments and sorted into three depth groups so the
 * target and the character occlude correctly: far (behind the board), mid, near (in front of the character). One path of flat
 * ellipses on the floor is the shadows.
 * Owner of this file: the "juice" agent.
 */
import { Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { colors } from '@/ui/theme';

import { flatRatio, scaleAt, screenX, screenY, type Camera } from '../camera';
import { addBall, BallPaint, ballColors, detachBall, makeBall, type BallPathSet } from './ballLook';

/** A ball on the UI thread: flat segment numbers [t0, t1, x, y, z, vx, vy, vz, gy] × n, plus when it stops being drawn. */
export interface BallRec {
  startMs: number;
  seg: number[];
  end: number;
  r: number;
}

export const SEG = 9;

export interface BallFrame {
  far: BallPathSet;
  mid: BallPathSet;
  near: BallPathSet;
  shadow: SkPath;
}

export function useBallFrame(args: { clock: SharedValue<number>; balls: SharedValue<BallRec[]>; cam: Camera; farDepth: number; nearDepth: number }) {
  const { clock, balls, cam, farDepth, nearDepth } = args;
  return useDerivedValue(() => {
    clock.value;
    const nowMs = Date.now();
    const list = balls.value;
    const far = makeBall();
    const mid = makeBall();
    const near = makeBall();
    const shadow = Skia.PathBuilder.Make();
    for (let i = 0; i < list.length; i++) {
      const b = list[i]!;
      const t = (nowMs - b.startMs) / 1000;
      const seg = b.seg;
      const n = seg.length / SEG;
      if (n === 0 || t < seg[0]! || t >= b.end) continue;
      let k = n - 1;
      for (let j = 0; j < n; j++) {
        if (t < seg[j * SEG + 1]!) {
          k = j;
          break;
        }
      }
      const o = k * SEG;
      const dt = Math.min(t, seg[o + 1]!) - seg[o]!;
      const x = seg[o + 2]! + seg[o + 5]! * dt;
      const y = seg[o + 3]! + seg[o + 6]! * dt + 0.5 * seg[o + 8]! * dt * dt;
      const z = seg[o + 4]! + seg[o + 7]! * dt;
      const s = scaleAt(cam, x, z);
      const sx = screenX(cam, x, z);
      const sy = screenY(cam, x, y, z);
      let rp = b.r * s;
      if (rp < 2) rp = 2;
      addBall(x >= farDepth ? far : x < nearDepth ? near : mid, sx, sy, rp);
      const ry = rp * flatRatio(cam, x, 0, z);
      const sy0 = screenY(cam, x, 0, z);
      shadow.addOval({ x: sx - rp, y: sy0 - ry, width: 2 * rp, height: 2 * ry });
    }
    return { far: detachBall(far), mid: detachBall(mid), near: detachBall(near), shadow: shadow.detach() };
  });
}

export function BallShadows({ frame }: { frame: SharedValue<BallFrame> }) {
  const shadow = useDerivedValue(() => frame.value.shadow);
  return <Path path={shadow} color={colors.ink} opacity={0.22} />;
}

export function BallGroup({ frame, depth, sportId }: { frame: SharedValue<BallFrame>; depth: 'far' | 'mid' | 'near'; sportId: string }) {
  const look = useMemo(() => ballColors(sportId), [sportId]);
  const ink = useDerivedValue(() => frame.value[depth].ink);
  const shade = useDerivedValue(() => frame.value[depth].shade);
  const body = useDerivedValue(() => frame.value[depth].body);
  const light = useDerivedValue(() => frame.value[depth].light);
  return <BallPaint ink={ink} shade={shade} body={body} light={light} look={look} />;
}
