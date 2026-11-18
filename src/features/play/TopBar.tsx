/**
 * The top bar during a round: the money pill in the middle (coin and digits, ui/money.tsx), a ghost settings button in the top right
 * corner, nothing else (design rules section 6). Three flex columns, no absolute positioning, so the corners stay corners on every width.
 * The digits are tabular in a fixed minimum width so they do not jump while the money counts.
 */
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { strings } from '@/content/strings';
import { selectMoney, useGame } from '@/store/game';
import { Money, Pill, colors, moneyPulse, space, touch } from '@/ui';
import { GearGlyph } from '@/ui/glyphs';

export function TopBar() {
  const money = useGame(selectMoney);
  // The pill pops a little on a hit (ui/feedback.ts drives the value from the play field).
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: moneyPulse.value }] }));
  return (
    <View style={styles.row} pointerEvents="box-none">
      <View style={styles.side} />
      <Animated.View style={pop}>
        <Pill style={styles.pill}>
          <Money amount={money} size="md" live />
        </Pill>
      </Animated.View>
      <View style={[styles.side, styles.right]}>
        <Link href="/settings" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={strings.settings.title}
            hitSlop={space.sm}
            style={({ pressed }) => [styles.settings, pressed && styles.pressed]}
          >
            <GearGlyph size={24} color={colors.ink} />
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', top: space.sm, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm },
  side: { flex: 1 },
  right: { alignItems: 'flex-end' },
  pill: { minHeight: 36, justifyContent: 'flex-start' },
  settings: { width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
