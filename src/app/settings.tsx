/**
 * Settings, a modal route on paper: sound, haptics, restore purchases, a privacy note, start over, close. Plain and complete language;
 * the humor stops at this door (design rules section 10). Plain text labels, no icons.
 */
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/content/strings';
import { useGame } from '@/store/game';
import { AppText, StickerButton, border, colors, space, touch } from '@/ui';

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sound = useGame((s) => s.state.settings.sound);
  const haptics = useGame((s) => s.state.settings.haptics);
  const [restoring, setRestoring] = useState(false);
  const [restoreNote, setRestoreNote] = useState<string | null>(null);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const setSound = useCallback((value: boolean) => {
    useGame.getState().actions.setSetting('sound', value);
  }, []);
  const setHaptics = useCallback((value: boolean) => {
    useGame.getState().actions.setSetting('haptics', value);
  }, []);

  const restore = useCallback(async () => {
    setRestoring(true);
    try {
      const res = await useGame.getState().actions.restorePurchases();
      if (!res.ok) setRestoreNote(strings.settings.restoreFailed);
      else setRestoreNote(res.restored > 0 ? strings.settings.restoreDone(res.restored) : strings.settings.restoreNone);
    } finally {
      setRestoring(false);
    }
  }, []);

  const confirmReset = useCallback(() => {
    Alert.alert(strings.settings.reset, strings.settings.resetConfirm, [
      { text: strings.settings.cancel, style: 'cancel' },
      {
        text: strings.settings.confirmReset,
        style: 'destructive',
        onPress: () => {
          useGame.getState().actions.resetGame();
          close();
        },
      },
    ]);
  }, [close]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.header}>
        <AppText variant="title">{strings.settings.title}</AppText>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={strings.settings.close}
          hitSlop={space.sm}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <AppText variant="label">{strings.settings.close}</AppText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SwitchRow label={strings.settings.sound} value={sound} onChange={setSound} />
        <SwitchRow label={strings.settings.haptics} value={haptics} onChange={setHaptics} />

        <View style={styles.block}>
          <StickerButton title={strings.shop.restore} color={colors.paper} size="sm" disabled={restoring} onPress={() => void restore()} />
          {restoreNote ? <AppText variant="caption">{restoreNote}</AppText> : null}
        </View>

        <View style={styles.block}>
          <AppText variant="label">{strings.settings.privacy}</AppText>
          <AppText variant="body">{strings.settings.privacyNote}</AppText>
        </View>

        <View style={styles.block}>
          <StickerButton title={strings.settings.reset} color={colors.bad} size="sm" onPress={confirmReset} />
        </View>
      </ScrollView>
    </View>
  );
}

interface SwitchRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function SwitchRow({ label, value, onChange }: SwitchRowProps) {
  return (
    <View style={styles.row}>
      <AppText variant="label">{label}</AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.paper2, true: colors.accent }}
        thumbColor={colors.paper}
        ios_backgroundColor={colors.paper2}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: touch.min },
  closeButton: { minHeight: touch.min, minWidth: touch.min, justifyContent: 'center', alignItems: 'flex-end' },
  pressed: { opacity: 0.6 },
  scroll: { paddingTop: space.sm, paddingBottom: space.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    borderBottomWidth: border.thin,
    borderBottomColor: colors.paper2,
  },
  block: { marginTop: space.xl, gap: space.sm },
});
