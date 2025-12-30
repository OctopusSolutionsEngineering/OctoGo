/**
 * Environment Detail Screen
 * Shows environment info and deployment targets
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
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEnvironment, useMachines } from '../../src/hooks/useOctopusQuery';
import { Card } from '../../src/components/ui/Card';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';
import type { Machine } from '../../src/lib/api/types';

const getHealthIcon = (status: string): string => {
  switch (status) {
    case 'Healthy':
      return '✅';
    case 'HasWarnings':
      return '⚠️';
    case 'Unhealthy':
      return '❌';
    case 'Unavailable':
      return '⏸️';
    default:
      return '❓';
  }
};

const _getHealthColor = (status: string): string => {
  switch (status) {
    case 'Healthy':
      return colors.healthStatus.Healthy;
    case 'HasWarnings':
      return colors.healthStatus.HasWarnings;
    case 'Unhealthy':
      return colors.healthStatus.Unhealthy;
    case 'Unavailable':
      return colors.healthStatus.Unavailable;
    default:
      return colors.healthStatus.Unknown;
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'Online':
      return colors.status.success;
    case 'Offline':
      return colors.status.error;
    case 'Disabled':
      return colors.text.tertiary;
    default:
      return colors.text.secondary;
  }
};

export default function EnvironmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const { data: environment, isLoading: envLoading, error: envError, refetch: refetchEnv } = useEnvironment(id!);
  const { data: machinesData, isLoading: machinesLoading, refetch: refetchMachines } = useMachines({
    environmentIds: [id!],
    take: 100,
  });
  
  const machines = machinesData?.Items || [];
  const isLoading = envLoading || machinesLoading;

  const handleRefresh = useCallback(() => {
    refetchEnv();
    refetchMachines();
  }, [refetchEnv, refetchMachines]);

  const handleMachinePress = useCallback((machine: Machine) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/machine/${machine.Id}`);
  }, [router]);

  // Group machines by health status
  const healthSummary = useMemo(() => {
    return {
      healthy: machines.filter(m => m.HealthStatus === 'Healthy').length,
      warnings: machines.filter(m => m.HealthStatus === 'HasWarnings').length,
      unhealthy: machines.filter(m => m.HealthStatus === 'Unhealthy').length,
      unavailable: machines.filter(m => m.HealthStatus === 'Unavailable').length,
    };
  }, [machines]);

  const renderMachine = useCallback(({ item }: { item: Machine }) => (
    <Card style={styles.machineCard} onPress={() => handleMachinePress(item)}>
      <View style={styles.machineHeader}>
        <Text style={styles.healthIcon}>{getHealthIcon(item.HealthStatus)}</Text>
        <View style={styles.machineInfo}>
          <Text style={styles.machineName}>{item.Name}</Text>
          <View style={styles.machineStatus}>
            <View 
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(item.Status) }
              ]} 
            />
            <Text style={styles.statusText}>{item.Status}</Text>
          </View>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
      
      {item.StatusSummary && (
        <Text style={styles.statusSummary}>{item.StatusSummary}</Text>
      )}
      
      {item.Roles.length > 0 && (
        <View style={styles.rolesContainer}>
          {item.Roles.slice(0, 3).map((role, index) => (
            <View key={index} style={styles.roleBadge}>
              <Text style={styles.roleText}>{role}</Text>
            </View>
          ))}
          {item.Roles.length > 3 && (
            <Text style={styles.moreRoles}>+{item.Roles.length - 3} more</Text>
          )}
        </View>
      )}
    </Card>
  ), [handleMachinePress]);

  const keyExtractor = useCallback((item: Machine) => item.Id, []);

  if (envLoading && !environment) {
    return <LoadingScreen message="Loading environment..." />;
  }

  if (envError) {
    return (
      <ErrorView
        message={envError.message}
        onRetry={handleRefresh}
        fullScreen
      />
    );
  }

  if (!environment) {
    return (
      <ErrorView
        message="Environment not found"
        fullScreen
      />
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: environment.Name,
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.background.secondary },
          headerTintColor: colors.text.primary,
        }} 
      />
      
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        {/* Health Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.healthStatus.Healthy }]}>
                {healthSummary.healthy}
              </Text>
              <Text style={styles.summaryLabel}>Healthy</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.healthStatus.HasWarnings }]}>
                {healthSummary.warnings}
              </Text>
              <Text style={styles.summaryLabel}>Warnings</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.healthStatus.Unhealthy }]}>
                {healthSummary.unhealthy}
              </Text>
              <Text style={styles.summaryLabel}>Unhealthy</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.healthStatus.Unavailable }]}>
                {healthSummary.unavailable}
              </Text>
              <Text style={styles.summaryLabel}>Unavailable</Text>
            </View>
          </View>
        </View>

        <FlatList
          data={machines}
          renderItem={renderMachine}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              tintColor={colors.brand.primary}
            />
          }
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              Deployment Targets ({machines.length})
            </Text>
          }
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState
                icon="🖥️"
                title="No deployment targets"
                message="Add deployment targets to this environment in Octopus Deploy"
              />
            ) : null
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  summaryContainer: {
    padding: spacing.md,
    paddingBottom: 0,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.muted,
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
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  summaryLabel: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  listHeader: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  separator: {
    height: spacing.sm,
  },
  machineCard: {
    padding: spacing.md,
  },
  machineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  machineInfo: {
    flex: 1,
  },
  machineName: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  machineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  statusSummary: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  rolesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  roleBadge: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  roleText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
  },
  moreRoles: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    alignSelf: 'center',
  },
  chevron: {
    color: colors.text.tertiary,
    fontSize: fontSize.xxl,
    fontWeight: '300',
    marginLeft: spacing.sm,
  },
});


