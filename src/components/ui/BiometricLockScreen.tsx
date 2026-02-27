/**
 * Biometric Lock Screen
 * Full-screen overlay that blocks access until biometric authentication succeeds.
 * Shown on app open and when returning from background (if enabled).
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/colors';
import { fontSize, spacing, fontFamily, borderRadius } from '../../theme/spacing';
import {
  authenticateWithBiometrics,
  getBiometricStatus,
  getBiometricTypeName,
  getBiometricIcon,
  type BiometricType,
} from '../../lib/biometric';

interface BiometricLockScreenProps {
  onUnlock: () => void;
}

export const BiometricLockScreen: React.FC<BiometricLockScreenProps> = ({ onUnlock }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [biometricType, setBiometricType] = React.useState<BiometricType>('none');
  const [error, setError] = React.useState<string | null>(null);
  const hasPrompted = useRef(false);

  // Fade-in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Pulsing animation for the logo
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Load biometric type
  useEffect(() => {
    getBiometricStatus().then(status => {
      setBiometricType(status.biometricType);
    });
  }, []);

  const promptBiometric = useCallback(async () => {
    setError(null);

    const result = await authenticateWithBiometrics('Unlock OctoGo');

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Fade out then unlock
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        onUnlock();
      });
    } else {
      if (result.error && result.error !== 'Authentication cancelled') {
        setError(result.error);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [onUnlock, fadeAnim]);

  // Auto-prompt on mount (once)
  useEffect(() => {
    if (!hasPrompted.current) {
      hasPrompted.current = true;
      // Short delay so the UI renders before the system prompt appears
      const timer = setTimeout(() => {
        promptBiometric();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [promptBiometric]);

  const biometricName = getBiometricTypeName(biometricType);
  const iconName = getBiometricIcon(biometricType);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        {/* App logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Text style={styles.appName}>OctoGo</Text>
        <Text style={styles.subtitle}>Locked</Text>

        {/* Unlock button */}
        <Pressable
          style={({ pressed }) => [
            styles.unlockButton,
            pressed && styles.unlockButtonPressed,
          ]}
          onPress={promptBiometric}
        >
          <Ionicons
            name={iconName as any}
            size={22}
            color={colors.white}
          />
          <Text style={styles.unlockText}>
            Unlock with {biometricName}
          </Text>
        </Pressable>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.status.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 100,
    height: 100,
  },
  appName: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xxl,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.brand.primary,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  unlockButtonPressed: {
    backgroundColor: colors.brand.dark,
  },
  unlockText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semiBold,
    color: colors.white,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.status.error,
    fontFamily: fontFamily.medium,
  },
});
