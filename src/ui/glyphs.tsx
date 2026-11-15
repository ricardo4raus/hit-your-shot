/**
 * The few glyphs the interface needs, drawn from plain views in the cut-out style (design rules section 7): no emoji, no icon fonts.
 * A gear for settings and an X for closing. Both are decorative; the pressable around them carries the accessibility label.
 */
import { StyleSheet, View } from 'react-native';

import { colors } from './theme';

export interface GlyphProps {
  size?: number;
  color?: string;
}

/** Two squares, one turned 45 degrees, under a disc: an eight-tooth cog with a hole in the middle. */
export function GearGlyph({ size = 24, color = colors.ink }: GlyphProps) {
  const tooth = size * 0.66;
  const disc = size * 0.72;
  const hole = size * 0.3;
  const toothStyle = { width: tooth, height: tooth, backgroundColor: color, borderRadius: size * 0.08 };
  return (
    <View style={[styles.box, { width: size, height: size }]} importantForAccessibility="no" accessibilityElementsHidden>
      <View style={[styles.abs, toothStyle]} />
      <View style={[styles.abs, toothStyle, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.abs, { width: disc, height: disc, borderRadius: disc / 2, backgroundColor: color }]} />
      <View style={[styles.abs, { width: hole, height: hole, borderRadius: hole / 2, backgroundColor: colors.paper }]} />
    </View>
  );
}

/** Two bars crossed. */
export function CloseGlyph({ size = 24, color = colors.ink }: GlyphProps) {
  const bar = { width: size * 0.14, height: size, backgroundColor: color, borderRadius: size * 0.07 };
  return (
    <View style={[styles.box, { width: size, height: size }]} importantForAccessibility="no" accessibilityElementsHidden>
      <View style={[styles.abs, bar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.abs, bar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
});
