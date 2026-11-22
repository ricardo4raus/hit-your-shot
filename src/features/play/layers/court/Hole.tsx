/**
 * The golf hole: a putting green (lighter fringe ring, a lit center toward the key light), the cup with a white lip, and the flag: a
 * white pole in two tones and a red pennant with a wave, a shade band and a highlight, fluttering gently on the UI thread. The flag's
 * shadow falls on the green to the right. Green, cup and flag move together: the hole sits at a new lateral spot every round.
 */
import { Group, Path, RadialGradient, Skia, vec, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';

import type { SportDef } from '@/engine';
import { border, colors } from '@/ui/theme';

import { scaleAt, screenX, screenY, type Camera } from '../../camera';
import type { TargetLayerProps } from '../shared';
import { floorSpot } from './geometry';
import { useHitPulse, useTargetSlide } from './motion';
import { SoftSpot, type Spot } from './SoftSpot';
import { alpha, course as C } from './worldPalette';

/** The cup seen nearly edge-on would vanish; its ellipse is never flatter than this (height over width). */
const MIN_TILT = 0.32;
const POLE_H = 2.1;

export function Hole({ def, cam, clock, phase, hits }: TargetLayerProps) {
  const h = useMemo(() => buildHole(def, cam), [def, cam]);
  const slide = useTargetSlide(def, cam, clock, phase, def.target.center.x);
  const pulse = useHitPulse(clock, hits, 0.5);
  const { poleX, flagY } = h;
  // The pennant flutters: a slow stretch along its length, stronger right after a hit.
  const flutter = useDerivedValue(() => {
    const t = clock.value / 1000;
    const k = 1 + 0.05 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 5.1) + 0.12 * pulse.value;
    const skew = 0.04 * Math.sin(t * 1.7);
    return [{ translateX: poleX }, { translateY: flagY }, { scaleX: k }, { skewY: skew }, { translateX: -poleX }, { translateY: -flagY }];
  });
  const b2 = 2 * border.width;
  return (
    <Group transform={slide}>
      <Path path={h.fringe} color={C.fringe} />
      <Path path={h.green} color={C.green}>
        <RadialGradient c={vec(h.greenCenter.x, h.greenCenter.y)} r={h.greenR} colors={[C.greenLight, C.green, C.green]} positions={[0, 0.55, 1]} />
      </Path>
      <Path path={h.mow} color={alpha('#FFFFFF', 0.12)} style="stroke" strokeWidth={2} />
      <Path path={h.flagShadow} color={alpha(C.shadow, 0.22)} />
      <SoftSpot spot={h.poleShadow} color={C.shadow} opacity={0.3} />

      <Path path={h.lip} color={C.cupLip} />
      <Path path={h.cup} color={C.cup} />
      <Path path={h.cupBack} color={alpha('#FFFFFF', 0.25)} />

      <Path path={h.pole} color={colors.ink} style="stroke" strokeWidth={h.poleW + b2} strokeCap="round" />
      <Path path={h.pole} color={C.pole} style="stroke" strokeWidth={h.poleW} strokeCap="round" />
      <Path path={h.poleShade} color={C.poleShade} style="stroke" strokeWidth={Math.max(1, h.poleW * 0.4)} strokeCap="round" />
      <Group transform={flutter}>
        <Path path={h.flag} color={colors.ink} style="stroke" strokeWidth={b2} strokeJoin="round" />
        <Path path={h.flag} color={C.flag} />
        <Path path={h.flagShade} color={C.flagShade} />
        <Path path={h.flagLight} color={C.flagLight} />
      </Group>
      <Path path={h.tip} color={colors.ink} />
      <Path path={h.tipFill} color={colors.cash} />
    </Group>
  );
}

interface HolePaths {
  poleX: number;
  flagY: number;
  fringe: SkPath;
  green: SkPath;
  greenCenter: { x: number; y: number };
  greenR: number;
  mow: SkPath;
  flagShadow: SkPath;
  poleShadow: Spot;
  lip: SkPath;
  cup: SkPath;
  cupBack: SkPath;
  pole: SkPath;
  poleShade: SkPath;
  poleW: number;
  flag: SkPath;
  flagShade: SkPath;
  flagLight: SkPath;
  tip: SkPath;
  tipFill: SkPath;
}

function buildHole(def: SportDef, cam: Camera): HolePaths {
  const t = def.target;
  const cx = t.center.x;
  const r = t.halfWidth;
  const s = scaleAt(cam, cx);
  const M = () => Skia.PathBuilder.Make();
  const ell = (b: ReturnType<typeof M>, sp: Spot) => b.addOval({ x: sp.cx - sp.rx, y: sp.cy - sp.ry, width: 2 * sp.rx, height: 2 * sp.ry });

  // Green and fringe: flat discs around the cup, a little deeper than wide so the green reads as a green and not a stripe.
  const fringe = M();
  const green = M();
  const mow = M();
  const gr = 2.5;
  ell(fringe, floorSpot(cam, cx + 0.3, 0, gr + 0.35));
  const gs = floorSpot(cam, cx + 0.3, 0, gr);
  ell(green, gs);
  for (const k of [0.45, 0.75]) ell(mow, floorSpot(cam, cx + 0.3, 0, gr * k));

  // Cup with its lip; the ellipse keeps a minimum tilt so the hole stays readable from a low camera.
  const px = screenX(cam, cx, 0);
  const py = screenY(cam, cx, 0);
  const rx = Math.max(4, r * s);
  const ry = Math.max(rx * MIN_TILT, rx * Math.min(1, Math.abs(cam.y) / Math.max(1, cx - cam.x)));
  const lip = M();
  const cup = M();
  const cupBack = M();
  lip.addOval({ x: px - rx * 1.4, y: py - ry * 1.4, width: rx * 2.8, height: ry * 2.8 });
  cup.addOval({ x: px - rx, y: py - ry, width: 2 * rx, height: 2 * ry });
  cupBack.addOval({ x: px - rx * 0.8, y: py - ry * 0.95, width: rx * 1.6, height: ry * 0.8 });

  // Pole: white with a shade line on its right, a yellow ball on top.
  const top = screenY(cam, cx, POLE_H);
  const poleW = Math.max(3, 0.05 * s);
  const pole = M();
  pole.moveTo(px, py);
  pole.lineTo(px, top);
  const poleShade = M();
  poleShade.moveTo(px + poleW * 0.22, py - 2);
  poleShade.lineTo(px + poleW * 0.22, top + 2);
  const tip = M();
  const tipFill = M();
  tip.addCircle(px, top - poleW * 0.4, poleW * 0.9 + border.width);
  tipFill.addCircle(px, top - poleW * 0.4, poleW * 0.9);

  // Pennant: from the pole top down 0.45 m, out 0.8 m to the right, with a wave along both edges.
  const fl = 0.8 * s;
  const fh = 0.45 * s;
  const y0 = top + poleW * 0.6;
  const wave = 0.08 * s;
  const edge = (b: ReturnType<typeof M>, k0: number, k1: number) => {
    // A band of the pennant between fractions k0 and k1 of its height (0 = top edge), tapering to the tip.
    const ya = (k: number, u: number) => y0 + fh * 0.5 * u + (fh * (1 - u) * k) + wave * Math.sin(u * Math.PI * 1.6);
    b.moveTo(px, ya(k0, 0));
    for (let i = 1; i <= 12; i++) {
      const u = i / 12;
      b.lineTo(px + fl * u, ya(k0, u));
    }
    for (let i = 12; i >= 0; i--) {
      const u = i / 12;
      b.lineTo(px + fl * u, ya(k1, u));
    }
    b.close();
  };
  const flag = M();
  edge(flag, 0, 1);
  const flagShade = M();
  edge(flagShade, 0.68, 1);
  const flagLight = M();
  edge(flagLight, 0.04, 0.2);

  // The flag's shadow: a slanted sliver on the green to the right of the pole.
  const flagShadow = M();
  const sl = 1.6 * s;
  flagShadow.moveTo(px + 2, py);
  flagShadow.lineTo(px + sl, py - 0.05 * s);
  flagShadow.lineTo(px + sl + 0.5 * s, py - 0.03 * s);
  flagShadow.lineTo(px + sl * 0.9 + 0.5 * s, py + 0.02 * s);
  flagShadow.lineTo(px + 2, py + 0.025 * s);
  flagShadow.close();
  const poleShadow = floorSpot(cam, cx + 0.05, 0.15, 0.28);

  return {
    poleX: px,
    flagY: y0,
    fringe: fringe.detach(),
    green: green.detach(),
    greenCenter: { x: gs.cx - gs.rx * 0.3, y: gs.cy - gs.ry * 0.3 },
    greenR: gs.rx,
    mow: mow.detach(),
    flagShadow: flagShadow.detach(),
    poleShadow,
    lip: lip.detach(),
    cup: cup.detach(),
    cupBack: cupBack.detach(),
    pole: pole.detach(),
    poleShade: poleShade.detach(),
    poleW,
    flag: flag.detach(),
    flagShade: flagShade.detach(),
    flagLight: flagLight.detach(),
    tip: tip.detach(),
    tipFill: tipFill.detach(),
  };
}
