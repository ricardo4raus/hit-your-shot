/**
 * Owned by the lead. Root: loads the fonts (and on web, CanvasKit for Skia), declares the routes. The web build exists for the screenshot
 * tool (tools/screenshot.ts) and for looking at the game in a browser; the phone is the product.
 */
import { LilitaOne_400Regular } from '@expo-google-fonts/lilita-one';
import { Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Keys match `font.family` in the theme. */
const FONTS = { LilitaOne_400Regular, Nunito_600SemiBold, Nunito_700Bold };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  // A font that fails to load must not leave the player on the splash: the system font takes over.
  const fontsDone = fontsLoaded || fontError !== null;
  const [skiaReady, setSkiaReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Skia on web draws with CanvasKit (WebAssembly), which must be loaded before the first Canvas renders. The .wasm file is served
    // from public/ (copied there by tools/screenshot.ts; not committed).
    import('@shopify/react-native-skia/lib/module/web')
      .then((web) => web.LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }))
      .then(() => setSkiaReady(true))
      .catch((e: unknown) => console.warn('CanvasKit failed to load', e));
  }, []);

  useEffect(() => {
    if (fontsDone && skiaReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsDone, skiaReady]);

  if (!fontsDone || !skiaReady) return null;

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
