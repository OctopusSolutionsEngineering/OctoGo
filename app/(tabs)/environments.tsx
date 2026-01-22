/**
 * Environments Screen
 * View environments and their deployment targets health
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
import { useEnvironments, useMachines } from '../../src/hooks/useOctopusQuery';
import { Card } from '../../src/components/ui/Card';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PageTitle } from '../../src/components/ui/PageTitle';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';
import type { Environment } from '../../src/lib/api/types';

const getHealthColor = (status: string): string => {
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

interface EnvironmentWithStats extends Environment {
  machineCount: number;
  healthyCount: number;
  unhealthyCount: number;
  warningCount: number;
}

export default function EnvironmentsScreen() {
  const router = useRouter();
  const { data: environments, isLoading: envLoading, error: envError, refetch: refetchEnv } = useEnvironments();
  const { data: machinesData, isLoading: machinesLoading, refetch: refetchMachines } = useMachines({ take: 1000 });
  
  const machines = machinesData?.Items || [];
  const isLoading = envLoading || machinesLoading;

  // Combine environments with machine stats
  const environmentsWithStats = useMemo((): EnvironmentWithStats[] => {
    if (!environments) return [];
    
    return environments.map(env => {
      const envMachines = machines.filter(m => m.EnvironmentIds.includes(env.Id));
      return {
        ...env,
        machineCount: envMachines.length,
        healthyCount: envMachines.filter(m => m.HealthStatus === 'Healthy').length,
        unhealthyCount: envMachines.filter(m => m.HealthStatus === 'Unhealthy' || m.HealthStatus === 'Unavailable').length,
        warningCount: envMachines.filter(m => m.HealthStatus === 'HasWarnings').length,
      };
    }).sort((a, b) => a.SortOrder - b.SortOrder);
  }, [environments, machines]);

  const handleRefresh = useCallback(() => {
    refetchEnv();
    refetchMachines();
  }, [refetchEnv, refetchMachines]);

  const handleEnvironmentPress = useCallback((env: Environment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/environment/${env.Id}`);
  }, [router]);

  const renderEnvironment = useCallback(({ item }: { item: EnvironmentWithStats }) => {
    const overallHealth = item.unhealthyCount > 0 
      ? 'Unhealthy' 
      : item.warningCount > 0 
        ? 'HasWarnings' 
        : item.machineCount > 0 
          ? 'Healthy' 
          : 'Unknown';

    return (
      <Card
        onPress={() => handleEnvironmentPress(item)}
        style={styles.envCard}
      >
        <View style={styles.envHeader}>
          <View style={styles.envTitleRow}>
            <View 
              style={[
                styles.healthIndicator,
                { backgroundColor: getHealthColor(overallHealth) }
              ]} 
            />
            <Text style={styles.envName}>{item.Name}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
        
        {item.Description && (
          <Text style={styles.envDescription} numberOfLines={2}>
            {item.Description}
          </Text>
        )}
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.machineCount}</Text>
            <Text style={styles.statLabel}>Targets</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.healthStatus.Healthy }]}>
              {item.healthyCount}
            </Text>
            <Text style={styles.statLabel}>Healthy</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={[
              styles.statValue, 
              item.warningCount > 0 && { color: colors.healthStatus.HasWarnings }
            ]}>
              {item.warningCount}
            </Text>
            <Text style={styles.statLabel}>Warnings</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={[
              styles.statValue,
              item.unhealthyCount > 0 && { color: colors.healthStatus.Unhealthy }
            ]}>
              {item.unhealthyCount}
            </Text>
            <Text style={styles.statLabel}>Unhealthy</Text>
          </View>
        </View>
      </Card>
    );
  }, [handleEnvironmentPress]);

  const keyExtractor = useCallback((item: Environment) => item.Id, []);

  if (envError) {
    return (
      <ErrorView
        message={envError.message}
        onRetry={handleRefresh}
        fullScreen
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Page Title */}
      <PageTitle 
        title="Environments" 
        icon="layers"
      />

      {/* Summary banner */}
      <View style={styles.summaryBanner}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{environments?.length || 0}</Text>
          <Text style={styles.summaryLabel}>Environments</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{machines.length}</Text>
          <Text style={styles.summaryLabel}>Deployment Targets</Text>
        </View>
      </View>

      <FlatList
        data={environmentsWithStats}
        renderItem={renderEnvironment}
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
              ionicon="globe-outline"
              title="No environments found"
              message="Create environments in Octopus Deploy to see them here"
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
  summaryBanner: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    margin: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border.default,
  },
  summaryValue: {
    color: colors.text.primary,
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  summaryLabel: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    flexGrow: 1,
  },
  separator: {
    height: spacing.sm,
  },
  envCard: {
    padding: spacing.md,
  },
  envHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  envTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  healthIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  envName: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    flex: 1,
  },
  chevron: {
    color: colors.text.tertiary,
    fontSize: fontSize.xxl,
    fontWeight: '300',
  },
  envDescription: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.muted,
    marginVertical: spacing.xs,
  },
  statValue: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});



