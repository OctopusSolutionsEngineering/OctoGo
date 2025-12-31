/**
 * Error View Component
 * Displays error messages with retry option
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { borderRadius, fontSize, spacing } from '../../theme/spacing';
import { Button } from './Button';

interface ErrorViewProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  fullScreen?: boolean;
  /** Optional secondary action (e.g., "Switch Space") */
  secondaryAction?: {
    title: string;
    onPress: () => void;
  };
  /** Type of error - affects icon and styling */
  errorType?: 'generic' | 'permission' | 'network' | 'notFound';
}

export const ErrorView: React.FC<ErrorViewProps> = ({ 
  title,
  message,
  onRetry,
  fullScreen = false,
  secondaryAction,
  errorType = 'generic',
}) => {
  // Determine icon and default title based on error type
  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    switch (errorType) {
      case 'permission':
        return 'lock-closed-outline';
      case 'network':
        return 'cloud-offline-outline';
      case 'notFound':
        return 'search-outline';
      default:
        return 'alert-circle-outline';
    }
  };

  const getDefaultTitle = (): string => {
    switch (errorType) {
      case 'permission':
        return 'Access Denied';
      case 'network':
        return 'Connection Error';
      case 'notFound':
        return 'Not Found';
      default:
        return 'Something went wrong';
    }
  };

  const displayTitle = title || getDefaultTitle();

  const content = (
    <>
      <View style={[
        styles.iconContainer,
        errorType === 'permission' && styles.iconContainerPermission,
      ]}>
        <Ionicons 
          name={getIconName()} 
          size={32} 
          color={errorType === 'permission' ? colors.status.warning : colors.status.error} 
        />
      </View>
      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.buttonContainer}>
        {secondaryAction && (
          <Button 
            title={secondaryAction.title} 
            onPress={secondaryAction.onPress} 
            variant="primary"
            style={styles.button}
          />
        )}
        {onRetry && (
          <Button 
            title="Try Again" 
            onPress={onRetry} 
            variant="secondary"
            style={styles.button}
          />
        )}
      </View>
    </>
  );

  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.content}>{content}</View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  container: {
    backgroundColor: colors.status.errorDim,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    margin: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.status.errorDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainerPermission: {
    backgroundColor: colors.status.warningDim,
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    width: '100%',
  },
  button: {
    minWidth: 140,
  },
});



