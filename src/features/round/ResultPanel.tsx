/** Round result over the play field. Placeholder: the UI agent implements it per design rules; keep the export and props. */
import { StyleSheet, View } from 'react-native';

import { strings } from '@/content/strings';
import { formatMoney } from '@/engine';
import { useGame } from '@/store/game';
import { AppText, OutlinedText, Sticker, StickerButton } from '@/ui';

export interface ResultPanelProps {
  onOpenShop: () => void;
}

export function ResultPanel({ onOpenShop: _onOpenShop }: ResultPanelProps) {
  const result = useGame((s) => s.result);
  const start = useGame((s) => s.actions.startRound);
  if (!result) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Sticker style={styles.panel}>
        <OutlinedText variant="displaySm" color="#FFF7E8">{formatMoney(result.money)}</OutlinedText>
        <AppText>{strings.round.hits(result.hits, result.shots)}</AppText>
        <AppText variant="caption">{result.line}</AppText>
        <StickerButton title={strings.round.playAgain} onPress={() => start()} />
      </Sticker>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  panel: { padding: 16, gap: 8 },
});
