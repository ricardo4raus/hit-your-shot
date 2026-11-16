/**
 * What sits above the upgrade cards between rounds (owner decision 2026-11-16): no panel. The character simply stops shooting, the cards
 * come back, and above them, centered, one play button. After a round the money it made stands over the button in display lettering,
 * tilted 4 degrees (this screen's one odd choice), with "NEW!" beside it on a best round and the commentator's line under it. The ×2 offer
 * is a small second button. The line sits in a paper pill like the money counter, because the character's shirt is behind it; a pill is
 * not a panel. Everything fades and rises in 280 ms with ease-out; Reduce Motion fades only. Touches outside the buttons
 * fall through to the play field so the player can keep aiming.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { strings } from '@/content/strings';
import { canWatchX2, formatMoney } from '@/engine';
import { balance, useGame } from '@/store/game';
import { AppText, OutlinedText, Pill, StickerButton, colors, motion, space } from '@/ui';

export interface RoundControlsProps {
  /** Distance from the bottom of the screen to the top of the cards. */
  bottom: number;
}

const RISE_FROM = 24;
const BUTTON_WIDTH = 220;

export function RoundControls({ bottom }: RoundControlsProps) {
  const phase = useGame((s) => s.phase);
  if (phase === 'playing') return null;
  return <ControlsBody bottom={bottom} />;
}

function ControlsBody({ bottom }: RoundControlsProps) {
  const reduced = useReducedMotion();
  const result = useGame((s) => s.result);
  const busy = useGame((s) => s.busy);
  const offlineOpen = useGame((s) => s.offline !== null);
  const roundsPlayed = useGame((s) => s.state.sports[s.state.currentSport].roundsPlayed);
  const removeAds = useGame((s) => s.state.removeAds);
  const x2Available = useGame((s) => canWatchX2(s.state, balance));
  // The ×2 was taken for the next round already; the button goes away even when removeAds keeps canWatchX2 true.
  const [x2Taken, setX2Taken] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    setX2Taken(false);
    progress.value = 0;
    progress.value = withTiming(1, { duration: motion.panelIn, easing: Easing.out(Easing.cubic) });
  }, [result, progress]);

  const rise = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduced ? 0 : (1 - progress.value) * RISE_FROM }],
  }));

  const play = () => {
    useGame.getState().actions.startRound();
  };
  const watchX2 = async () => {
    const status = await useGame.getState().actions.watchX2();
    if (status.ok) setX2Taken(true);
  };

  const showX2 = x2Available && !(result?.doubled ?? false) && !x2Taken;
  const x2Title = `${strings.round.x2} · ${removeAds ? strings.round.x2Free : strings.round.x2Watch}`;

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <Animated.View style={[styles.column, rise]} pointerEvents="box-none">
        {result ? (
          <View style={styles.resultRow} pointerEvents="none">
            <OutlinedText variant="displaySm" color={colors.paper} style={styles.tilt}>
              {formatMoney(result.money)}
            </OutlinedText>
            {result.newBest ? (
              <View style={styles.newTag} accessibilityLabel={strings.round.best}>
                <OutlinedText variant="displaySm" color={colors.cash} stroke={2}>
                  {strings.round.newTag}
                </OutlinedText>
              </View>
            ) : null}
          </View>
        ) : null}
        {result ? (
          <Pill style={styles.linePill}>
            <AppText variant="label" center style={styles.line} numberOfLines={2}>
              {result.line}
            </AppText>
          </Pill>
        ) : roundsPlayed === 0 ? (
          <Pill style={styles.linePill}>
            <AppText variant="label" center style={styles.line}>
              {strings.round.dragToAim}
            </AppText>
          </Pill>
        ) : null}
        <StickerButton
          title={result ? strings.round.playAgain : strings.round.play}
          color={colors.accent}
          size="lg"
          variant="title"
          disabled={busy || offlineOpen}
          onPress={play}
          outerStyle={styles.primary}
        />
        {showX2 ? (
          <StickerButton title={x2Title} color={colors.paper} size="sm" disabled={busy} onPress={watchX2} accessibilityLabel={x2Title} outerStyle={styles.secondary} />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  column: { alignItems: 'center', gap: space.sm },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tilt: { transform: [{ rotate: '-4deg' }], paddingHorizontal: space.xs },
  newTag: { transform: [{ rotate: '6deg' }] },
  linePill: { maxWidth: 320, paddingVertical: 4 },
  line: { flexShrink: 1 },
  primary: { width: BUTTON_WIDTH },
  secondary: { width: BUTTON_WIDTH },
});
