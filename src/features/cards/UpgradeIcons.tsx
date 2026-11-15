/**
 * The three upgrade icons as small drawn scenes (design rules section 7): flat fills, ink outlines, built from plain views so they render
 * the same everywhere. Accuracy: a ball going through the hoop with motion lines. Fire rate: three balls in a row leaving a hand.
 * Income: a coin with a face. The label next to the icon says the word; the icon shows what the upgrade does.
 */
import { StyleSheet, View } from 'react-native';

import type { UpgradeId } from '@/engine';
import { border, colors } from '@/ui';

export const ICON_WIDTH = 72;
export const ICON_HEIGHT = 40;

export interface UpgradeIconProps {
  id: UpgradeId;
}

export function UpgradeIcon({ id }: UpgradeIconProps) {
  return (
    <View style={styles.box} importantForAccessibility="no" accessibilityElementsHidden>
      {id === 'accuracy' ? <AccuracyScene /> : id === 'fireRate' ? <FireRateScene /> : <IncomeScene />}
    </View>
  );
}

/** Three motion lines, a ball, a rim and a net under it. */
function AccuracyScene() {
  return (
    <>
      <View style={[styles.line, { left: 4, top: 9, width: 12 }]} />
      <View style={[styles.line, { left: 8, top: 15, width: 10 }]} />
      <View style={[styles.line, { left: 12, top: 21, width: 6 }]} />
      <View style={[styles.net, { left: 42, top: 18 }]} />
      <View style={[styles.ball, { left: 42, top: 2, width: 16, height: 16, borderRadius: 8 }]} />
      <View style={[styles.rim, { left: 34, top: 14 }]} />
    </>
  );
}

/** A palm with a thumb at the left, three balls flying right. */
function FireRateScene() {
  return (
    <>
      <View style={styles.palm} />
      <View style={styles.thumb} />
      <View style={[styles.ball, styles.smallBall, { left: 30, top: 14 }]} />
      <View style={[styles.ball, styles.smallBall, { left: 45, top: 12 }]} />
      <View style={[styles.ball, styles.smallBall, { left: 60, top: 10 }]} />
    </>
  );
}

/** A coin with a rim, two eyes and a smile. */
function IncomeScene() {
  return (
    <>
      <View style={styles.coin}>
        <View style={styles.coinRim} />
        <View style={[styles.eye, { left: 10, top: 11 }]} />
        <View style={[styles.eye, { left: 20, top: 11 }]} />
        <View style={styles.smile} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  box: { width: ICON_WIDTH, height: ICON_HEIGHT, position: 'relative' },
  line: { position: 'absolute', height: border.thin, borderRadius: 1, backgroundColor: colors.ink },
  ball: { position: 'absolute', backgroundColor: colors.paper, borderWidth: border.thin, borderColor: colors.ink },
  smallBall: { width: 12, height: 12, borderRadius: 6 },
  rim: { position: 'absolute', width: 32, height: 9, borderRadius: 5, backgroundColor: colors.accent, borderWidth: border.thin, borderColor: colors.ink },
  net: {
    position: 'absolute',
    width: 16,
    height: 14,
    backgroundColor: colors.paper,
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  palm: { position: 'absolute', left: 4, top: 12, width: 18, height: 18, borderRadius: 6, backgroundColor: colors.paper, borderWidth: border.thin, borderColor: colors.ink },
  thumb: { position: 'absolute', left: 16, top: 7, width: 9, height: 12, borderRadius: 5, backgroundColor: colors.paper, borderWidth: border.thin, borderColor: colors.ink },
  coin: {
    position: 'absolute',
    left: (ICON_WIDTH - 36) / 2,
    top: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cash,
    borderWidth: border.thin,
    borderColor: colors.ink,
  },
  coinRim: { position: 'absolute', left: 3, top: 3, width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.ink },
  eye: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink },
  smile: {
    position: 'absolute',
    left: 10,
    top: 16,
    width: 12,
    height: 7,
    borderBottomWidth: border.thin,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderColor: colors.ink,
  },
});
