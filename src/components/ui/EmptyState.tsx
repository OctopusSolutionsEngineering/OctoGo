/**
 * Empty State Component
 * Shown when lists are empty
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fontSize, spacing } from '../../theme/spacing';

interface EmptyStateProps {
  icon?: string;
  ionicon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon,
  ionicon,
  title,
  message,
}) => {
  return (
    <View style={styles.container}>
      {ionicon ? (
        <Ionicons name={ionicon} size={48} color={colors.text.tertiary} style={styles.ionicon} />
      ) : (
        <Text style={styles.icon}>{icon || '📭'}</Text>
      )}
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  ionicon: {
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});
