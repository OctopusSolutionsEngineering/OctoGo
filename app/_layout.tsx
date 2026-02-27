/**
 * Root Layout
 * Configures providers and handles auth routing
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { View, Pressable, Alert, Platform, AppState, AppStateStatus } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import {
  useFonts,
  Quicksand_300Light,
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { FavoritesProvider } from '../src/context/FavoritesContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { TabCustomizationProvider } from '../src/context/TabCustomizationContext';
import { NotificationsProvider } from '../src/context/NotificationsContext';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { BiometricLockScreen } from '../src/components/ui/BiometricLockScreen';
import { isBiometricEnabled } from '../src/lib/biometric';
import { spacing } from '../src/theme/spacing';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, isAddingInstance } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Biometric lock state
  const [isLocked, setIsLocked] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // Track whether the user has unlocked at least once this session.
  // Prevents re-locking on the initial launch transition and during the
  // Face ID / Touch ID prompt (which briefly moves the app to "inactive").
  const hasUnlockedRef = useRef(false);

  const handleUnlock = useCallback(() => {
    setIsLocked(false);
    hasUnlockedRef.current = true;
  }, []);

  // Check biometric preference on initial auth load
  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      setBiometricChecked(true);
      return;
    }

    let cancelled = false;
    isBiometricEnabled().then(enabled => {
      if (cancelled) return;
      if (enabled) {
        setIsLocked(true);
      }
      setBiometricChecked(true);
    });

    return () => { cancelled = true; };
  }, [isLoading, isAuthenticated]);

  // Monitor AppState for background -> foreground transitions.
  // Only re-lock when returning from "background" (not "inactive") because:
  //  - "inactive" is the state while Face ID / Touch ID prompt is showing
  //  - "inactive" is also triggered by notification shade, control center, etc.
  // And only after the user has completed the initial unlock.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        appStateRef.current === 'background' &&
        nextState === 'active' &&
        isAuthenticated &&
        hasUnlockedRef.current
      ) {
        isBiometricEnabled().then(enabled => {
          if (enabled) {
            setIsLocked(true);
          }
        });
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [isAuthenticated]);

  // Auth routing
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup && !isAddingInstance) {
      // Redirect to main app (unless we're adding a new instance)
      router.replace('/(tabs)');
    }
  }, [isLoading, isAuthenticated, isAddingInstance, segments]);

  if (isLoading || !biometricChecked) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  return (
    <>
      {children}
      {isLocked && isAuthenticated && (
        <BiometricLockScreen onUnlock={handleUnlock} />
      )}
    </>
  );
}

function ThemedApp() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Only apply bottom insets on Android - iOS handles safe area automatically
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;
  
  const goToSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/settings');
  }, [router]);

  // Settings cog button for header right
  const SettingsButton = () => (
    <Pressable 
      onPress={goToSettings}
      style={{
        padding: spacing.sm,
        marginRight: spacing.xs,
      }}
      hitSlop={8}
    >
      <Ionicons name="settings-outline" size={22} color={colors.text.secondary} />
    </Pressable>
  );
  
  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary, paddingBottom: bottomInset }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: true,
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: colors.background.secondary },
            headerTintColor: colors.text.primary,
            contentStyle: { backgroundColor: colors.background.primary },
            animation: 'slide_from_right',
            headerRight: () => <SettingsButton />,
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="customize-tabs" options={{ headerShown: false }} />
          <Stack.Screen name="release/[id]" options={{ title: 'Release' }} />
          <Stack.Screen name="release/create" options={{ title: 'Create Release' }} />
          <Stack.Screen name="release/[id]/deploy" options={{ title: 'Deploy Release' }} />
          <Stack.Screen name="project/[id]" options={{ title: 'Project' }} />
          <Stack.Screen name="project/[id]/variables" options={{ title: 'Variables' }} />
          <Stack.Screen name="deployment/[id]" options={{ title: 'Deployment' }} />
          <Stack.Screen name="environment/[id]" options={{ title: 'Environment' }} />
          <Stack.Screen name="machine/[id]" options={{ title: 'Machine' }} />
          <Stack.Screen name="runbook/[id]" options={{ title: 'Runbook' }} />
          <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
          <Stack.Screen name="tenant/[id]" options={{ title: 'Tenant' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        </Stack>
      </AuthGate>
    </View>
  );
}

// Check for OTA updates on app launch
async function checkForUpdates() {
  if (__DEV__) return; // Skip in development
  
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      Alert.alert(
        'Update Available',
        'A new version has been downloaded. Restart to apply the update?',
        [
          { text: 'Later', style: 'cancel' },
          { 
            text: 'Restart', 
            onPress: async () => {
              await Updates.reloadAsync();
            }
          },
        ]
      );
    }
  } catch {
    // Silently fail - updates are not critical
  }
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Quicksand_300Light,
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  // Check for updates on mount
  useEffect(() => {
    checkForUpdates();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0D1117' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <FavoritesProvider>
                <TabCustomizationProvider>
                  <NotificationsProvider>
                    <ThemedApp />
                  </NotificationsProvider>
                </TabCustomizationProvider>
              </FavoritesProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
