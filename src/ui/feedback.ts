/** Haptics behind the player's setting. Never throws. The setting is read through a getter so this file does not import the store. */
import * as Haptics from 'expo-haptics';

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
