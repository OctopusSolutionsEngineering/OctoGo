/**
 * Runbook Detail Screen
 * View runbook details and execute runs
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { 
  useRunbook, 
  useProject,
  useEnvironments,
  useRunbookEnvironments,
  useRunbookSnapshots,
  useRunbookRuns,
  useRunbookProcessById,
  useCreateRunbookRun,
} from '../../src/hooks/useOctopusQuery';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ProcessStepsView } from '../../src/components/ProcessStepsView';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';
import type { Environment, RunbookSnapshot } from '../../src/lib/api/types';

export default function RunbookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Only apply bottom insets on Android - iOS handles safe area automatically
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;
  
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedEnvironments, setSelectedEnvironments] = useState<Environment[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<RunbookSnapshot | null>(null);

  const { data: runbook, isLoading: runbookLoading, error: runbookError, refetch: refetchRunbook } = useRunbook(id!);
  const { data: project } = useProject(runbook?.ProjectId || '');
  const { data: environments } = useEnvironments(); // For display purposes (env names)
  const { data: availableEnvironments = [], isLoading: environmentsLoading } = useRunbookEnvironments(runbook?.ProjectId, id);
  const { data: snapshotsData, isLoading: snapshotsLoading, refetch: refetchSnapshots } = useRunbookSnapshots(id!, { take: 10 });
  const { data: runsData, isLoading: runsLoading, refetch: refetchRuns } = useRunbookRuns({ runbookId: id!, take: 20 });
  // Use the RunbookProcessId from the runbook for efficient process fetching
  const { data: runbookProcess } = useRunbookProcessById(runbook?.RunbookProcessId);
  
  const createRunbookRun = useCreateRunbookRun();

  const snapshots = snapshotsData?.Items || [];
  const runs = runsData?.Items || [];
  const isLoading = runbookLoading || snapshotsLoading || runsLoading;

  // Get published snapshot if available
  const publishedSnapshot = useMemo(() => {
    if (!runbook?.PublishedRunbookSnapshotId || !snapshots.length) return null;
    return snapshots.find(s => s.Id === runbook.PublishedRunbookSnapshotId) || snapshots[0];
  }, [runbook, snapshots]);

  const handleRefresh = useCallback(() => {
    refetchRunbook();
    refetchSnapshots();
    refetchRuns();
  }, [refetchRunbook, refetchSnapshots, refetchRuns]);

  const openRunModal = useCallback(() => {
    if (!publishedSnapshot) {
      Alert.alert('No Published Snapshot', 'This runbook does not have a published snapshot. Please publish a snapshot in Octopus Deploy first.');
      return;
    }
    setSelectedSnapshot(publishedSnapshot);
    setSelectedEnvironments([]);
    setShowRunModal(true);
  }, [publishedSnapshot]);

  const toggleEnvironment = useCallback((env: Environment) => {
    Haptics.selectionAsync();
    setSelectedEnvironments(prev => {
      const isSelected = prev.some(e => e.Id === env.Id);
      if (isSelected) {
        return prev.filter(e => e.Id !== env.Id);
      } else {
        return [...prev, env];
      }
    });
  }, []);

  const handleRunRunbook = useCallback(async () => {
    if (selectedEnvironments.length === 0 || !selectedSnapshot || !runbook) {
      Alert.alert('Error', 'Please select at least one environment');
      return;
    }

    try {
      // Run for each selected environment
      const runs = await Promise.all(
        selectedEnvironments.map(env =>
          createRunbookRun.mutateAsync({
            runbookId: runbook.Id,
            runbookSnapshotId: selectedSnapshot.Id,
            environmentId: env.Id,
          })
        )
      );
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRunModal(false);
      
      const envNames = selectedEnvironments.map(e => e.Name).join(', ');
      const envCount = selectedEnvironments.length;
      
      Alert.alert(
        'Runbook Started',
        `${runbook.Name} is now running on ${envCount === 1 ? envNames : `${envCount} environments: ${envNames}`}`,
        envCount === 1
          ? [
              { text: 'View Task', onPress: () => router.push(`/task/${runs[0].TaskId}`) },
              { text: 'OK' },
            ]
          : [{ text: 'OK' }]
      );
      
      refetchRuns();
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to run runbook');
    }
  }, [runbook, selectedEnvironments, selectedSnapshot, createRunbookRun, router, refetchRuns]);

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getEnvironmentName = (envId: string): string => {
    return environments?.find(e => e.Id === envId)?.Name || envId;
  };

  if (runbookLoading && !runbook) {
    return <LoadingScreen message="Loading runbook..." />;
  }

  if (runbookError) {
    return (
      <ErrorView
        message={runbookError.message}
        onRetry={handleRefresh}
        fullScreen
      />
    );
  }

  if (!runbook) {
    return (
      <ErrorView
        message="Runbook not found"
        fullScreen
      />
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: runbook.Name,
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
              refreshing={isLoading}
              onRefresh={handleRefresh}
              tintColor={colors.brand.primary}
            />
          }
        >
          {/* Runbook Header */}
          <Card style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="play-circle" size={32} color={colors.brand.primary} />
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.runbookName}>{runbook.Name}</Text>
                <Text style={styles.projectName}>{project?.Name || 'Loading...'}</Text>
              </View>
            </View>

            {runbook.Description && (
              <Text style={styles.description}>{runbook.Description}</Text>
            )}

            <Button
              title="Run Now"
              onPress={openRunModal}
              variant="primary"
              style={styles.runButton}
            />
          </Card>

          {/* Runbook Info */}
          <Card>
            <Text style={styles.cardTitle}>Configuration</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Multi-Tenancy</Text>
              <Text style={styles.infoValue}>{runbook.MultiTenancyMode}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Environment Scope</Text>
              <Text style={styles.infoValue}>{runbook.EnvironmentScope}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Guided Failure</Text>
              <Text style={styles.infoValue}>{runbook.DefaultGuidedFailureMode}</Text>
            </View>

            {publishedSnapshot && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Published Snapshot</Text>
                <Text style={styles.infoValue}>{publishedSnapshot.Name}</Text>
              </View>
            )}
          </Card>

          {/* Steps */}
          <Card>
            <Text style={styles.cardTitle}>
              Steps ({runbookProcess?.Steps?.length || 0})
            </Text>
            <ProcessStepsView 
              steps={runbookProcess?.Steps || []}
              environments={environments}
              emptyTitle="No steps configured"
              emptyMessage="Configure runbook steps in Octopus Deploy"
            />
          </Card>

          {/* Recent Runs */}
          <Card>
            <Text style={styles.cardTitle}>Recent Runs ({runs.length})</Text>
            {runs.length > 0 ? (
              <View style={styles.runsList}>
                {runs.slice(0, 10).map((run) => (
                  <Pressable
                    key={run.Id}
                    style={styles.runItem}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(`/task/${run.TaskId}`);
                    }}
                  >
                    <View style={styles.runInfo}>
                      <Text style={styles.runEnvironment}>
                        {getEnvironmentName(run.EnvironmentId)}
                      </Text>
                      <Text style={styles.runTime}>{getTimeAgo(run.Created)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <EmptyState
                ionicon="play-circle-outline"
                title="No runs yet"
                message="This runbook hasn't been executed yet"
              />
            )}
          </Card>
        </ScrollView>

        {/* Run Modal */}
        <Modal
          visible={showRunModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowRunModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: spacing.lg + bottomInset }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Run {runbook.Name}</Text>
                <Pressable onPress={() => setShowRunModal(false)}>
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </Pressable>
              </View>

              <Text style={styles.modalLabel}>Select Environments</Text>
              {environmentsLoading ? (
                <View style={styles.environmentLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.brand.primary} />
                  <Text style={styles.environmentLoadingText}>Loading environments...</Text>
                </View>
              ) : availableEnvironments.length === 0 ? (
                <View style={styles.environmentEmptyContainer}>
                  <Ionicons name="alert-circle-outline" size={24} color={colors.text.tertiary} />
                  <Text style={styles.environmentEmptyText}>No environments available for this runbook</Text>
                </View>
              ) : (
                <ScrollView style={styles.environmentList} horizontal={false}>
                  {availableEnvironments.map((env) => {
                    const isSelected = selectedEnvironments.some(e => e.Id === env.Id);
                    return (
                      <Pressable
                        key={env.Id}
                        style={[
                          styles.environmentOption,
                          isSelected && styles.environmentOptionSelected,
                        ]}
                        onPress={() => toggleEnvironment(env)}
                      >
                        <Ionicons 
                          name={isSelected ? 'checkbox' : 'square-outline'} 
                          size={20} 
                          color={isSelected ? colors.brand.primary : colors.text.tertiary} 
                        />
                        <Text style={[
                          styles.environmentOptionText,
                          isSelected && styles.environmentOptionTextSelected,
                        ]}>
                          {env.Name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowRunModal(false)}
                  variant="secondary"
                  style={styles.modalButton}
                />
                <Button
                  title={selectedEnvironments.length > 1 ? `Run on ${selectedEnvironments.length} Envs` : 'Run'}
                  onPress={handleRunRunbook}
                  variant="primary"
                  loading={createRunbookRun.isPending}
                  disabled={selectedEnvironments.length === 0}
                  style={styles.modalButton}
                />
              </View>
            </View>
          </View>
        </Modal>
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
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.interactive.focus,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  runbookName: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  projectName: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  description: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  runButton: {
    marginTop: spacing.sm,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.muted,
  },
  infoLabel: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  infoValue: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  runsList: {
    gap: spacing.xs,
  },
  runItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.muted,
  },
  runInfo: {
    flex: 1,
  },
  runEnvironment: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  runTime: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  modalLabel: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  environmentList: {
    maxHeight: 200,
  },
  environmentLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  environmentLoadingText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  environmentEmptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
  },
  environmentEmptyText: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
  },
  environmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  environmentOptionSelected: {
    backgroundColor: colors.interactive.focus,
  },
  environmentOptionText: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
  },
  environmentOptionTextSelected: {
    color: colors.brand.primary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalButton: {
    flex: 1,
  },
});

