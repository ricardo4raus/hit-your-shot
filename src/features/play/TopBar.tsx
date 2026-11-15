/** Money pill top center, settings ghost button top right. Placeholder: the UI agent replaces the body, keeps the export. */
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatMoney } from '@/engine';
import { selectMoney, useGame } from '@/store/game';
import { AppText, Pill } from '@/ui';

export function TopBar() {
  const money = useGame(selectMoney);
  return (
    <View style={styles.row} pointerEvents="box-none">
      <Pill>
        <AppText variant="label" tabular>
          {formatMoney(money)}
        </AppText>
      </Pill>
      <Link href="/settings" asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" style={styles.settings}>
          <AppText variant="label">⚙</AppText>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' },
  settings: { position: 'absolute', right: 12, top: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
