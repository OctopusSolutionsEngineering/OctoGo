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
import { Ionicons } from '@expo/vector-icons';
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
      return 'checkmark-circle';
    case 'HasWarnings':
      return 'warning';
    case 'Unhealthy':
      return 'close-circle';
    case 'Unavailable':
      return 'pause-circle';
    default:
      return 'help-circle';
  }
};

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

const getTargetTypeLabel = (style: string, roles?: string[]): string => {
  const rolesLower = roles?.map(r => r.toLowerCase()) || [];
  const hasK8sRole = rolesLower.some(r => 
    r.includes('k8s') || r.includes('kubernetes') || r.includes('kube')
  );

  if (style === 'Kubernetes' || style === 'KubernetesTentacle' || hasK8sRole) {
    return 'Kubernetes';
  }
  if (style === 'TentaclePassive') {
    return 'Listening Tentacle';
  }
  if (style === 'TentacleActive') {
    return 'Polling Tentacle';
  }
  if (style === 'Ssh') {
    return 'SSH';
  }
  if (style === 'AzureWebApp') {
    return 'Azure Web App';
  }
  if (style === 'AzureCloudService') {
    return 'Azure Cloud Service';
  }
  if (style === 'AzureServiceFabricCluster') {
    return 'Service Fabric';
  }
  if (style === 'StepPackage' || style === 'None' || style === 'CloudRegion') {
    return 'Cloud Region';
  }
  if (style === 'OfflineDrop') {
    return 'Offline Drop';
  }
  return style || 'Cloud Region';
};

const getCommunicationStyleIcon = (style: string, roles?: string[]): { name: string; color: string } => {
  const rolesLower = roles?.map(r => r.toLowerCase()) || [];
  const hasK8sRole = rolesLower.some(r => 
    r.includes('k8s') || r.includes('kubernetes') || r.includes('kube') || r.includes('aks') || r.includes('eks') || r.includes('gke')
  );
  const hasDockerRole = rolesLower.some(r => r.includes('docker') || r.includes('container'));
  const hasWebRole = rolesLower.some(r => r.includes('web') || r.includes('iis') || r.includes('nginx'));
  const hasDbRole = rolesLower.some(r => r.includes('sql') || r.includes('database') || r.includes('db'));

  if (style === 'Kubernetes' || style === 'KubernetesTentacle' || hasK8sRole) {
    return { name: 'cube', color: '#326CE5' };
  }
  if (style === 'Ssh') {
    return { name: 'terminal', color: '#F0652F' };
  }
  if (style === 'AzureWebApp') {
    return { name: 'globe', color: '#0078D4' };
  }
  if (style === 'AzureCloudService' || style === 'AzureServiceFabricCluster') {
    return { name: 'cloud', color: '#0078D4' };
  }
  if (style === 'StepPackage') {
    return { name: 'cloud-outline', color: colors.text.secondary };
  }
  if (style === 'OfflineDrop') {
    return { name: 'folder', color: colors.text.secondary };
  }
  if (hasDockerRole) {
    return { name: 'layers', color: '#2496ED' };
  }
  if (hasDbRole) {
    return { name: 'server', color: '#CC2927' };
  }
  if (hasWebRole) {
    return { name: 'globe', color: colors.brand.primary };
  }
  if (style === 'TentaclePassive' || style === 'TentacleActive') {
    return { name: 'desktop', color: '#00A4EF' };
  }
  return { name: 'server', color: colors.text.secondary };
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

  const renderMachine = useCallback(({ item }: { item: Machine }) => {
    const roles = item.Roles || [];
    const endpoint = item.Endpoint || { CommunicationStyle: 'Unknown' };
    const targetIcon = getCommunicationStyleIcon(endpoint.CommunicationStyle, roles);
    const targetType = getTargetTypeLabel(endpoint.CommunicationStyle, roles);

    return (
      <Card style={styles.machineCard} onPress={() => handleMachinePress(item)}>
        <View style={styles.machineHeader}>
          <View style={[styles.machineIconContainer, { backgroundColor: targetIcon.color + '20' }]}>
            <Ionicons 
              name={targetIcon.name as any} 
              size={24} 
              color={targetIcon.color} 
            />
          </View>
          <View style={styles.machineInfo}>
            <Text style={styles.machineName} numberOfLines={1}>{item.Name}</Text>
            <View style={styles.machineMetaRow}>
              <View style={[styles.typeBadge, { backgroundColor: targetIcon.color + '15' }]}>
                <Text style={[styles.typeBadgeText, { color: targetIcon.color }]}>{targetType}</Text>
              </View>
              {roles.length > 0 && (
                <Text style={styles.roleText} numberOfLines={1}>
                  {roles[0]}{roles.length > 1 && ` +${roles.length - 1}`}
                </Text>
              )}
              {item.IsDisabled && (
                <View style={styles.disabledBadge}>
                  <Text style={styles.disabledText}>Disabled</Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons 
            name={getHealthIcon(item.HealthStatus) as any} 
            size={22} 
            color={getHealthColor(item.HealthStatus)} 
          />
          <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
        </View>
      </Card>
    );
  }, [handleMachinePress]);

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
                ionicon="server-outline"
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
    padding: spacing.sm,
  },
  machineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  machineIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  machineInfo: {
    flex: 1,
    minWidth: 0,
  },
  machineName: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  machineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  roleText: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    maxWidth: 100,
  },
  disabledBadge: {
    backgroundColor: colors.status.warningDim,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  disabledText: {
    color: colors.status.warning,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
});
