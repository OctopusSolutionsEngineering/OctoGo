/**
 * PageTitle Component
 * Consistent page title for main tab screens
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../context/ThemeContext';
import { fontSize, spacing, fontFamily } from '../../theme/spacing';

type IconName = keyof typeof Ionicons.glyphMap;

interface PageTitleProps {
  title: string;
  icon?: IconName;
  subtitle?: string;
}

export const PageTitle: React.FC<PageTitleProps> = ({ title, icon, subtitle }) => {
  const colors = useColors();
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <View style={styles.titleRow}>
        {icon && (
          <Ionicons 
            name={icon} 
            size={24} 
            color={colors.brand.primary} 
            style={styles.icon}
          />
        )}
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {title}
        </Text>
      </View>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.text.muted }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
  title: {
    fontSize: fontSize.xxl,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.md + 24, // Align with title when icon is present
  },
});

