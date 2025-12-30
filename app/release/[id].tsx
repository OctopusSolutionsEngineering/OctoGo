/**
 * Release Detail Screen
 * Shows release details and allows deployment
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRelease, useProject, useEnvironments } from '@/src/hooks/useOctopusQuery';
import { useColors } from '@/src/context/ThemeContext';
import { LoadingScreen } from '@/src/components/ui/LoadingScreen';
import { ErrorView } from '@/src/components/ui/ErrorView';
import { Card } from '@/src/components/ui/Card';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { Button } from '@/src/components/ui/Button';
import { spacing, fontSize } from '@/src/theme/spacing';

export default function ReleaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();

  const {
    data: release,
    isLoading: releaseLoading,
    error: releaseError,
    refetch: refetchRelease,
  } = useRelease(id || '');

  // Only fetch project when we have the projectId
  const projectId = release?.ProjectId || '';
  const {
    data: project,
    isLoading: projectLoading,
  } = useProject(projectId);

  const { data: environments } = useEnvironments();

  const isLoading = releaseLoading || (projectLoading && !!projectId);
  const isRefreshing = false;

  // Create styles with theme colors
  const themedStyles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    content: {
      padding: spacing.md,
    },
    headerCard: {
      marginBottom: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    versionText: {
      fontSize: fontSize.xxl,
      fontWeight: '700',
      color: colors.text.primary,
    },
    projectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      paddingVertical: spacing.xs,
    },
    projectText: {
      fontSize: fontSize.md,
      color: colors.brand.primary,
      marginRight: spacing.xs,
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
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
      fontSize: fontSize.sm,
      color: colors.text.secondary,
    },
    infoValue: {
      fontSize: fontSize.sm,
      color: colors.text.primary,
      fontWeight: '500',
    },
    notesCard: {
      marginTop: spacing.md,
    },
    notesLabel: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      marginBottom: spacing.xs,
    },
    notesText: {
      fontSize: fontSize.sm,
      color: colors.text.primary,
      lineHeight: 20,
    },
    noNotes: {
      fontSize: fontSize.sm,
      color: colors.text.tertiary,
      fontStyle: 'italic',
    },
    deployButton: {
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    envCard: {
      marginBottom: spacing.sm,
    },
    envHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    envName: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.text.primary,
    },
    envMeta: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
    },
    emptySection: {
      padding: spacing.lg,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: fontSize.sm,
      color: colors.text.tertiary,
      marginTop: spacing.sm,
    },
    packageSection: {
      marginTop: spacing.md,
    },
    packageItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.muted,
    },
    packageName: {
      fontSize: fontSize.sm,
      color: colors.text.primary,
      flex: 1,
    },
    packageVersion: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      fontFamily: 'monospace',
    },
  }), [colors]);

  const handleRefresh = useCallback(() => {
    refetchRelease();
  }, [refetchRelease]);

  const handleDeploy = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/release/${id}/deploy` as any);
  }, [router, id]);

  const handleProjectPress = useCallback(() => {
    if (release?.ProjectId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/project/${release.ProjectId}`);
    }
  }, [router, release?.ProjectId]);

  // Get available environments for deployment
  const availableEnvironments = environments || [];

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (releaseError) {
    return (
      <SafeAreaView style={themedStyles.container}>
        <ErrorView
          title="Failed to load release"
          message={releaseError.message}
          onRetry={refetchRelease}
        />
      </SafeAreaView>
    );
  }

  if (isLoading || !release) {
    return <LoadingScreen message="Loading release..." />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `Release ${release.Version}`,
          headerStyle: { backgroundColor: colors.background.secondary },
          headerTintColor: colors.text.primary,
        }}
      />
      <SafeAreaView style={themedStyles.container}>
        <ScrollView
          style={themedStyles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand.primary}
            />
          }
        >
          {/* Header Card */}
          <Card style={themedStyles.headerCard}>
            <View style={themedStyles.headerRow}>
              <Text style={themedStyles.versionText}>{release.Version}</Text>
              <StatusBadge status="Success" />
            </View>
            
            <Pressable style={themedStyles.projectButton} onPress={handleProjectPress}>
              <Text style={themedStyles.projectText}>
                {project?.Name || release.ProjectId.replace('Projects-', '')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.brand.primary} />
            </Pressable>
          </Card>

          {/* Release Info */}
          <Card>
            <View style={themedStyles.infoRow}>
              <Text style={themedStyles.infoLabel}>Created</Text>
              <Text style={themedStyles.infoValue}>{formatDate(release.Assembled)}</Text>
            </View>
            <View style={themedStyles.infoRow}>
              <Text style={themedStyles.infoLabel}>Channel</Text>
              <Text style={themedStyles.infoValue}>
                {release.ChannelId?.replace('Channels-', 'Channel ') || 'Default'}
              </Text>
            </View>
            {release.ProjectVariableSetSnapshotId && (
              <View style={[themedStyles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={themedStyles.infoLabel}>Variable Snapshot</Text>
                <Text style={themedStyles.infoValue}>
                  {release.ProjectVariableSetSnapshotId.split('-').pop()}
                </Text>
              </View>
            )}
          </Card>

          {/* Release Notes */}
          {release.ReleaseNotes !== undefined && (
            <Card style={themedStyles.notesCard}>
              <Text style={themedStyles.notesLabel}>Release Notes</Text>
              {release.ReleaseNotes ? (
                <Text style={themedStyles.notesText}>{release.ReleaseNotes}</Text>
              ) : (
                <Text style={themedStyles.noNotes}>No release notes</Text>
              )}
            </Card>
          )}

          {/* Selected Packages */}
          {release.SelectedPackages && release.SelectedPackages.length > 0 && (
            <View style={themedStyles.packageSection}>
              <Text style={themedStyles.sectionTitle}>Packages</Text>
              <Card>
                {release.SelectedPackages.map((pkg, index) => (
                  <View
                    key={pkg.ActionName || index}
                    style={[
                      themedStyles.packageItem,
                      index === release.SelectedPackages!.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <Text style={themedStyles.packageName} numberOfLines={1}>
                      {pkg.ActionName || 'Package'}
                    </Text>
                    <Text style={themedStyles.packageVersion}>{pkg.Version}</Text>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {/* Deploy Button */}
          <View style={themedStyles.deployButton}>
            <Button
              title="Deploy this Release"
              onPress={handleDeploy}
              variant="primary"
            />
          </View>

          {/* Available Environments */}
          {availableEnvironments.length > 0 && (
            <>
              <Text style={themedStyles.sectionTitle}>Available Environments</Text>
              {availableEnvironments.slice(0, 5).map(env => (
                <Card key={env.Id} style={themedStyles.envCard}>
                  <View style={themedStyles.envHeader}>
                    <Text style={themedStyles.envName}>{env.Name}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                  </View>
                  {env.Description && (
                    <Text style={themedStyles.envMeta} numberOfLines={1}>
                      {env.Description}
                    </Text>
                  )}
                </Card>
              ))}
            </>
          )}

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
