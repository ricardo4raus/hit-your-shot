/**
 * Text with the two fonts. Display text is Lilita One with a thick ink outline (copies of the text offset around a circle, the cheap text
 * stroke that works on every platform), the same width on every side (owner 2026-11-22: a drop under the letters read as a doubled
 * bottom border), so it reads as game lettering over any fill. Display is for short,
 * important text only: button labels, card titles, level chips, tags. Body text is Nunito. Money is never display lettering
 * (owner 2026-11-19); it is the coin and Nunito digits (ui/money.tsx). Numbers that change every frame use `tabular`.
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

export type DisplaySize = 'display' | 'displaySm' | 'button' | 'buttonSm' | 'tag';

const DISPLAY_SIZE: Record<DisplaySize, number> = {
  display: font.size.display,
  displaySm: font.size.displaySm,
  button: font.size.button,
  buttonSm: font.size.buttonSm,
  tag: font.size.tag,
};

export interface OutlinedTextProps {
  children: string;
  /** Named size of the lettering; `size` wins when given. */
  variant?: DisplaySize;
  size?: number;
  /** Fill color. The outline is always ink. */
  color?: string;
  /** Outline width in pt; defaults to about an eighth of the font size, at least 2. */
  stroke?: number;
  style?: StyleProp<ViewStyle>;
  center?: boolean;
  /** Inside a pressable that carries its own label: hidden from screen readers. */
  decorative?: boolean;
}

/** Offsets around a circle: 8 directions for thin strokes, 16 for thick ones, so the outline stays round at the corners of letters. */
function ring(stroke: number): [number, number][] {
  const n = stroke > 2.5 ? 16 : 8;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([Math.cos(a) * stroke, Math.sin(a) * stroke]);
  }
  return out;
}

/** Display lettering with an ink outline: button labels, card titles, "NEW BEST!", level chips. Short strings only. */
export function OutlinedText({ children, variant = 'display', size, color = colors.paper, stroke, style, center, decorative }: OutlinedTextProps) {
  const fontSize = size ?? DISPLAY_SIZE[variant];
  const s = stroke ?? Math.max(2, Math.round(fontSize / 8));
  const base: TextStyle = { fontFamily: font.family.display, fontSize, lineHeight: Math.round(fontSize * 1.18) };
  const layers = ring(s);
  return (
    <View
      style={[styles.outlineBox, { paddingHorizontal: s, paddingTop: s, paddingBottom: s }, style]}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'text'}
      accessibilityLabel={decorative ? undefined : children}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={decorative}
      aria-hidden={decorative}
    >
      {layers.map(([dx, dy], i) => (
        <Text
          key={i}
          numberOfLines={1}
          style={[base, styles.outlineLayer, center && styles.center, { color: colors.ink, left: s + dx, top: s + dy, right: s - dx }]}
          allowFontScaling={false}
          accessibilityElementsHidden
          importantForAccessibility="no"
          aria-hidden
        >
          {children}
        </Text>
      ))}
      <Text numberOfLines={1} style={[base, { color }, center && styles.center]} allowFontScaling={false} aria-hidden={decorative}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  outlineBox: { position: 'relative' },
  outlineLayer: { position: 'absolute' },
});
