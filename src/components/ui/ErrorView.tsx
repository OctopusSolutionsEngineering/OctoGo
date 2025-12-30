/**
 * Error View Component
 * Displays error messages with retry option
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius, fontSize, spacing } from '../../theme/spacing';
import { Button } from './Button';

interface ErrorViewProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  fullScreen?: boolean;
}

export const ErrorView: React.FC<ErrorViewProps> = ({ 
  title = 'Something went wrong',
  message,
  onRetry,
  fullScreen = false,
}) => {
  const content = (
    <>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button 
          title="Try Again" 
          onPress={onRetry} 
          variant="secondary"
          style={styles.button}
        />
      )}
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
    maxWidth: 300,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
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
  button: {
    marginTop: spacing.lg,
  },
});



