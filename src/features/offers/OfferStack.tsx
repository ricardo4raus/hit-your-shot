/**
 * Rewarded-ad offers (owner 2026-11-22), the way idle games show them: clickable cards that pop in from the left edge between rounds and
 * stack from the top down under the top bar, oldest on top. Each card has a thin bar along its bottom that runs down until the offer goes
 * away (balance.ads.offerSeconds). Two kinds:
 * - "×2 +10 min": one ad adds 10 minutes of double income, stacking on what is left up to 2 hours (engine/ads.ts). The card stays
 *   after a tap while one more step fits, so ads can be stacked one after another.
 * - "Double": the money from while the app was closed, after the welcome-back panel was closed with "Keep".
 * Above the cards, while the boost runs, a small navy pill counts the time down; it stays during rounds, the cards do not (an ad in the
 * middle of a round would eat it). Cards slide in with a little overshoot and slide out to the left; Reduce Motion fades them.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInLeft,
  SlideOutLeft,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { strings } from '@/content/strings';
import { boostLeftMs } from '@/engine';
import { balance, useGame, type Offer } from '@/store/game';
import { AppText, CoinGlyph, Money, OutlinedText, Pill, StickerButton, border, colors, space } from '@/ui';

const CARD_WIDTH = 148;
const BADGE = 36;

export interface OfferStackProps {
  /** Distance from the top of the screen to the first card (under the top bar). */
  top: number;
}

export function OfferStack({ top }: OfferStackProps) {
  const playing = useGame((s) => s.phase === 'playing');
  const covered = useGame((s) => s.offline !== null);
  const offers = useGame((s) => s.offers);
  const showCards = !playing && !covered;
  return (
    <View style={[styles.stack, { top }]} pointerEvents="box-none">
      <BoostTimer />
      {showCards ? offers.map((o) => <OfferCard key={o.id} offer={o} />) : null}
    </View>
  );
}

/** "1:52:07" over an hour, "9:58" under it. */
export function formatBoostLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** The running boost: a navy pill with a gold ×2 and the time left, ticking once a second. Gone when the boost ends. */
function BoostTimer() {
  const until = useGame((s) => s.state.ads.boostUntil);
  const [now, setNow] = useState(() => Date.now());
  const left = boostLeftMs(useGame.getState().state, balance, now);
  useEffect(() => {
    setNow(Date.now());
    if (!(until > Date.now())) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  if (left <= 0) return null;
  const time = formatBoostLeft(left);
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition} accessible accessibilityLabel={strings.offers.timerLabel(time)}>
      <Pill color={colors.panel} style={styles.timer}>
        <OutlinedText size={18} color={colors.cash} stroke={2} decorative>
          {strings.offers.x2}
        </OutlinedText>
        <AppText variant="label" color={colors.onPanel} tabular style={styles.timerText}>
          {time}
        </AppText>
      </Pill>
    </Animated.View>
  );
}

function OfferCard({ offer }: { offer: Offer }) {
  const reduced = useReducedMotion();
  const busy = useGame((s) => s.busy);
  const free = useGame((s) => s.state.removeAds);
  const pending = useGame((s) => s.state.offline.pendingDouble);
  const life = useSharedValue(1);

  // The bar runs down to the offer's end; then the store drops it. A tap that keeps the card (the boost) restarts both.
  useEffect(() => {
    const total = balance.ads.offerSeconds * 1000;
    const ms = Math.max(0, offer.until - Date.now());
    life.value = ms / total;
    life.value = withTiming(0, { duration: ms, easing: Easing.linear });
    const timer = setTimeout(() => useGame.getState().actions.dropOffer(offer.id), ms);
    return () => clearTimeout(timer);
  }, [offer.id, offer.until, life]);

  const bar = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, life.value)) * 100}%` }));
  const take = () => {
    void useGame.getState().actions.takeOffer(offer.id);
  };

  const boost = offer.kind === 'boost';
  const minutes = balance.ads.boostMinutes;
  const label = boost ? strings.offers.boostLabel(minutes, free) : strings.offers.doubleLabel(free);
  const action = free ? strings.offers.free : strings.offers.watch;

  return (
    <Animated.View
      entering={reduced ? FadeIn : SlideInLeft.springify().damping(14).stiffness(140)}
      exiting={reduced ? FadeOut : SlideOutLeft.duration(220)}
      layout={LinearTransition}
    >
      <StickerButton
        title=""
        color={boost ? colors.good : colors.blue}
        size="md"
        disabled={busy}
        onPress={take}
        accessibilityLabel={label}
        outerStyle={styles.card}
        style={styles.face}
      >
        <View style={styles.badge}>
          {boost ? (
            <OutlinedText size={17} color={colors.paper} stroke={2} decorative>
              {strings.offers.x2}
            </OutlinedText>
          ) : (
            <CoinGlyph size={28} />
          )}
        </View>
        <View style={styles.words}>
          <OutlinedText size={18} color={colors.paper} stroke={2} decorative>
            {boost ? strings.offers.boostTime(minutes) : strings.offers.doubleTitle}
          </OutlinedText>
          {boost ? (
            <AppText variant="label" color={colors.paper} numberOfLines={1}>
              {action}
            </AppText>
          ) : (
            <Money amount={pending} size="sm" plus color={colors.paper} />
          )}
        </View>
        <View style={styles.track} pointerEvents="none">
          <Animated.View style={[styles.bar, bar]} />
        </View>
      </StickerButton>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', left: space.md, alignItems: 'flex-start', gap: space.sm },
  timer: { minHeight: 34, paddingLeft: 8, paddingRight: 12, gap: 4 },
  timerText: { minWidth: 52 },
  card: { width: CARD_WIDTH },
  face: { flexDirection: 'row', justifyContent: 'flex-start', gap: space.sm, paddingLeft: 6, paddingRight: 6, paddingTop: 4, paddingBottom: 8 },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: border.thin,
    borderColor: colors.ink,
    backgroundColor: colors.cash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flexShrink: 1, alignItems: 'flex-start' },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(20, 24, 34, 0.35)' },
  bar: { height: 4, backgroundColor: colors.cash },
});
