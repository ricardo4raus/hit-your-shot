/**
 * Haptics behind the player's setting, and the money pill's pop (now or at a future hit's time). Never throws. The setting is read
 * through a getter so this file does not import the store.
 */
import * as Haptics from 'expo-haptics';
import { makeMutable, withSequence, withTiming } from 'react-native-reanimated';

/** Scale of the money pill; the play field pops it on a hit, the top bar animates with it. */
export const moneyPulse = makeMutable(1);
let lastPulseAt = 0;
const PULSE_MIN_GAP_MS = 110;

/** A hit happened: the money pill pops 1.12 and settles. Throttled, so a flood of hits is one steady pulse. */
export function pulseMoney(now: number): void {
  if (now - lastPulseAt < PULSE_MIN_GAP_MS) return;
  lastPulseAt = now;
  moneyPulse.value = withSequence(withTiming(1.12, { duration: 70 }), withTiming(1, { duration: 160 }));
}

let lastScheduledAt = 0;

/**
 * A hit will happen at wall time `atMs` (shots are resolved when fired, the ball lands later): the pill pops then. Throttled like
 * pulseMoney, on the hit times, so a flood of future hits schedules one timer per gap, not one per hit.
 */
export function pulseMoneyAt(atMs: number): void {
  if (Math.abs(atMs - lastScheduledAt) < PULSE_MIN_GAP_MS) return;
  lastScheduledAt = atMs;
  const delay = atMs - Date.now();
  if (delay <= 0) pulseMoney(Date.now());
  else setTimeout(() => pulseMoney(Date.now()), delay);
}

let enabled = (): boolean => true;

/** The store registers its settings getter once at init. */
export function setHapticsGetter(get: () => boolean): void {
  enabled = get;
}

/** A press, a purchase. */
export function lightHaptic(): void {
  if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A hit tick: soft, may be called often but the store throttles it. */
export function tickHaptic(): void {
  if (enabled()) Haptics.selectionAsync().catch(() => {});
}

/** A new best round. */
export function mediumHaptic(): void {
  if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** A character walks in. */
export function heavyHaptic(): void {
  if (enabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}
