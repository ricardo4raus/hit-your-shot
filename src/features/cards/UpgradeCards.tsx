/**
 * The three upgrade cards in the bottom 30% (design rules section 6): equal width, one fill color each, name, a drawn icon, the pips of the
 * current tier, a level badge and one button with the price on it. Always visible and always pressable, during and between rounds.
 * A purchase pops the icon (1.1 and back, 240 ms); Reduce Motion skips the pop. The small "Shop" pill above the cards opens the sheet.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { strings } from '@/content/strings';
import { formatMoney, upgradeCost, UPGRADE_IDS, type UpgradeId } from '@/engine';
import { useGameEvent } from '@/store/events';
import { balance, selectMoney, useGame } from '@/store/game';
import { AppText, Pill, Sticker, StickerButton, border, colors, motion, radius, space, touch } from '@/ui';

import { pipsFor } from './pips';
import { ICON_HEIGHT, UpgradeIcon } from './UpgradeIcons';

export interface UpgradeCardsProps {
  onOpenShop: () => void;
}

const CARD_COLOR: Record<UpgradeId, string> = {
  accuracy: colors.cardAccuracy,
  fireRate: colors.cardFireRate,
  income: colors.cardIncome,
};

export function UpgradeCards({ onOpenShop }: UpgradeCardsProps) {
  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Pressable
          onPress={onOpenShop}
          accessibilityRole="button"
          accessibilityLabel={strings.shop.title}
          hitSlop={space.sm}
          style={({ pressed }) => [styles.shopButton, pressed && styles.pressed]}
        >
          <Pill style={styles.shopPill}>
            <AppText variant="label">{strings.shop.title}</AppText>
          </Pill>
        </Pressable>
      </View>
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
      <View style={styles.head}>
        <AppText variant="label" numberOfLines={1} style={styles.name}>
          {name}
        </AppText>
      </View>
      <View style={styles.badge} accessibilityLabel={strings.upgrades.level(level)}>
        <AppText variant="caption" color={colors.paper} tabular>
          {String(level)}
        </AppText>
      </View>
      <Animated.View style={[styles.icon, iconStyle]}>
        <UpgradeIcon id={id} />
      </Animated.View>
      <View style={styles.pips} accessibilityLabel={`${pips.filled} of ${pips.total}`}>
        {Array.from({ length: pips.total }, (_, i) => (
          <View key={i} style={[styles.pip, i < pips.filled ? { backgroundColor: maxed ? colors.good : color } : styles.pipEmpty]} />
        ))}
      </View>
      <StickerButton
        title={maxed ? strings.upgrades.max : strings.upgrades.upgrade}
        subtitle={maxed ? undefined : formatMoney(cost)}
        color={colors.paper}
        disabled={!affordable || playing}
        size="sm"
        onPress={buy}
        accessibilityLabel={maxed ? `${name}, ${strings.upgrades.max}` : `${strings.upgrades.upgrade} ${name}, ${formatMoney(cost)}`}
        style={styles.buttonFace}
      />
    </Sticker>
  );
}

const PIP = 10;

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  toolbar: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', height: 32, marginBottom: space.xs },
  shopButton: { minHeight: 32, justifyContent: 'center' },
  shopPill: { paddingVertical: 2, minHeight: 30 },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  cardOuter: { flex: 1 },
  card: { paddingHorizontal: 6, paddingTop: space.xs, paddingBottom: space.sm, gap: space.xs, overflow: 'visible' },
  head: { minHeight: 22, justifyContent: 'center' },
  name: { paddingRight: 18 },
  badge: {
    position: 'absolute',
    top: -space.sm,
    right: -space.sm,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { height: ICON_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  pips: { flexDirection: 'row', justifyContent: 'center', gap: 5, height: PIP + 2, alignItems: 'center' },
  pip: { width: PIP, height: PIP, borderRadius: PIP / 2, borderWidth: border.thin, borderColor: colors.ink },
  pipEmpty: { backgroundColor: colors.paper2 },
  buttonFace: { paddingHorizontal: space.xs, minHeight: touch.min, borderRadius: radius.button },
});
