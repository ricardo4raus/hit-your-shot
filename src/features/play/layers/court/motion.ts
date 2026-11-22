/**
 * Per-frame values the targets share, all computed on the UI thread in derived values (no React renders per frame):
 * - the target's sideways slide: smooth and continuous across rounds, because the store picks each round's phase so that the engine's
 *   sin(2π t / period + phase) equals the idle curve sin(2π wallSeconds / period) when the round starts. A target that does not move
 *   during a round (golf) sits at the round's phase;
 * - a hit pulse: 0 to 1 and back over a short time after the latest hit (net swish, rim flash, net ripple).
 */
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { SportDef } from '@/engine';

import { scaleAt, type Camera } from '../../camera';
import { TWO_PI, type HitRec } from '../shared';

/** Screen points the moving part is shifted sideways, as a transform for a Group. */
export function useTargetSlide(def: SportDef, cam: Camera, clock: SharedValue<number>, phase: SharedValue<number>, depthX: number) {
  const s = scaleAt(cam, depthX);
  const m = def.target.motion;
  return useDerivedValue(() => {
    clock.value;
    let z = 0;
    if (m.periodSec <= 0) z = m.amplitude * Math.sin(phase.value);
    else z = m.amplitude * Math.sin((TWO_PI * (Date.now() / 1000)) / m.periodSec);
    return [{ translateX: z * s }];
  });
}

/** The strongest pulse of any hit younger than `sec`: a quick rise and an eased fall. */
export function useHitPulse(clock: SharedValue<number>, hits: SharedValue<HitRec[]>, sec: number) {
  return useDerivedValue(() => {
    clock.value;
    const now = Date.now();
    const list = hits.value;
    let p = 0;
    for (let i = 0; i < list.length; i++) {
      const age = (now - list[i]!.atMs) / 1000;
      if (age < 0 || age >= sec) continue;
      const w = Math.sin((Math.PI * age) / sec) * (1 - age / sec);
      if (w > p) p = w;
    }
    return p;
  });
}

/** 1 at the moment of a hit, fading to 0 over `sec`. */
export function useHitFlash(clock: SharedValue<number>, hits: SharedValue<HitRec[]>, sec: number) {
  return useDerivedValue(() => {
    clock.value;
    const now = Date.now();
    const list = hits.value;
    let f = 0;
    for (let i = 0; i < list.length; i++) {
      const age = (now - list[i]!.atMs) / 1000;
      if (age < 0 || age >= sec) continue;
      const w = 1 - age / sec;
      if (w > f) f = w;
    }
    return f * f;
  });
}
