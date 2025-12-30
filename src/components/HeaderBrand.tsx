/**
 * HeaderBrand Component
 * App icon + name branding for the header
 */

import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '../context/ThemeContext';
import { spacing, borderRadius, fontSize, fontFamily } from '../theme/spacing';

const octoGoIcon = require('../../assets/icon.png');

interface HeaderBrandProps {
  /** Whether tapping the brand should navigate to dashboard */
  navigateToDashboard?: boolean;
  /** Size variant */
  size?: 'large' | 'default' | 'compact';
}

export const HeaderBrand: React.FC<HeaderBrandProps> = ({ 
  navigateToDashboard = true,
  size = 'default',
}) => {
  const router = useRouter();
  const colors = useColors();
  
  const handlePress = () => {
    if (navigateToDashboard) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/');
    }
  };

  const iconSize = size === 'large' ? 40 : size === 'compact' ? 28 : 32;
  const textSize = size === 'large' ? fontSize.xl : size === 'compact' ? fontSize.md : fontSize.lg;

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingBottom: size === 'large' ? spacing.sm : 0,
    },
    iconContainer: {
      width: iconSize,
      height: iconSize,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
    },
    icon: {
      width: iconSize,
      height: iconSize,
    },
    text: {
      color: colors.white,
      fontSize: textSize,
      fontFamily: fontFamily.bold,
      letterSpacing: -0.5,
    },
  });

  const content = (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Image source={octoGoIcon} style={styles.icon} resizeMode="contain" />
      </View>
      <Text style={styles.text}>OctoGo</Text>
    </View>
  );

  if (navigateToDashboard) {
    return (
      <Pressable onPress={handlePress} hitSlop={8}>
        {content}
      </Pressable>
    );
  }

  return content;
};

