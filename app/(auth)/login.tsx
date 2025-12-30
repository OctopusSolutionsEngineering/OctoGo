/**
 * Login Screen
 * Secure API key authentication with beautiful design
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
  Image,
  Dimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../src/context/AuthContext';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius, fontFamily } from '../../src/theme/spacing';
import { validateServerUrl, validateApiKey } from '../../src/lib/security';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error, clearError, instances, isAddingInstance, cancelAddingInstance } = useAuth();
  
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    serverUrl?: string;
    apiKey?: string;
  }>({});

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cancelAddingInstance();
    router.back();
  }, [cancelAddingInstance, router]);

  const handleServerUrlChange = useCallback((text: string) => {
    setServerUrl(text);
    if (validationErrors.serverUrl) {
      setValidationErrors(prev => ({ ...prev, serverUrl: undefined }));
    }
    if (error) clearError();
  }, [validationErrors.serverUrl, error, clearError]);

  const handleApiKeyChange = useCallback((text: string) => {
    setApiKey(text);
    if (validationErrors.apiKey) {
      setValidationErrors(prev => ({ ...prev, apiKey: undefined }));
    }
    if (error) clearError();
  }, [validationErrors.apiKey, error, clearError]);

  const handleLogin = useCallback(async () => {
    // Validate inputs
    const errors: typeof validationErrors = {};
    
    const urlValidation = validateServerUrl(serverUrl);
    if (!urlValidation.valid) {
      errors.serverUrl = urlValidation.error;
    }

    const keyValidation = validateApiKey(apiKey);
    if (!keyValidation.valid) {
      errors.apiKey = keyValidation.error;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const result = await login(serverUrl, apiKey, undefined, instanceName || undefined);
    
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [serverUrl, apiKey, instanceName, login]);

  const openApiKeyHelp = useCallback(() => {
    Alert.alert(
      'How to get an API Key',
      'To generate an API key:\n\n1. Log in to your Octopus Deploy server\n2. Click your profile in the top right\n3. Go to "Profile"\n4. Select "My API Keys"\n5. Click "New API Key"\n6. Give it a name and click "Generate New"\n\nCopy the key and paste it here.',
      [
        { text: 'Got it', style: 'cancel' },
        { 
          text: 'View Docs', 
          onPress: () => Linking.openURL('https://octopus.com/docs/octopus-rest-api/how-to-create-an-api-key') 
        },
      ]
    );
  }, []);

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#0D1117', '#0F1923', '#0D2137', '#0D1117']}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Decorative glow behind logo */}
      <View style={styles.glowContainer}>
        <LinearGradient
          colors={['rgba(47, 147, 224, 0.15)', 'rgba(0, 212, 170, 0.08)', 'transparent']}
          style={styles.glow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Back button when adding instance */}
        {isAddingInstance && (
          <Pressable style={styles.backButton} onPress={handleCancel}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            <Text style={styles.backButtonText}>Cancel</Text>
          </Pressable>
        )}

        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header with Logo */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>OctoGo</Text>
              <Text style={styles.subtitle}>
                {isAddingInstance ? 'Add another Octopus instance' : 'Unofficial Octopus Deploy companion app'}
              </Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              <View style={styles.formFields}>
                <Input
                  label="Nickname (optional)"
                  placeholder="e.g. Production, Staging, Work"
                  value={instanceName}
                  onChangeText={setInstanceName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />

                <Input
                  label="Server URL"
                  placeholder="https://your-server.octopus.app"
                  value={serverUrl}
                  onChangeText={handleServerUrlChange}
                  error={validationErrors.serverUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  textContentType="URL"
                />

                <Input
                  label="API Key"
                  placeholder="API-XXXXXXXXXXXXXXXXXXXX"
                  value={apiKey}
                  onChangeText={handleApiKeyChange}
                  error={validationErrors.apiKey || error || undefined}
                  secureTextEntry
                  showToggle
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="none"
                  autoComplete="off"
                />
              </View>

              <View style={styles.formActions}>
                <Button
                  title={isAddingInstance ? 'Add Instance' : 'Connect'}
                  onPress={handleLogin}
                  loading={isLoading}
                  disabled={!serverUrl || !apiKey}
                  fullWidth
                  style={styles.connectButton}
                />

                <Button
                  title="Need an API Key?"
                  onPress={openApiKeyHelp}
                  variant="ghost"
                  fullWidth
                />
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.securityBadge}>
                <Text style={styles.securityIcon}>🔒</Text>
                <Text style={styles.securityText}>
                  Your credentials are stored securely on this device
                </Text>
              </View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  backButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  glowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
    alignItems: 'center',
    overflow: 'hidden',
  },
  glow: {
    width: SCREEN_WIDTH * 1.5,
    height: 400,
    borderRadius: SCREEN_WIDTH,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoContainer: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logo: {
    width: 88,
    height: 88,
  },
  title: {
    fontSize: 32,
    fontFamily: fontFamily.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: 'rgba(22, 27, 34, 0.9)',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.muted,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  formFields: {
    gap: spacing.sm,
  },
  formActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  connectButton: {
    height: 52,
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0, 212, 170, 0.08)',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.15)',
  },
  securityIcon: {
    fontSize: fontSize.sm,
  },
  securityText: {
    fontSize: fontSize.xs,
    color: colors.status.success,
    fontWeight: '500',
  },
});
