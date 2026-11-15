/**
 * The shop, as a bottom sheet: balls of the current sport with an "about $X per round" line, the next trainer as a name and a silhouette
 * (the card never says what is different about them; design rules section 8), remove ads and restore purchases. The content mounts only
 * while the sheet is open, and the per-ball estimates are memoized on the sport state, because the estimate runs the real shot resolver.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { strings } from '@/content/strings';
import { characterCost, characterName, formatMoney, incomePerRoundEstimate, type BallDef, type SportId } from '@/engine';
import { balance, selectSport, selectSportId, useGame } from '@/store/game';
import { AppText, Pill, Sticker, StickerButton, border, colors, radius, space, sportColors, touch } from '@/ui';
import { CloseGlyph } from '@/ui/glyphs';
import { Sheet } from '@/ui/sheet';

export interface ShopSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function ShopSheet({ visible, onClose }: ShopSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel={strings.shop.title} closeLabel={strings.shop.close}>
      <ShopContent onClose={onClose} />
    </Sheet>
  );
}

/** The store price in dollars; the balance file holds a decimal price, not game money, so formatMoney does not apply. */
function formatUsd(price: number): string {
  return `$${price.toFixed(2)}`;
}

interface ShopContentProps {
  onClose: () => void;
}

function ShopContent({ onClose }: ShopContentProps) {
  const sportId = useGame(selectSportId);
  const sport = useGame(selectSport);
  const removeAds = useGame((s) => s.state.removeAds);
  const busy = useGame((s) => s.busy);
  const [pending, setPending] = useState(false);
  const [restoreNote, setRestoreNote] = useState<string | null>(null);

  const def = balance.sports[sportId];
  const balls = def.balls;

  // One estimate per ball. `sport` is in the dependency list on purpose: the estimate reads the whole game state, and the sport state is
  // the part of it that changes when a purchase or upgrade should move the numbers.
  const estimates = useMemo(() => {
    const state = useGame.getState().state;
    const map: Record<string, number> = {};
    for (const b of balls) map[b.id] = incomePerRoundEstimate(state, balance, sportId, b.id);
    return map;
  }, [sport, sportId, balls]);

  const nextLimbs = sport.limbs + 1;
  const trainerAvailable = sport.limbs < balance.characters.softCapLimbs;
  const trainerCost = trainerAvailable ? characterCost(balance, nextLimbs) : 0;
  const trainerName = trainerAvailable ? characterName(balance, nextLimbs) : '';

  const buyTrainer = useCallback(() => {
    useGame.getState().actions.buyCharacter();
  }, []);

  const buyRemoveAds = useCallback(async () => {
    setPending(true);
    try {
      await useGame.getState().actions.buyRemoveAds();
    } finally {
      setPending(false);
    }
  }, []);

  const restore = useCallback(async () => {
    setPending(true);
    try {
      const res = await useGame.getState().actions.restorePurchases();
      if (!res.ok) setRestoreNote(strings.settings.restoreFailed);
      else setRestoreNote(res.restored > 0 ? strings.settings.restoreDone(res.restored) : strings.settings.restoreNone);
    } finally {
      setPending(false);
    }
  }, []);

  const locked = busy || pending;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText variant="title">{strings.shop.title}</AppText>
        <Pill style={styles.moneyPill}>
          <AppText variant="label" tabular accessibilityLabel={`Money ${formatMoney(sport.money)}`}>
            {formatMoney(sport.money)}
          </AppText>
        </Pill>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={strings.shop.close}
          hitSlop={space.sm}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <CloseGlyph size={22} />
        </Pressable>
      </View>

      <ScrollView style={styles.shrink} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppText variant="label" style={styles.section}>
          {strings.shop.balls}
        </AppText>
        {balls.map((ball) => (
          <BallRow
            key={ball.id}
            ball={ball}
            sportId={sportId}
            estimate={estimates[ball.id] ?? 0}
            money={sport.money}
            owned={sport.ownedBalls.includes(ball.id)}
            onFirstLimb={sport.limbBalls[0] === ball.id}
            onEveryLimb={sport.limbBalls.length > 0 && sport.limbBalls.every((b) => b === ball.id)}
          />
        ))}

        {trainerAvailable ? (
          <>
            <AppText variant="label" style={styles.section}>
              {strings.shop.characters}
            </AppText>
            <Sticker color={colors.arm} style={styles.trainerCard}>
              <Silhouette />
              <View style={styles.grow}>
                <AppText variant="caption">{strings.shop.next}</AppText>
                <AppText variant="title" numberOfLines={1}>
                  {trainerName}
                </AppText>
              </View>
              <StickerButton
                title={strings.shop.buy}
                subtitle={formatMoney(trainerCost)}
                color={colors.paper}
                size="sm"
                disabled={sport.money < trainerCost}
                onPress={buyTrainer}
                accessibilityLabel={`${strings.shop.buy} ${trainerName}, ${formatMoney(trainerCost)}`}
                outerStyle={styles.action}
              />
            </Sticker>
          </>
        ) : null}

        <View style={styles.purchases}>
          {!removeAds ? (
            <StickerButton
              title={strings.shop.removeAds}
              subtitle={formatUsd(balance.shop.removeAdsPriceUsd)}
              color={colors.paper}
              size="sm"
              disabled={locked}
              onPress={() => void buyRemoveAds()}
            />
          ) : null}
          <StickerButton title={strings.shop.restore} color={colors.paper} size="sm" disabled={locked} onPress={() => void restore()} />
          {restoreNote ? (
            <AppText variant="caption" center>
              {restoreNote}
            </AppText>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

interface BallRowProps {
  ball: BallDef;
  sportId: SportId;
  estimate: number;
  money: number;
  owned: boolean;
  onFirstLimb: boolean;
  onEveryLimb: boolean;
}

function BallRow({ ball, sportId, estimate, money, owned, onFirstLimb, onEveryLimb }: BallRowProps) {
  const fill = sportColors[sportId].ball;
  const buy = useCallback(() => {
    useGame.getState().actions.buyBall(ball.id);
  }, [ball.id]);
  const useOnAll = useCallback(() => {
    useGame.getState().actions.assignAllLimbs(ball.id);
  }, [ball.id]);

  return (
    <View style={styles.row}>
      <View style={[styles.ball, { backgroundColor: fill }]} importantForAccessibility="no" accessibilityElementsHidden />
      <View style={styles.grow}>
        <View style={styles.nameRow}>
          <AppText variant="label" numberOfLines={1}>
            {ball.name}
          </AppText>
          {onFirstLimb ? (
            <Pill color={colors.paper2} style={styles.tag}>
              <AppText variant="caption">{strings.shop.inUse}</AppText>
            </Pill>
          ) : null}
        </View>
        <AppText variant="caption" tabular>
          {strings.shop.perRound(formatMoney(estimate))}
        </AppText>
      </View>
      {!owned ? (
        <StickerButton
          title={strings.shop.buy}
          subtitle={formatMoney(ball.cost)}
          color={colors.paper}
          size="sm"
          disabled={money < ball.cost}
          onPress={buy}
          accessibilityLabel={`${strings.shop.buy} ${ball.name}, ${formatMoney(ball.cost)}`}
          outerStyle={styles.action}
        />
      ) : !onEveryLimb ? (
        <StickerButton
          title={strings.shop.useOnAll}
          color={colors.paper}
          size="sm"
          onPress={useOnAll}
          accessibilityLabel={`${strings.shop.useOnAll}, ${ball.name}`}
          outerStyle={styles.action}
        />
      ) : (
        <View style={[styles.action, styles.ownedBox]}>
          <AppText variant="caption" center>
            {strings.shop.owned}
          </AppText>
        </View>
      )}
    </View>
  );
}

/** A dark head and body, nothing more. Whatever else the trainer brings stays behind the body until they walk in. */
function Silhouette() {
  return (
    <View style={styles.silhouette} importantForAccessibility="no" accessibilityElementsHidden>
      <View style={styles.silhouetteHead} />
      <View style={styles.silhouetteBody} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: space.lg, paddingTop: space.md, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch.min },
  moneyPill: { marginLeft: 'auto', paddingVertical: 4 },
  close: { width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center', marginRight: -space.md },
  pressed: { opacity: 0.6 },
  scroll: { paddingBottom: space.xl },
  section: { marginTop: space.md, marginBottom: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: border.thin,
    borderBottomColor: colors.paper2,
  },
  ball: { width: 36, height: 36, borderRadius: 18, borderWidth: border.width, borderColor: colors.ink },
  grow: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tag: { paddingVertical: 1, paddingHorizontal: 8 },
  action: { width: 108 },
  ownedBox: { minHeight: touch.min, justifyContent: 'center', borderRadius: radius.button, backgroundColor: colors.paper2 },
  trainerCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  purchases: { marginTop: space.xl, gap: space.sm },
  silhouette: { width: 44, height: 56, alignItems: 'center', justifyContent: 'flex-end' },
  silhouetteHead: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, marginBottom: -4, zIndex: 1 },
  silhouetteBody: { width: 40, height: 34, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: colors.ink },
});
