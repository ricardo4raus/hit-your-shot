/**
 * The top bar during a round: the money pill top center, a ghost settings button top right, nothing else (design rules section 6).
 * The money sits left-aligned in a fixed-width box with tabular figures so the digits do not jump while it counts.
 */
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { strings } from '@/content/strings';
import { formatMoney } from '@/engine';
import { selectMoney, useGame } from '@/store/game';
import { AppText, Pill, colors, space, touch } from '@/ui';
import { GearGlyph } from '@/ui/glyphs';

const MONEY_BOX_WIDTH = 104;

export function TopBar() {
  const money = useGame(selectMoney);
  return (
    <View style={styles.row} pointerEvents="box-none">
      <Pill style={styles.pill}>
        <AppText variant="label" tabular numberOfLines={1} style={styles.money} accessibilityLabel={`Money ${formatMoney(money)}`}>
          {formatMoney(money)}
        </AppText>
      </Pill>
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
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', top: space.sm, left: 0, right: 0, alignItems: 'center' },
  pill: { minHeight: 36, justifyContent: 'flex-start' },
  money: { minWidth: MONEY_BOX_WIDTH, textAlign: 'left' },
  settings: {
    position: 'absolute',
    right: space.lg,
    top: -(touch.min - 36) / 2,
    width: touch.min,
    height: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
