/**
 * Deployments Screen
 * View and monitor deployments
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTasks, useSpaces } from '../../src/hooks/useOctopusQuery';
import { useAuth } from '../../src/context/AuthContext';
import { Card } from '../../src/components/ui/Card';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PageTitle } from '../../src/components/ui/PageTitle';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';
import type { Task } from '../../src/lib/api/types';

type FilterState = 'all' | 'active' | 'success' | 'failed';

const FILTER_OPTIONS: { key: FilterState; label: string; states?: string[] }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active', states: ['Executing', 'Queued'] },
  { key: 'success', label: 'Success', states: ['Success'] },
  { key: 'failed', label: 'Failed', states: ['Failed', 'TimedOut', 'Canceled'] },
];

export default function DeploymentsScreen() {
  const router = useRouter();
  const { currentSpace } = useAuth();
  const [filter, setFilter] = useState<FilterState>('all');
  const [showAllSpaces, setShowAllSpaces] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const activeStates = FILTER_OPTIONS.find(f => f.key === filter)?.states;
  
  const { data: tasksData, isLoading, error, refetch } = useTasks({
    take: 100, // Increased to account for client-side space filtering
    states: activeStates,
    name: 'Deploy',
  });
  
  // Fetch spaces for lookup
  const { data: spaces } = useSpaces();
  const spaceLookup = React.useMemo(() => {
    const map: Record<string, string> = {};
    spaces?.forEach(space => {
      map[space.Id] = space.Name;
    });
    return map;
  }, [spaces]);
  
  // Filter tasks by current space (unless showing all spaces)
  // Both status filter (via API) and space filter are applied
  const filteredTasks = React.useMemo(() => {
    const allTasks = tasksData?.Items ?? [];
    // When showing all spaces or no current space, return all tasks
    if (showAllSpaces || !currentSpace?.Id) {
      return allTasks;
    }
    // Filter to only tasks from the current space
    return allTasks.filter(task => task.SpaceId === currentSpace.Id);
  }, [tasksData, showAllSpaces, currentSpace?.Id]);
  
  // Refetch when tab gains focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );
  
  // Manual refresh handler with minimum spinner time for better UX
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      // Ensure spinner shows for at least 500ms for visual feedback
      setTimeout(() => setRefreshing(false), 500);
    }
  }, [refetch]);
  
  const tasks = filteredTasks;

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatDuration = (duration: string): string => {
    // Duration comes in format like "00:01:23.456"
    const parts = duration.split(':');
    if (parts.length >= 3) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      const seconds = parseFloat(parts[2]).toFixed(0);
      
      if (hours > 0) return `${hours}h ${minutes}m`;
      if (minutes > 0) return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
    }
    return duration;
  };

  const handleTaskPress = useCallback((task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/task/${task.Id}`);
  }, [router]);

  const renderTask = useCallback(({ item }: { item: Task }) => {
    const spaceName = item.SpaceId ? spaceLookup[item.SpaceId] : null;
    
    return (
      <Card
        onPress={() => handleTaskPress(item)}
        style={styles.taskCard}
      >
        <View style={styles.taskHeader}>
          <View style={styles.taskInfo}>
            <Text style={styles.taskDescription} numberOfLines={2}>
              {item.Description}
            </Text>
          </View>
          <StatusBadge status={item.State} size="sm" />
        </View>
        
        <View style={styles.taskFooter}>
          <View style={styles.taskMeta}>
            {item.State === 'Executing' && (
              <View style={styles.progressIndicator}>
                <View style={styles.progressDot} />
                <Text style={styles.progressText}>In progress</Text>
              </View>
            )}
            
            {item.IsCompleted && item.Duration && (
              <View style={styles.durationContainer}>
                <Ionicons name="time-outline" size={12} color={colors.text.secondary} />
                <Text style={styles.duration}>{formatDuration(item.Duration)}</Text>
              </View>
            )}
            
            {showAllSpaces && spaceName && (
              <View style={styles.spaceTag}>
                <Ionicons name="layers-outline" size={12} color={colors.text.tertiary} />
                <Text style={styles.spaceText}>{spaceName}</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.timeAgo}>
            {getTimeAgo(item.QueueTime)}
          </Text>
        </View>
        
        {item.HasWarningsOrErrors && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>⚠️ Has warnings or errors</Text>
          </View>
        )}
        
        {item.HasPendingInterruptions && (
          <View style={styles.interruptionBanner}>
            <Text style={styles.interruptionText}>⏸️ Awaiting intervention</Text>
          </View>
        )}
      </Card>
    );
  }, [handleTaskPress, spaceLookup, showAllSpaces]);

  const keyExtractor = useCallback((item: Task) => item.Id, []);

  if (error) {
    return (
      <ErrorView
        message={error.message}
        onRetry={refetch}
        fullScreen
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Page Title */}
      <PageTitle 
        title="Tasks" 
        icon="rocket"
      />
      
      {/* Space Scope Toggle */}
      <View style={styles.scopeContainer}>
        <Pressable
          style={[styles.scopeButton, !showAllSpaces && styles.scopeButtonActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setShowAllSpaces(false);
          }}
        >
          <Ionicons 
            name="layers-outline" 
            size={14} 
            color={!showAllSpaces ? colors.white : colors.text.secondary} 
          />
          <Text style={[styles.scopeButtonText, !showAllSpaces && styles.scopeButtonTextActive]}>
            {currentSpace?.Name || 'Current Space'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.scopeButton, showAllSpaces && styles.scopeButtonActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setShowAllSpaces(true);
          }}
        >
          <Ionicons 
            name="globe-outline" 
            size={14} 
            color={showAllSpaces ? colors.white : colors.text.secondary} 
          />
          <Text style={[styles.scopeButtonText, showAllSpaces && styles.scopeButtonTextActive]}>
            All Spaces
          </Text>
        </Pressable>
      </View>
      
      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        {FILTER_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            style={[
              styles.filterTab,
              filter === option.key && styles.filterTabActive,
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setFilter(option.key);
            }}
          >
            <Text style={[
              styles.filterTabText,
              filter === option.key && styles.filterTabTextActive,
            ]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.brand.primary}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              ionicon="rocket-outline"
              title="No tasks found"
              message={filter !== 'all' ? 'Try a different filter' : 'Tasks will appear here when deployments run'}
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scopeContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  scopeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  scopeButtonActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  scopeButtonText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  scopeButtonTextActive: {
    color: colors.white,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterTab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  filterTabActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  filterTabText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: colors.white,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    flexGrow: 1,
  },
  separator: {
    height: spacing.sm,
  },
  taskCard: {
    padding: spacing.md,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  taskInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  taskDescription: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '500',
    lineHeight: 22,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.primary,
  },
  progressText: {
    color: colors.brand.primary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  duration: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
  },
  spaceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  spaceText: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
  },
  timeAgo: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
  },
  warningBanner: {
    backgroundColor: colors.status.warningDim,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  warningText: {
    color: colors.status.warning,
    fontSize: fontSize.xs,
  },
  interruptionBanner: {
    backgroundColor: colors.status.pendingDim,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  interruptionText: {
    color: colors.status.pending,
    fontSize: fontSize.xs,
  },
});
