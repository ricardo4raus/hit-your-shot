/**
 * Cut-out surfaces and buttons (design rules sections 3 and 6): flat fill, one ink outline of the same width on every side, no shadow,
 * no blur. A pressed button shrinks a little and darkens. A disabled button is flat paper2 with full-contrast text.
 * (The owner removed the hard drop shadow on 2026-11-15: it read as a thicker bottom outline.)
 */
import { useCallback, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { lightHaptic } from './feedback';
import { AppText, type TextVariant } from './text';
import { border, colors, motion, radius, touch } from './theme';

export interface StickerProps {
  children?: ReactNode;
  color?: string;
  rounded?: keyof typeof radius;
  /** Kept for callers; stickers no longer cast a shadow. */
  raised?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Width, flex and margins go here; the inner view carries the fill and padding. */
  outerStyle?: StyleProp<ViewStyle>;
}

/** A flat card with an ink outline. */
export function Sticker({ children, color = colors.paper, rounded = 'card', style, outerStyle }: StickerProps) {
  const r = radius[rounded];
  return (
    <View style={outerStyle}>
      <View style={[styles.face, { backgroundColor: color, borderRadius: r }, style]}>{children}</View>
    </View>
  );
}

export interface StickerButtonProps {
  title: string;
  /** Second line, usually the price. */
  subtitle?: string;
  color?: string;
  textColor?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: TextVariant;
  onPress?: () => void;
  haptic?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  outerStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

const HEIGHT = { sm: touch.min, md: 56, lg: 68 } as const;
const PRESSED_SCALE = 0.96;

/** The pressable sticker. The face shrinks slightly while pressed and springs back. */
export function StickerButton({
  title,
  subtitle,
  color = colors.accent,
  textColor = colors.ink,
  disabled,
  size = 'md',
  variant = 'label',
  onPress,
  haptic = true,
  accessibilityLabel,
  style,
  outerStyle,
  children,
}: StickerButtonProps) {
  const down = useSharedValue(0);
  const reduced = useReducedMotion();
  const face = useAnimatedStyle(() => ({ transform: [{ scale: 1 - down.value * (1 - PRESSED_SCALE) }] }));
  const onPressIn = useCallback(() => {
    down.value = reduced ? 1 : withTiming(1, { duration: motion.pressDown });
  }, [down, reduced]);
  const onPressOut = useCallback(() => {
    down.value = reduced ? 0 : withSpring(0, motion.spring);
  }, [down, reduced]);
  const handlePress = useCallback(() => {
    if (haptic) lightHaptic();
    onPress?.();
  }, [haptic, onPress]);

  const fill = disabled ? colors.paper2 : color;
  return (
    <Pressable
      onPress={disabled ? undefined : handlePress}
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      accessibilityState={{ disabled: !!disabled }}
      style={outerStyle}
    >
      <Animated.View style={[styles.face, styles.button, { backgroundColor: fill, minHeight: HEIGHT[size] }, face, style]}>
        {children ?? (
          <>
            <AppText variant={variant} color={textColor} center numberOfLines={1}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" color={textColor} center numberOfLines={1} tabular>
                {subtitle}
              </AppText>
            ) : null}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** Small paper pill with an ink outline: the money counter, tags. */
export function Pill({ children, color = colors.paper, style }: { children: ReactNode; color?: string; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.face, styles.pill, { backgroundColor: color }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  face: { borderWidth: border.width, borderColor: colors.ink },
  button: { borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
