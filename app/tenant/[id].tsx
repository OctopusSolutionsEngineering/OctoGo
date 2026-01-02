/**
 * Tenant Detail Screen
 * View tenant information and connected projects/environments
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  SafeAreaView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useTenant,
  useProjects,
  useEnvironments,
  useTagSets,
  useDashboard,
} from '@/src/hooks/useOctopusQuery';
import { Card } from '@/src/components/ui/Card';
import { LoadingScreen } from '@/src/components/ui/LoadingScreen';
import { ErrorView } from '@/src/components/ui/ErrorView';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { colors } from '@/src/theme/colors';
import { fontSize, spacing, borderRadius } from '@/src/theme/spacing';
import type { DashboardItem, TaskState } from '@/src/lib/api/types';

type SectionId = 'overview' | 'variables' | 'tasks' | 'settings';

export default function TenantDetailScreen() {
  const { id: tenantId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(['overview']));
  
  const { 
    data: tenant, 
    isLoading, 
    error, 
    refetch,
    isRefetching,
  } = useTenant(tenantId || '');
  
  const { data: projectsData } = useProjects({ take: 500 });
  const { data: environments } = useEnvironments();
  const { data: tagSets } = useTagSets();
  const { data: dashboard } = useDashboard();

  // Create lookup maps
  const projectMap = useMemo(() => {
    const map: Record<string, string> = {};
    projectsData?.Items.forEach(p => {
      map[p.Id] = p.Name;
    });
    return map;
  }, [projectsData]);

  const environmentMap = useMemo(() => {
    const map: Record<string, string> = {};
    environments?.forEach(e => {
      map[e.Id] = e.Name;
    });
    return map;
  }, [environments]);

  // Parse tenant tags to get human-readable names
  const tenantTags = useMemo(() => {
    if (!tenant?.TenantTags || !tagSets) return [];
    
    return tenant.TenantTags.map(canonicalTag => {
      // canonicalTag format: "TagSetName/TagName"
      const [tagSetName, tagName] = canonicalTag.split('/');
      const tagSet = tagSets.find(ts => ts.Name === tagSetName);
      const tag = tagSet?.Tags.find(t => t.Name === tagName);
      
      return {
        canonicalName: canonicalTag,
        tagSetName: tagSetName || '',
        tagName: tagName || canonicalTag,
        color: tag?.Description || undefined,
      };
    });
  }, [tenant, tagSets]);

  // Parse connected projects with deployment status
  const connectedProjects = useMemo(() => {
    if (!tenant?.ProjectEnvironments) return [];
    
    return Object.entries(tenant.ProjectEnvironments).map(([projectId, envIds]) => {
      const envs = (envIds as string[]).map(envId => {
        // Find latest deployment for this tenant/project/env
        const latestDeployment = dashboard?.Items.find(
          item => 
            item.ProjectId === projectId && 
            item.EnvironmentId === envId &&
            item.TenantId === tenant.Id
        );

        return {
          id: envId,
          name: environmentMap[envId] || envId,
          deployment: latestDeployment,
        };
      });

      return {
        projectId,
        projectName: projectMap[projectId] || projectId,
        environments: envs,
      };
    });
  }, [tenant, projectMap, environmentMap, dashboard]);

  const toggleSection = useCallback((section: SectionId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return <LoadingScreen message="Loading tenant..." />;
  }

  if (error) {
    return (
      <ErrorView
        message={error.message || 'An error occurred'}
        title="Failed to load tenant"
        onRetry={refetch}
      />
    );
  }

  if (!tenant) {
    return (
      <ErrorView
        message="The requested tenant could not be found"
        title="Tenant Not Found"
        fullScreen
      />
    );
  }

  // Section Header Component
  const SectionHeader = ({ 
    id, 
    title, 
    icon, 
    count 
  }: { 
    id: SectionId; 
    title: string; 
    icon: string; 
    count?: number;
  }) => (
    <Pressable
      style={styles.sectionHeader}
      onPress={() => toggleSection(id)}
    >
      <View style={styles.sectionHeaderLeft}>
        <Ionicons name={icon as any} size={20} color={colors.brand.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {count !== undefined && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
      </View>
      <Ionicons 
        name={expandedSections.has(id) ? 'chevron-up' : 'chevron-down'} 
        size={20} 
        color={colors.text.tertiary} 
      />
    </Pressable>
  );

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: tenant.Name,
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
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.brand.primary}
            />
          }
        >
          {/* Tenant Header */}
          <View style={styles.headerCard}>
          <View style={styles.tenantHeader}>
            <View style={styles.tenantIconLarge}>
              <Ionicons name="business" size={32} color={colors.brand.primary} />
            </View>
              <View style={styles.tenantInfo}>
                <Text style={styles.tenantName}>{tenant.Name}</Text>
                {tenant.Description && (
                  <Text style={styles.tenantDescription} numberOfLines={2}>
                    {tenant.Description}
                  </Text>
                )}
              </View>
            </View>

            {/* Tag Sets */}
            {tenantTags.length > 0 && (
              <View style={styles.tagSetsContainer}>
                <Text style={styles.tagSetsLabel}>Release Ring</Text>
                <View style={styles.tagsList}>
                  {tenantTags.map((tag, index) => (
                    <View key={index} style={styles.tagBadge}>
                      <Text style={styles.tagText}>{tag.tagName}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Overview Section */}
          <Card style={styles.sectionCard}>
            <SectionHeader 
              id="overview" 
              title="Overview" 
              icon="grid-outline"
            />
            {expandedSections.has('overview') && (
              <View style={styles.sectionContent}>
                {/* Projects Grid */}
                <View style={styles.projectsSection}>
                  <Text style={styles.subSectionTitle}>
                    Projects ({connectedProjects.length})
                  </Text>
                  
                  {connectedProjects.length === 0 ? (
                    <EmptyState
                      ionicon="cube-outline"
                      title="No projects"
                      message="This tenant is not connected to any projects"
                    />
                  ) : (
                    <View style={styles.projectsList}>
                      {connectedProjects.map((project) => (
                        <Pressable
                          key={project.projectId}
                          style={styles.projectCard}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push(`/project/${project.projectId}`);
                          }}
                        >
                          <View style={styles.projectCardHeader}>
                            <View style={styles.projectIcon}>
                              <Ionicons name="cube-outline" size={20} color={colors.brand.primary} />
                            </View>
                            <Text style={styles.projectName} numberOfLines={1}>
                              {project.projectName}
                            </Text>
                            <Ionicons 
                              name="chevron-forward" 
                              size={16} 
                              color={colors.text.tertiary} 
                            />
                          </View>

                          {/* Environment deployments */}
                          <View style={styles.environmentsList}>
                            {project.environments.map((env) => (
                              <View key={env.id} style={styles.environmentRow}>
                                <Text style={styles.environmentName} numberOfLines={1}>
                                  {env.name}
                                </Text>
                                {env.deployment ? (
                                  <View style={styles.deploymentInfo}>
                                    <StatusBadge status={env.deployment.State} size="sm" />
                                    <Text style={styles.deploymentVersion}>
                                      {env.deployment.ReleaseVersion}
                                    </Text>
                                  </View>
                                ) : (
                                  <View style={styles.noDeploymentBadge}>
                                    <Text style={styles.noDeploymentText}>—</Text>
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}
          </Card>

          {/* Variables Section (placeholder) */}
          <Card style={styles.sectionCard}>
            <SectionHeader 
              id="variables" 
              title="Variables" 
              icon="code-slash-outline"
              count={0}
            />
            {expandedSections.has('variables') && (
              <View style={styles.sectionContent}>
                <EmptyState
                  icon="🔐"
                  title="No variables"
                  message="Tenant-specific variables can be configured in Octopus Deploy"
                />
              </View>
            )}
          </Card>

          {/* Settings Section */}
          <Card style={styles.sectionCard}>
            <SectionHeader 
              id="settings" 
              title="Settings" 
              icon="settings-outline"
            />
            {expandedSections.has('settings') && (
              <View style={styles.sectionContent}>
                <View style={styles.settingsSection}>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Tenant ID</Text>
                    <Text style={styles.settingValue}>{tenant.Id}</Text>
                  </View>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Space ID</Text>
                    <Text style={styles.settingValue}>{tenant.SpaceId}</Text>
                  </View>
                  {tenant.ClonedFromTenantId && (
                    <View style={styles.settingRow}>
                      <Text style={styles.settingLabel}>Cloned From</Text>
                      <Text style={styles.settingValue}>{tenant.ClonedFromTenantId}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </Card>
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
    gap: spacing.sm,
  },
  headerCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  tenantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tenantIconLarge: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  tenantDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 4,
  },
  tagSetsContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.muted,
  },
  tagSetsLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagBadge: {
    backgroundColor: colors.status.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.status.success,
  },
  sectionCard: {
    padding: 0,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  countBadge: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  sectionContent: {
    borderTopWidth: 1,
    borderTopColor: colors.border.muted,
  },
  subSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  projectsSection: {
    padding: spacing.md,
  },
  projectsList: {
    gap: spacing.sm,
  },
  projectCard: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  projectCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  projectIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.brand.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  projectName: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  environmentsList: {
    gap: spacing.xs,
  },
  environmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  environmentName: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  deploymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deploymentVersion: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.primary,
  },
  noDeploymentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  noDeploymentText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  settingsSection: {
    padding: spacing.md,
    gap: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  settingValue: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.primary,
    fontFamily: 'monospace',
  },
});

