/** Settings modal: sound, haptics, restore purchases, privacy, start over. Placeholder: the UI agent implements it. */
import { View } from 'react-native';

import { strings } from '@/content/strings';
import { AppText } from '@/ui';

export default function Settings() {
  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#FFF7E8' }}>
      <AppText variant="title">{strings.settings.title}</AppText>
    </View>
  );
}
