/**
 * The one screen (docs/design-rules.md section 6, revised 2026-11-16): the play field fills the whole screen, seen from behind the
 * character. The money pill sits on top. The three upgrade cards sit over the bottom 30% between rounds and slide away while a round
 * plays; above them, between rounds, the play button and the last round's result (features/round/RoundControls.tsx). The shop is a
 * sheet, the offline panel appears on return. Rewarded-ad offers pop in on the left under the top bar (features/offers/OfferStack.tsx). The cards sit on a navy tray that belongs to the arena (art direction "polished arcade",
 * 2026-11-22): a gradient lit from above, rounded top corners, the ink edge and a light line under it.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UpgradeCards } from '@/features/cards/UpgradeCards';
import { OfferStack } from '@/features/offers/OfferStack';
import { OfflinePanel } from '@/features/offline/OfflinePanel';
import { PlayField } from '@/features/play/PlayField';
import { TopBar } from '@/features/play/TopBar';
import { RoundControls } from '@/features/round/RoundControls';
import { ShopSheet } from '@/features/shop/ShopSheet';
import { useGame } from '@/store/game';
import { border, colors, drop, motion, radius, vgrad } from '@/ui/theme';

/** The cards take the bottom 30% of the usable height (design rules section 6), never less than the cards need. */
const CARDS_MIN_HEIGHT = 236;
const CARDS_FRACTION = 0.3;
/** The offer stack starts under the top bar (money pill and settings button). */
const OFFERS_TOP = 68;

export default function Home() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ready = useGame((s) => s.ready);
  const playing = useGame((s) => s.phase === 'playing');
  const reduced = useReducedMotion();
  const [shopOpen, setShopOpen] = useState(false);
  const hidden = useSharedValue(0);

  useEffect(() => {
    useGame.getState().actions.init();
  }, []);

  useEffect(() => {
    hidden.value = withTiming(playing ? 1 : 0, { duration: motion.panelIn, easing: Easing.out(Easing.cubic) });
  }, [playing, hidden]);

  const usable = height - insets.top - insets.bottom;
  const cardsHeight = Math.max(CARDS_MIN_HEIGHT, Math.round(usable * CARDS_FRACTION)) + insets.bottom;

  const cardsStyle = useAnimatedStyle(() => ({
    opacity: 1 - hidden.value,
    transform: [{ translateY: reduced ? 0 : hidden.value * cardsHeight }],
  }));

  if (!ready) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <PlayField width={width} height={height} />
      <View style={[styles.top, { top: insets.top }]} pointerEvents="box-none">
        <TopBar />
      </View>
      <Animated.View style={[styles.cards, { height: cardsHeight, paddingBottom: insets.bottom }, cardsStyle]} pointerEvents={playing ? 'none' : 'auto'}>
        <UpgradeCards onOpenShop={() => setShopOpen(true)} />
      </Animated.View>
      {/* After the tray: the play button sits on the tray's top edge. */}
      <RoundControls bottom={cardsHeight} />
      <OfferStack top={insets.top + OFFERS_TOP} />
      <ShopSheet visible={shopOpen} onClose={() => setShopOpen(false)} />
      <OfflinePanel />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky },
  top: { position: 'absolute', left: 0, right: 0, height: 56 },
  cards: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.panel,
    backgroundImage: vgrad(colors.panel, colors.panelDeep),
    borderTopLeftRadius: radius.card + 4,
    borderTopRightRadius: radius.card + 4,
    borderWidth: border.width,
    borderBottomWidth: 0,
    borderColor: colors.ink,
    boxShadow: `inset 0px 3px 0px ${colors.panelEdge}, ${drop.panel}`,
  },
});
