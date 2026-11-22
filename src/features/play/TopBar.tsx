/**
 * The top bar: the money pill in the middle (a navy 3D pill, the shaded coin and Nunito digits, ui/money.tsx) and a round 3D settings
 * button in the top right corner, nothing else (design rules section 6). Three flex columns, no absolute positioning, so the corners
 * stay corners on every width. The digits are tabular in a fixed minimum width so they do not jump while the money counts; the pill pops
 * on a hit (ui/feedback.ts).
 */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { strings } from '@/content/strings';
import { selectMoney, useGame } from '@/store/game';
import { Money, Pill, RoundButton, colors, moneyPulse, space } from '@/ui';
import { GearGlyph } from '@/ui/glyphs';

export function TopBar() {
  const money = useGame(selectMoney);
  const router = useRouter();
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: moneyPulse.value }] }));
  return (
    <View style={styles.row} pointerEvents="box-none">
      <View style={styles.side} />
      <Animated.View style={pop}>
        <Pill color={colors.panel} style={styles.pill}>
          <Money amount={money} size="md" color={colors.onPanel} raised live />
        </Pill>
      </Animated.View>
      <View style={[styles.side, styles.right]}>
        <RoundButton accessibilityLabel={strings.settings.title} color={colors.blue} onPress={() => router.push('/settings')}>
          <GearGlyph size={22} color={colors.paper} />
        </RoundButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', top: space.sm, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md },
  side: { flex: 1 },
  right: { alignItems: 'flex-end' },
  pill: { minHeight: 38, paddingLeft: 5, paddingRight: 16 },
});
