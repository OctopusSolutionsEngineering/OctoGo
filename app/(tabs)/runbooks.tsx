/**
 * Runbooks Screen
 * View and manage runbooks and their recent runs
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRunbooks, useRunbookRuns, useProjects } from '../../src/hooks/useOctopusQuery';
import { Card } from '../../src/components/ui/Card';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { PageTitle } from '../../src/components/ui/PageTitle';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';
import type { Runbook, RunbookRun } from '../../src/lib/api/types';

interface RunbookWithProject extends Runbook {
  projectName: string;
  lastRun?: RunbookRun;
}

export default function RunbooksScreen() {
  const router = useRouter();
  const { data: runbooksData, isLoading: runbooksLoading, error: runbooksError, refetch: refetchRunbooks } = useRunbooks({ take: 100 });
  const { data: runsData, isLoading: runsLoading, refetch: refetchRuns } = useRunbookRuns({ take: 50 });
  const { data: projectsData, isLoading: projectsLoading } = useProjects({ take: 200 });
  
  const runbooks = runbooksData?.Items || [];
  const runs = runsData?.Items || [];
  const projects = projectsData?.Items || [];
  const isLoading = runbooksLoading || runsLoading || projectsLoading;

  // Create project map for quick lookup
  const projectMap = useMemo(() => {
    return new Map(projects.map(p => [p.Id, p]));
  }, [projects]);

  // Create a map of runbook ID to latest run
  const latestRunMap = useMemo(() => {
    const map = new Map<string, RunbookRun>();
    // Sort by Created desc and pick first for each runbook
    const sortedRuns = [...runs].sort((a, b) => 
      new Date(b.Created).getTime() - new Date(a.Created).getTime()
    );
    for (const run of sortedRuns) {
      if (!map.has(run.RunbookId)) {
        map.set(run.RunbookId, run);
      }
    }
    return map;
  }, [runs]);

  // Combine runbooks with project info and last run
  const runbooksWithData = useMemo((): RunbookWithProject[] => {
    return runbooks.map(rb => ({
      ...rb,
      projectName: projectMap.get(rb.ProjectId)?.Name || 'Unknown Project',
      lastRun: latestRunMap.get(rb.Id),
    })).sort((a, b) => {
      // Sort by last run time (most recent first), then by name
      const aTime = a.lastRun ? new Date(a.lastRun.Created).getTime() : 0;
      const bTime = b.lastRun ? new Date(b.lastRun.Created).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return a.Name.localeCompare(b.Name);
    });
  }, [runbooks, projectMap, latestRunMap]);

  // Calculate stats
  const stats = useMemo(() => {
    const recentRuns = runs.filter(r => {
      const created = new Date(r.Created);
      const now = new Date();
      return now.getTime() - created.getTime() < 24 * 60 * 60 * 1000;
    });
    
    const publishedCount = runbooks.filter(rb => rb.PublishedRunbookSnapshotId !== null).length;
    
    return {
      totalRunbooks: runbooks.length,
      publishedCount,
      runsLast24h: recentRuns.length,
    };
  }, [runbooks, runs]);

  const handleRefresh = useCallback(() => {
    refetchRunbooks();
    refetchRuns();
  }, [refetchRunbooks, refetchRuns]);

  const handleRunbookPress = useCallback((runbook: Runbook) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/runbook/${runbook.Id}`);
  }, [router]);

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const renderRunbook = useCallback(({ item }: { item: RunbookWithProject }) => {
    const isPublished = item.PublishedRunbookSnapshotId !== null;
    
    return (
      <Card
        onPress={() => handleRunbookPress(item)}
        style={styles.runbookCard}
      >
        <View style={styles.runbookHeader}>
          <View style={styles.runbookIcon}>
            <Ionicons name="play-circle-outline" size={24} color={colors.brand.primary} />
          </View>
          <View style={styles.runbookInfo}>
            <View style={styles.runbookNameRow}>
              <Text style={styles.runbookName} numberOfLines={1}>{item.Name}</Text>
              {!isPublished && (
                <View style={styles.draftBadge}>
                  <Text style={styles.draftBadgeText}>Draft</Text>
                </View>
              )}
            </View>
            <Text style={styles.projectName} numberOfLines={1}>{item.projectName}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
        
        {item.Description && (
          <Text style={styles.runbookDescription} numberOfLines={2}>
            {item.Description}
          </Text>
        )}
        
        <View style={styles.runbookFooter}>
          {item.lastRun ? (
            <>
              <View style={styles.lastRunInfo}>
                <Text style={styles.lastRunLabel}>Last run:</Text>
                <Text style={styles.lastRunTime}>{getTimeAgo(item.lastRun.Created)}</Text>
              </View>
              <StatusBadge status={item.lastRun.TaskId ? 'Success' : 'Queued'} size="sm" />
            </>
          ) : (
            <Text style={styles.neverRun}>Never run</Text>
          )}
        </View>
      </Card>
    );
  }, [handleRunbookPress]);

  const keyExtractor = useCallback((item: Runbook) => item.Id, []);

  if (runbooksError) {
    return (
      <ErrorView
        message={runbooksError.message}
        onRetry={handleRefresh}
        fullScreen
      />
    );
  }

  if (isLoading && runbooks.length === 0) {
    return <LoadingScreen message="Loading runbooks..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Page Title */}
      <PageTitle 
        title="Runbooks" 
        icon="book"
      />
      
      {/* Stats Row - matching dashboard style */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statItemValue}>{stats.totalRunbooks}</Text>
          <Text style={styles.statItemLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statItemValue, { color: colors.status.success }]}>{stats.publishedCount}</Text>
          <Text style={styles.statItemLabel}>Published</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statItemValue, stats.runsLast24h === 0 && styles.statItemValueMuted]}>
            {stats.runsLast24h === 0 ? '—' : stats.runsLast24h}
          </Text>
          <Text style={styles.statItemLabel}>{stats.runsLast24h === 0 ? 'Quiet 24h' : 'Runs 24h'}</Text>
        </View>
      </View>

      <FlatList
        data={runbooksWithData}
        renderItem={renderRunbook}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.brand.primary}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="📋"
              title="No runbooks found"
              message="Create runbooks in Octopus Deploy to automate operations tasks"
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
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  statItem: {
    flex: 1,
    flexBasis: 0,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  statItemValue: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  statItemLabel: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  statItemValueMuted: {
    color: colors.text.tertiary,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.muted,
    marginVertical: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    flexGrow: 1,
  },
  separator: {
    height: spacing.sm,
  },
  runbookCard: {
    padding: spacing.md,
  },
  runbookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  runbookIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.interactive.focus,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  runbookInfo: {
    flex: 1,
  },
  runbookNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  runbookName: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
    flexShrink: 1,
  },
  draftBadge: {
    backgroundColor: colors.status.warning + '20',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  draftBadgeText: {
    color: colors.status.warning,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  projectName: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  chevron: {
    color: colors.text.tertiary,
    fontSize: fontSize.xxl,
    fontWeight: '300',
  },
  runbookDescription: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  runbookFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  lastRunInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lastRunLabel: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
  },
  lastRunTime: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  neverRun: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
});
