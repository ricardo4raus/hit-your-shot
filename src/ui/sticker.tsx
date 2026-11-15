/**
 * Cut-out surfaces and buttons (design rules sections 3 and 6): flat fill, 3 pt ink outline, hard shadow 4 pt down, no blur.
 * A pressed button drops onto its shadow. A disabled button is flat paper2 with full-contrast text.
 */
import { useCallback, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { lightHaptic } from './feedback';
import { AppText, type TextVariant } from './text';
import { border, colors, motion, radius, shadow, touch } from './theme';

export interface StickerProps {
  children?: ReactNode;
  color?: string;
  rounded?: keyof typeof radius;
  /** Hard shadow below. */
  raised?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Width, flex and margins go here; the inner view carries the fill and padding. */
  outerStyle?: StyleProp<ViewStyle>;
}

/** A flat card with an ink outline. */
export function Sticker({ children, color = colors.paper, rounded = 'card', raised = true, style, outerStyle }: StickerProps) {
  const r = radius[rounded];
  return (
    <View style={[{ paddingBottom: raised ? shadow.offset : 0 }, outerStyle]}>
      {raised ? <View style={[styles.shadow, { borderRadius: r }]} /> : null}
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

/** The pressable sticker. The face moves down onto the shadow while pressed. */
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
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: down.value * shadow.offset }] }));
  const onPressIn = useCallback(() => {
    down.value = withTiming(1, { duration: motion.pressDown });
  }, [down]);
  const onPressOut = useCallback(() => {
    down.value = withSpring(0, motion.spring);
  }, [down]);
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
      style={[{ paddingBottom: shadow.offset }, outerStyle]}
    >
      {!disabled ? <View style={[styles.shadow, { borderRadius: radius.button }]} /> : null}
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
  shadow: { position: 'absolute', left: 0, right: 0, top: shadow.offset, bottom: 0, backgroundColor: colors.ink },
  face: { borderWidth: border.width, borderColor: colors.ink },
  button: { borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
