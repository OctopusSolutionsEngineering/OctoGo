/**
 * Notifications Screen
 * Shows all pending interventions that require user action
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { 
  useNotifications, 
  getInterruptionTypeLabel, 
  canRespond, 
  getAvailableActions 
} from '../src/context/NotificationsContext';
import { useAuth } from '../src/context/AuthContext';
import { useTask } from '../src/hooks/useOctopusQuery';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { EmptyState } from '../src/components/ui/EmptyState';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';
import { colors } from '../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../src/theme/spacing';
import type { Interruption } from '../src/lib/api/types';
import type { CrossInstanceAuthFailure } from '../src/lib/api/client';

interface InterventionItemProps {
  interruption: Interruption;
  onViewTask: (taskId: string) => void;
  onSubmit: (action: 'Proceed' | 'Abort' | 'Fail' | 'Retry' | 'Ignore' | 'Exclude', notes?: string) => void;
  onTakeResponsibility: () => void;
  isSubmitting: boolean;
  // Cross-instance context (optional - when showing interruptions from other instances)
  instanceName?: string;
  spaceName?: string;
  isCrossInstance?: boolean;
}

const InterventionItem: React.FC<InterventionItemProps> = ({
  interruption,
  onViewTask,
  onSubmit,
  onTakeResponsibility,
  isSubmitting,
  instanceName,
  spaceName,
  isCrossInstance = false,
}) => {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    key: 'Proceed' | 'Abort' | 'Fail' | 'Retry' | 'Ignore' | 'Exclude';
    label: string;
    variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  } | null>(null);
  
  // Fetch associated task for context (only for current instance)
  // Don't fetch task for cross-instance interruptions (would need different credentials)
  const { data: task } = useTask(interruption.TaskId, { 
    refetchInterval: false,
    enabled: !isCrossInstance,
  });
  
  const typeLabel = getInterruptionTypeLabel(interruption);
  const isGuidedFailure = interruption.Form?.Values?.Guidance === 'GuidedFailure';
  const userCanRespond = canRespond(interruption);
  const needsResponsibility = !interruption.HasResponsibility && !interruption.ResponsibleUserId && interruption.CanTakeResponsibility;
  const actions = getAvailableActions(interruption);

  const handleConfirmAction = () => {
    if (confirmAction) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSubmit(confirmAction.key, notes || undefined);
      setConfirmAction(null);
    }
  };

  const getConfirmationMessage = (actionKey: string) => {
    switch (actionKey) {
      case 'Proceed':
        return 'This will approve the manual intervention and allow the deployment to continue.';
      case 'Abort':
        return 'This will reject the intervention and abort the deployment. This action cannot be undone.';
      case 'Fail':
        return 'This will mark the step as failed and stop the deployment.';
      case 'Retry':
        return 'This will retry the failed step.';
      case 'Ignore':
        return 'This will ignore the failure and continue with the deployment.';
      case 'Exclude':
        return 'This will exclude the machine and continue with the deployment.';
      default:
        return 'Are you sure you want to continue?';
    }
  };

  const getActionColor = (variant: string) => {
    switch (variant) {
      case 'primary':
        return colors.brand.primary;
      case 'danger':
        return colors.status.error;
      default:
        return colors.text.secondary;
    }
  };
  
  // Get text from form elements
  const formText = interruption.Form?.Elements
    ?.filter(el => el.Control?.Type === 'Paragraph' && el.Control?.Text)
    .map(el => el.Control?.Text)
    .join('\n');

  const timeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  return (
    <Card style={[
      styles.interventionCard,
      isGuidedFailure ? styles.guidedFailureCard : styles.manualInterventionCard,
    ]}>
      {/* Header */}
      <Pressable 
        style={styles.interventionHeader}
        onPress={() => {
          Haptics.selectionAsync();
          setExpanded(!expanded);
        }}
      >
        <View style={styles.headerLeft}>
          <View style={[
            styles.typeIconContainer,
            isGuidedFailure ? styles.typeIconGuidedFailure : styles.typeIconManual,
          ]}>
            <Ionicons 
              name={isGuidedFailure ? 'warning' : 'hand-left'} 
              size={18} 
              color={isGuidedFailure ? colors.status.warning : colors.brand.primary} 
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.typeLabel}>{typeLabel}</Text>
            <Text style={styles.timeAgo}>{timeAgo(interruption.Created)}</Text>
          </View>
        </View>
        <Ionicons 
          name={expanded ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color={colors.text.tertiary} 
        />
      </Pressable>
      
      {/* Instance/Space context for cross-instance interruptions */}
      {isCrossInstance && instanceName && spaceName && (
        <View style={styles.crossInstanceBadge}>
          <Ionicons name="server-outline" size={12} color={colors.text.tertiary} />
          <Text style={styles.crossInstanceText}>
            {instanceName} • {spaceName}
          </Text>
        </View>
      )}
      
      {/* Title */}
      <Text style={styles.interventionTitle} numberOfLines={expanded ? undefined : 2}>
        {interruption.Title || 'Manual intervention required'}
      </Text>
      
      {/* Task context */}
      {task && (
        <Pressable 
          style={styles.taskContext}
          onPress={() => onViewTask(interruption.TaskId)}
        >
          <Ionicons name="rocket-outline" size={14} color={colors.text.tertiary} />
          <Text style={styles.taskDescription} numberOfLines={1}>
            {task.Description || task.Name}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
        </Pressable>
      )}
      
      {/* Expanded content */}
      {expanded && (
        <>
          {/* Form text/message */}
          {formText && (
            <View style={styles.formTextContainer}>
              <Text style={styles.formText}>{formText}</Text>
            </View>
          )}
          
          {/* Responsibility notice */}
          {needsResponsibility && (
            <View style={styles.responsibilityNotice}>
              <Ionicons name="person-outline" size={16} color={colors.status.info} />
              <Text style={styles.responsibilityText}>
                You need to take responsibility before you can respond
              </Text>
            </View>
          )}
          
          {/* Notes input toggle - only show after taking responsibility */}
          {!needsResponsibility && userCanRespond && (
            <>
              <Pressable 
                style={styles.notesToggle}
                onPress={() => setShowNotes(!showNotes)}
              >
                <Ionicons 
                  name={showNotes ? 'chevron-up' : 'create-outline'} 
                  size={16} 
                  color={colors.text.tertiary} 
                />
                <Text style={styles.notesToggleText}>
                  {showNotes ? 'Hide notes' : 'Add notes (optional)'}
                </Text>
              </Pressable>

              {showNotes && (
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add notes about your decision..."
                  placeholderTextColor={colors.text.tertiary}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                />
              )}
            </>
          )}
          
          {/* Action buttons */}
          <View style={styles.actionsContainer}>
            {needsResponsibility ? (
              <Button
                title="Take Responsibility"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onTakeResponsibility();
                }}
                variant="primary"
                loading={isSubmitting}
                style={styles.fullWidthButton}
              />
            ) : userCanRespond && (
              <View style={styles.actionButtons}>
                {actions.map((action) => (
                  <Pressable
                    key={action.key}
                    style={[
                      styles.actionButton,
                      action.variant === 'primary' && styles.actionButtonPrimary,
                      action.variant === 'danger' && styles.actionButtonDanger,
                      action.variant === 'secondary' && styles.actionButtonSecondary,
                      action.variant === 'ghost' && styles.actionButtonGhost,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setConfirmAction(action);
                    }}
                    disabled={isSubmitting}
                  >
                    <Text style={[
                      styles.actionButtonText,
                      action.variant === 'primary' && styles.actionButtonTextPrimary,
                      action.variant === 'danger' && styles.actionButtonTextDanger,
                      action.variant === 'secondary' && styles.actionButtonTextSecondary,
                      action.variant === 'ghost' && styles.actionButtonTextGhost,
                    ]}>
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          
          {/* View task button */}
          <Pressable 
            style={styles.viewTaskButton}
            onPress={() => onViewTask(interruption.TaskId)}
          >
            <Text style={styles.viewTaskButtonText}>View Full Task</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.brand.primary} />
          </Pressable>
        </>
      )}

      {/* Confirmation Modal */}
      <Modal
        visible={!!confirmAction}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmAction(null)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setConfirmAction(null)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={[
                styles.modalIcon, 
                { backgroundColor: getActionColor(confirmAction?.variant || 'primary') + '20' }
              ]}>
                <Ionicons 
                  name={
                    confirmAction?.key === 'Proceed' ? 'checkmark-circle' :
                    confirmAction?.key === 'Abort' ? 'close-circle' :
                    confirmAction?.key === 'Retry' ? 'refresh' :
                    confirmAction?.key === 'Fail' ? 'alert-circle' :
                    'help-circle'
                  } 
                  size={32} 
                  color={getActionColor(confirmAction?.variant || 'primary')} 
                />
              </View>
              <Text style={styles.modalTitle}>
                Confirm {confirmAction?.label}
              </Text>
            </View>
            
            <Text style={styles.modalMessage}>
              {confirmAction && getConfirmationMessage(confirmAction.key)}
            </Text>

            {!!notes && (
              <View style={styles.modalNotesPreview}>
                <Text style={styles.modalNotesLabel}>Your notes:</Text>
                <Text style={styles.modalNotesText} numberOfLines={2}>{notes}</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setConfirmAction(null)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </Pressable>
              
              <Pressable
                style={[
                  styles.modalConfirmButton,
                  { backgroundColor: getActionColor(confirmAction?.variant || 'primary') }
                ]}
                onPress={handleConfirmAction}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Text style={styles.modalConfirmButtonText}>Processing...</Text>
                ) : (
                  <Text style={styles.modalConfirmButtonText}>
                    {confirmAction?.label}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { currentInstance, currentSpace, deleteInstance, updateInstanceApiKey } = useAuth();
  const {
    pendingInterruptions,
    isLoading,
    totalCount,
    manualInterventionCount,
    guidedFailureCount,
    refetch,
    refetchCrossInstance,
    submitInterruption,
    takeResponsibility,
    isSubmitting,
    crossInstanceInterruptions,
    crossInstanceAuthFailures,
    clearCrossInstanceAuthFailure,
    isCrossInstanceLoading,
    lastCrossInstancePoll,
  } = useNotifications();
  const [authFailureModal, setAuthFailureModal] = useState<CrossInstanceAuthFailure | null>(null);
  const [showApiKeyEditor, setShowApiKeyEditor] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [isUpdatingApiKey, setIsUpdatingApiKey] = useState(false);
  const [isRemovingInstance, setIsRemovingInstance] = useState(false);
  
  // Filter cross-instance interruptions to exclude current instance/space (avoid duplicates)
  const otherInstanceInterruptions = useMemo(() => {
    return crossInstanceInterruptions.filter(ci => {
      const isSameInstanceSpace = 
        ci.instanceId === currentInstance?.id && 
        ci.spaceId === currentSpace?.Id;
      return !isSameInstanceSpace;
    });
  }, [crossInstanceInterruptions, currentInstance?.id, currentSpace?.Id]);

  const handleViewTask = useCallback((taskId: string) => {
    router.push(`/task/${taskId}`);
  }, [router]);

  const handleSubmit = useCallback(async (
    interruptionId: string,
    action: 'Proceed' | 'Abort' | 'Fail' | 'Retry' | 'Ignore' | 'Exclude',
    notes?: string,
    instanceId?: string,
    spaceId?: string
  ) => {
    try {
      await submitInterruption(interruptionId, action, notes, instanceId, spaceId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to submit response. Please try again.');
    }
  }, [submitInterruption]);

  const handleTakeResponsibility = useCallback(async (
    interruptionId: string,
    instanceId?: string,
    spaceId?: string
  ) => {
    try {
      await takeResponsibility(interruptionId, instanceId, spaceId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to take responsibility. Please try again.');
    }
  }, [takeResponsibility]);

  const handleRefresh = useCallback(() => {
    refetch();
    refetchCrossInstance();
  }, [refetch, refetchCrossInstance]);

  useEffect(() => {
    if (!authFailureModal && crossInstanceAuthFailures.length > 0) {
      setAuthFailureModal(crossInstanceAuthFailures[0]);
      setShowApiKeyEditor(false);
      setNewApiKey('');
    }
  }, [crossInstanceAuthFailures, authFailureModal]);

  const dismissAuthFailureModal = useCallback((instanceId?: string) => {
    if (instanceId) {
      clearCrossInstanceAuthFailure(instanceId);
    }
    setAuthFailureModal(null);
    setShowApiKeyEditor(false);
    setNewApiKey('');
  }, [clearCrossInstanceAuthFailure]);

  const handleRemoveFailedInstance = useCallback(async () => {
    if (!authFailureModal) return;
    setIsRemovingInstance(true);
    try {
      await deleteInstance(authFailureModal.instanceId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dismissAuthFailureModal(authFailureModal.instanceId);
      await refetchCrossInstance();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Remove Failed', 'Could not remove this instance. Please try again.');
    } finally {
      setIsRemovingInstance(false);
    }
  }, [authFailureModal, deleteInstance, dismissAuthFailureModal, refetchCrossInstance]);

  const handleSaveApiKey = useCallback(async () => {
    if (!authFailureModal) return;
    const trimmedApiKey = newApiKey.trim();
    if (!trimmedApiKey) {
      Alert.alert('API Key Required', 'Please enter a new API key.');
      return;
    }

    setIsUpdatingApiKey(true);
    try {
      const result = await updateInstanceApiKey(authFailureModal.instanceId, trimmedApiKey);
      if (!result.success) {
        Alert.alert('Update Failed', result.error || 'Could not update the API key.');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      dismissAuthFailureModal(authFailureModal.instanceId);
      await refetchCrossInstance();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Update Failed', 'Could not update the API key. Please try again.');
    } finally {
      setIsUpdatingApiKey(false);
    }
  }, [authFailureModal, newApiKey, updateInstanceApiKey, dismissAuthFailureModal, refetchCrossInstance]);

  if (isLoading && pendingInterruptions.length === 0 && crossInstanceInterruptions.length === 0) {
    return <LoadingScreen message="Loading notifications..." />;
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: 'Notifications',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.background.secondary },
          headerTintColor: colors.text.primary,
        }} 
      />
      
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isLoading || isCrossInstanceLoading}
              onRefresh={handleRefresh}
              tintColor={colors.brand.primary}
            />
          }
        >
          {/* Summary header - only show when there's something to summarize (2+ items) */}
          {totalCount > 1 && (
            <View style={styles.summaryContainer}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryCount}>{totalCount}</Text>
                <Text style={styles.summaryLabel}>Total Pending</Text>
              </View>
              {manualInterventionCount > 0 && (
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryCount, { color: colors.brand.primary }]}>
                    {manualInterventionCount}
                  </Text>
                  <Text style={styles.summaryLabel}>Manual</Text>
                </View>
              )}
              {guidedFailureCount > 0 && (
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryCount, { color: colors.status.warning }]}>
                    {guidedFailureCount}
                  </Text>
                  <Text style={styles.summaryLabel}>Guided Failure</Text>
                </View>
              )}
            </View>
          )}
          
          {/* Empty state */}
          {totalCount === 0 && (
            <EmptyState
              ionicon="checkmark-circle-outline"
              title="All Clear!"
              message="There are no pending interventions that require your attention."
            />
          )}
          
          {/* Current space interventions */}
          {pendingInterruptions.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Current Space</Text>
              {pendingInterruptions.map((interruption) => (
                <InterventionItem
                  key={interruption.Id}
                  interruption={interruption}
                  onViewTask={handleViewTask}
                  onSubmit={(action, notes) => handleSubmit(interruption.Id, action, notes)}
                  onTakeResponsibility={() => handleTakeResponsibility(interruption.Id)}
                  isSubmitting={isSubmitting}
                />
              ))}
            </>
          )}
          
          {/* Cross-instance interventions */}
          {otherInstanceInterruptions.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Other Instances & Spaces</Text>
              {lastCrossInstancePoll && (
                <Text style={styles.lastPollText}>
                  Last checked: {lastCrossInstancePoll.toLocaleTimeString()}
                </Text>
              )}
              {otherInstanceInterruptions.map((ci) => (
                <InterventionItem
                  key={`${ci.instanceId}-${ci.spaceId}-${ci.interruption.Id}`}
                  interruption={ci.interruption}
                  onViewTask={handleViewTask}
                  onSubmit={(action, notes) => handleSubmit(
                    ci.interruption.Id, 
                    action, 
                    notes, 
                    ci.instanceId, 
                    ci.spaceId
                  )}
                  onTakeResponsibility={() => handleTakeResponsibility(
                    ci.interruption.Id, 
                    ci.instanceId, 
                    ci.spaceId
                  )}
                  isSubmitting={isSubmitting}
                  instanceName={ci.instanceName}
                  spaceName={ci.spaceName}
                  isCrossInstance={true}
                />
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={!!authFailureModal}
        transparent
        animationType="fade"
        onRequestClose={() => dismissAuthFailureModal(authFailureModal?.instanceId)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => dismissAuthFailureModal(authFailureModal?.instanceId)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: colors.status.error + '20' }]}>
                <Ionicons name="alert-circle" size={32} color={colors.status.error} />
              </View>
              <Text style={styles.modalTitle}>Instance Login Failed</Text>
            </View>

            <Text style={styles.modalMessage}>
              {showApiKeyEditor
                ? `Enter a new API key for "${authFailureModal?.instanceName}" and retry polling.`
                : `Could not authenticate "${authFailureModal?.instanceName}" while checking manual interventions. ${authFailureModal?.message || 'The API key may be invalid.'}`}
            </Text>

            {!showApiKeyEditor && authFailureModal?.serverUrl && (
              <View style={styles.modalNotesPreview}>
                <Text style={styles.modalNotesLabel}>Server</Text>
                <Text style={styles.modalNotesText}>{authFailureModal.serverUrl}</Text>
              </View>
            )}

            {showApiKeyEditor ? (
              <>
                <TextInput
                  style={styles.notesInput}
                  placeholder="New API key"
                  placeholderTextColor={colors.text.tertiary}
                  value={newApiKey}
                  onChangeText={setNewApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.modalButtons}>
                  <Pressable
                    style={styles.modalCancelButton}
                    onPress={() => setShowApiKeyEditor(false)}
                    disabled={isUpdatingApiKey}
                  >
                    <Text style={styles.modalCancelButtonText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalConfirmButton, { backgroundColor: colors.brand.primary }]}
                    onPress={handleSaveApiKey}
                    disabled={isUpdatingApiKey}
                  >
                    <Text style={styles.modalConfirmButtonText}>
                      {isUpdatingApiKey ? 'Saving...' : 'Save Key'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.modalCancelButton}
                  onPress={() => setShowApiKeyEditor(true)}
                  disabled={isRemovingInstance}
                >
                  <Text style={styles.modalCancelButtonText}>Update API Key</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalConfirmButton, { backgroundColor: colors.status.error }]}
                  onPress={handleRemoveFailedInstance}
                  disabled={isRemovingInstance}
                >
                  <Text style={styles.modalConfirmButtonText}>
                    {isRemovingInstance ? 'Removing...' : 'Remove Instance'}
                  </Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  interventionCard: {
    padding: spacing.md,
    borderWidth: 1,
  },
  manualInterventionCard: {
    borderColor: colors.brand.primary + '40',
    backgroundColor: colors.status.infoDim,
  },
  guidedFailureCard: {
    borderColor: colors.status.warning + '40',
    backgroundColor: colors.status.warningDim,
  },
  interventionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconManual: {
    backgroundColor: colors.brand.primary + '20',
  },
  typeIconGuidedFailure: {
    backgroundColor: colors.status.warning + '20',
  },
  headerInfo: {
    gap: 2,
  },
  typeLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  timeAgo: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  interventionTitle: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
    lineHeight: 22,
  },
  taskContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.sm,
  },
  taskDescription: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  formTextContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
  },
  formText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  responsibilityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.status.infoDim,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.status.info + '30',
  },
  responsibilityText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  notesToggleText: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
  },
  notesInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.muted,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionsContainer: {
    marginTop: spacing.md,
  },
  fullWidthButton: {
    width: '100%',
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: colors.brand.primary,
  },
  actionButtonDanger: {
    backgroundColor: colors.status.error + '20',
  },
  actionButtonSecondary: {
    backgroundColor: colors.background.tertiary,
  },
  actionButtonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  actionButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  actionButtonTextPrimary: {
    color: colors.white,
  },
  actionButtonTextDanger: {
    color: colors.status.error,
  },
  actionButtonTextSecondary: {
    color: colors.text.primary,
  },
  actionButtonTextGhost: {
    color: colors.text.secondary,
  },
  viewTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.muted,
  },
  viewTaskButtonText: {
    fontSize: fontSize.sm,
    color: colors.brand.primary,
    fontWeight: '500',
  },
  // Confirmation Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalMessage: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  modalNotesPreview: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  modalNotesLabel: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  modalNotesText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  modalCancelButtonText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: colors.text.inverse,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // Cross-instance styles
  crossInstanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  crossInstanceText: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  sectionHeader: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lastPollText: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
});
