/**
 * Deploy Release Screen
 * Deploy/promote a release to an environment
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  SafeAreaView,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useRelease,
  useReleaseProgression,
  useEnvironments,
  useTenants,
  useDeploymentPreview,
  useCreateDeployment,
} from '@/src/hooks/useOctopusQuery';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { LoadingScreen } from '@/src/components/ui/LoadingScreen';
import { ErrorView } from '@/src/components/ui/ErrorView';
import { colors } from '@/src/theme/colors';

export default function DeployReleaseScreen() {
  const { id: releaseId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const { data: release, isLoading: releaseLoading, error: releaseError } = useRelease(releaseId || '');
  const { data: progression } = useReleaseProgression(releaseId || '');
  const { data: environments } = useEnvironments();
  const { data: tenantsData } = useTenants({ take: 100 });
  
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [comments, setComments] = useState('');
  
  const createDeployment = useCreateDeployment();

  // Get available environments from progression (next deployments)
  const availableEnvironments = useMemo(() => {
    if (!progression?.NextDeployments || !environments) return [];
    
    return environments.filter(env => 
      progression.NextDeployments.includes(env.Id)
    ).sort((a, b) => a.SortOrder - b.SortOrder);
  }, [progression, environments]);

  // All environments for display
  const allEnvironments = useMemo(() => {
    return environments?.slice().sort((a, b) => a.SortOrder - b.SortOrder) || [];
  }, [environments]);

  // Check which environments have been deployed to
  const deployedEnvironments = useMemo(() => {
    const deployed = new Set<string>();
    progression?.Phases?.forEach(phase => {
      Object.entries(phase.Deployments || {}).forEach(([envId, deployments]) => {
        if (deployments && deployments.length > 0) {
          deployed.add(envId);
        }
      });
    });
    return deployed;
  }, [progression]);

  // Get tenants for this project
  const tenants = tenantsData?.Items || [];

  const { data: preview } = useDeploymentPreview(
    releaseId || '',
    selectedEnvironmentId || '',
    selectedTenantId || undefined,
    { enabled: !!selectedEnvironmentId }
  );

  const handleDeploy = useCallback(async () => {
    if (!releaseId || !selectedEnvironmentId) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const deployment = await createDeployment.mutateAsync({
        releaseId,
        environmentId: selectedEnvironmentId,
        comments: comments || undefined,
        tenantId: selectedTenantId || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Deployment Started',
        'Your deployment is now queued.',
        [
          {
            text: 'View Task',
            onPress: () => router.replace(`/task/${deployment.TaskId}`),
          },
          {
            text: 'Done',
            style: 'cancel',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Deployment Failed',
        error?.message || 'An unexpected error occurred'
      );
    }
  }, [releaseId, selectedEnvironmentId, selectedTenantId, comments, createDeployment, router]);

  if (releaseLoading) {
    return <LoadingScreen message="Loading release..." />;
  }

  if (releaseError) {
    return (
      <ErrorView
        message={releaseError.message || 'An error occurred'}
        title="Failed to load release"
        onRetry={() => router.back()}
      />
    );
  }

  const getEnvironmentStatus = (envId: string) => {
    if (availableEnvironments.some(e => e.Id === envId)) {
      return 'available';
    }
    if (deployedEnvironments.has(envId)) {
      return 'deployed';
    }
    return 'blocked';
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Deploy Release',
          headerBackTitle: 'Cancel',
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Release Info */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20,
          }}>
            <View style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: colors.status.success + '20',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Ionicons name="rocket" size={22} color={colors.status.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: colors.text.primary,
              }}>
                {release?.Version}
              </Text>
              <Text style={{
                fontSize: 14,
                color: colors.text.muted,
              }}>
                Deploy Release
              </Text>
            </View>
          </View>

          {/* Environment Selection */}
          <Card style={{ marginBottom: 16 }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.text.secondary,
              marginBottom: 12,
            }}>
              Select Environment
            </Text>
            {allEnvironments.map(env => {
              const status = getEnvironmentStatus(env.Id);
              const isSelected = selectedEnvironmentId === env.Id;
              const isAvailable = status === 'available';
              const isDeployed = status === 'deployed';
              
              return (
                <Pressable
                  key={env.Id}
                  onPress={() => {
                    if (isAvailable || isDeployed) {
                      Haptics.selectionAsync();
                      setSelectedEnvironmentId(env.Id);
                    }
                  }}
                  disabled={status === 'blocked'}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    marginBottom: 8,
                    borderRadius: 8,
                    backgroundColor: isSelected 
                      ? colors.octopus.primary + '15'
                      : pressed 
                        ? colors.background.tertiary 
                        : colors.background.secondary,
                    borderWidth: 2,
                    borderColor: isSelected 
                      ? colors.octopus.primary 
                      : 'transparent',
                    opacity: status === 'blocked' ? 0.5 : 1,
                  })}
                >
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: isAvailable 
                      ? colors.status.success + '20'
                      : isDeployed
                        ? colors.status.info + '20'
                        : colors.background.tertiary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons 
                      name={
                        isAvailable ? 'arrow-forward-circle' : 
                        isDeployed ? 'checkmark-circle' : 
                        'lock-closed'
                      } 
                      size={18} 
                      color={
                        isAvailable ? colors.status.success : 
                        isDeployed ? colors.status.info :
                        colors.text.subtle
                      } 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 15,
                      fontWeight: '500',
                      color: status === 'blocked' ? colors.text.muted : colors.text.primary,
                    }}>
                      {env.Name}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: colors.text.muted,
                      marginTop: 2,
                    }}>
                      {isAvailable ? 'Ready for deployment' : 
                       isDeployed ? 'Already deployed' :
                       'Blocked by lifecycle'}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.octopus.primary} />
                  )}
                </Pressable>
              );
            })}
          </Card>

          {/* Tenant Selection (if applicable) */}
          {tenants.length > 0 && (
            <Card style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.text.secondary,
                marginBottom: 8,
              }}>
                Tenant (optional)
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedTenantId(null);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 6,
                    backgroundColor: !selectedTenantId
                      ? colors.octopus.primary
                      : colors.background.tertiary,
                  }}
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: !selectedTenantId ? '#FFFFFF' : colors.text.secondary,
                  }}>
                    No Tenant
                  </Text>
                </Pressable>
                {tenants.slice(0, 10).map(tenant => (
                  <Pressable
                    key={tenant.Id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedTenantId(tenant.Id);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 6,
                      backgroundColor: selectedTenantId === tenant.Id
                        ? colors.octopus.primary
                        : colors.background.tertiary,
                    }}
                  >
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '500',
                      color: selectedTenantId === tenant.Id ? '#FFFFFF' : colors.text.secondary,
                    }}>
                      {tenant.Name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          )}

          {/* Deployment Preview */}
          {selectedEnvironmentId && preview && (
            <Card style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.text.secondary,
                marginBottom: 8,
              }}>
                Deployment Preview
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <Ionicons 
                  name={preview.HasPreviouslyBeenDeployed ? 'refresh' : 'rocket'} 
                  size={16} 
                  color={colors.text.muted} 
                  style={{ marginRight: 8 }}
                />
                <Text style={{
                  fontSize: 13,
                  color: colors.text.muted,
                }}>
                  {preview.HasPreviouslyBeenDeployed 
                    ? 'This release has been deployed to this environment before' 
                    : 'First deployment to this environment'}
                </Text>
              </View>
              {preview.StepsToExecute && preview.StepsToExecute.length > 0 && (
                <View>
                  <Text style={{
                    fontSize: 12,
                    color: colors.text.muted,
                    marginTop: 4,
                    marginBottom: 4,
                  }}>
                    {preview.StepsToExecute.length} step(s) will be executed
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* Comments */}
          <Card style={{ marginBottom: 24 }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.text.secondary,
              marginBottom: 8,
            }}>
              Deployment Notes (optional)
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.background.tertiary,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.text.primary,
                borderWidth: 1,
                borderColor: colors.border.muted,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
              value={comments}
              onChangeText={setComments}
              placeholder="Add a note about this deployment..."
              placeholderTextColor={colors.text.subtle}
              multiline
              numberOfLines={3}
            />
          </Card>

          {/* Deploy Button */}
          <Button
            title={createDeployment.isPending ? 'Deploying...' : 'Deploy Now'}
            onPress={handleDeploy}
            disabled={!selectedEnvironmentId || createDeployment.isPending}
            variant="primary"
          />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

