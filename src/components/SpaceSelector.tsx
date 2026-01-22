/**
 * Space Selector Component
 * Dropdown to switch between Octopus Deploy spaces
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSpaces } from '../hooks/useOctopusQuery';
import { useAuth } from '../context/AuthContext';
import { useColors } from '../context/ThemeContext';
import { fontSize, spacing, borderRadius } from '../theme/spacing';
import type { Space } from '../lib/api/types';

export const SpaceSelector: React.FC = () => {
  const colors = useColors();
  const { height: screenHeight } = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState(false);
  const { data: spaces, isLoading } = useSpaces();
  const { currentSpace, switchSpace } = useAuth();
  
  // Calculate max list height based on screen size (leaving room for header and padding)
  const maxListHeight = Math.min(screenHeight * 0.7, 600);

  const handleOpenModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
  }, []);

  const handleSelectSpace = useCallback(async (space: Space) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalVisible(false);
    await switchSpace(space.Id);
  }, [switchSpace]);

  const currentSpaceName = currentSpace?.Name || 'Select Space';
  const currentSpaceDescription = currentSpace?.Description || currentSpace?.Id || '';

  const styles = StyleSheet.create({
    selectorContainer: {
      marginBottom: spacing.sm,
    },
    selectorLabel: {
      color: colors.text.tertiary,
      fontSize: fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.tertiary,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    selectorPressed: {
      opacity: 0.7,
    },
    selectorContent: {
      flex: 1,
    },
    selectorName: {
      color: colors.text.primary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    selectorDescription: {
      color: colors.text.tertiary,
      fontSize: fontSize.xs,
      marginTop: 1,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    modalContent: {
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.xl,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: colors.border.muted,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.muted,
    },
    modalTitle: {
      color: colors.text.primary,
      fontSize: fontSize.xl,
      fontWeight: '700',
    },
    loadingContainer: {
      padding: spacing.xxl,
      alignItems: 'center',
      gap: spacing.md,
    },
    loadingText: {
      color: colors.text.secondary,
      fontSize: fontSize.md,
    },
    listContainer: {
      maxHeight: maxListHeight,
    },
    spaceList: {
    },
    spaceListContent: {
      paddingVertical: spacing.sm,
    },
    spaceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      marginHorizontal: spacing.sm,
      marginVertical: spacing.xs,
      borderRadius: borderRadius.lg,
      gap: spacing.md,
    },
    spaceItemSelected: {
      backgroundColor: colors.interactive.focus,
    },
    spaceItemPressed: {
      backgroundColor: colors.background.tertiary,
    },
    spaceItemContent: {
      flex: 1,
      gap: 2,
    },
    spaceItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    spaceItemName: {
      color: colors.text.primary,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    spaceItemDescription: {
      color: colors.text.tertiary,
      fontSize: fontSize.sm,
    },
    spaceItemId: {
      color: colors.text.tertiary,
      fontSize: fontSize.sm,
      fontFamily: 'monospace',
    },
    defaultBadge: {
      backgroundColor: colors.brand.primary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    defaultBadgeText: {
      color: colors.text.inverse,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    emptyContainer: {
      padding: spacing.xxl,
      alignItems: 'center',
      gap: spacing.md,
    },
    emptyText: {
      color: colors.text.secondary,
      fontSize: fontSize.md,
      textAlign: 'center',
    },
  });

  return (
    <>
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>Space</Text>
        <Pressable 
          style={({ pressed }) => [
            styles.selector,
            pressed && styles.selectorPressed,
          ]} 
          onPress={handleOpenModal}
        >
          <View style={styles.selectorContent}>
            <Text style={styles.selectorName} numberOfLines={1}>
              {currentSpaceName}
            </Text>
            {currentSpaceDescription && (
              <Text style={styles.selectorDescription} numberOfLines={1}>
                {currentSpaceDescription}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </Pressable>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Switch Space</Text>
              <Pressable 
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </Pressable>
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.brand.primary} size="large" />
                <Text style={styles.loadingText}>Loading spaces...</Text>
              </View>
            ) : (
              <View style={styles.listContainer}>
                <FlatList
                  data={spaces}
                  keyExtractor={(item) => item.Id}
                  renderItem={({ item }) => {
                    const isSelected = currentSpace?.Id === item.Id;
                    return (
                      <Pressable
                        style={({ pressed }) => [
                          styles.spaceItem,
                          isSelected && styles.spaceItemSelected,
                          pressed && styles.spaceItemPressed,
                        ]}
                        onPress={() => handleSelectSpace(item)}
                      >
                        <View style={styles.spaceItemContent}>
                          <View style={styles.spaceItemHeader}>
                            <Text style={styles.spaceItemName}>{item.Name}</Text>
                            {item.IsDefault && (
                              <View style={styles.defaultBadge}>
                                <Text style={styles.defaultBadgeText}>Default</Text>
                              </View>
                            )}
                          </View>
                          {item.Description ? (
                            <Text style={styles.spaceItemDescription} numberOfLines={1}>
                              {item.Description}
                            </Text>
                          ) : (
                            <Text style={styles.spaceItemId}>{item.Id}</Text>
                          )}
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={24} color={colors.brand.primary} />
                        )}
                      </Pressable>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No spaces available</Text>
                    </View>
                  }
                  style={styles.spaceList}
                  contentContainerStyle={styles.spaceListContent}
                />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};
