import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ICON_FONTS } from '@/components/Icon';
import { Splash } from '@/components/Splash';
import { SensorProvider, useSensors } from '@/lib/store';
import { useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const MIN_SPLASH_MS = 1200;
const MAX_SPLASH_MS = 3500;

function RootStack({ fontsReady }: { fontsReady: boolean }) {
  const { loaded, settings, latest, failures } = useSensors();
  const { c, mode } = useTheme();
  const [started] = useState(() => Date.now());
  const [showSplash, setShowSplash] = useState(true);
  const [fade] = useState(() => new Animated.Value(1));
  const ready = loaded && fontsReady;

  // Native splash → in-app splash as soon as fonts and settings are in.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Keep the in-app splash while the first reading arrives (or fails), within 1.2–3.5 s.
  useEffect(() => {
    if (!ready || !showSplash) return;
    const waiting = !settings.demo && !!settings.host && !latest && failures === 0;
    const elapsed = Date.now() - started;
    const wait = Math.max(MIN_SPLASH_MS - elapsed, waiting ? MAX_SPLASH_MS - elapsed : 0, 0);
    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setShowSplash(false));
    }, wait);
    return () => clearTimeout(t);
  }, [ready, showSplash, settings.demo, settings.host, latest, failures, started, fade]);

  if (!ready) return null;

  const message = settings.demo ? 'Starting demo mode…' : settings.host ? 'Looking for your ESP32…' : 'Getting ready…';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={showSplash || mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sensor/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="connect" />
      </Stack>
      {showSplash && (
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: fade }}>
          <Splash message={message} />
        </Animated.View>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [fontsReady, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    ...ICON_FONTS,
  });
  return (
    <SafeAreaProvider>
      <SensorProvider>
        <RootStack fontsReady={fontsReady || !!fontError} />
      </SensorProvider>
    </SafeAreaProvider>
  );
}
