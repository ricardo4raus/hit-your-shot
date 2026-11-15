/**
 * Overlays: a bottom sheet and a centered panel, both over an ink scrim at 35% (the one translucent thing the design rules allow).
 * The sheet slides up with ease-out in 280 ms and no bounce (design rules section 9); Reduce Motion keeps the fade and drops the slide.
 * The children mount only while the sheet is open, so heavy content is not computed behind a closed sheet. No library; this is enough.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { border, colors, motion, radius } from './theme';

export const SCRIM_OPACITY = 0.35;
const OUT_MS = 200;

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children?: ReactNode;
  /** Fraction of the window the panel may take. */
  maxHeightFraction?: number;
  accessibilityLabel?: string;
  /** Label of the scrim, which closes the sheet when pressed. */
  closeLabel?: string;
}

export function Sheet({ visible, onClose, children, maxHeightFraction = 0.82, accessibilityLabel, closeLabel = 'Close' }: SheetProps) {
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: motion.panelIn, easing: Easing.out(Easing.cubic) });
    } else {
      progress.value = withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, progress]);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value * SCRIM_OPACITY }));
  const panel = useAnimatedStyle(() => ({
    opacity: reduced ? progress.value : 1,
    transform: [{ translateY: reduced ? 0 : (1 - progress.value) * height }],
  }));

  if (!mounted) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.scrimLayer, scrim]}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
      </Animated.View>
      <Animated.View
        style={[styles.panel, { maxHeight: height * maxHeightFraction, paddingBottom: insets.bottom }, panel]}
        accessibilityViewIsModal
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export interface ScrimCenterProps {
  children: ReactNode;
  accessibilityLabel?: string;
}

/** A centered panel over the scrim, for the one message that must be read before anything else (the offline payout). Fades in. */
export function ScrimCenter({ children, accessibilityLabel }: ScrimCenterProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: motion.panelIn, easing: Easing.out(Easing.cubic) });
  }, [progress]);
  const scrim = useAnimatedStyle(() => ({ opacity: progress.value * SCRIM_OPACITY }));
  const body = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: reduced ? 1 : 0.94 + 0.06 * progress.value }],
  }));
  return (
    <View style={styles.root}>
      <Animated.View style={[styles.scrimLayer, scrim]} />
      <Animated.View style={[styles.center, body]} accessibilityViewIsModal accessibilityLabel={accessibilityLabel}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' },
  scrimLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.ink },
  fill: { flex: 1 },
  panel: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: border.width,
    borderBottomWidth: 0,
    borderColor: colors.ink,
  },
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
});
