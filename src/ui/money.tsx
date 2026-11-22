/**
 * Money on screen (owner 2026-11-19: "a green money icon that makes sense and the numbers like a normal mobile game"): a green coin, then
 * plain bold digits in Nunito. Never display lettering. The coin is lit from the upper left: a face with a lighter top, a highlight and an
 * inner ring, inside one ink outline of the same width all round (owner 2026-11-22: no edge or drop under coins or digits, it read as a
 * doubled bottom border). One component at four sizes: prices on buttons, the pill, the round's result.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatAmount, formatMoney } from '@/engine';

import { AppText } from './text';
import { border, colors, font, shade, vgrad } from './theme';

export type MoneySize = 'sm' | 'md' | 'lg' | 'xl';

const COIN: Record<MoneySize, number> = { sm: 20, md: 28, lg: 34, xl: 44 };
const DIGITS: Record<MoneySize, number> = { sm: 16, md: 20, lg: 26, xl: 34 };
const GAP: Record<MoneySize, number> = { sm: 4, md: 6, lg: 8, xl: 8 };

const COIN_TOP = shade(colors.good, 0.35);
const COIN_LOW = shade(colors.good, -0.12);

export interface CoinGlyphProps {
  size?: number;
}

/** A green coin: a lit face, a highlight, an inner ring and a dollar sign in one even outline. Decorative. */
export function CoinGlyph({ size = 22 }: CoinGlyphProps) {
  const face = size;
  const bw = size >= 28 ? border.width : border.thin;
  const inner = face - 2 * bw - Math.max(3, size * 0.14);
  return (
    <View style={{ width: size, height: size }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden>
      <View
        style={[
          styles.disc,
          styles.center,
          { top: 0, width: size, height: face, borderRadius: size / 2, borderWidth: bw, backgroundColor: colors.good, backgroundImage: vgrad(COIN_TOP, COIN_LOW) },
        ]}
      >
        <View style={[styles.ring, { width: inner, height: inner * (face / size), borderRadius: inner / 2 }]} />
        <AppText color={colors.ink} style={[styles.sign, { fontSize: size * 0.56, lineHeight: face * 0.9 }]}>
          $
        </AppText>
        <View style={[styles.highlight, { left: size * 0.17, top: face * 0.14, width: size * 0.2, height: size * 0.12, borderRadius: size * 0.1 }]} />
      </View>
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
  const fs = DIGITS[size];
  return (
    <View style={[styles.row, { gap: GAP[size] }, style]} accessibilityLabel={`${plus ? '+' : ''}${formatMoney(amount)}`}>
      <CoinGlyph size={COIN[size]} />
      <AppText
        color={color}
        tabular={live}
        numberOfLines={1}
        style={[
          { fontFamily: font.family.bold, fontSize: fs, lineHeight: Math.round(fs * 1.25) },
          live && { minWidth: fs * 3.2, textAlign: 'left' },
        ]}
      >
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  disc: { position: 'absolute', left: 0, borderColor: colors.ink },
  center: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: shade(colors.good, -0.45), opacity: 0.55 },
  sign: { fontFamily: font.family.bold, includeFontPadding: false, textAlign: 'center' },
  highlight: { position: 'absolute', backgroundColor: 'rgba(255, 255, 255, 0.75)', transform: [{ rotate: '-30deg' }] },
});
