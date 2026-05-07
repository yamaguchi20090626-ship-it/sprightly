// @ts-nocheck
import { Stack, Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Audio } from 'expo-av';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { WordProvider } from '../context/WordContext';
import { SettingsProvider } from '../context/SettingsContext';
import { SubscriptionProvider } from '../context/SubscriptionContext';
import Paywall from '../components/Paywall';
import AuthScreen from './auth';

SplashScreen.preventAutoHideAsync();

function AppLayout() {
  const { user, loading } = useAuth();

  useEffect(() => {
    SplashScreen.hideAsync();
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  }, []);

  if (loading) return null;

  if (!user) return <AuthScreen />;

  return (
    <WordProvider>
      <SettingsProvider>
        <SubscriptionProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
          <Paywall />
        </SubscriptionProvider>
      </SettingsProvider>
    </WordProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
}
