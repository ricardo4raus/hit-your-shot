/**
 * Hit feedback drawn in the play field (design rules section 9, "Hit"): a quick bright flash with a glow where the ball went in, a
 * ring that spreads from the rim (flat like the rim for the hoop and the hole, upright for the goal) and a burst of sparks and confetti
 * in warm colors that flies up, falls with gravity and shrinks away. Never a coin rising from the hoop (owner 2026-11-22).
 * Stateless and cheap: each particle's path is a closed formula of the hit's time and a hash of its index, all particles of all live
 * hits go into three paths, and only hits that passed the planner's throttle (HitRec.fx, fx/hitPlan.ts) burst, so a flood of hits at
 * high fire rates stays a steady sparkle. Reduce Motion thins the particles.
 * Owner of this file: the "juice" agent.
 */
import { BlurMask, Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { SportDef } from '@/engine';

import { fx } from '../fx/palette';
import { flatRatio, scaleAt, screenX, screenY, type Camera } from '../camera';
import type { HitRec } from './shared';

/** How long the hit feedback lasts, seconds. */
export const HIT_SEC = 0.75;
const FLASH_SEC = 0.16;
const RING_SEC = 0.34;
/** Particles per burst (a streak milestone gets more). */
const PARTS = 16;
const PARTS_BIG = 30;
const GRAVITY = 9.81;
/** Horizontal drag of the particles, 1/s. */
const DRAG = 2.6;

function hash(a: number, b: number): number {
  'worklet';
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

export interface HitFxProps {
  def: SportDef;
  sportId: string;
  cam: Camera;
  clock: SharedValue<number>;
  hits: SharedValue<HitRec[]>;
  /** Reduce Motion: fewer particles. */
  reduced?: boolean;
}

export function HitFx({ def, cam, clock, hits, reduced = false }: HitFxProps) {
  const cx = def.target.center.x;
  const cy = def.target.center.y;
  const kind = def.target.kind;
  const halfWidth = def.target.halfWidth;
  const thin = reduced ? 3 : 1;
  const frame = useDerivedValue(() => {
    clock.value;
    const nowMs = Date.now();
    const list = hits.value;
    const ring = Skia.PathBuilder.Make();
    const flash = Skia.PathBuilder.Make();
    const core = Skia.PathBuilder.Make();
    const spark = Skia.PathBuilder.Make();
    const confA = Skia.PathBuilder.Make();
    const confB = Skia.PathBuilder.Make();
    for (let i = 0; i < list.length; i++) {
      const h = list[i]!;
      if (h.fx <= 0) continue;
      const age = (nowMs - h.atMs) / 1000;
      if (age < 0 || age >= HIT_SEC) continue;
      const big = h.fx >= 2;
      // The ring and flash sit on the rim (hoop), at the hole, or where the ball crossed the goal line.
      const rx0 = kind === 'goal' ? h.bx : cx;
      const ry0 = kind === 'goal' ? h.by : kind === 'hole' ? 0 : cy;
      const rz0 = kind === 'goal' ? h.bz : h.z;
      const s = scaleAt(cam, rx0, rz0);
      const px = screenX(cam, rx0, rz0);
      const py = screenY(cam, rx0, ry0, rz0);
      const flat = kind === 'goal' ? 1 : flatRatio(cam, rx0, ry0, rz0) * 1.15;
      const ringBase = (kind === 'goal' ? 0.35 : halfWidth) * s;
      if (age < RING_SEC) {
        const u = age / RING_SEC;
        const ease = 1 - (1 - u) * (1 - u);
        const outer = ringBase * (1 + (big ? 1.9 : 1.2) * ease);
        const thick = ringBase * (big ? 0.5 : 0.36) * (1 - u);
        const inner = outer - thick;
        ring.addOval({ x: px - outer, y: py - outer * flat, width: 2 * outer, height: 2 * outer * flat });
        ring.addOval({ x: px - inner, y: py - inner * flat, width: 2 * inner, height: 2 * inner * flat }, true);
      }
      if (age < FLASH_SEC) {
        const u = age / FLASH_SEC;
        const fr = ringBase * (big ? 1.25 : 0.9) * (0.55 + 0.9 * u) * (1 - u * u);
        flash.addOval({ x: px - fr, y: py - fr * 0.75, width: 2 * fr, height: 1.5 * fr });
        const cr = 0.45 * fr;
        core.addOval({ x: px - cr, y: py - cr * 0.75, width: 2 * cr, height: 1.5 * cr });
      }
      // The burst: from where the ball crossed (the rim for the hoop), up and out, then falling.
      const bs = scaleAt(cam, h.bx, h.bz);
      const bx = kind === 'hoop' ? px : screenX(cam, h.bx, h.bz);
      const by = kind === 'hoop' ? py : screenY(cam, h.bx, h.by, h.bz);
      const count = Math.floor((big ? PARTS_BIG : PARTS) / thin);
      const seed = (h.atMs % 100000) * 0.0137 + h.streak * 0.31;
      const k = (1 - Math.exp(-DRAG * age)) / DRAG;
      for (let j = 0; j < count; j++) {
        const r1 = hash(seed, j);
        const r2 = hash(seed + 3.1, j);
        const r3 = hash(seed + 7.7, j);
        const r4 = hash(seed + 11.3, j);
        const life = HIT_SEC * (0.55 + 0.45 * r4);
        if (age >= life) continue;
        const u = age / life;
        const theta = r1 * 2 * Math.PI;
        const sp = (0.7 + 2.3 * r2) * (big ? 1.45 : 1);
        const up = (1.4 + 2.8 * r3) * (big ? 1.25 : 1);
        const x = bx + Math.cos(theta) * sp * bs * k;
        const y = by + Math.sin(theta) * sp * bs * 0.35 * k - up * bs * age + 0.5 * GRAVITY * bs * age * age;
        const fade = 1 - u * u;
        const bucket = j % 4;
        if (bucket < 2) {
          spark.addCircle(x, y, (0.026 + 0.02 * r2) * bs * fade + 0.6);
        } else {
          // Confetti: a small card that tumbles (its height flips with the spin) and shrinks.
          const w = 0.045 * bs * fade;
          const spin = (r3 - 0.5) * 22 * age + r1 * 6;
          const hgt = 0.028 * bs * fade * Math.abs(Math.cos(spin * 1.3));
          const c = Math.cos(spin);
          const sn = Math.sin(spin);
          const ax = c * w;
          const ay = sn * w;
          const bxv = -sn * hgt;
          const byv = c * hgt;
          const p = bucket === 2 ? confA : confB;
          p.moveTo(x - ax - bxv, y - ay - byv);
          p.lineTo(x + ax - bxv, y + ay - byv);
          p.lineTo(x + ax + bxv, y + ay + byv);
          p.lineTo(x - ax + bxv, y - ay + byv);
          p.close();
        }
      }
    }
    return { ring: ring.detach(), flash: flash.detach(), core: core.detach(), spark: spark.detach(), confA: confA.detach(), confB: confB.detach() };
  });
  const ring = useDerivedValue(() => frame.value.ring);
  const flash = useDerivedValue(() => frame.value.flash);
  const core = useDerivedValue(() => frame.value.core);
  const spark = useDerivedValue(() => frame.value.spark);
  const confA = useDerivedValue(() => frame.value.confA);
  const confB = useDerivedValue(() => frame.value.confB);
  return (
    <>
      <Path path={ring} color={fx.spark} opacity={0.9} />
      <Path path={flash} color={fx.spark} opacity={0.85}>
        <BlurMask blur={14} style="normal" />
      </Path>
      <Path path={spark} color={fx.gold} opacity={0.8}>
        <BlurMask blur={4} style="normal" />
      </Path>
      <Path path={confA} color={fx.flame} />
      <Path path={confB} color={fx.cream} />
      <Path path={spark} color={fx.spark} />
      <Path path={core} color={fx.white} opacity={0.95}>
        <BlurMask blur={3} style="normal" />
      </Path>
    </>
  );
}
