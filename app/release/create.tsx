/**
 * Create Release Screen
 * Create a new release for a project
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useProject,
  useProjectChannels,
  useReleaseTemplate,
  useCreateRelease,
} from '@/src/hooks/useOctopusQuery';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { LoadingScreen } from '@/src/components/ui/LoadingScreen';
import { ErrorView } from '@/src/components/ui/ErrorView';
import { colors } from '@/src/theme/colors';
import type { SelectedPackageVersion } from '@/src/lib/api/types';

export default function CreateReleaseScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId || '');
  const { data: channels, isLoading: channelsLoading } = useProjectChannels(projectId || '');
  
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [selectedPackages, setSelectedPackages] = useState<Record<string, string>>({});
  
  const defaultChannel = channels?.find(c => c.IsDefault) || channels?.[0];
  const effectiveChannelId = selectedChannelId || defaultChannel?.Id;
  
  const { 
    data: template, 
    isLoading: templateLoading,
  } = useReleaseTemplate(projectId || '', effectiveChannelId);
  
  const createRelease = useCreateRelease();

  // Set initial version from template
  useEffect(() => {
    if (template?.NextVersionIncrement && !version) {
      setVersion(template.NextVersionIncrement);
    }
  }, [template, version]);

  // Initialize package selections from template
  useEffect(() => {
    if (template?.Packages) {
      const initialPackages: Record<string, string> = {};
      template.Packages.forEach(pkg => {
        const key = `${pkg.ActionName}:${pkg.PackageReferenceName || ''}`;
        if (!selectedPackages[key] && pkg.VersionSelectedLastRelease) {
          initialPackages[key] = pkg.VersionSelectedLastRelease;
        }
      });
      if (Object.keys(initialPackages).length > 0) {
        setSelectedPackages(prev => ({ ...initialPackages, ...prev }));
      }
    }
  }, [template]);

  const handlePackageVersionChange = useCallback((actionName: string, packageRef: string | null, version: string) => {
    const key = `${actionName}:${packageRef || ''}`;
    setSelectedPackages(prev => ({ ...prev, [key]: version }));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!projectId) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Build selected packages array
    const packages: SelectedPackageVersion[] = [];
    if (template?.Packages) {
      template.Packages.forEach(pkg => {
        const key = `${pkg.ActionName}:${pkg.PackageReferenceName || ''}`;
        const ver = selectedPackages[key] || pkg.VersionSelectedLastRelease;
        if (ver) {
          packages.push({
            ActionName: pkg.ActionName,
            PackageReferenceName: pkg.PackageReferenceName || undefined,
            Version: ver,
          });
        }
      });
    }

    try {
      const release = await createRelease.mutateAsync({
        projectId,
        version: version || undefined,
        channelId: effectiveChannelId,
        releaseNotes: releaseNotes || undefined,
        selectedPackages: packages.length > 0 ? packages : undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Release Created',
        `Version ${release.Version} has been created.`,
        [
          {
            text: 'View Release',
            onPress: () => router.replace(`/release/${release.Id}` as any),
          },
          {
            text: 'Create Deployment',
            onPress: () => router.replace(`/release/${release.Id}/deploy` as any),
          },
        ]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Failed to Create Release',
        error?.message || 'An unexpected error occurred'
      );
    }
  }, [projectId, version, effectiveChannelId, releaseNotes, selectedPackages, template, createRelease, router]);

  if (projectLoading) {
    return <LoadingScreen message="Loading project..." />;
  }

  if (projectError) {
    return (
      <ErrorView
        message={projectError.message || 'An error occurred'}
        title="Failed to load project"
        onRetry={() => router.back()}
      />
    );
  }

  const isLoading = channelsLoading || templateLoading;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Create Release',
          headerBackTitle: 'Cancel',
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Project Info */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20,
            }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.octopus.primary + '20',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="pricetag" size={22} color={colors.octopus.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: colors.text.primary,
                }}>
                  {project?.Name}
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: colors.text.muted,
                }}>
                  New Release
                </Text>
              </View>
            </View>

            {/* Version */}
            <Card style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.text.secondary,
                marginBottom: 8,
              }}>
                Version
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.background.tertiary,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  fontSize: 16,
                  color: colors.text.primary,
                  borderWidth: 1,
                  borderColor: colors.border.muted,
                }}
                value={version}
                onChangeText={setVersion}
                placeholder={template?.NextVersionIncrement || '1.0.0'}
                placeholderTextColor={colors.text.subtle}
              />
              {template?.NextVersionIncrement && (
                <Text style={{
                  fontSize: 12,
                  color: colors.text.muted,
                  marginTop: 6,
                }}>
                  Suggested: {template.NextVersionIncrement}
                </Text>
              )}
            </Card>

            {/* Channel */}
            {channels && channels.length > 1 && (
              <Card style={{ marginBottom: 16 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.text.secondary,
                  marginBottom: 8,
                }}>
                  Channel
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {channels.map(channel => (
                    <Pressable
                      key={channel.Id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedChannelId(channel.Id);
                      }}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: (effectiveChannelId === channel.Id)
                          ? colors.octopus.primary
                          : colors.background.tertiary,
                        borderWidth: 1,
                        borderColor: (effectiveChannelId === channel.Id)
                          ? colors.octopus.primary
                          : colors.border.muted,
                      }}
                    >
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '500',
                        color: (effectiveChannelId === channel.Id)
                          ? '#FFFFFF'
                          : colors.text.secondary,
                      }}>
                        {channel.Name}
                        {channel.IsDefault && ' (Default)'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Card>
            )}

            {/* Packages */}
            {template?.Packages && template.Packages.length > 0 && (
              <Card style={{ marginBottom: 16 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.text.secondary,
                  marginBottom: 12,
                }}>
                  Packages
                </Text>
                {template.Packages.map((pkg, index) => (
                  <View
                    key={`${pkg.ActionName}-${pkg.PackageReferenceName || index}`}
                    style={{
                      marginBottom: index < template.Packages.length - 1 ? 16 : 0,
                    }}
                  >
                    <Text style={{
                      fontSize: 13,
                      color: colors.text.muted,
                      marginBottom: 4,
                    }}>
                      {pkg.ActionName}
                      {pkg.PackageReferenceName && ` / ${pkg.PackageReferenceName}`}
                    </Text>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}>
                      <View style={{
                        flex: 1,
                        backgroundColor: colors.background.tertiary,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderWidth: 1,
                        borderColor: colors.border.muted,
                      }}>
                        <Text style={{
                          fontSize: 13,
                          color: colors.text.muted,
                          marginBottom: 2,
                        }}>
                          {pkg.PackageId}
                        </Text>
                        <TextInput
                          style={{
                            fontSize: 14,
                            color: colors.text.primary,
                          }}
                          value={selectedPackages[`${pkg.ActionName}:${pkg.PackageReferenceName || ''}`] || pkg.VersionSelectedLastRelease || ''}
                          onChangeText={(v) => handlePackageVersionChange(pkg.ActionName, pkg.PackageReferenceName, v)}
                          placeholder="Version"
                          placeholderTextColor={colors.text.subtle}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {/* Release Notes */}
            <Card style={{ marginBottom: 24 }}>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: colors.text.secondary,
                marginBottom: 8,
              }}>
                Release Notes (optional)
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
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
                value={releaseNotes}
                onChangeText={setReleaseNotes}
                placeholder="What's in this release?"
                placeholderTextColor={colors.text.subtle}
                multiline
                numberOfLines={4}
              />
            </Card>

            {/* Create Button */}
            <Button
              title={createRelease.isPending ? 'Creating...' : 'Create Release'}
              onPress={handleCreate}
              disabled={createRelease.isPending || isLoading}
              variant="primary"
            />

            {isLoading && (
              <View style={{
                alignItems: 'center',
                marginTop: 16,
              }}>
                <ActivityIndicator size="small" color={colors.octopus.primary} />
                <Text style={{
                  fontSize: 13,
                  color: colors.text.muted,
                  marginTop: 8,
                }}>
                  Loading release details...
                </Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

