/**
 * Task Detail Screen
 * Shows detailed task information with live logs and intervention handling
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { 
  useTaskDetails, 
  useCancelTask, 
  useTaskRaw, 
  useTaskInterruptions,
  useSubmitInterruption,
  useTakeResponsibility,
  useDeployment,
  useRunbookRun,
  useProject,
  useRelease,
  useEnvironment,
  useTenant,
  useRunbook,
} from '../../src/hooks/useOctopusQuery';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';
import type { ActivityLog } from '../../src/lib/api/types';

type ViewMode = 'activity' | 'raw';

// Helper to extract deployment ID from task arguments
const getDeploymentIdFromTask = (task: { Name?: string; Arguments?: Record<string, unknown> }): string | null => {
  // Check if it's a deployment task
  if (task.Name?.includes('Deploy')) {
    const args = task.Arguments as Record<string, string> | undefined;
    return args?.DeploymentId || null;
  }
  return null;
};

// Helper to extract runbook run ID from task arguments  
const getRunbookRunIdFromTask = (task: { Name?: string; Arguments?: Record<string, unknown> }): string | null => {
  // Check if it's a runbook task
  if (task.Name?.includes('Runbook')) {
    const args = task.Arguments as Record<string, string> | undefined;
    return args?.RunbookRunId || null;
  }
  return null;
};

const getLogColor = (category: string): string => {
  switch (category) {
    case 'Error':
    case 'Fatal':
      return colors.status.error;
    case 'Warning':
      return colors.status.warning;
    case 'Highlight':
      return colors.brand.primary;
    case 'Wait':
    case 'Planned':
      return colors.status.pending;
    default:
      return colors.text.secondary;
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'Success':
      return colors.status.success;
    case 'SuccessWithWarning':
    case 'Warning':
      return colors.status.warning;
    case 'Failed':
    case 'TimedOut':
      return colors.status.error;
    case 'Running':
    case 'Executing':
      return colors.status.info;
    case 'Pending':
    case 'Queued':
      return colors.status.pending;
    case 'Skipped':
    case 'Canceled':
    case 'Cancelled':
      return colors.text.tertiary;
    default:
      return colors.text.tertiary;
  }
};

const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'Success':
      return '✓';
    case 'SuccessWithWarning':
      return '⚠';
    case 'Failed':
    case 'TimedOut':
      return '✕';
    case 'Running':
    case 'Executing':
      return '●';
    case 'Pending':
    case 'Queued':
      return '○';
    case 'Warning':
      return '⚠';
    case 'Skipped':
      return '→';
    case 'Canceled':
    case 'Cancelled':
      return '◌';
    default:
      return '○';
  }
};

// Check if an activity has warnings in its logs or children
const hasWarningsOrErrors = (activity: ActivityLog): boolean => {
  // Check direct log elements for warnings/errors
  if (activity.LogElements?.some(log => 
    log.Category === 'Warning' || log.Category === 'Error' || log.Category === 'Fatal'
  )) {
    return true;
  }
  
  // Check children recursively
  if (activity.Children?.some(child => hasWarningsOrErrors(child))) {
    return true;
  }
  
  return false;
};

// Get effective status considering log warnings
const getEffectiveStatus = (activity: ActivityLog): string => {
  // If status is explicitly Warning or Failed, use that
  if (activity.Status === 'Warning' || activity.Status === 'Failed') {
    return activity.Status;
  }
  
  // If successful but has warning logs, show as success with warning
  if (activity.Status === 'Success' && hasWarningsOrErrors(activity)) {
    return 'SuccessWithWarning';
  }
  
  return activity.Status;
};

interface ActivityItemProps {
  activity: ActivityLog;
  depth?: number;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ activity, depth = 0 }) => {
  const [expanded, setExpanded] = useState(depth < 2);

  const hasChildren = activity.Children && activity.Children.length > 0;
  const hasLogs = activity.LogElements && activity.LogElements.length > 0;
  const effectiveStatus = getEffectiveStatus(activity);
  const statusColor = getStatusColor(effectiveStatus);
  const statusIcon = getStatusIcon(effectiveStatus);

  return (
    <View style={[styles.activityItem, { marginLeft: depth * spacing.md }]}>
      <Pressable 
        style={styles.activityHeader}
        onPress={() => {
          if (hasChildren || hasLogs) {
            Haptics.selectionAsync();
            setExpanded(!expanded);
          }
        }}
      >
        <View 
          style={[
            styles.activityStatusBadge,
            { backgroundColor: statusColor + '20' }
          ]} 
        >
          <Text style={[styles.activityStatusIcon, { color: statusColor }]}>
            {statusIcon}
          </Text>
        </View>
        <Text style={styles.activityName} numberOfLines={expanded ? undefined : 1}>
          {activity.Name}
        </Text>
        {(hasChildren || hasLogs) && (
          <Text style={styles.expandIcon}>{expanded ? '−' : '+'}</Text>
        )}
      </Pressable>

      {expanded && hasLogs && (
        <View style={styles.logElements}>
          {activity.LogElements.map((log, index) => (
            <View key={index} style={styles.logLine}>
              <Text style={[styles.logText, { color: getLogColor(log.Category) }]}>
                {log.MessageText}
              </Text>
            </View>
          ))}
        </View>
      )}

      {expanded && hasChildren && (
        <View style={styles.activityChildren}>
          {activity.Children.map((child, index) => (
            <ActivityItem key={`${child.Id}-${index}`} activity={child} depth={depth + 1} />
          ))}
        </View>
      )}
    </View>
  );
};

// Task Context component to show related resources
interface TaskContextCardProps {
  task: { Name?: string; Description?: string; Arguments?: Record<string, unknown> };
  onNavigate: (route: string) => void;
}

const TaskContextCard: React.FC<TaskContextCardProps> = ({ task, onNavigate }) => {
  // Extract IDs from task arguments
  const deploymentId = getDeploymentIdFromTask(task);
  const runbookRunId = getRunbookRunIdFromTask(task);
  
  // Also extract IDs directly from Arguments (more reliable)
  const args = task.Arguments as Record<string, string> | undefined;
  const directDeploymentId = args?.DeploymentId;
  const directRunbookRunId = args?.RunbookRunId;
  
  const effectiveDeploymentId = deploymentId || directDeploymentId;
  const effectiveRunbookRunId = runbookRunId || directRunbookRunId;
  
  // Fetch deployment and related resources (with error handling)
  const { data: deployment, isError: deploymentError } = useDeployment(effectiveDeploymentId || '');
  const { data: runbookRun, isError: runbookRunError } = useRunbookRun(effectiveRunbookRunId || '');
  
  // Get IDs from deployment or runbook run
  const projectId = deployment?.ProjectId || runbookRun?.ProjectId;
  const environmentId = deployment?.EnvironmentId || runbookRun?.EnvironmentId;
  const releaseId = deployment?.ReleaseId;
  const tenantId = deployment?.TenantId || runbookRun?.TenantId;
  const runbookId = runbookRun?.RunbookId;
  
  // Fetch related resource names
  const { data: project } = useProject(projectId || '');
  const { data: release } = useRelease(releaseId || '');
  const { data: environment } = useEnvironment(environmentId || '');
  const { data: tenant } = useTenant(tenantId || '');
  const { data: runbook } = useRunbook(runbookId || '');
  
  // Parse info from task description as fallback
  // e.g. "Deploy Swift Bridge release 25.12.16162317 to Development"
  const parseDescriptionInfo = () => {
    const desc = task.Description || '';
    const info: { projectName?: string; releaseVersion?: string; environmentName?: string; runbookName?: string } = {};
    
    // Deployment pattern: "Deploy {Project} release {Version} to {Environment}"
    const deployMatch = desc.match(/^Deploy (.+?) release ([\d.]+) to (.+?)$/);
    if (deployMatch) {
      info.projectName = deployMatch[1];
      info.releaseVersion = deployMatch[2];
      info.environmentName = deployMatch[3];
    }
    
    // Runbook pattern: "Run {Runbook} on {Environment}"
    const runbookMatch = desc.match(/^Run (.+?) on (.+?)(?: for tenant (.+))?$/);
    if (runbookMatch) {
      info.runbookName = runbookMatch[1];
      info.environmentName = runbookMatch[2];
    }
    
    return info;
  };
  
  const descInfo = parseDescriptionInfo();
  
  // Build context items - prefer API data, fallback to parsed description
  const contextItems: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress?: () => void }[] = [];
  
  // Project
  if (project) {
    contextItems.push({
      icon: 'cube-outline',
      label: 'Project',
      value: project.Name,
      onPress: () => onNavigate(`/project/${project.Id}`),
    });
  } else if (descInfo.projectName) {
    contextItems.push({
      icon: 'cube-outline',
      label: 'Project',
      value: descInfo.projectName,
    });
  }
  
  // Environment
  if (environment) {
    contextItems.push({
      icon: 'server-outline',
      label: 'Environment',
      value: environment.Name,
    });
  } else if (descInfo.environmentName) {
    contextItems.push({
      icon: 'server-outline',
      label: 'Environment',
      value: descInfo.environmentName,
    });
  }
  
  // Release
  if (release) {
    contextItems.push({
      icon: 'pricetag-outline',
      label: 'Release',
      value: release.Version,
      onPress: () => onNavigate(`/release/${release.Id}`),
    });
  } else if (descInfo.releaseVersion) {
    contextItems.push({
      icon: 'pricetag-outline',
      label: 'Release',
      value: descInfo.releaseVersion,
    });
  }
  
  // Runbook
  if (runbook) {
    contextItems.push({
      icon: 'book-outline',
      label: 'Runbook',
      value: runbook.Name,
      onPress: () => onNavigate(`/runbook/${runbook.Id}`),
    });
  } else if (descInfo.runbookName) {
    contextItems.push({
      icon: 'book-outline',
      label: 'Runbook',
      value: descInfo.runbookName,
    });
  }
  
  // Tenant
  if (tenant) {
    contextItems.push({
      icon: 'people-outline',
      label: 'Tenant',
      value: tenant.Name,
    });
  }
  
  // Don't render if we have nothing to show
  if (contextItems.length === 0) {
    return null;
  }
  
  return (
    <Card style={styles.contextCard}>
      <Text style={styles.contextTitle}>Context</Text>
      {contextItems.map((item, index) => (
        <Pressable
          key={index}
          style={[styles.contextRow, item.onPress && styles.contextRowPressable]}
          onPress={item.onPress}
          disabled={!item.onPress}
        >
          <View style={styles.contextLabelContainer}>
            <Ionicons name={item.icon} size={16} color={colors.text.tertiary} />
            <Text style={styles.contextLabel}>{item.label}</Text>
          </View>
          <View style={styles.contextValueContainer}>
            <Text style={styles.contextValue} numberOfLines={1}>{item.value}</Text>
            {item.onPress && (
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            )}
          </View>
        </Pressable>
      ))}
    </Card>
  );
};

// Intervention component for handling guided failures
interface InterventionCardProps {
  interruption: any;
  onSubmit: (action: 'Proceed' | 'Abort' | 'Fail' | 'Retry' | 'Ignore' | 'Exclude', notes?: string) => void;
  onTakeResponsibility: () => void;
  isSubmitting: boolean;
}

const InterventionCard: React.FC<InterventionCardProps> = ({ 
  interruption, 
  onSubmit, 
  onTakeResponsibility,
  isSubmitting 
}) => {
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const getActions = () => {
    // Default actions for guided failure
    const actions: { key: 'Proceed' | 'Abort' | 'Fail' | 'Retry' | 'Ignore' | 'Exclude'; label: string; color: string }[] = [];
    
    if (interruption.CanTakeResponsibility && !interruption.ResponsibleUserId) {
      return null; // Show take responsibility first
    }
    
    // Add available actions based on interruption type
    if (interruption.Form?.Values?.Guidance === 'GuidedFailure') {
      actions.push({ key: 'Fail', label: 'Fail', color: colors.status.error });
      actions.push({ key: 'Retry', label: 'Retry', color: colors.status.warning });
      actions.push({ key: 'Ignore', label: 'Ignore', color: colors.text.secondary });
      actions.push({ key: 'Exclude', label: 'Exclude Machine', color: colors.text.secondary });
    } else {
      actions.push({ key: 'Proceed', label: 'Proceed', color: colors.status.success });
      actions.push({ key: 'Abort', label: 'Abort', color: colors.status.error });
    }
    
    return actions;
  };

  const actions = getActions();

  return (
    <Card style={styles.interventionCard}>
      <View style={styles.interventionHeader}>
        <Ionicons name="alert-circle" size={24} color={colors.status.warning} />
        <Text style={styles.interventionTitle}>Intervention Required</Text>
      </View>
      
      <Text style={styles.interventionMessage}>
        {interruption.Title || 'This task requires manual intervention to continue.'}
      </Text>
      
      {interruption.Form?.Elements?.map((element: any, index: number) => (
        <View key={index} style={styles.interventionElement}>
          {element.Control?.Type === 'Paragraph' && (
            <Text style={styles.interventionText}>
              {element.Control.Text}
            </Text>
          )}
        </View>
      ))}

      {!interruption.ResponsibleUserId && interruption.CanTakeResponsibility && (
        <Button
          title="Take Responsibility"
          onPress={onTakeResponsibility}
          variant="primary"
          loading={isSubmitting}
          style={styles.interventionButton}
        />
      )}

      {actions && (
        <>
          <Pressable 
            style={styles.notesToggle}
            onPress={() => setShowNotes(!showNotes)}
          >
            <Text style={styles.notesToggleText}>
              {showNotes ? 'Hide notes' : 'Add notes (optional)'}
            </Text>
            <Ionicons 
              name={showNotes ? 'chevron-up' : 'chevron-down'} 
              size={16} 
              color={colors.text.tertiary} 
            />
          </Pressable>

          {showNotes && (
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes..."
              placeholderTextColor={colors.text.tertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          )}

          <View style={styles.actionButtons}>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                style={[styles.actionButton, { backgroundColor: action.color + '20' }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onSubmit(action.key, notes || undefined);
                }}
                disabled={isSubmitting}
              >
                <Text style={[styles.actionButtonText, { color: action.color }]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </Card>
  );
};

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('activity');
  const [autoScroll, setAutoScroll] = useState(true);
  
  const isExecuting = (state?: string) => state === 'Executing' || state === 'Queued';
  
  const { data: task, isLoading, error, refetch } = useTaskDetails(id!, {
    enabled: !!id,
    // Only poll when task is actively executing - stop polling once completed
    refetchInterval: (query) => {
      const taskState = query.state.data?.State;
      return isExecuting(taskState) ? 5000 : false;
    },
  });

  const isTaskActive = isExecuting(task?.State);

  // Only fetch raw logs when in raw view mode
  const { data: rawLogs, isLoading: rawLoading } = useTaskRaw(id!, {
    enabled: !!id && viewMode === 'raw',
    refetchInterval: isTaskActive ? 3000 : false, // Live refresh only when executing
  });

  // Fetch interruptions only if task has pending interruptions and is active
  const { data: interruptions, refetch: refetchInterruptions } = useTaskInterruptions(id!, {
    enabled: !!id && task?.HasPendingInterruptions === true && isTaskActive,
    refetchInterval: isTaskActive ? 10000 : false,
  });

  const cancelMutation = useCancelTask();
  const submitInterruptionMutation = useSubmitInterruption();
  const takeResponsibilityMutation = useTakeResponsibility();

  // Auto-scroll to bottom when raw logs update (if enabled)
  useEffect(() => {
    if (autoScroll && viewMode === 'raw' && rawLogs) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [rawLogs, autoScroll, viewMode]);

  const formatDuration = (duration: string): string => {
    const parts = duration.split(':');
    if (parts.length >= 3) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      const seconds = parseFloat(parts[2]).toFixed(0);
      
      if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
      if (minutes > 0) return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
    }
    return duration;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancel Task',
      'Are you sure you want to cancel this task?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMutation.mutateAsync(id!);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (_error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to cancel task');
            }
          },
        },
      ]
    );
  }, [id, cancelMutation]);

  const handleSubmitInterruption = useCallback(async (
    interruptionId: string,
    action: 'Proceed' | 'Abort' | 'Fail' | 'Retry' | 'Ignore' | 'Exclude',
    notes?: string
  ) => {
    try {
      await submitInterruptionMutation.mutateAsync({ interruptionId, action, notes });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchInterruptions();
      refetch();
    } catch (_error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to submit response');
    }
  }, [submitInterruptionMutation, refetchInterruptions, refetch]);

  const handleTakeResponsibility = useCallback(async (interruptionId: string) => {
    try {
      await takeResponsibilityMutation.mutateAsync(interruptionId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchInterruptions();
    } catch (_error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to take responsibility');
    }
  }, [takeResponsibilityMutation, refetchInterruptions]);

  const handleNavigate = useCallback((route: string) => {
    router.push(route as any);
  }, [router]);

  if (isLoading && !task) {
    return <LoadingScreen message="Loading task details..." />;
  }

  if (error) {
    return (
      <ErrorView
        message={error.message}
        onRetry={refetch}
        fullScreen
      />
    );
  }

  if (!task) {
    return (
      <ErrorView
        message="Task not found"
        fullScreen
      />
    );
  }

  const canCancel = task.State === 'Executing' || task.State === 'Queued';
  const isTaskRunning = isExecuting(task.State);

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: 'Task Details',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.background.secondary },
          headerTintColor: colors.text.primary,
        }} 
      />
      
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.brand.primary}
            />
          }
        >
          {/* Status Header */}
          <Card style={styles.headerCard}>
            <View style={styles.statusHeader}>
              <StatusBadge status={task.State} size="lg" />
              {task.Progress && isTaskRunning && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill,
                        { width: `${task.Progress.ProgressPercentage}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {task.Progress.ProgressPercentage.toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>
            
            <Text style={styles.taskDescription}>
              {task.Description || task.Name || `Task ${task.Id}`}
            </Text>

            {task.ErrorMessage && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{task.ErrorMessage}</Text>
              </View>
            )}

            {canCancel && (
              <Button
                title="Cancel Task"
                onPress={handleCancel}
                variant="danger"
                loading={cancelMutation.isPending}
                style={styles.cancelButton}
              />
            )}
          </Card>

          {/* Task Context - Project, Release, Environment, etc. */}
          <TaskContextCard task={task} onNavigate={handleNavigate} />

          {/* Pending Interruptions */}
          {interruptions && interruptions.length > 0 && (
            <View style={styles.section}>
              {interruptions.map((interruption) => (
                <InterventionCard
                  key={interruption.Id}
                  interruption={interruption}
                  onSubmit={(action, notes) => handleSubmitInterruption(interruption.Id, action, notes)}
                  onTakeResponsibility={() => handleTakeResponsibility(interruption.Id)}
                  isSubmitting={submitInterruptionMutation.isPending || takeResponsibilityMutation.isPending}
                />
              ))}
            </View>
          )}

          {/* Timing Info */}
          <Card style={styles.contextCard}>
            <Text style={styles.contextTitle}>Timing</Text>
            <View style={styles.contextRow}>
              <View style={styles.contextLabelContainer}>
                <Ionicons name="hourglass-outline" size={16} color={colors.text.tertiary} />
                <Text style={styles.contextLabel}>Queued</Text>
              </View>
              <Text style={styles.contextValue}>{formatDate(task.QueueTime)}</Text>
            </View>
            
            <View style={styles.contextRow}>
              <View style={styles.contextLabelContainer}>
                <Ionicons name="play-outline" size={16} color={colors.text.tertiary} />
                <Text style={styles.contextLabel}>Started</Text>
              </View>
              <Text style={styles.contextValue}>{formatDate(task.StartTime)}</Text>
            </View>
            
            {task.CompletedTime && (
              <View style={styles.contextRow}>
                <View style={styles.contextLabelContainer}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.text.tertiary} />
                  <Text style={styles.contextLabel}>Completed</Text>
                </View>
                <Text style={styles.contextValue}>{formatDate(task.CompletedTime)}</Text>
              </View>
            )}
            
            {task.Duration && (
              <View style={[styles.contextRow, { borderBottomWidth: 0 }]}>
                <View style={styles.contextLabelContainer}>
                  <Ionicons name="time-outline" size={16} color={colors.text.tertiary} />
                  <Text style={styles.contextLabel}>Duration</Text>
                </View>
                <Text style={styles.contextValue}>{formatDuration(task.Duration)}</Text>
              </View>
            )}
          </Card>

          {/* Log View Mode Toggle */}
          <View style={styles.section}>
            <View style={styles.viewModeContainer}>
              <Text style={styles.sectionTitle}>Logs</Text>
              <View style={styles.viewModeToggle}>
                <Pressable
                  style={[styles.viewModeButton, viewMode === 'activity' && styles.viewModeButtonActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setViewMode('activity');
                  }}
                >
                  <Text style={[styles.viewModeText, viewMode === 'activity' && styles.viewModeTextActive]}>
                    Activity
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.viewModeButton, viewMode === 'raw' && styles.viewModeButtonActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setViewMode('raw');
                  }}
                >
                  <Text style={[styles.viewModeText, viewMode === 'raw' && styles.viewModeTextActive]}>
                    Raw
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Activity Logs */}
            {viewMode === 'activity' && task.ActivityLogs && task.ActivityLogs.length > 0 && (
              <Card style={styles.activityCard}>
                {task.ActivityLogs.map((activity, index) => (
                  <ActivityItem key={`${activity.Id}-${index}`} activity={activity} />
                ))}
              </Card>
            )}

            {/* Raw Logs */}
            {viewMode === 'raw' && (
              <Card style={styles.rawLogsCard}>
                <View style={styles.rawLogsHeader}>
                  {isTaskRunning && (
                    <View style={styles.liveIndicator}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>Live</Text>
                    </View>
                  )}
                  <Pressable
                    style={styles.autoScrollToggle}
                    onPress={() => setAutoScroll(!autoScroll)}
                  >
                    <Ionicons 
                      name={autoScroll ? 'checkbox' : 'square-outline'} 
                      size={18} 
                      color={autoScroll ? colors.brand.primary : colors.text.tertiary} 
                    />
                    <Text style={[styles.autoScrollText, autoScroll && styles.autoScrollTextActive]}>
                      Auto-scroll
                    </Text>
                  </Pressable>
                </View>
                
                {rawLoading && !rawLogs ? (
                  <View style={styles.rawLogsLoading}>
                    <Text style={styles.rawLogsLoadingText}>Loading logs...</Text>
                  </View>
                ) : (
                  <View style={styles.rawLogsContainer}>
                    <ScrollView 
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                      style={styles.rawLogsScrollV}
                    >
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={true}
                        nestedScrollEnabled={true}
                      >
                        <Text style={styles.rawLogsText} selectable>
                          {rawLogs || 'No logs available'}
                        </Text>
                      </ScrollView>
                    </ScrollView>
                  </View>
                )}
              </Card>
            )}

            {viewMode === 'activity' && (!task.ActivityLogs || task.ActivityLogs.length === 0) && (
              <Card>
                <Text style={styles.emptyText}>No activity logs available</Text>
              </Card>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
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
  headerCard: {
    padding: spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
    gap: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brand.primary,
    borderRadius: 4,
  },
  progressText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  taskDescription: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '500',
    lineHeight: 26,
  },
  errorBanner: {
    backgroundColor: colors.status.errorDim,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.status.error,
    fontSize: fontSize.sm,
  },
  cancelButton: {
    marginTop: spacing.md,
  },
  // Context card styles
  contextCard: {
    padding: spacing.md,
  },
  contextTitle: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.muted,
  },
  contextRowPressable: {
    // No additional styles needed, but pressable rows show chevron
  },
  contextLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contextLabel: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  contextValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    justifyContent: 'flex-end',
  },
  contextValue: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    textAlign: 'right',
    maxWidth: '70%',
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  viewModeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  viewModeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  viewModeButtonActive: {
    backgroundColor: colors.brand.primary,
  },
  viewModeText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  viewModeTextActive: {
    color: colors.white,
  },
  activityCard: {
    padding: spacing.sm,
  },
  activityItem: {
    marginBottom: spacing.sm,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  activityStatusBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityStatusIcon: {
    fontSize: 12,
    fontWeight: '700',
  },
  activityName: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  expandIcon: {
    color: colors.text.tertiary,
    fontSize: fontSize.lg,
    marginLeft: spacing.sm,
    width: 24,
    textAlign: 'center',
  },
  activityChildren: {
    marginTop: spacing.xs,
  },
  logElements: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.lg,
  },
  logLine: {
    paddingVertical: 2,
  },
  logText: {
    fontSize: fontSize.xs,
    fontFamily: 'monospace',
  },
  rawLogsCard: {
    padding: spacing.md,
  },
  rawLogsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.muted,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },
  liveText: {
    color: colors.status.success,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  autoScrollToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  autoScrollText: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
  },
  autoScrollTextActive: {
    color: colors.brand.primary,
  },
  rawLogsContainer: {
    maxHeight: 400,
    minHeight: 200,
  },
  rawLogsScrollV: {
    flex: 1,
  },
  rawLogsText: {
    color: colors.text.primary,
    fontSize: fontSize.xs,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  rawLogsLoading: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  rawLogsLoadingText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    padding: spacing.lg,
  },
  // Intervention styles
  interventionCard: {
    padding: spacing.md,
    backgroundColor: colors.status.warningDim,
    borderWidth: 1,
    borderColor: colors.status.warning,
    marginBottom: spacing.md,
  },
  interventionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  interventionTitle: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  interventionMessage: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  interventionElement: {
    marginBottom: spacing.sm,
  },
  interventionText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  interventionButton: {
    marginTop: spacing.sm,
  },
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
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
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.muted,
    minHeight: 80,
    textAlignVertical: 'top',
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
  },
  actionButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
