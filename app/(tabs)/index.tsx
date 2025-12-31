/**
 * Dashboard Screen
 * Overview of deployments, projects, and system status
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useDashboard, useMachines, useProjects } from '../../src/hooks/useOctopusQuery';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { useDrawer } from '../../src/context/DrawerContext';
import { Card } from '../../src/components/ui/Card';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { OctopusApiError } from '../../src/lib/api/client';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';
import type { DashboardItem } from '../../src/lib/api/types';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, serverVersion } = useAuth();
  const { favorites } = useFavorites();
  const { openDrawer } = useDrawer();
  const { data: dashboard, isLoading, error, refetch } = useDashboard();
  const { data: machinesData } = useMachines({ take: 500 });
  const { data: projectsData } = useProjects({ take: 200 });

  // Calculate stats
  const stats = useMemo(() => {
    if (!dashboard) return null;

    const items = dashboard.Items;
    const machines = machinesData?.Items || [];
    const now = new Date();
    const last24h = items.filter(item => {
      const created = new Date(item.Created);
      return now.getTime() - created.getTime() < 24 * 60 * 60 * 1000;
    });

    return {
      total: items.length,
      success: items.filter(i => i.State === 'Success').length,
      failed: items.filter(i => i.State === 'Failed').length,
      inProgress: items.filter(i => i.State === 'Executing' || i.State === 'Queued').length,
      last24h: last24h.length,
      projects: dashboard.Projects.length,
      targets: machines.length,
      healthyTargets: machines.filter(m => m.HealthStatus === 'Healthy').length,
    };
  }, [dashboard, machinesData]);

  // Get recent deployments
  const recentDeployments = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.Items
      .sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime())
      .slice(0, 5);
  }, [dashboard]);

  // Get environment map for display names
  const environmentMap = useMemo(() => {
    if (!dashboard) return new Map();
    return new Map(dashboard.Environments.map(e => [e.Id, e.Name]));
  }, [dashboard]);

  // Get project map
  const projectMap = useMemo(() => {
    if (!dashboard) return new Map();
    return new Map(dashboard.Projects.map(p => [p.Id, p.Name]));
  }, [dashboard]);

  // Get favorited projects
  const favoriteProjects = useMemo(() => {
    if (!projectsData?.Items || favorites.length === 0) return [];
    return projectsData.Items.filter(p => favorites.includes(p.Id));
  }, [projectsData, favorites]);

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleDeploymentPress = useCallback((item: DashboardItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to deployment details
    router.push(`/deployment/${item.DeploymentId}`);
  }, [router]);

  const handleProjectPress = useCallback((projectId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/project/${projectId}`);
  }, [router]);

  if (error) {
    // Check if this is a permission/access error
    const isPermissionError = error instanceof OctopusApiError && error.statusCode === 403;
    const isSpaceAccessError = error.message?.includes('access to this space') || 
                               error.message?.includes('does not have access to space');
    
    return (
      <ErrorView
        message={error.message}
        onRetry={refetch}
        fullScreen
        errorType={isPermissionError ? 'permission' : 'generic'}
        secondaryAction={isSpaceAccessError ? {
          title: 'Select Space',
          onPress: openDrawer,
        } : undefined}
      />
    );
  }

  if (isLoading && !dashboard) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
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
        {/* Welcome banner - compact since branding is in header */}
        <View style={styles.welcomeBanner}>
          <View style={styles.welcomeRow}>
            <View style={styles.welcomeTextContainer}>
              <Text style={styles.welcomeGreeting}>
                Welcome back, <Text style={styles.userName}>{user?.DisplayName || 'User'}</Text>
              </Text>
            </View>
            <View style={styles.versionBadge}>
              <Text style={styles.versionBadgeText}>v{serverVersion}</Text>
            </View>
          </View>
        </View>

        {/* Deployment Stats - Compact horizontal row */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statItemValue}>{stats.inProgress}</Text>
              <Text style={styles.statItemLabel}>In Progress</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statItemValue, { color: colors.status.success }]}>{stats.success}</Text>
              <Text style={styles.statItemLabel}>Success</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statItemValue, { color: colors.status.error }]}>{stats.failed}</Text>
              <Text style={styles.statItemLabel}>Failed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statItemValue, stats.last24h === 0 && styles.statItemValueMuted]}>
                {stats.last24h === 0 ? '—' : stats.last24h}
              </Text>
              <Text style={styles.statItemLabel}>{stats.last24h === 0 ? 'Quiet 24h' : '24h'}</Text>
            </View>
          </View>
        )}

        {/* Quick Overview - Compact cards with outline icons */}
        <View style={styles.overviewSection}>
          <Pressable 
            style={styles.overviewCardCompact}
            onPress={() => router.push('/projects')}
          >
            <View style={[styles.overviewIconContainer, { backgroundColor: colors.brand.primary + '15' }]}>
              <Ionicons name="cube-outline" size={20} color={colors.brand.primary} />
            </View>
            <View style={styles.overviewTextContainer}>
              <Text style={styles.overviewValueCompact}>{stats?.projects || 0}</Text>
              <Text style={styles.overviewLabelCompact}>Projects</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.text.subtle} />
          </Pressable>
          
          <Pressable 
            style={styles.overviewCardCompact}
            onPress={() => router.push('/targets')}
          >
            <View style={[styles.overviewIconContainer, { backgroundColor: colors.status.success + '15' }]}>
              <Ionicons name="server-outline" size={20} color={colors.status.success} />
            </View>
            <View style={styles.overviewTextContainer}>
              <Text style={styles.overviewValueCompact}>{stats?.targets || 0}</Text>
              <Text style={styles.overviewLabelCompact}>Targets</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.text.subtle} />
          </Pressable>
        </View>

        {/* Favorite Projects */}
        {favoriteProjects.length > 0 && (
          <View style={styles.favoritesSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="star" size={18} color={colors.brand.accent} style={{ marginRight: spacing.xs }} />
                <Text style={styles.sectionTitle}>Favorites</Text>
              </View>
              <Pressable onPress={() => router.push('/projects')}>
                <Text style={styles.seeAllText}>See All</Text>
              </Pressable>
            </View>

            <View style={styles.favoritesList}>
              {favoriteProjects.slice(0, 4).map((project) => (
                <Pressable
                  key={project.Id}
                  style={styles.favoriteCard}
                  onPress={() => handleProjectPress(project.Id)}
                >
                  <View style={[styles.overviewIconContainer, { backgroundColor: colors.brand.primary + '15' }]}>
                    <Ionicons name="cube" size={18} color={colors.brand.primary} />
                  </View>
                  <Text style={styles.favoriteProjectName} numberOfLines={2}>
                    {project.Name}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.text.subtle} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Recent Deployments */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Deployments</Text>
            <Pressable onPress={() => router.push('/deployments')}>
              <Text style={styles.seeAllText}>See All</Text>
            </Pressable>
          </View>

          {recentDeployments.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>No recent deployments</Text>
            </Card>
          ) : (
            <View style={styles.deploymentsList}>
              {recentDeployments.map((item) => (
                <Card
                  key={item.Id}
                  onPress={() => handleDeploymentPress(item)}
                  style={styles.deploymentCard}
                >
                  <View style={styles.deploymentHeader}>
                    <View style={styles.deploymentInfo}>
                      <Text style={styles.projectName} numberOfLines={1}>
                        {projectMap.get(item.ProjectId) || 'Unknown Project'}
                      </Text>
                      <Text style={styles.releaseVersion}>
                        v{item.ReleaseVersion}
                      </Text>
                    </View>
                    <StatusBadge status={item.State} size="sm" />
                  </View>
                  
                  <View style={styles.deploymentFooter}>
                    <View style={styles.environmentBadge}>
                      <Text style={styles.environmentText}>
                        {environmentMap.get(item.EnvironmentId) || 'Unknown'}
                      </Text>
                    </View>
                    <Text style={styles.timeAgo}>
                      {getTimeAgo(item.Created)}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
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
  },
  welcomeBanner: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeGreeting: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
  },
  userName: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  versionBadge: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  versionBadgeText: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg, // Consistent with other cards
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.muted,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  statItem: {
    flex: 1,
    flexBasis: 0, // Forces equal width regardless of content
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    minWidth: 0, // Prevents content from expanding beyond flex allocation
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
  overviewSection: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  overviewCardCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg, // Consistent with other cards
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.muted,
    gap: spacing.sm,
  },
  overviewIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewTextContainer: {
    flex: 1,
  },
  overviewValueCompact: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  overviewLabelCompact: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  favoritesSection: {
    marginBottom: spacing.lg,
  },
  recentSection: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  seeAllText: {
    color: colors.brand.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  deploymentsList: {
    gap: spacing.sm,
  },
  deploymentCard: {
    padding: spacing.md,
  },
  deploymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  deploymentInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  projectName: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  releaseVersion: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  deploymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  environmentBadge: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  environmentText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  timeAgo: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  favoritesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.muted,
    gap: spacing.sm,
    flex: 1,
    minWidth: '47%',
    maxWidth: '48%',
  },
  favoriteProjectName: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
