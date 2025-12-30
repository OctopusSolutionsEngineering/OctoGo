/**
 * Tenant Detail Screen
 * View tenant information and connected projects/environments
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useTenant,
  useProjects,
  useEnvironments,
} from '@/src/hooks/useOctopusQuery';
import { Card } from '@/src/components/ui/Card';
import { LoadingScreen } from '@/src/components/ui/LoadingScreen';
import { ErrorView } from '@/src/components/ui/ErrorView';
import { colors } from '@/src/theme/colors';

export default function TenantDetailScreen() {
  const { id: tenantId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const { 
    data: tenant, 
    isLoading, 
    error, 
    refetch,
    isRefetching,
  } = useTenant(tenantId || '');
  
  const { data: projectsData } = useProjects({ take: 500 });
  const { data: environments } = useEnvironments();

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

  // Parse connected projects
  const connectedProjects = useMemo(() => {
    if (!tenant?.ProjectEnvironments) return [];
    
    return Object.entries(tenant.ProjectEnvironments).map(([projectId, envIds]) => ({
      projectId,
      projectName: projectMap[projectId] || projectId,
      environments: (envIds as string[]).map(envId => ({
        id: envId,
        name: environmentMap[envId] || envId,
      })),
    }));
  }, [tenant, projectMap, environmentMap]);

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
      />
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: tenant.Name,
          headerBackTitle: 'Back',
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.octopus.primary}
            />
          }
        >
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20,
          }}>
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: colors.octopus.primary + '20',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 16,
            }}>
              <Ionicons name="people" size={28} color={colors.octopus.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 22,
                fontWeight: '700',
                color: colors.text.primary,
              }}>
                {tenant.Name}
              </Text>
              {tenant.Description && (
                <Text style={{
                  fontSize: 14,
                  color: colors.text.muted,
                  marginTop: 4,
                }}>
                  {tenant.Description}
                </Text>
              )}
            </View>
          </View>

          {/* Tags */}
          {tenant.TenantTags && tenant.TenantTags.length > 0 && (
            <Card style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.text.secondary,
                marginBottom: 10,
              }}>
                Tags
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {tenant.TenantTags.map(tag => (
                  <View
                    key={tag}
                    style={{
                      backgroundColor: colors.status.info + '20',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{
                      fontSize: 13,
                      color: colors.status.info,
                      fontWeight: '500',
                    }}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Connected Projects */}
          <Card style={{ marginBottom: 16 }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.text.secondary,
              marginBottom: 12,
            }}>
              Connected Projects ({connectedProjects.length})
            </Text>
            
            {connectedProjects.length === 0 ? (
              <Text style={{
                fontSize: 14,
                color: colors.text.muted,
                fontStyle: 'italic',
              }}>
                No projects connected to this tenant
              </Text>
            ) : (
              connectedProjects.map((project, index) => (
                <Pressable
                  key={project.projectId}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/project/${project.projectId}`);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    paddingVertical: 12,
                    borderBottomWidth: index < connectedProjects.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border.muted,
                    backgroundColor: pressed ? colors.background.tertiary : 'transparent',
                    marginHorizontal: -12,
                    paddingHorizontal: 12,
                  })}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.status.success + '20',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons name="folder" size={18} color={colors.status.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 15,
                      fontWeight: '500',
                      color: colors.text.primary,
                    }}>
                      {project.projectName}
                    </Text>
                    <View style={{ 
                      flexDirection: 'row', 
                      flexWrap: 'wrap',
                      gap: 6,
                      marginTop: 6,
                    }}>
                      {project.environments.map(env => (
                        <View
                          key={env.id}
                          style={{
                            backgroundColor: colors.background.tertiary,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 4,
                          }}
                        >
                          <Text style={{
                            fontSize: 11,
                            color: colors.text.muted,
                          }}>
                            {env.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Ionicons 
                    name="chevron-forward" 
                    size={18} 
                    color={colors.text.subtle}
                    style={{ alignSelf: 'center' }}
                  />
                </Pressable>
              ))
            )}
          </Card>

          {/* Info */}
          <Card>
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: colors.text.secondary,
              marginBottom: 10,
            }}>
              Details
            </Text>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.text.muted }}>ID</Text>
                <Text style={{ fontSize: 13, color: colors.text.secondary, fontFamily: 'monospace' }}>
                  {tenant.Id}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.text.muted }}>Space</Text>
                <Text style={{ fontSize: 13, color: colors.text.secondary }}>
                  {tenant.SpaceId}
                </Text>
              </View>
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

