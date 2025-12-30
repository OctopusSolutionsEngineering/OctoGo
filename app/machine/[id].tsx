/**
 * Machine Detail Screen
 * Shows detailed machine/deployment target information with health check
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useMachine, useTriggerMachineHealthCheck, useEnvironments } from '../../src/hooks/useOctopusQuery';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';

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

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'Online':
      return colors.status.success;
    case 'Offline':
      return colors.status.error;
    case 'Disabled':
      return colors.text.tertiary;
    case 'NeedsUpgrade':
      return colors.status.warning;
    default:
      return colors.text.secondary;
  }
};

const getCommunicationStyleLabel = (style: string): string => {
  switch (style) {
    case 'TentaclePassive':
      return 'Listening Tentacle';
    case 'TentacleActive':
      return 'Polling Tentacle';
    case 'Ssh':
      return 'SSH';
    case 'Kubernetes':
    case 'KubernetesTentacle':
      return 'Kubernetes Agent';
    case 'AzureWebApp':
      return 'Azure Web App';
    case 'AzureCloudService':
      return 'Azure Cloud Service';
    case 'AzureServiceFabricCluster':
      return 'Service Fabric';
    case 'OfflineDrop':
      return 'Offline Drop';
    case 'StepPackage':
      return 'Cloud Region';
    case 'None':
    case 'CloudRegion':
      return 'Cloud Region';
    default:
      return style || 'Unknown';
  }
};

export default function MachineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const { data: machine, isLoading, error, refetch } = useMachine(id!);
  const { data: environments } = useEnvironments();
  const healthCheckMutation = useTriggerMachineHealthCheck();

  // Map environment IDs to names
  const environmentNames = useMemo(() => {
    if (!environments || !machine) return [];
    return machine.EnvironmentIds.map(envId => {
      const env = environments.find(e => e.Id === envId);
      return env?.Name || envId;
    });
  }, [environments, machine]);

  const handleHealthCheck = useCallback(() => {
    Alert.alert(
      'Run Health Check',
      'This will trigger a health check task for this machine. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Health Check',
          onPress: async () => {
            try {
              const task = await healthCheckMutation.mutateAsync(id!);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Health Check Started',
                'The health check task has been created.',
                [
                  { text: 'View Task', onPress: () => router.push(`/task/${task.Id}`) },
                  { text: 'OK' },
                ]
              );
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to start health check');
            }
          },
        },
      ]
    );
  }, [id, healthCheckMutation, router]);

  if (isLoading && !machine) {
    return <LoadingScreen message="Loading machine..." />;
  }

  if (error) {
    return (
      <ErrorView
        message={error.message}
        onRetry={refetch}
        fullScreen
      />
    );
  }

  if (!machine) {
    return (
      <ErrorView
        message="Machine not found"
        fullScreen
      />
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: machine.Name,
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
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.brand.primary}
            />
          }
        >
          {/* Health Status Header */}
          <Card style={styles.healthCard}>
            <View style={styles.healthHeader}>
              <Ionicons 
                name={getHealthIcon(machine.HealthStatus) as any} 
                size={48} 
                color={getHealthColor(machine.HealthStatus)} 
              />
              <View style={styles.healthInfo}>
                <Text style={[styles.healthStatus, { color: getHealthColor(machine.HealthStatus) }]}>
                  {machine.HealthStatus || 'Unknown'}
                </Text>
                {/* Only show status if it has a meaningful value */}
                {machine.Status && machine.Status !== 'Unknown' && (
                  <View style={styles.statusRow}>
                    <View 
                      style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(machine.Status) }
                      ]} 
                    />
                    <Text style={styles.statusText}>{machine.Status}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Status summary or enabled message */}
            <View style={styles.statusSummary}>
              <Text style={styles.statusSummaryText}>
                {machine.StatusSummary || (machine.IsDisabled ? 'This target is disabled.' : 'This target is enabled.')}
              </Text>
            </View>

            {machine.IsDisabled && (
              <View style={styles.disabledBanner}>
                <Ionicons name="pause-circle" size={18} color={colors.status.warning} />
                <Text style={styles.disabledText}>This machine is disabled</Text>
              </View>
            )}

            <Button
              title="Run Health Check"
              onPress={handleHealthCheck}
              variant="primary"
              loading={healthCheckMutation.isPending}
              style={styles.healthCheckButton}
            />
          </Card>

          {/* Machine Details */}
          <Card>
            <Text style={styles.cardTitle}>Details</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Communication Style</Text>
              <Text style={styles.detailValue}>
                {getCommunicationStyleLabel(machine.Endpoint.CommunicationStyle)}
              </Text>
            </View>

            {machine.Uri && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>URI</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {machine.Uri}
                </Text>
              </View>
            )}

            {machine.Thumbprint && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Thumbprint</Text>
                <Text style={styles.detailValueMono} numberOfLines={1}>
                  {machine.Thumbprint.substring(0, 20)}...
                </Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Calamari</Text>
              <View style={styles.detailRowValue}>
                {machine.HasLatestCalamari ? (
                  <View style={styles.upToDateBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
                    <Text style={styles.upToDateText}>Up to date</Text>
                  </View>
                ) : (
                  <View style={styles.needsUpdateBadge}>
                    <Ionicons name="arrow-up-circle" size={14} color={colors.status.warning} />
                    <Text style={styles.needsUpdateText}>Needs update</Text>
                  </View>
                )}
              </View>
            </View>
          </Card>

          {/* Environments */}
          <Card>
            <Text style={styles.cardTitle}>
              Environments ({environmentNames.length})
            </Text>
            {environmentNames.length > 0 ? (
              <View style={styles.tagContainer}>
                {environmentNames.map((name, index) => (
                  <View key={index} style={styles.environmentTag}>
                    <Ionicons name="globe-outline" size={14} color={colors.brand.primary} />
                    <Text style={styles.environmentTagText}>{name}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No environments assigned</Text>
            )}
          </Card>

          {/* Target Tags (formerly Roles) */}
          <Card>
            <Text style={styles.cardTitle}>
              Target Tags ({machine.Roles.length})
            </Text>
            {machine.Roles.length > 0 ? (
              <View style={styles.tagContainer}>
                {machine.Roles.map((role, index) => (
                  <View key={index} style={styles.roleTag}>
                    <Ionicons name="pricetag-outline" size={12} color={colors.text.secondary} />
                    <Text style={styles.roleTagText}>{role}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No target tags assigned</Text>
            )}
          </Card>

          {/* Tenants (if any) */}
          {machine.TenantIds.length > 0 && (
            <Card>
              <Text style={styles.cardTitle}>
                Tenants ({machine.TenantIds.length})
              </Text>
              <View style={styles.tagContainer}>
                {machine.TenantIds.map((tenantId, index) => (
                  <View key={index} style={styles.tenantTag}>
                    <Ionicons name="people-outline" size={14} color={colors.text.secondary} />
                    <Text style={styles.tenantTagText}>{tenantId}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Tenant Tags (if any) */}
          {machine.TenantTags.length > 0 && (
            <Card>
              <Text style={styles.cardTitle}>
                Tenant Tags ({machine.TenantTags.length})
              </Text>
              <View style={styles.tagContainer}>
                {machine.TenantTags.map((tag, index) => (
                  <View key={index} style={styles.roleTag}>
                    <Text style={styles.roleTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}
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
    gap: spacing.md,
  },
  healthCard: {
    padding: spacing.lg,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  healthInfo: {
    flex: 1,
  },
  healthStatus: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  statusText: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
  },
  statusSummary: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  statusSummaryText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  disabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.warningDim,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  disabledText: {
    color: colors.status.warning,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  healthCheckButton: {
    marginTop: spacing.md,
  },
  cardTitle: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.muted,
  },
  detailLabel: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  detailValue: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  detailValueMono: {
    color: colors.text.primary,
    fontSize: fontSize.xs,
    fontFamily: 'monospace',
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  detailRowValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upToDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.status.successDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  upToDateText: {
    color: colors.status.success,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  needsUpdateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.status.warningDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  needsUpdateText: {
    color: colors.status.warning,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  environmentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.interactive.focus,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  environmentTagText: {
    color: colors.brand.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  roleTagText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  tenantTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  tenantTagText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  emptyText: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
});

