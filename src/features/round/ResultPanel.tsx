/**
 * The round result (design rules sections 6 and 9): a paper panel that slides up over the play field, never over the cards, in 280 ms with
 * ease-out and no bounce. Reduce Motion fades instead. The money is display lettering tilted 4 degrees (this screen's one odd choice);
 * "NEW!" hangs over the panel edge on a new best. Touches outside the panel fall through to the play field, where a drag starts the next
 * round, so the wrapper is box-none.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { strings } from '@/content/strings';
import { canWatchX2, formatMoney } from '@/engine';
import { balance, useGame, type RoundResultView } from '@/store/game';
import { AppText, OutlinedText, Pill, Sticker, StickerButton, colors, motion, space } from '@/ui';

export interface ResultPanelProps {
  onOpenShop: () => void;
}

/** Where the panel starts its slide: a little more than its own height, so it is fully behind the cards at frame 0. */
const SLIDE_FROM = 360;

export function ResultPanel({ onOpenShop: _onOpenShop }: ResultPanelProps) {
  const result = useGame((s) => s.result);
  if (!result) return null;
  return <ResultBody result={result} />;
}

interface ResultBodyProps {
  result: RoundResultView;
}

function ResultBody({ result }: ResultBodyProps) {
  const reduced = useReducedMotion();
  const busy = useGame((s) => s.busy);
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

  const slide = useAnimatedStyle(() => ({
    opacity: reduced ? progress.value : 1,
    transform: [{ translateY: reduced ? 0 : (1 - progress.value) * SLIDE_FROM }],
  }));

  const playAgain = () => {
    useGame.getState().actions.startRound();
  };
  const watchX2 = async () => {
    const status = await useGame.getState().actions.watchX2();
    if (status.ok) setX2Taken(true);
  };

  const showX2 = x2Available && !result.doubled && !x2Taken;
  const x2Title = `${strings.round.x2} · ${removeAds ? strings.round.x2Free : strings.round.x2Watch}`;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View style={slide}>
        <Sticker style={styles.panel}>
          {result.newBest ? (
            <View style={styles.newTag} accessibilityLabel={strings.round.best}>
              <OutlinedText variant="displaySm" color={colors.cash} stroke={2}>
                {strings.round.newTag}
              </OutlinedText>
            </View>
          ) : null}
          <View style={styles.moneyRow}>
            <OutlinedText variant="displaySm" color={colors.paper} style={styles.tilt}>
              {formatMoney(result.money)}
            </OutlinedText>
            {result.doubled ? (
              <Pill color={colors.cash} style={styles.doubledPill}>
                <AppText variant="caption">{strings.round.doubled}</AppText>
              </Pill>
            ) : null}
          </View>
          <AppText variant="label" tabular>
            {`${strings.round.hits(result.hits, result.shots)} ${strings.round.shots}`}
          </AppText>
          <AppText variant="body" style={styles.line}>
            {result.line}
          </AppText>
          <StickerButton title={strings.round.playAgain} color={colors.accent} onPress={playAgain} outerStyle={styles.primary} />
          {showX2 ? (
            <StickerButton
              title={x2Title}
              color={colors.paper}
              size="sm"
              disabled={busy}
              onPress={watchX2}
              accessibilityLabel={x2Title}
              outerStyle={styles.secondary}
            />
          ) : null}
        </Sticker>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.md },
  panel: { padding: space.lg, paddingTop: space.md, gap: space.sm },
  newTag: { position: 'absolute', top: -22, right: space.md, transform: [{ rotate: '6deg' }] },
  moneyRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.xs },
  tilt: { transform: [{ rotate: '-4deg' }], paddingHorizontal: space.xs },
  doubledPill: { paddingVertical: 2, paddingHorizontal: 10 },
  line: { marginTop: -space.xs },
  primary: { marginTop: space.xs },
  secondary: { marginTop: 0 },
});
