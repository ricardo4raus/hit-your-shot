/**
 * The three upgrade cards on the arena's navy tray (design rules section 6, art direction "polished arcade" 2026-11-22): equal width,
 * one 3D card each (a gradient face lit from above, a gloss band, a darker lip), the name in Lilita with an ink outline, a shaded icon,
 * a "Lv 3" chip beside a segmented bar for the current tier, and one 3D button with the price (the coin and Nunito digits, never display
 * lettering). Affordable prices are green buttons; unaffordable ones are grey with full-contrast digits. Shown between rounds only (the
 * screen slides the tray away while a round plays, owner decision 2026-11-16); the buttons stay disabled during a round as a second
 * guard. A purchase pops the icon (1.1 and back, 240 ms); Reduce Motion skips the pop. The "Shop" button sits as a tab on the tray's
 * top edge at the right, clear of the centered play button and of the character on the left.
 */
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { strings } from '@/content/strings';
import { formatMoney, upgradeCost, UPGRADE_IDS, type UpgradeId } from '@/engine';
import { useGameEvent } from '@/store/events';
import { balance, selectMoney, useGame } from '@/store/game';
import { OutlinedText, Sticker, StickerButton, border, colors, font, motion, shade, space, vgrad } from '@/ui';

import { pipsFor } from './pips';
import { ICON_HEIGHT, UpgradeIcon } from './UpgradeIcons';

export interface UpgradeCardsProps {
  onOpenShop: () => void;
}

/** How far the Shop tab rises above the tray's top edge. */
export const SHOP_TAB_RISE = 26;

const CARD_COLOR: Record<UpgradeId, string> = {
  accuracy: colors.cardAccuracy,
  fireRate: colors.cardFireRate,
  income: colors.cardIncome,
};

export function UpgradeCards({ onOpenShop }: UpgradeCardsProps) {
  return (
    <View style={styles.root}>
      <StickerButton
        title={strings.shop.title}
        color={colors.blue}
        size="sm"
        onPress={onOpenShop}
        accessibilityLabel={strings.shop.title}
        outerStyle={styles.shopTab}
        style={styles.shopFace}
      />
      <View style={styles.row}>
        {UPGRADE_IDS.map((id) => (
          <UpgradeCard key={id} id={id} />
        ))}
      </View>
    </View>
  );
}

interface UpgradeCardProps {
  id: UpgradeId;
}

function UpgradeCard({ id }: UpgradeCardProps) {
  const playing = useGame((s) => s.phase === 'playing');
  const level = useGame((s) => s.state.sports[s.state.currentSport].upgrades[id]);
  const money = useGame(selectMoney);
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const maxed = level >= balance.upgrades.maxLevel;
  const cost = maxed ? 0 : upgradeCost(balance, id, level);
  const affordable = !maxed && money >= cost;
  const pips = pipsFor(level, balance.trophies.upgradeTierEvery);
  const color = CARD_COLOR[id];
  const name = strings.upgrades[id];

  useGameEvent((e) => {
    if (e.type !== 'upgradeBought' || e.id !== id || reduced) return;
    const half = motion.pop / 2;
    scale.value = withSequence(withTiming(1.1, { duration: half }), withTiming(1, { duration: half }));
  });

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const buy = useCallback(() => {
    useGame.getState().actions.buyUpgrade(id);
  }, [id]);

  return (
    <Sticker color={color} outerStyle={styles.cardOuter} style={styles.card}>
      <OutlinedText size={16} stroke={2} dropDepth={2} color={colors.paper} center style={styles.title}>
        {name}
      </OutlinedText>
      <Animated.View style={[styles.icon, iconStyle]}>
        <UpgradeIcon id={id} />
      </Animated.View>
      <View style={styles.progress}>
        <View style={styles.chip} accessibilityLabel={strings.upgrades.level(level)}>
          <Text style={styles.chipText} allowFontScaling={false} aria-hidden importantForAccessibility="no">
            {strings.upgrades.levelShort(level)}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: shade(color, -0.55) }]} accessibilityLabel={`${pips.filled} of ${pips.total}`}>
          {Array.from({ length: pips.total }, (_, i) => (
            <View key={i} style={[styles.segment, i < pips.filled && styles.segmentOn]} />
          ))}
        </View>
      </View>
      <StickerButton
        title={maxed ? strings.upgrades.max : ''}
        money={maxed ? undefined : cost}
        color={maxed ? colors.paper : colors.good}
        disabled={!maxed && (!affordable || playing)}
        size="sm"
        onPress={maxed ? undefined : buy}
        accessibilityLabel={maxed ? `${name}, ${strings.upgrades.max}` : `${strings.upgrades.upgrade} ${name}, ${formatMoney(cost)}`}
        outerStyle={styles.buttonOuter}
        style={styles.buttonFace}
      />
    </Sticker>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.md, paddingTop: 44, paddingBottom: space.sm },
  shopTab: { position: 'absolute', right: space.lg, top: -SHOP_TAB_RISE, zIndex: 2 },
  shopFace: { paddingHorizontal: space.md },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  cardOuter: { flex: 1 },
  card: { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 6, gap: 3, alignItems: 'stretch' },
  title: { alignSelf: 'center' },
  icon: { height: ICON_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1, marginBottom: 3 },
  chip: {
    height: 20,
    minWidth: 30,
    paddingHorizontal: 5,
    borderRadius: 7,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: font.family.display, fontSize: font.size.tag - 1, lineHeight: 17, color: colors.cash },
  track: {
    flex: 1,
    height: 16,
    borderRadius: 8,
    borderWidth: border.thin,
    borderColor: colors.ink,
    padding: 2,
    flexDirection: 'row',
    gap: 2,
  },
  segment: { flex: 1, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.14)' },
  segmentOn: { backgroundColor: colors.good, backgroundImage: vgrad(shade(colors.good, 0.45), colors.good) },
  buttonOuter: { alignSelf: 'stretch' },
  buttonFace: { paddingHorizontal: 2 },
});
