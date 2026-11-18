/**
 * Money on screen (owner 2026-11-19: "a green money icon that makes sense and the numbers like a normal mobile game"): a green coin with
 * an ink outline and a dollar sign, then plain bold digits in Nunito. No display lettering, no outline on the digits. The same component
 * at three sizes serves the money pill, prices on buttons and the round's result.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatAmount, formatMoney } from '@/engine';

import { AppText, type TextVariant } from './text';
import { border, colors } from './theme';

export type MoneySize = 'sm' | 'md' | 'lg';

const COIN: Record<MoneySize, number> = { sm: 16, md: 22, lg: 30 };
const VARIANT: Record<MoneySize, TextVariant> = { sm: 'caption', md: 'label', lg: 'title' };
const GAP: Record<MoneySize, number> = { sm: 4, md: 6, lg: 8 };

export interface CoinGlyphProps {
  size?: number;
}

/** A green coin: disc, ink outline, a thin inner ring and a dollar sign. Decorative; the parent carries the label. */
export function CoinGlyph({ size = 22 }: CoinGlyphProps) {
  const inner = size - 2 * border.width - 3;
  return (
    <View style={[styles.coin, { width: size, height: size, borderRadius: size / 2 }]} importantForAccessibility="no" accessibilityElementsHidden>
      <View style={[styles.ring, { width: inner, height: inner, borderRadius: inner / 2 }]} />
      <AppText variant="caption" color={colors.ink} style={[styles.sign, { fontSize: size * 0.62, lineHeight: size * 0.8 }]}>
        $
      </AppText>
    </View>
  );
}

export interface MoneyProps {
  amount: number;
  size?: MoneySize;
  color?: string;
  /** "+" before the digits for a gain. */
  plus?: boolean;
  /** Tabular digits and a fixed minimum width for a number that changes every frame. */
  live?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Money({ amount, size = 'md', color = colors.ink, plus, live, style }: MoneyProps) {
  const text = (plus ? '+' : '') + formatAmount(amount);
  return (
    <View style={[styles.row, { gap: GAP[size] }, style]} accessibilityLabel={`${plus ? '+' : ''}${formatMoney(amount)}`}>
      <CoinGlyph size={COIN[size]} />
      <AppText variant={VARIANT[size]} color={color} tabular={live} numberOfLines={1} style={live && styles.live}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  coin: { backgroundColor: colors.good, borderWidth: border.width, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: colors.ink, opacity: 0.35 },
  sign: { fontFamily: undefined, fontWeight: '800', includeFontPadding: false, textAlign: 'center' },
  live: { minWidth: 64, textAlign: 'left' },
});
