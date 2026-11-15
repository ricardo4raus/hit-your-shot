/**
 * Text with the two fonts. Display text is Lilita One with an ink outline (drawn as four offset copies, the cheap text stroke that works on
 * every platform). Body text is Nunito. Numbers that change every frame use `tabular` so digits do not wobble.
 */
import { StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';

import { colors, font } from './theme';

export type TextVariant = 'display' | 'displaySm' | 'title' | 'label' | 'body' | 'caption';

const variantStyle: Record<TextVariant, TextStyle> = {
  display: { fontFamily: font.family.display, fontSize: font.size.display, lineHeight: font.size.display * 1.1 },
  displaySm: { fontFamily: font.family.display, fontSize: font.size.displaySm, lineHeight: font.size.displaySm * 1.15 },
  title: { fontFamily: font.family.bold, fontSize: font.size.title, lineHeight: font.size.title * 1.3 },
  label: { fontFamily: font.family.bold, fontSize: font.size.label, lineHeight: font.size.label * 1.3 },
  body: { fontFamily: font.family.body, fontSize: font.size.body, lineHeight: font.size.body * 1.4 },
  caption: { fontFamily: font.family.body, fontSize: font.size.caption, lineHeight: font.size.caption * 1.4 },
};

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  /** Tabular figures for numbers that change. */
  tabular?: boolean;
  /** Centered text. */
  center?: boolean;
}

export function AppText({ variant = 'body', color = colors.ink, tabular, center, style, ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[variantStyle[variant], { color }, tabular && styles.tabular, center && styles.center, style]}
      allowFontScaling={false}
    />
  );
}

export interface OutlinedTextProps {
  children: string;
  variant?: 'display' | 'displaySm';
  /** Fill color. The outline is always ink. */
  color?: string;
  /** Outline width in pt. */
  stroke?: number;
  style?: StyleProp<ViewStyle>;
  center?: boolean;
}

const OFFSETS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/** Display lettering with an ink outline: sport names, "NEW!", round results, prices. Short strings only. */
export function OutlinedText({ children, variant = 'display', color = colors.paper, stroke = 2, style, center }: OutlinedTextProps) {
  const base = variantStyle[variant];
  return (
    <View style={[styles.outlineBox, style]} accessibilityRole="text" accessibilityLabel={children}>
      {OFFSETS.map(([dx, dy], i) => (
        <Text
          key={i}
          style={[base, styles.outlineLayer, center && styles.center, { color: colors.ink, left: dx * stroke, top: dy * stroke }]}
          allowFontScaling={false}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {children}
        </Text>
      ))}
      <Text style={[base, { color }, center && styles.center]} allowFontScaling={false}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  outlineBox: { position: 'relative' },
  outlineLayer: { position: 'absolute', right: undefined, bottom: undefined },
});
