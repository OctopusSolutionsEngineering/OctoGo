/**
 * Root Layout
 * Configures providers and handles auth routing
 */

import React, { useEffect, useCallback } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
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

  if (isLoading) {
    return <LoadingScreen message="Checking authentication..." />;
  }

  return <>{children}</>;
}

function ThemedApp() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  
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
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
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
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <FavoritesProvider>
              <TabCustomizationProvider>
                <ThemedApp />
              </TabCustomizationProvider>
            </FavoritesProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
