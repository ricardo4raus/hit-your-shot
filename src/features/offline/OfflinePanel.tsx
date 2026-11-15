/**
 * The welcome-back panel: what the sport earned while the app was closed, how long that was, a "Double" offer and "Keep". Centered over
 * everything on an ink scrim. No confetti; the money and a plain sentence are enough (design rules section 9, the confetti budget).
 */
import { StyleSheet, View } from 'react-native';

import { strings } from '@/content/strings';
import { formatMoney } from '@/engine';
import { useGame, type OfflineView } from '@/store/game';
import { AppText, OutlinedText, Sticker, StickerButton, colors, space } from '@/ui';
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
      <Sticker style={styles.panel} outerStyle={styles.panelOuter}>
        <AppText variant="title" center>
          {strings.offline.title}
        </AppText>
        <OutlinedText variant="display" color={colors.cash} center style={styles.money}>
          {formatMoney(offline.money)}
        </OutlinedText>
        <AppText variant="body" center>
          {strings.offline.away(formatTimeAway(offline.seconds))}
        </AppText>
        <View style={styles.buttons}>
          {canDouble ? (
            <StickerButton
              title={strings.offline.double}
              subtitle={removeAds ? strings.round.x2Free : strings.round.x2Watch}
              color={colors.accent}
              disabled={busy}
              onPress={double}
            />
          ) : null}
          <StickerButton title={strings.offline.keep} color={colors.paper} size="sm" disabled={busy} onPress={keep} />
        </View>
      </Sticker>
    </ScrimCenter>
  );
}

const styles = StyleSheet.create({
  panelOuter: { width: '100%', maxWidth: 360 },
  panel: { padding: space.xl, gap: space.sm, alignItems: 'stretch' },
  money: { alignSelf: 'center', paddingVertical: space.xs },
  buttons: { gap: space.sm, marginTop: space.sm },
});
