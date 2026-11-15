/**
 * The one screen (docs/design-rules.md section 6): play field in the top 70%, the three upgrade cards in the bottom 30%, the money pill
 * on top, the result panel sliding over the play field, the shop as a sheet, the offline panel on return.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UpgradeCards } from '@/features/cards/UpgradeCards';
import { OfflinePanel } from '@/features/offline/OfflinePanel';
import { PlayField } from '@/features/play/PlayField';
import { TopBar } from '@/features/play/TopBar';
import { ResultPanel } from '@/features/round/ResultPanel';
import { ShopSheet } from '@/features/shop/ShopSheet';
import { useGame } from '@/store/game';
import { colors } from '@/ui/theme';

/** The cards take the bottom 30% of the usable height (design rules section 6), never less than the cards need. */
const CARDS_MIN_HEIGHT = 212;
const CARDS_FRACTION = 0.3;

export default function Home() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ready = useGame((s) => s.ready);
  const [shopOpen, setShopOpen] = useState(false);

  useEffect(() => {
    useGame.getState().actions.init();
  }, []);

  if (!ready) return <View style={styles.root} />;

  const usable = height - insets.top - insets.bottom;
  const cardsHeight = Math.max(CARDS_MIN_HEIGHT, Math.round(usable * CARDS_FRACTION));
  const fieldHeight = Math.max(260, usable - cardsHeight);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={{ height: fieldHeight }}>
        <PlayField height={fieldHeight} />
        <TopBar />
        <ResultPanel onOpenShop={() => setShopOpen(true)} />
      </View>
      <View style={[styles.cards, { height: cardsHeight }]}>
        <UpgradeCards onOpenShop={() => setShopOpen(true)} />
      </View>
      <ShopSheet visible={shopOpen} onClose={() => setShopOpen(false)} />
      <OfflinePanel />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sky },
  cards: { backgroundColor: colors.paper2, borderTopWidth: 3, borderTopColor: colors.ink },
});
