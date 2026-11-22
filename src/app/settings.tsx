/**
 * Settings, a modal route on paper: sound, haptics, restore purchases, a privacy note, start over, close. Plain and complete language;
 * the humor stops at this door (design rules section 10). Plain text labels, no icons. Styled as the arena's navy tray: a Lilita title,
 * the rows in inset wells, 3D buttons, a round 3D close button.
 */
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/content/strings';
import { useGame } from '@/store/game';
import { AppText, CloseGlyph, OutlinedText, RoundButton, StickerButton, border, colors, radius, space, touch, vgrad } from '@/ui';

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
      <StatusBar style="light" />
      <View style={styles.header}>
        <OutlinedText size={32} color={colors.paper} stroke={3} dropDepth={3}>
          {strings.settings.title}
        </OutlinedText>
        <RoundButton accessibilityLabel={strings.settings.close} color={colors.bad} onPress={close}>
          <CloseGlyph size={18} />
        </RoundButton>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.well}>
          <SwitchRow label={strings.settings.sound} value={sound} onChange={setSound} />
          <View style={styles.divider} />
          <SwitchRow label={strings.settings.haptics} value={haptics} onChange={setHaptics} />
        </View>

        <View style={styles.block}>
          <StickerButton title={strings.shop.restore} color={colors.blue} size="md" disabled={restoring} onPress={() => void restore()} />
          {restoreNote ? (
            <AppText variant="body" color={colors.onPanelSoft} center>
              {restoreNote}
            </AppText>
          ) : null}
        </View>

        <View style={[styles.well, styles.block, styles.wellPad]}>
          <OutlinedText size={20} color={colors.paper}>
            {strings.settings.privacy}
          </OutlinedText>
          <AppText variant="body" color={colors.onPanel}>
            {strings.settings.privacyNote}
          </AppText>
        </View>

        <View style={styles.block}>
          <StickerButton title={strings.settings.reset} color={colors.bad} size="md" onPress={confirmReset} />
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
      <AppText variant="title" color={colors.onPanel}>
        {label}
      </AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.muted, true: colors.good }}
        thumbColor={colors.paper}
        ios_backgroundColor={colors.muted}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.panel, backgroundImage: vgrad(colors.panel, colors.panelDeep), paddingHorizontal: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: touch.min + 8 },
  scroll: { paddingTop: space.md, paddingBottom: space.xl },
  well: {
    borderRadius: radius.well + 4,
    borderWidth: border.thin,
    borderColor: colors.ink,
    backgroundColor: colors.well,
    boxShadow: 'inset 0px 3px 0px rgba(10, 16, 30, 0.35)',
    paddingHorizontal: space.lg,
  },
  wellPad: { paddingVertical: space.md, gap: space.sm },
  divider: { height: border.thin, backgroundColor: 'rgba(255, 255, 255, 0.10)' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 60 },
  block: { marginTop: space.xl, gap: space.sm },
});
