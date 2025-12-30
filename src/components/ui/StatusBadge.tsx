/**
 * Status Badge Component
 * Displays task/deployment status with appropriate styling
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius, fontSize, spacing } from '../../theme/spacing';
import type { TaskState } from '../../lib/api/types';

interface StatusBadgeProps {
  status: TaskState | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const getStatusColor = (status: string): { bg: string; text: string } => {
  switch (status) {
    case 'Success':
      return { bg: colors.status.successDim, text: colors.status.success };
    case 'Failed':
    case 'TimedOut':
      return { bg: colors.status.errorDim, text: colors.status.error };
    case 'Executing':
      return { bg: colors.status.infoDim, text: colors.status.info };
    case 'Queued':
      return { bg: colors.status.pendingDim, text: colors.status.pending };
    case 'Canceled':
    case 'Cancelling':
      return { bg: colors.status.warningDim, text: colors.status.warning };
    default:
      return { bg: colors.background.tertiary, text: colors.text.secondary };
  }
};

const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'Success':
      return '✓';
    case 'Failed':
    case 'TimedOut':
      return '✕';
    case 'Executing':
      return '●';
    case 'Queued':
      return '◷';
    case 'Canceled':
    case 'Cancelling':
      return '◌';
    default:
      return '○';
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = 'md',
  showIcon = true,
}) => {
  const statusColors = getStatusColor(status);
  const icon = getStatusIcon(status);

  const sizeStyles = {
    sm: { paddingHorizontal: spacing.sm, paddingVertical: 2, fontSize: fontSize.xs },
    md: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, fontSize: fontSize.sm },
    lg: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, fontSize: fontSize.md },
  };

  return (
    <View
      style={[
        styles.badge,
        { 
          backgroundColor: statusColors.bg,
          paddingHorizontal: sizeStyles[size].paddingHorizontal,
          paddingVertical: sizeStyles[size].paddingVertical,
        },
      ]}
    >
      {showIcon && (
        <Text style={[styles.icon, { color: statusColors.text, fontSize: sizeStyles[size].fontSize }]}>
          {icon}
        </Text>
      )}
      <Text style={[styles.text, { color: statusColors.text, fontSize: sizeStyles[size].fontSize }]}>
        {status}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  icon: {
    fontWeight: '700',
  },
  text: {
    fontWeight: '600',
  },
});



