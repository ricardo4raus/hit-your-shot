/** The three upgrade cards. Placeholder: the UI agent implements it per docs/design-rules.md section 6; keep the export and props. */
import { View } from 'react-native';

import { strings } from '@/content/strings';
import { upgradeCost, UPGRADE_IDS } from '@/engine';
import { balance, selectSport, useGame } from '@/store/game';
import { formatMoney } from '@/engine';
import { StickerButton } from '@/ui';

export interface UpgradeCardsProps {
  onOpenShop: () => void;
}

export function UpgradeCards({ onOpenShop: _onOpenShop }: UpgradeCardsProps) {
  const sport = useGame(selectSport);
  const buy = useGame((s) => s.actions.buyUpgrade);
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
      {UPGRADE_IDS.map((id) => {
        const level = sport.upgrades[id];
        const cost = upgradeCost(balance, id, level);
        return (
          <StickerButton
            key={id}
            title={strings.upgrades[id]}
            subtitle={formatMoney(cost)}
            disabled={sport.money < cost}
            onPress={() => buy(id)}
            outerStyle={{ flex: 1 }}
          />
        );
      })}
    </View>
  );
}
