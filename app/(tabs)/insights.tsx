/**
 * Insights / DORA Metrics Screen
 * Deployment analytics and performance metrics
 * Note: Full DORA metrics require Octopus Enterprise license
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDashboard, useProjects, useEnvironments, useTasks } from '../../src/hooks/useOctopusQuery';
import { Card } from '../../src/components/ui/Card';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';

type TimeRange = '24h' | '7d' | '30d';

const TIME_RANGES: { key: TimeRange; label: string; hours: number }[] = [
  { key: '24h', label: '24 Hours', hours: 24 },
  { key: '7d', label: '7 Days', hours: 24 * 7 },
  { key: '30d', label: '30 Days', hours: 24 * 30 },
];

const screenWidth = Dimensions.get('window').width;

export default function InsightsScreen() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  
  const { data: dashboard, isLoading: dashboardLoading, error: dashboardError, refetch } = useDashboard();
  const { data: projectsData } = useProjects({ take: 100 });
  const { data: _environments } = useEnvironments();
  const { data: tasksData } = useTasks({ take: 200 });

  const _tasks = tasksData?.Items || [];
  const _projects = projectsData?.Items || [];

  const selectedTimeRange = TIME_RANGES.find(t => t.key === timeRange)!;

  // Calculate metrics based on dashboard data
  const metrics = useMemo(() => {
    if (!dashboard) return null;

    const now = new Date();
    const cutoffTime = new Date(now.getTime() - selectedTimeRange.hours * 60 * 60 * 1000);
    
    // Filter items within time range
    const recentItems = dashboard.Items.filter(item => {
      const created = new Date(item.Created);
      return created >= cutoffTime;
    });

    // Basic stats
    const totalDeployments = recentItems.length;
    const successfulDeployments = recentItems.filter(i => i.State === 'Success').length;
    const failedDeployments = recentItems.filter(i => i.State === 'Failed' || i.State === 'TimedOut').length;
    const successRate = totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0;

    // Deployment frequency (per day)
    const daysInRange = selectedTimeRange.hours / 24;
    const deploymentFrequency = totalDeployments / daysInRange;

    // Average duration (from completed deployments)
    const completedItems = recentItems.filter(i => i.IsCompleted && i.Duration);
    let avgDurationSeconds = 0;
    if (completedItems.length > 0) {
      const totalSeconds = completedItems.reduce((sum, item) => {
        const parts = item.Duration.split(':');
        if (parts.length >= 3) {
          const hours = parseInt(parts[0]) || 0;
          const minutes = parseInt(parts[1]) || 0;
          const seconds = parseFloat(parts[2]) || 0;
          return sum + (hours * 3600 + minutes * 60 + seconds);
        }
        return sum;
      }, 0);
      avgDurationSeconds = totalSeconds / completedItems.length;
    }

    // Unique projects deployed
    const uniqueProjects = new Set(recentItems.map(i => i.ProjectId)).size;

    // Unique environments deployed to
    const uniqueEnvironments = new Set(recentItems.map(i => i.EnvironmentId)).size;

    // Deployments by environment
    const byEnvironment = new Map<string, { success: number; failed: number; total: number }>();
    recentItems.forEach(item => {
      const envName = dashboard.Environments.find(e => e.Id === item.EnvironmentId)?.Name || 'Unknown';
      const current = byEnvironment.get(envName) || { success: 0, failed: 0, total: 0 };
      current.total++;
      if (item.State === 'Success') current.success++;
      if (item.State === 'Failed' || item.State === 'TimedOut') current.failed++;
      byEnvironment.set(envName, current);
    });

    // Most active projects
    const byProject = new Map<string, number>();
    recentItems.forEach(item => {
      const projectName = dashboard.Projects.find(p => p.Id === item.ProjectId)?.Name || 'Unknown';
      byProject.set(projectName, (byProject.get(projectName) || 0) + 1);
    });
    const topProjects = Array.from(byProject.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Deployments by day of week
    const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    recentItems.forEach(item => {
      const day = new Date(item.Created).getDay();
      byDayOfWeek[day]++;
    });

    // Failure rate trend (simple comparison)
    const halfPoint = new Date(now.getTime() - (selectedTimeRange.hours / 2) * 60 * 60 * 1000);
    const firstHalf = recentItems.filter(i => new Date(i.Created) < halfPoint);
    const secondHalf = recentItems.filter(i => new Date(i.Created) >= halfPoint);
    
    const firstHalfFailRate = firstHalf.length > 0 
      ? (firstHalf.filter(i => i.State === 'Failed' || i.State === 'TimedOut').length / firstHalf.length) * 100 
      : 0;
    const secondHalfFailRate = secondHalf.length > 0 
      ? (secondHalf.filter(i => i.State === 'Failed' || i.State === 'TimedOut').length / secondHalf.length) * 100 
      : 0;
    const failRateTrend = firstHalfFailRate - secondHalfFailRate; // Positive = improving

    return {
      totalDeployments,
      successfulDeployments,
      failedDeployments,
      successRate,
      deploymentFrequency,
      avgDurationSeconds,
      uniqueProjects,
      uniqueEnvironments,
      byEnvironment: Array.from(byEnvironment.entries()),
      topProjects,
      byDayOfWeek,
      failRateTrend,
    };
  }, [dashboard, selectedTimeRange]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  if (dashboardLoading && !dashboard) {
    return <LoadingScreen message="Loading insights..." />;
  }

  if (dashboardError) {
    return (
      <ErrorView
        message={dashboardError.message}
        onRetry={refetch}
        fullScreen
      />
    );
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={dashboardLoading}
            onRefresh={refetch}
            tintColor={colors.brand.primary}
          />
        }
      >
        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          {TIME_RANGES.map((range) => (
            <Pressable
              key={range.key}
              style={[
                styles.timeRangeButton,
                timeRange === range.key && styles.timeRangeButtonActive,
              ]}
              onPress={() => setTimeRange(range.key)}
            >
              <Text style={[
                styles.timeRangeText,
                timeRange === range.key && styles.timeRangeTextActive,
              ]}>
                {range.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* DORA Metrics Banner */}
        <View style={styles.doraBanner}>
          <Ionicons name="analytics" size={24} color={colors.brand.primary} />
          <View style={styles.doraBannerText}>
            <Text style={styles.doraBannerTitle}>Deployment Insights</Text>
            <Text style={styles.doraBannerSubtitle}>
              Based on {metrics?.totalDeployments || 0} deployments in the last {selectedTimeRange.label.toLowerCase()}
            </Text>
          </View>
        </View>

        {/* Key Metrics Grid */}
        {metrics && (
          <>
            <View style={styles.metricsGrid}>
              <Card style={styles.metricCard}>
                <View style={styles.metricIcon}>
                  <Ionicons name="rocket" size={24} color={colors.brand.primary} />
                </View>
                <Text style={styles.metricValue}>
                  {metrics.deploymentFrequency.toFixed(1)}
                </Text>
                <Text style={styles.metricLabel}>Deploys/Day</Text>
              </Card>

              <Card style={styles.metricCard}>
                <View style={[styles.metricIcon, { backgroundColor: colors.status.successDim }]}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
                </View>
                <Text style={[styles.metricValue, { color: colors.status.success }]}>
                  {metrics.successRate.toFixed(0)}%
                </Text>
                <Text style={styles.metricLabel}>Success Rate</Text>
              </Card>

              <Card style={styles.metricCard}>
                <View style={[styles.metricIcon, { backgroundColor: colors.status.infoDim }]}>
                  <Ionicons name="time" size={24} color={colors.status.info} />
                </View>
                <Text style={styles.metricValue}>
                  {formatDuration(metrics.avgDurationSeconds)}
                </Text>
                <Text style={styles.metricLabel}>Avg Duration</Text>
              </Card>

              <Card style={styles.metricCard}>
                <View style={[
                  styles.metricIcon, 
                  { backgroundColor: metrics.failRateTrend >= 0 ? colors.status.successDim : colors.status.errorDim }
                ]}>
                  <Ionicons 
                    name={metrics.failRateTrend >= 0 ? 'trending-down' : 'trending-up'} 
                    size={24} 
                    color={metrics.failRateTrend >= 0 ? colors.status.success : colors.status.error} 
                  />
                </View>
                <Text style={[
                  styles.metricValue,
                  { color: metrics.failRateTrend >= 0 ? colors.status.success : colors.status.error }
                ]}>
                  {Math.abs(metrics.failRateTrend).toFixed(1)}%
                </Text>
                <Text style={styles.metricLabel}>
                  Fail Rate {metrics.failRateTrend >= 0 ? '↓' : '↑'}
                </Text>
              </Card>
            </View>

            {/* Summary Stats */}
            <Card>
              <Text style={styles.cardTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{metrics.totalDeployments}</Text>
                  <Text style={styles.summaryLabel}>Total Deploys</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.status.success }]}>
                    {metrics.successfulDeployments}
                  </Text>
                  <Text style={styles.summaryLabel}>Successful</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.status.error }]}>
                    {metrics.failedDeployments}
                  </Text>
                  <Text style={styles.summaryLabel}>Failed</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{metrics.uniqueProjects}</Text>
                  <Text style={styles.summaryLabel}>Projects</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{metrics.uniqueEnvironments}</Text>
                  <Text style={styles.summaryLabel}>Environments</Text>
                </View>
              </View>
            </Card>

            {/* Deployments by Day */}
            <Card>
              <Text style={styles.cardTitle}>Activity by Day</Text>
              <View style={styles.chartContainer}>
                {metrics.byDayOfWeek.map((count, index) => {
                  const maxCount = Math.max(...metrics.byDayOfWeek, 1);
                  const height = (count / maxCount) * 100;
                  return (
                    <View key={index} style={styles.chartBar}>
                      <View 
                        style={[
                          styles.chartBarFill, 
                          { height: `${height}%` }
                        ]} 
                      />
                      <Text style={styles.chartLabel}>{dayNames[index]}</Text>
                      <Text style={styles.chartValue}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* By Environment */}
            <Card>
              <Text style={styles.cardTitle}>By Environment</Text>
              {metrics.byEnvironment.length > 0 ? (
                <View style={styles.envList}>
                  {metrics.byEnvironment.map(([name, stats]) => (
                    <View key={name} style={styles.envRow}>
                      <Text style={styles.envName}>{name}</Text>
                      <View style={styles.envStats}>
                        <Text style={styles.envTotal}>{stats.total}</Text>
                        <View style={styles.envBadge}>
                          <Text style={[styles.envBadgeText, { color: colors.status.success }]}>
                            {stats.success}✓
                          </Text>
                        </View>
                        {stats.failed > 0 && (
                          <View style={[styles.envBadge, { backgroundColor: colors.status.errorDim }]}>
                            <Text style={[styles.envBadgeText, { color: colors.status.error }]}>
                              {stats.failed}✗
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No deployment data</Text>
              )}
            </Card>

            {/* Top Projects */}
            <Card>
              <Text style={styles.cardTitle}>Most Active Projects</Text>
              {metrics.topProjects.length > 0 ? (
                <View style={styles.projectList}>
                  {metrics.topProjects.map(([name, count], index) => (
                    <View key={name} style={styles.projectRow}>
                      <View style={styles.projectRank}>
                        <Text style={styles.projectRankText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.projectName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.projectCount}>{count}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No project data</Text>
              )}
            </Card>

            {/* Enterprise Note */}
            <View style={styles.enterpriseNote}>
              <Ionicons name="information-circle" size={20} color={colors.text.tertiary} />
              <Text style={styles.enterpriseNoteText}>
                Full DORA metrics (Lead Time, MTTR, Change Failure Rate) require Octopus Enterprise license and Insights feature.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  timeRangeContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  timeRangeButtonActive: {
    backgroundColor: colors.brand.primary,
  },
  timeRangeText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  timeRangeTextActive: {
    color: colors.white,
  },
  doraBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.interactive.focus,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  doraBannerText: {
    flex: 1,
  },
  doraBannerTitle: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  doraBannerSubtitle: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    width: (screenWidth - spacing.md * 3) / 2 - spacing.sm,
    alignItems: 'center',
    padding: spacing.md,
  },
  metricIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.interactive.focus,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  metricValue: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  metricLabel: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border.muted,
  },
  summaryValue: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  summaryLabel: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 150,
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBarFill: {
    width: 24,
    backgroundColor: colors.brand.primary,
    borderRadius: borderRadius.sm,
    minHeight: 4,
  },
  chartLabel: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  chartValue: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  envList: {
    gap: spacing.sm,
  },
  envRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.muted,
  },
  envName: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    flex: 1,
  },
  envStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  envTotal: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  envBadge: {
    backgroundColor: colors.status.successDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  envBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  projectList: {
    gap: spacing.sm,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.muted,
  },
  projectRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectRankText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  projectName: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    flex: 1,
  },
  projectCount: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    padding: spacing.lg,
  },
  enterpriseNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  enterpriseNoteText: {
    flex: 1,
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
});

