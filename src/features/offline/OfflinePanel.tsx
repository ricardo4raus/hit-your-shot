/**
 * The welcome-back panel: what the sport earned while the app was closed, how long that was, a "Double" offer and "Keep". Centered over
 * everything on an ink scrim. No confetti; the money and a plain sentence are enough (design rules section 9, the confetti budget).
 * A navy 3D card like the arena's trays: a short Lilita title, the money as the coin and big Nunito digits in an inset well, 3D buttons.
 */
import { StyleSheet, View } from 'react-native';

import { strings } from '@/content/strings';
import { useGame, type OfflineView } from '@/store/game';
import { AppText, Money, OutlinedText, Sticker, StickerButton, border, colors, radius, space } from '@/ui';
import { ScrimCenter } from '@/ui/sheet';

import { formatTimeAway } from './timeAway';

export function OfflinePanel() {
  const offline = useGame((s) => s.offline);
  if (!offline) return null;
  return <OfflineBody offline={offline} />;
}

interface OfflineBodyProps {
  offline: OfflineView;
}

function OfflineBody({ offline }: OfflineBodyProps) {
  const busy = useGame((s) => s.busy);
  const removeAds = useGame((s) => s.state.removeAds);
  const canDouble = useGame((s) => s.offline?.canDouble === true && s.state.offline.pendingDouble > 0);

  const double = () => {
    void useGame.getState().actions.watchOfflineDouble();
  };
  const keep = () => {
    useGame.getState().actions.dismissOffline();
  };

  return (
    <ScrimCenter accessibilityLabel={strings.offline.title}>
      <Sticker color={colors.panel} style={styles.panel} outerStyle={styles.panelOuter}>
        <OutlinedText size={30} color={colors.paper} stroke={3} center style={styles.title}>
          {strings.offline.welcome}
        </OutlinedText>
        <AppText variant="label" color={colors.onPanelSoft} center>
          {strings.offline.title}
        </AppText>
        <View style={styles.well}>
          <Money amount={offline.money} size="xl" plus color={colors.onPanel} />
          <AppText variant="body" color={colors.onPanelSoft} center>
            {strings.offline.away(formatTimeAway(offline.seconds))}
          </AppText>
        </View>
        <View style={styles.buttons}>
          {canDouble ? (
            <StickerButton
              title={strings.offline.double}
              subtitle={removeAds ? strings.offers.free : strings.offers.watch}
              color={colors.accent}
              disabled={busy}
              onPress={double}
            />
          ) : null}
          <StickerButton title={strings.offline.keep} color={colors.blue} size={canDouble ? 'sm' : 'md'} disabled={busy} onPress={keep} />
        </View>
      </Sticker>
    </ScrimCenter>
  );
}

const styles = StyleSheet.create({
  panelOuter: { width: '100%', maxWidth: 360 },
  panel: { padding: space.xl, paddingTop: space.lg, gap: space.sm, alignItems: 'stretch' },
  title: { alignSelf: 'center' },
  well: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    borderRadius: radius.well + 4,
    borderWidth: border.thin,
    borderColor: colors.ink,
    backgroundColor: colors.well,
    boxShadow: 'inset 0px 3px 0px rgba(10, 16, 30, 0.35)',
  },
  buttons: { gap: space.sm, marginTop: space.sm },
});
