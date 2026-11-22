/**
 * The light screen shake on a streak milestone: a short damped wobble of the whole canvas, scaled up a hair while it moves so the
 * edges never show. Only the planner (fx/hitPlan.ts) asks for one, throttled; Reduce Motion turns it off.
 * Owner of this file: the "juice" agent.
 */
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

/** A shake: when it starts (wall ms) and its strength in points. */
export interface ShakeRec {
  atMs: number;
  amp: number;
}

const SHAKE_MS = 320;

export function useShakeTransform(clock: SharedValue<number>, shake: SharedValue<ShakeRec>, width: number, height: number, reduced: boolean) {
  const cx = width / 2;
  const cy = height / 2;
  const span = Math.min(width, height);
  return useDerivedValue(() => {
    clock.value;
    const s = shake.value;
    const age = Date.now() - s.atMs;
    if (reduced || s.amp <= 0 || age < 0 || age >= SHAKE_MS) {
      return [{ translateX: cx }, { translateY: cy }, { scale: 1 }, { translateX: -cx }, { translateY: -cy }];
    }
    const u = age / SHAKE_MS;
    const e = (1 - u) * (1 - u);
    const dx = s.amp * e * Math.sin(age * 0.11);
    const dy = s.amp * e * 0.6 * Math.sin(age * 0.083 + 1);
    const sc = 1 + (2.4 * s.amp * e) / span;
    // Scale about the center, then offset.
    return [{ translateX: cx + dx }, { translateY: cy + dy }, { scale: sc }, { translateX: -cx }, { translateY: -cy }];
  });
}
