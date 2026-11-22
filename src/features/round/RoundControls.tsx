/**
 * What sits above the upgrade cards between rounds (owner decision 2026-11-16): no panel. The character simply stops shooting, the cards
 * come back, and above them, centered, one big 3D play button, set into the tray's top edge beside the Shop tab. The camera keeps the character left of center (features/play/camera.ts),
 * so everything else stands in the empty court right of the character and never covers it: after a round the money it made (the coin
 * and big Nunito digits in a pill, owner 2026-11-19: no display lettering for money), "NEW BEST!" hanging crooked on the pill's corner on
 * a best round (this screen's one odd choice), and the commentator's line as a small two-line caption under it, the way a broadcast
 * shows commentary. Before the first round a hand slides left and right over the same spot with "DRAG TO AIM". The ×2 offer is a small
 * second button under the caption. Everything fades and rises in 280 ms with ease-out; Reduce Motion fades only and holds the hand still.
 * Touches outside the buttons fall through to the play field so the player can keep aiming.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { strings } from '@/content/strings';
import { canWatchX2 } from '@/engine';
import { balance, useGame } from '@/store/game';
import { AppText, HandGlyph, Money, OutlinedText, Pill, StickerButton, border, colors, motion, space, vgrad } from '@/ui';

export interface RoundControlsProps {
  /** Distance from the bottom of the screen to the top of the cards. */
  bottom: number;
}

const RISE_FROM = 24;
const BUTTON_WIDTH = 176;
/** The play button's full height: face, lip and outline (StickerButton size "lg"). */
const BUTTON_HEIGHT = 74;
/** The play button sinks this far into the cards tray's top edge, level with the Shop tab, to stay clear of the character's arm. */
const SINK = 34;
/** How far the hand travels each way. */
const HINT_SWING = 26;

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
  const showHint = !result && roundsPlayed === 0;

  return (
    <View style={[styles.wrap, { bottom: bottom - SINK }]} pointerEvents="box-none">
      <Animated.View style={[styles.side, { bottom: BUTTON_HEIGHT + space.md }, rise]} pointerEvents="box-none">
        {result ? (
          <View style={styles.resultRow} pointerEvents="none">
            <Pill style={styles.moneyPill}>
              <Money amount={result.money} size="xl" plus />
            </Pill>
            {result.newBest ? (
              <View style={styles.newTag} accessibilityLabel={strings.round.best}>
                <OutlinedText size={22} color={colors.cash} stroke={3} dropDepth={3}>
                  {strings.round.newBest}
                </OutlinedText>
              </View>
            ) : null}
          </View>
        ) : null}
        {result ? (
          <View style={styles.caption} pointerEvents="none">
            <AppText variant="body" color={colors.onPanel} center numberOfLines={2} style={styles.captionText}>
              {result.line}
            </AppText>
          </View>
        ) : null}
        {showHint ? <DragHint reduced={reduced} /> : null}
        {showX2 ? <StickerButton title={x2Title} color={colors.blue} size="sm" disabled={busy} onPress={watchX2} accessibilityLabel={x2Title} /> : null}
      </Animated.View>
      <Animated.View style={rise} pointerEvents="box-none">
        <StickerButton
          title={result ? strings.round.playAgainButton : strings.round.playButton}
          accessibilityLabel={result ? strings.round.playAgain : strings.round.play}
          color={colors.accent}
          size="lg"
          disabled={busy || offlineOpen}
          onPress={play}
          outerStyle={styles.primary}
        />
      </Animated.View>
    </View>
  );
}

/** A hand sliding left and right over the court, with two words. Reduce Motion holds it still. */
function DragHint({ reduced }: { reduced: boolean }) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    const ease = Easing.inOut(Easing.sin);
    x.value = withRepeat(
      withSequence(withTiming(-HINT_SWING, { duration: motion.hint / 2, easing: ease }), withTiming(HINT_SWING, { duration: motion.hint, easing: ease }), withTiming(0, { duration: motion.hint / 2, easing: ease })),
      -1,
    );
    return () => cancelAnimation(x);
  }, [reduced, x]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: `${x.value * 0.25}deg` }] }));
  return (
    <View style={styles.hint} pointerEvents="none" accessible accessibilityLabel={strings.round.dragToAim}>
      <View style={styles.track}>
        <Animated.View style={slide}>
          <HandGlyph size={56} />
        </Animated.View>
      </View>
      <OutlinedText size={24} color={colors.paper} stroke={3} dropDepth={3} decorative>
        {strings.round.dragToAim}
      </OutlinedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  side: { position: 'absolute', left: '44%', right: space.sm, alignItems: 'center', gap: space.sm },
  resultRow: { alignItems: 'center', paddingTop: space.md },
  moneyPill: { paddingVertical: 4, paddingLeft: 6, paddingRight: 18 },
  newTag: { position: 'absolute', top: -14, right: -26, transform: [{ rotate: '-9deg' }] },
  caption: {
    maxWidth: 216,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: border.width,
    borderColor: colors.ink,
    backgroundColor: colors.panel,
    backgroundImage: vgrad(colors.panel, colors.panelDeep),
    boxShadow: `inset 0px 2px 0px ${colors.panelEdge}, 0px 3px 0px rgba(20, 24, 34, 0.35)`,
  },
  captionText: { lineHeight: 19 },
  hint: { alignItems: 'center', gap: 2 },
  track: { width: 120, height: 62, alignItems: 'center', justifyContent: 'flex-end' },
  primary: { width: BUTTON_WIDTH },
});
