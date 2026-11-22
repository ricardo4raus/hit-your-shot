/**
 * Every ball in flight, rebuilt on the UI thread each frame from the engine's segments and sorted into three depth groups so the
 * target and the character occlude correctly: far (behind the board), mid, near (in front of the character).
 * Per ball, all batched into a few paths per group: a short tapered motion trail when it moves fast, a fire trail and halo while the
 * shooter is on a hit streak, the ball itself (ballLook.tsx) with markings turning with its spin, a squash on a floor bounce. A missed
 * ball shrinks away soon after its first floor contact so the court never fills with lingering balls (visual only: the engine's timing
 * is untouched). Two shadow paths on the floor: a wide soft one that shrinks as the ball rises, and a dark contact one near the floor.
 * Owner of this file: the "juice" agent.
 */
import { Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { colors } from '@/ui/theme';

import { fx } from '../fx/palette';
import { flatRatio, scaleAt, screenX, screenY, type Camera } from '../camera';
import { addBall, BallPaint, ballColors, detachBall, makeBall, type BallBuilders, type BallPathSet } from './ballLook';

/**
 * A ball on the UI thread: flat segment numbers [t0, t1, x, y, z, vx, vy, vz, gy] × n, when it stops being drawn (round seconds), its
 * radius in meters, when it starts shrinking away (round seconds; a large number for none), whether it flies on fire, and its spin.
 */
export interface BallRec {
  startMs: number;
  seg: number[];
  end: number;
  r: number;
  fadeAt: number;
  fire: number;
  /** Radians per second the markings turn; the sign is the direction. */
  spin: number;
}

export const SEG = 9;
/** A missed ball shrinks away over this many seconds once it starts fading. */
export const FADE_SEC = 0.32;
/** How long after its first floor contact a missed ball starts fading. */
export const FADE_DELAY_SEC = 0.12;
/** Motion trail length in seconds of flight, and the screen speed (ball radii per trail length) below which none is drawn. */
const TRAIL_SEC = 0.045;
const TRAIL_MIN = 1.4;
const FIRE_SEC = 0.11;
/** A floor bounce squashes the ball for this long. */
const SQUASH_SEC = 0.07;
const SQUASH_MAX = 0.28;

type Builder = ReturnType<typeof Skia.PathBuilder.Make>;

interface GroupBuilders {
  ball: BallBuilders;
  trail: Builder;
  fireOuter: Builder;
  fireCore: Builder;
}

export interface BallGroupPaths extends BallPathSet {
  trail: SkPath;
  fireOuter: SkPath;
  fireCore: SkPath;
}

export interface BallFrame {
  far: BallGroupPaths;
  mid: BallGroupPaths;
  near: BallGroupPaths;
  shadow: SkPath;
  contact: SkPath;
}

function makeGroup(): GroupBuilders {
  'worklet';
  return { ball: makeBall(), trail: Skia.PathBuilder.Make(), fireOuter: Skia.PathBuilder.Make(), fireCore: Skia.PathBuilder.Make() };
}

function detachGroup(g: GroupBuilders): BallGroupPaths {
  'worklet';
  const b = detachBall(g.ball);
  return { ...b, trail: g.trail.detach(), fireOuter: g.fireOuter.detach(), fireCore: g.fireCore.detach() };
}

/** A tapered streak from the ball's center back to a tail point: a triangle whose wide end the ball covers. */
function addStreak(p: Builder, hx: number, hy: number, tx: number, ty: number, w: number): void {
  'worklet';
  const dx = hx - tx;
  const dy = hy - ty;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.5) return;
  const nx = (-dy / d) * w;
  const ny = (dx / d) * w;
  p.moveTo(hx + nx, hy + ny);
  p.lineTo(tx, ty);
  p.lineTo(hx - nx, hy - ny);
  p.close();
}

export function useBallFrame(args: { clock: SharedValue<number>; balls: SharedValue<BallRec[]>; cam: Camera; farDepth: number; nearDepth: number; kind: number }) {
  const { clock, balls, cam, farDepth, nearDepth, kind } = args;
  return useDerivedValue(() => {
    clock.value;
    const nowMs = Date.now();
    const list = balls.value;
    const far = makeGroup();
    const mid = makeGroup();
    const near = makeGroup();
    const shadow = Skia.PathBuilder.Make();
    const contact = Skia.PathBuilder.Make();
    for (let i = 0; i < list.length; i++) {
      const b = list[i]!;
      const t = (nowMs - b.startMs) / 1000;
      const seg = b.seg;
      const n = seg.length / SEG;
      if (n === 0 || t < seg[0]! || t >= b.end) continue;
      // Shrinking away after a miss.
      let life = 1;
      if (t > b.fadeAt) {
        life = 1 - (t - b.fadeAt) / FADE_SEC;
        if (life <= 0) continue;
        life = life * (2 - life);
      }
      let k = n - 1;
      for (let j = 0; j < n; j++) {
        if (t < seg[j * SEG + 1]!) {
          k = j;
          break;
        }
      }
      const o = k * SEG;
      const t0 = seg[o]!;
      const dt = Math.min(t, seg[o + 1]!) - t0;
      const vx = seg[o + 5]!;
      const vy0 = seg[o + 6]!;
      const vz = seg[o + 7]!;
      const gy = seg[o + 8]!;
      const x = seg[o + 2]! + vx * dt;
      const y = seg[o + 3]! + vy0 * dt + 0.5 * gy * dt * dt;
      const z = seg[o + 4]! + vz * dt;
      const s = scaleAt(cam, x, z);
      const sx = screenX(cam, x, z);
      const sy = screenY(cam, x, y, z);
      let rp = b.r * s;
      if (rp < 2) rp = 2;
      rp *= life;
      const g = x >= farDepth ? far : x < nearDepth ? near : mid;

      // Trails: the same segment's parabola a moment earlier (clamped to the segment start, so a bounce shortens the trail).
      if (life === 1) {
        const span = b.fire > 0 ? FIRE_SEC : TRAIL_SEC;
        const tb = dt - span > 0 ? dt - span : 0;
        const bx = seg[o + 2]! + vx * tb;
        const by = seg[o + 3]! + vy0 * tb + 0.5 * gy * tb * tb;
        const bz = seg[o + 4]! + vz * tb;
        const tx = screenX(cam, bx, bz);
        const ty = screenY(cam, bx, by, bz);
        const ddx = sx - tx;
        const ddy = sy - ty;
        const d2 = ddx * ddx + ddy * ddy;
        if (b.fire > 0) {
          if (d2 > rp * rp) {
            const flick = 1 + 0.22 * Math.sin(nowMs * 0.031 + i * 1.7);
            const ex = sx - ddx * flick;
            const ey = sy - ddy * flick;
            addStreak(g.fireOuter, sx, sy, ex, ey, rp * 1.3);
            addStreak(g.fireCore, sx, sy, sx - ddx * 0.6 * flick, sy - ddy * 0.6 * flick, rp * 0.75);
          }
          g.fireOuter.addCircle(sx, sy, rp * 1.22);
          g.fireCore.addCircle(sx, sy, rp * 1.08);
        } else if (d2 > TRAIL_MIN * TRAIL_MIN * rp * rp) {
          addStreak(g.trail, sx, sy, tx, ty, rp * 0.62);
        }
      }

      // Squash just after a floor bounce: the segment starts on the floor going up.
      let squash = 0;
      if (k > 0 && seg[o + 3]! <= b.r * 1.05 + 0.005 && vy0 > 0.6 && dt < SQUASH_SEC) {
        const u = 1 - dt / SQUASH_SEC;
        const hard = vy0 > 3 ? 1 : vy0 / 3;
        squash = SQUASH_MAX * u * u * hard;
      }
      const angle = b.spin * (t - seg[0]!) + i;
      addBall(g.ball, sx, sy, rp, angle, kind, squash);

      // Shadows: a soft one that shrinks as the ball rises, and a dark contact one when it is near the floor.
      const h = y - b.r;
      const ry0 = flatRatio(cam, x, 0, z);
      const sy0 = screenY(cam, x, 0, z);
      let soft = 1 - h / 5;
      if (soft < 0.3) soft = 0.3;
      const srx = rp * 1.25 * soft;
      const sry = srx * ry0;
      shadow.addOval({ x: sx - srx, y: sy0 - sry, width: 2 * srx, height: 2 * sry });
      if (h < 2.5 * b.r) {
        const c = 1 - h / (2.5 * b.r);
        const crx = rp * (0.55 + 0.35 * c) * (1 + 0.5 * squash);
        const cry = crx * ry0;
        contact.addOval({ x: sx - crx, y: sy0 - cry, width: 2 * crx, height: 2 * cry });
      }
    }
    return { far: detachGroup(far), mid: detachGroup(mid), near: detachGroup(near), shadow: shadow.detach(), contact: contact.detach() };
  });
}

export function BallShadows({ frame }: { frame: SharedValue<BallFrame> }) {
  const shadow = useDerivedValue(() => frame.value.shadow);
  const contact = useDerivedValue(() => frame.value.contact);
  return (
    <>
      <Path path={shadow} color={colors.ink} opacity={0.16} />
      <Path path={contact} color={colors.ink} opacity={0.3} />
    </>
  );
}

export function BallGroup({ frame, depth, sportId }: { frame: SharedValue<BallFrame>; depth: 'far' | 'mid' | 'near'; sportId: string }) {
  const look = useMemo(() => ballColors(sportId), [sportId]);
  const trail = useDerivedValue(() => frame.value[depth].trail);
  const fireOuter = useDerivedValue(() => frame.value[depth].fireOuter);
  const fireCore = useDerivedValue(() => frame.value[depth].fireCore);
  const ink = useDerivedValue(() => frame.value[depth].ink);
  const shade = useDerivedValue(() => frame.value[depth].shade);
  const body = useDerivedValue(() => frame.value[depth].body);
  const light = useDerivedValue(() => frame.value[depth].light);
  const spec = useDerivedValue(() => frame.value[depth].spec);
  const seam = useDerivedValue(() => frame.value[depth].seam);
  const patch = useDerivedValue(() => frame.value[depth].patch);
  return (
    <>
      <Path path={trail} color={fx.white} opacity={0.32} />
      <Path path={fireOuter} color={fx.flame} opacity={0.75} />
      <Path path={fireCore} color={fx.spark} opacity={0.95} />
      <BallPaint ink={ink} shade={shade} body={body} light={light} spec={spec} seam={seam} patch={patch} look={look} />
    </>
  );
}
