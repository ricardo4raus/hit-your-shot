/** Placeholder home screen. The play field replaces this once the engine and the UI kit exist. */
import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>HIT YOUR SHOT</Text>
      <Text style={styles.sub}>Scaffold. No game yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: '#C9DCE8' },
  title: { fontFamily: 'LilitaOne_400Regular', fontSize: 40, color: '#1F2430' },
  sub: { fontFamily: 'Nunito_600SemiBold', fontSize: 16, color: '#1F2430', marginTop: 8 },
});
