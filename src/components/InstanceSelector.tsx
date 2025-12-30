/**
 * Instance Selector Component
 * Allows switching between multiple Octopus Deploy instances
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
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useColors } from '../context/ThemeContext';
import { fontSize, spacing, borderRadius } from '../theme/spacing';
import type { OctopusInstance } from '../lib/security';

interface InstanceSelectorProps {
  onInstanceSwitch?: () => void;
}

export const InstanceSelector: React.FC<InstanceSelectorProps> = ({ onInstanceSwitch }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<OctopusInstance | null>(null);
  const [newName, setNewName] = useState('');
  const [isSwitching, setIsSwitching] = useState(false);
  
  const router = useRouter();
  const colors = useColors();
  const { 
    instances, 
    currentInstance, 
    switchInstance, 
    deleteInstance, 
    renameInstance,
    isLoading,
    startAddingInstance,
  } = useAuth();

  const handleOpenModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
  }, []);

  const handleSelectInstance = useCallback(async (instance: OctopusInstance) => {
    if (instance.id === currentInstance?.id) {
      setModalVisible(false);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSwitching(true);

    const result = await switchInstance(instance.id);
    
    setIsSwitching(false);
    
    if (result.success) {
      setModalVisible(false);
      onInstanceSwitch?.();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Switch Failed', result.error || 'Failed to switch instance');
    }
  }, [currentInstance?.id, switchInstance, onInstanceSwitch]);

  const handleAddInstance = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(false);
    // Close the drawer menu
    onInstanceSwitch?.();
    // Set flag to allow access to login while authenticated
    startAddingInstance();
    // Navigate to login screen to add new instance
    router.push('/login');
  }, [router, startAddingInstance, onInstanceSwitch]);

  const handleDeleteInstance = useCallback((instance: OctopusInstance) => {
    Alert.alert(
      'Remove Instance',
      `Are you sure you want to remove "${instance.name}"? You'll need to add it again to use it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await deleteInstance(instance.id);
          },
        },
      ]
    );
  }, [deleteInstance]);

  const handleRenamePress = useCallback((instance: OctopusInstance) => {
    // Close the instance selector modal first to avoid nested modal issues
    setModalVisible(false);
    setSelectedInstance(instance);
    setNewName(instance.name);
    // Small delay to let the first modal close
    setTimeout(() => {
      setRenameModalVisible(true);
    }, 100);
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (!selectedInstance || !newName.trim()) return;
    
    await renameInstance(selectedInstance.id, newName.trim());
    setRenameModalVisible(false);
    setSelectedInstance(null);
    setNewName('');
    // Reopen the instance selector modal
    setTimeout(() => {
      setModalVisible(true);
    }, 100);
  }, [selectedInstance, newName, renameInstance]);

  const handleRenameCancel = useCallback(() => {
    setRenameModalVisible(false);
    setSelectedInstance(null);
    setNewName('');
    // Reopen the instance selector modal
    setTimeout(() => {
      setModalVisible(true);
    }, 100);
  }, []);

  const handleLongPress = useCallback((instance: OctopusInstance) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    Alert.alert(
      instance.name,
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rename', onPress: () => handleRenamePress(instance) },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => handleDeleteInstance(instance),
        },
      ]
    );
  }, [handleRenamePress, handleDeleteInstance]);

  // Extract display info from server URL
  const getInstanceDisplayInfo = (instance: OctopusInstance) => {
    try {
      const url = new URL(instance.serverUrl);
      return url.hostname;
    } catch {
      return instance.serverUrl;
    }
  };

  const styles = StyleSheet.create({
    selectorContainer: {
      marginBottom: spacing.md,
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
    selectorUrl: {
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
      maxHeight: '80%',
      borderWidth: 1,
      borderColor: colors.border.muted,
      overflow: 'hidden',
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
    instanceList: {
      maxHeight: 400,
    },
    instanceListContent: {
      paddingVertical: spacing.sm,
    },
    instanceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      marginHorizontal: spacing.sm,
      marginVertical: spacing.xs,
      borderRadius: borderRadius.lg,
      gap: spacing.md,
    },
    instanceItemSelected: {
      backgroundColor: colors.interactive.focus,
    },
    instanceItemPressed: {
      backgroundColor: colors.background.tertiary,
    },
    instanceContent: {
      flex: 1,
      gap: 2,
    },
    instanceName: {
      color: colors.text.primary,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    instanceUrl: {
      color: colors.text.tertiary,
      fontSize: fontSize.sm,
    },
    addInstanceButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.md,
      margin: spacing.md,
      marginTop: spacing.sm,
      backgroundColor: colors.brand.primary + '15',
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.brand.primary + '30',
      borderStyle: 'dashed',
      gap: spacing.sm,
    },
    addInstanceText: {
      color: colors.brand.primary,
      fontSize: fontSize.md,
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
    hintText: {
      color: colors.text.tertiary,
      fontSize: fontSize.xs,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    // Rename modal styles
    renameModalContent: {
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.xl,
      width: '100%',
      maxWidth: 320,
      borderWidth: 1,
      borderColor: colors.border.muted,
      padding: spacing.lg,
    },
    renameInput: {
      backgroundColor: colors.background.tertiary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      color: colors.text.primary,
      fontSize: fontSize.md,
      borderWidth: 1,
      borderColor: colors.border.default,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    renameButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    renameButton: {
      flex: 1,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    renameCancelButton: {
      backgroundColor: colors.background.tertiary,
    },
    renameConfirmButton: {
      backgroundColor: colors.brand.primary,
    },
    renameButtonText: {
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    renameCancelText: {
      color: colors.text.secondary,
    },
    renameConfirmText: {
      color: colors.white,
    },
  });

  const currentInstanceName = currentInstance?.name || 'Select Instance';
  const currentInstanceUrl = currentInstance ? getInstanceDisplayInfo(currentInstance) : '';

  return (
    <>
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>Instance</Text>
        <Pressable 
          style={({ pressed }) => [
            styles.selector,
            pressed && styles.selectorPressed,
          ]} 
          onPress={handleOpenModal}
        >
          <View style={styles.selectorContent}>
            <Text style={styles.selectorName} numberOfLines={1}>
              {currentInstanceName}
            </Text>
            {currentInstanceUrl && (
              <Text style={styles.selectorUrl} numberOfLines={1}>
                {currentInstanceUrl}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </Pressable>
      </View>

      {/* Instance Selector Modal */}
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
              <Text style={styles.modalTitle}>Switch Instance</Text>
              <Pressable 
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </Pressable>
            </View>

            {isLoading || isSwitching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.brand.primary} size="large" />
                <Text style={styles.loadingText}>
                  {isSwitching ? 'Switching instance...' : 'Loading...'}
                </Text>
              </View>
            ) : (
              <>
                <FlatList
                  data={instances}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const isSelected = currentInstance?.id === item.id;
                    return (
                      <Pressable
                        style={({ pressed }) => [
                          styles.instanceItem,
                          isSelected && styles.instanceItemSelected,
                          pressed && styles.instanceItemPressed,
                        ]}
                        onPress={() => handleSelectInstance(item)}
                        onLongPress={() => handleLongPress(item)}
                        delayLongPress={500}
                      >
                        <View style={styles.instanceContent}>
                          <Text style={styles.instanceName}>{item.name}</Text>
                          <Text style={styles.instanceUrl}>
                            {getInstanceDisplayInfo(item)}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={24} color={colors.brand.primary} />
                        )}
                      </Pressable>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No instances configured</Text>
                    </View>
                  }
                  style={styles.instanceList}
                  contentContainerStyle={styles.instanceListContent}
                />

                <Text style={styles.hintText}>
                  Long press an instance to rename or remove it
                </Text>

                <Pressable 
                  style={styles.addInstanceButton}
                  onPress={handleAddInstance}
                >
                  <Ionicons name="add-circle-outline" size={22} color={colors.brand.primary} />
                  <Text style={styles.addInstanceText}>Add Instance</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleRenameCancel}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={handleRenameCancel}
        >
          <Pressable style={styles.renameModalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Rename Instance</Text>
            <TextInput
              style={styles.renameInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Instance name"
              placeholderTextColor={colors.text.tertiary}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.renameButtons}>
              <Pressable 
                style={[styles.renameButton, styles.renameCancelButton]}
                onPress={handleRenameCancel}
              >
                <Text style={[styles.renameButtonText, styles.renameCancelText]}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.renameButton, styles.renameConfirmButton]}
                onPress={handleRenameConfirm}
              >
                <Text style={[styles.renameButtonText, styles.renameConfirmText]}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

