/**
 * Chunky 3D surfaces in the "polished arcade" style (design rules, 2026-11-22): one ink outline around the whole shape, a face lit from
 * above (a vertical gradient from a lighter top to the base color, plus a soft gloss band) and a darker lip of the same hue under it.
 * A button press pushes the face down onto its lip; Reduce Motion makes the push instant instead of springy. Button labels are Lilita
 * One with an ink outline; prices are the coin and Nunito digits (owner 2026-11-19). A disabled button is a cool grey face with
 * full-contrast lettering. Gradients are plain `backgroundImage` styles (React Native 0.88 and the web both draw them), so no canvas.
 */
import { useCallback, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { lightHaptic } from './feedback';
import { Money } from './money';
import { AppText, OutlinedText } from './text';
import { border, colors, depth, drop, font, lightness, motion, radius, tones, touch, vgrad } from './theme';

export interface StickerProps {
  children?: ReactNode;
  color?: string;
  rounded?: keyof typeof radius;
  /** Draws the gloss band across the top of the face. */
  gloss?: boolean;
  /** Kept for callers; every sticker now has its lip. */
  raised?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Width, flex and margins go here; the face carries the fill and padding. */
  outerStyle?: StyleProp<ViewStyle>;
}

/** A 3D card: gradient face, gloss band, a darker inner lip along the bottom, ink outline, a hard drop shadow. */
export function Sticker({ children, color = colors.paper, rounded = 'card', gloss = true, style, outerStyle }: StickerProps) {
  const r = radius[rounded];
  const t = tones(color);
  return (
    <View style={[styles.shell, { borderRadius: r, backgroundColor: t.lip, paddingBottom: depth.lip, boxShadow: drop.card }, outerStyle]}>
      <View style={[styles.face, { borderRadius: r - border.width, backgroundColor: color, backgroundImage: vgrad(t.top, t.face) }, style]}>
        {gloss ? <View pointerEvents="none" style={[styles.gloss, { borderRadius: r, height: 18 }]} /> : null}
        {children}
      </View>
    </View>
  );
}

export interface StickerButtonProps {
  title: string;
  /** Second line of text. */
  subtitle?: string;
  /** A price: the coin and the digits. With an empty title it is the whole label. */
  money?: number;
  color?: string;
  /** Lettering fill; defaults to paper on saturated faces and ink on light ones. */
  textColor?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
  haptic?: boolean;
  accessibilityLabel?: string;
  /** Applied to the face (padding, height). */
  style?: StyleProp<ViewStyle>;
  /** Width, flex and margins of the whole button. */
  outerStyle?: StyleProp<ViewStyle>;
  /** Replaces the lettering. */
  children?: ReactNode;
}

/** Face heights; with the lip and the outline every size is at least the 48 pt touch target. */
const FACE = { sm: 40, md: 50, lg: 62 } as const;
const LIP = { sm: depth.lipSm, md: depth.lip, lg: depth.lip } as const;
const LETTER = { sm: font.size.buttonSm, md: font.size.button, lg: 27 } as const;

function usePress() {
  const down = useSharedValue(0);
  const reduced = useReducedMotion();
  const onPressIn = useCallback(() => {
    down.value = reduced ? 1 : withTiming(1, { duration: motion.pressDown });
  }, [down, reduced]);
  const onPressOut = useCallback(() => {
    down.value = reduced ? 0 : withSpring(0, motion.spring);
  }, [down, reduced]);
  return { down, onPressIn, onPressOut };
}

/** The pressable 3D button. */
export function StickerButton({
  title,
  subtitle,
  money,
  color = colors.accent,
  textColor,
  disabled,
  size = 'md',
  onPress,
  haptic = true,
  accessibilityLabel,
  style,
  outerStyle,
  children,
}: StickerButtonProps) {
  const { down, onPressIn, onPressOut } = usePress();
  const lip = LIP[size];
  const push = Math.min(depth.press, lip - 1);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: down.value * push }] }));
  const handlePress = useCallback(() => {
    if (haptic) lightHaptic();
    onPress?.();
  }, [haptic, onPress]);

  const fill = disabled ? colors.muted : color;
  const t = tones(fill);
  const light = lightness(fill) > 0.8;
  const ink = textColor ?? (light ? colors.ink : colors.paper);
  const r = size === 'lg' ? 22 : radius.button;
  const label = accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title);

  return (
    <Pressable
      onPress={disabled ? undefined : handlePress}
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={outerStyle}
    >
      <View style={[styles.shell, { borderRadius: r, backgroundColor: t.lip, paddingBottom: lip, boxShadow: drop.button }]}>
        <Animated.View
          key={fill}
          style={[
            styles.face,
            styles.buttonFace,
            { borderRadius: r - border.width, minHeight: FACE[size], backgroundColor: fill, backgroundImage: vgrad(t.top, t.face) },
            style,
            face,
          ]}
        >
          <View pointerEvents="none" style={[styles.gloss, { borderRadius: r, height: Math.round(FACE[size] * 0.36) }]} />
          {children ?? (
            <>
              {title ? <ButtonLetters text={title} size={LETTER[size]} color={ink} light={light && !textColor} /> : null}
              {money !== undefined ? (
                <Money amount={money} size={title ? 'sm' : size === 'lg' ? 'md' : 'sm'} color={light ? colors.ink : colors.paper} />
              ) : subtitle ? (
                <AppText variant="label" color={ink} center numberOfLines={1}>
                  {subtitle}
                </AppText>
              ) : null}
            </>
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

/** Lilita lettering for a button: outlined on saturated faces, plain ink on light ones. Hidden from screen readers (the button has the label). */
function ButtonLetters({ text, size, color, light }: { text: string; size: number; color: string; light: boolean }) {
  if (light) {
    return (
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        aria-hidden
        importantForAccessibility="no"
        style={{ fontFamily: font.family.display, fontSize: size, lineHeight: Math.round(size * 1.2), color, textAlign: 'center' }}
      >
        {text}
      </Text>
    );
  }
  return (
    <OutlinedText size={size} color={color} center decorative>
      {text}
    </OutlinedText>
  );
}

export interface RoundButtonProps {
  onPress?: () => void;
  accessibilityLabel: string;
  color?: string;
  /** Outer diameter, at least the touch target. */
  size?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** A round 3D icon button: settings, close. */
export function RoundButton({ onPress, accessibilityLabel, color = colors.blue, size = touch.min, children, style }: RoundButtonProps) {
  const { down, onPressIn, onPressOut } = usePress();
  const lip = depth.lipSm;
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: down.value * (lip - 1) }] }));
  const t = tones(color);
  const handlePress = useCallback(() => {
    lightHaptic();
    onPress?.();
  }, [onPress]);
  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={style}
    >
      <View style={[styles.shell, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.lip, paddingBottom: lip, boxShadow: drop.button }]}>
        <Animated.View style={[styles.face, styles.center, { borderRadius: size / 2, backgroundColor: color, backgroundImage: vgrad(t.top, t.face) }, face]}>
          <View pointerEvents="none" style={[styles.gloss, { borderRadius: size, height: size * 0.3, left: size * 0.18, right: size * 0.18 }]} />
          {children}
        </Animated.View>
      </View>
    </Pressable>
  );
}

/** A small 3D pill with an ink outline: the money counter, tags. */
export function Pill({ children, color = colors.paper, style }: { children: ReactNode; color?: string; style?: StyleProp<ViewStyle> }) {
  const t = tones(color);
  return (
    <View style={[styles.shell, { borderRadius: radius.pill, backgroundColor: t.lip, paddingBottom: depth.lipSm, boxShadow: drop.button }]}>
      <View style={[styles.face, styles.pill, { backgroundColor: color, backgroundImage: vgrad(t.top, t.face) }, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { borderWidth: border.width, borderColor: colors.ink, overflow: 'hidden' },
  face: { flexGrow: 1, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  buttonFace: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 2 },
  gloss: { position: 'absolute', top: 3, left: 8, right: 8, backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  pill: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
