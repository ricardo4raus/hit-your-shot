/**
 * The few glyphs the interface needs, drawn from plain views in the cut-out style (design rules section 7): no emoji, no icon fonts.
 * Each is a fill over a slightly larger ink copy, so it carries the brand's ink outline on any button face. A gear for settings, an X
 * for closing, a pointing hand for the first-round drag hint. All decorative; the pressable around them carries the accessibility label.
 */
import { StyleSheet, View } from 'react-native';

import { colors, shade } from './theme';

export interface GlyphProps {
  size?: number;
  color?: string;
  /** Ink outline width in pt; 0 for none. */
  outline?: number;
}

function GearShape({ size, color, hole }: { size: number; color: string; hole: string }) {
  const tooth = size * 0.66;
  const disc = size * 0.74;
  const holeSize = size * 0.3;
  const toothStyle = { width: tooth, height: tooth, backgroundColor: color, borderRadius: size * 0.08 };
  return (
    <View style={[styles.box, styles.abs, { width: size, height: size }]}>
      <View style={[styles.abs, toothStyle]} />
      <View style={[styles.abs, toothStyle, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.abs, { width: disc, height: disc, borderRadius: disc / 2, backgroundColor: color }]} />
      <View style={[styles.abs, { width: holeSize, height: holeSize, borderRadius: holeSize / 2, backgroundColor: hole }]} />
    </View>
  );
}

/** An eight-tooth cog with a hole, outlined in ink. The hole shows the button face behind it as ink. */
export function GearGlyph({ size = 24, color = colors.paper, outline = 2.5 }: GlyphProps) {
  const big = size + outline * 2;
  return (
    <View style={[styles.box, { width: big, height: big }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden>
      {outline > 0 ? <GearShape size={big} color={colors.ink} hole={colors.ink} /> : null}
      <GearShape size={size} color={color} hole={colors.ink} />
    </View>
  );
}

function Cross({ size, thick, color }: { size: number; thick: number; color: string }) {
  const bar = { width: thick, height: size, backgroundColor: color, borderRadius: thick / 2 };
  return (
    <View style={[styles.box, styles.abs, { width: size, height: size }]}>
      <View style={[styles.abs, bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.abs, bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

/** Two chunky bars crossed, outlined in ink. */
export function CloseGlyph({ size = 24, color = colors.paper, outline = 2.5 }: GlyphProps) {
  const thick = size * 0.24;
  return (
    <View style={[styles.box, { width: size + outline * 2, height: size + outline * 2 }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden>
      {outline > 0 ? <Cross size={size + outline * 2} thick={thick + outline * 2} color={colors.ink} /> : null}
      <Cross size={size} thick={thick} color={color} />
    </View>
  );
}

/** A hand pointing up, index finger out, seen from the back: paper fill, ink outline, a shaded palm side. Size is the height. */
export function HandGlyph({ size = 56, color = colors.paper }: GlyphProps) {
  const u = size / 56;
  const shadeColor = shade(color, -0.14);
  const part = (left: number, top: number, w: number, h: number, r: number, fill = color) => ({
    position: 'absolute' as const,
    left: left * u,
    top: top * u,
    width: w * u,
    height: h * u,
    borderRadius: r * u,
    backgroundColor: fill,
    borderWidth: 2.5,
    borderColor: colors.ink,
  });
  return (
    <View style={{ width: 44 * u, height: size }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden>
      {/* Folded fingers, then the palm over them, then the index finger and the thumb. */}
      <View style={part(20, 22, 12, 16, 6, shadeColor)} />
      <View style={part(28, 25, 11, 15, 5.5, shadeColor)} />
      <View style={part(6, 26, 32, 28, 12)} />
      <View style={part(9, 2, 13, 34, 6.5)} />
      <View style={[part(0, 30, 13, 18, 6.5), { transform: [{ rotate: '-28deg' }] }]} />
      <View style={{ position: 'absolute', left: 12 * u, top: 6 * u, width: 7 * u, height: 7 * u, borderRadius: 3 * u, backgroundColor: shadeColor }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
});
