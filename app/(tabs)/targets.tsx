/**
 * Targets Screen
 * View all deployment targets/machines and their health status
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useMachines, useEnvironments } from '../../src/hooks/useOctopusQuery';
import { Card } from '../../src/components/ui/Card';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PageTitle } from '../../src/components/ui/PageTitle';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';
import type { Machine } from '../../src/lib/api/types';

type HealthFilter = 'All' | 'Healthy' | 'HasWarnings' | 'Issues';

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

const getTargetTypeLabel = (style: string, roles?: string[]): string => {
  // Check roles for hints
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
  // Check roles for hints about the target type
  const rolesLower = roles?.map(r => r.toLowerCase()) || [];
  const hasK8sRole = rolesLower.some(r => 
    r.includes('k8s') || r.includes('kubernetes') || r.includes('kube') || r.includes('aks') || r.includes('eks') || r.includes('gke')
  );
  const hasDockerRole = rolesLower.some(r => r.includes('docker') || r.includes('container'));
  const hasWebRole = rolesLower.some(r => r.includes('web') || r.includes('iis') || r.includes('nginx'));
  const hasDbRole = rolesLower.some(r => r.includes('sql') || r.includes('database') || r.includes('db'));

  // Kubernetes targets
  if (style === 'Kubernetes' || style === 'KubernetesTentacle' || hasK8sRole) {
    return { name: 'cube', color: '#326CE5' }; // Kubernetes blue
  }

  // SSH targets (typically Linux)
  if (style === 'Ssh') {
    return { name: 'terminal', color: '#F0652F' }; // Ubuntu/Linux orange
  }

  // Azure targets
  if (style === 'AzureWebApp') {
    return { name: 'globe', color: '#0078D4' }; // Azure blue
  }
  if (style === 'AzureCloudService' || style === 'AzureServiceFabricCluster') {
    return { name: 'cloud', color: '#0078D4' }; // Azure blue
  }

  // Cloud region / Step package
  if (style === 'StepPackage') {
    return { name: 'cloud-outline', color: colors.text.secondary };
  }

  // Offline drop
  if (style === 'OfflineDrop') {
    return { name: 'folder', color: colors.text.secondary };
  }

  // Docker containers
  if (hasDockerRole) {
    return { name: 'layers', color: '#2496ED' }; // Docker blue
  }

  // Database servers
  if (hasDbRole) {
    return { name: 'server', color: '#CC2927' }; // SQL red
  }

  // Web servers
  if (hasWebRole) {
    return { name: 'globe', color: colors.brand.primary };
  }

  // Tentacle (Windows/Linux polling or listening)
  if (style === 'TentaclePassive' || style === 'TentacleActive') {
    return { name: 'desktop', color: '#00A4EF' }; // Windows blue
  }

  // Default server icon
  return { name: 'server', color: colors.text.secondary };
};

export default function TargetsScreen() {
  const router = useRouter();
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('All');
  const { data: machinesData, isLoading, error, refetch } = useMachines();
  const { data: environments } = useEnvironments();
  
  const machines = machinesData?.Items || [];

  // Create environment map for displaying names
  const environmentMap = useMemo(() => {
    if (!environments) return new Map<string, string>();
    return new Map(environments.map(e => [e.Id, e.Name]));
  }, [environments]);

  // Filter machines by health status
  const filteredMachines = useMemo(() => {
    if (healthFilter === 'All') return machines;
    if (healthFilter === 'Issues') {
      return machines.filter(m => {
        const status = m.HealthStatus || 'Unknown';
        return status === 'Unhealthy' || status === 'Unavailable';
      });
    }
    return machines.filter(m => (m.HealthStatus || 'Unknown') === healthFilter);
  }, [machines, healthFilter]);

  // Calculate health stats
  const healthStats = useMemo(() => {
    return {
      total: machines.length,
      healthy: machines.filter(m => (m.HealthStatus || 'Unknown') === 'Healthy').length,
      warnings: machines.filter(m => (m.HealthStatus || 'Unknown') === 'HasWarnings').length,
      unhealthy: machines.filter(m => (m.HealthStatus || 'Unknown') === 'Unhealthy').length,
      unavailable: machines.filter(m => (m.HealthStatus || 'Unknown') === 'Unavailable').length,
    };
  }, [machines]);

  const handleMachinePress = useCallback((machine: Machine) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/machine/${machine.Id}`);
  }, [router]);

  const handleFilterPress = useCallback((filter: HealthFilter) => {
    Haptics.selectionAsync();
    setHealthFilter(filter);
  }, []);

  const renderMachine = useCallback(({ item }: { item: Machine }) => {
    // Defensive null checks for all properties
    const environmentIds = item.EnvironmentIds || [];
    const roles = item.Roles || [];
    const endpoint = item.Endpoint || { CommunicationStyle: 'Unknown' };
    
    // Get first environment name for display
    const primaryEnvName = environmentIds.length > 0 
      ? environmentMap.get(environmentIds[0]) 
      : null;
    const additionalEnvCount = environmentIds.length > 1 
      ? environmentIds.length - 1 
      : 0;

    // Get icon based on communication style and roles
    const targetIcon = getCommunicationStyleIcon(endpoint.CommunicationStyle, roles);
    const targetType = getTargetTypeLabel(endpoint.CommunicationStyle, roles);

    return (
      <Card
        onPress={() => handleMachinePress(item)}
        style={styles.machineCard}
      >
        <View style={styles.machineHeader}>
          <View style={[styles.machineIconContainer, { backgroundColor: targetIcon.color + '20' }]}>
            <Ionicons 
              name={targetIcon.name as any} 
              size={26} 
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
            </View>
          </View>
          <View style={styles.healthBadge}>
            <Ionicons 
              name={getHealthIcon(item.HealthStatus) as any} 
              size={24} 
              color={getHealthColor(item.HealthStatus)} 
            />
          </View>
        </View>
        
        <View style={styles.machineFooter}>
          {/* Show environment names - the most useful info */}
          {environmentIds.length > 0 && (
            <View style={styles.envBadge}>
              <Ionicons name="globe-outline" size={12} color={colors.brand.primary} />
              <Text style={styles.envBadgeText} numberOfLines={1}>
                {primaryEnvName || 'Environment'}
                {additionalEnvCount > 0 && ` +${additionalEnvCount}`}
              </Text>
            </View>
          )}
          {item.IsDisabled && (
            <View style={styles.disabledBadge}>
              <Text style={styles.disabledText}>Disabled</Text>
            </View>
          )}
          <View style={styles.footerSpacer} />
          <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
        </View>
      </Card>
    );
  }, [handleMachinePress, environmentMap]);

  const keyExtractor = useCallback((item: Machine, index: number) => item.Id || `machine-${index}`, []);

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
        title="Targets" 
        icon="server"
      />

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        <Pressable 
          style={[styles.filterPill, healthFilter === 'All' && styles.filterPillActive]}
          onPress={() => handleFilterPress('All')}
        >
          <Text style={[styles.filterText, healthFilter === 'All' && styles.filterTextActive]}>
            All
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.filterPill, healthFilter === 'Healthy' && styles.filterPillActive]}
          onPress={() => handleFilterPress('Healthy')}
        >
          <View style={[styles.filterDot, { backgroundColor: colors.healthStatus.Healthy }]} />
          <Text style={[styles.filterText, healthFilter === 'Healthy' && styles.filterTextActive]}>
            Healthy ({healthStats.healthy})
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.filterPill, healthFilter === 'HasWarnings' && styles.filterPillActive]}
          onPress={() => handleFilterPress('HasWarnings')}
        >
          <View style={[styles.filterDot, { backgroundColor: colors.healthStatus.HasWarnings }]} />
          <Text style={[styles.filterText, healthFilter === 'HasWarnings' && styles.filterTextActive]}>
            Warnings ({healthStats.warnings})
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.filterPill, healthFilter === 'Issues' && styles.filterPillActive]}
          onPress={() => handleFilterPress('Issues')}
        >
          <View style={[styles.filterDot, { backgroundColor: colors.healthStatus.Unhealthy }]} />
          <Text style={[styles.filterText, healthFilter === 'Issues' && styles.filterTextActive]}>
            Issues ({healthStats.unhealthy + healthStats.unavailable})
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={filteredMachines}
        renderItem={renderMachine}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.brand.primary}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="🖥️"
              title={healthFilter === 'All' ? "No deployment targets found" : healthFilter === 'Issues' ? "No targets with issues" : `No ${healthFilter.toLowerCase()} targets`}
              message={healthFilter === 'All' 
                ? "Add deployment targets in Octopus Deploy to see them here"
                : "Try a different filter to see more targets"
              }
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
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.muted,
    gap: spacing.xs,
  },
  filterPillActive: {
    backgroundColor: colors.interactive.focus,
    borderColor: colors.brand.primary,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  filterTextActive: {
    color: colors.brand.primary,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    flexGrow: 1,
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
    gap: spacing.sm,
  },
  machineIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
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
  envBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  envBadgeText: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    maxWidth: 120,
  },
  roleText: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    maxWidth: 100,
  },
  healthBadge: {
    padding: spacing.xs,
  },
  machineFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.muted,
  },
  footerSpacer: {
    flex: 1,
  },
  disabledBadge: {
    backgroundColor: colors.status.warningDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  disabledText: {
    color: colors.status.warning,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
});

