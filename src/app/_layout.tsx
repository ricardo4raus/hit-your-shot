/** Owned by the lead. Root: loads the fonts, declares the routes. The game store is started here once it exists. */
import { LilitaOne_400Regular } from '@expo-google-fonts/lilita-one';
import { Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Keys match `font.family` in the theme. */
const FONTS = { LilitaOne_400Regular, Nunito_600SemiBold, Nunito_700Bold };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  // A font that fails to load must not leave the player on the splash: the system font takes over.
  const fontsDone = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (fontsDone) SplashScreen.hideAsync().catch(() => {});
  }, [fontsDone]);

  if (!fontsDone) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.sky } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
