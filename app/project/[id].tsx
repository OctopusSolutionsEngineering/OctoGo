/**
 * Project Detail Screen
 * Shows comprehensive project info with environment deployment matrix
 * Similar to Octopus Deploy's project dashboard
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  Image,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useFavorites } from '../../src/context/FavoritesContext';
import { useAuth } from '../../src/context/AuthContext';
import { 
  useProject, 
  useReleases, 
  useCreateDeployment,
  useProjectSummary,
  useDeploymentProcess,
  useProjectRunbooks,
  useProjectVariables,
  useProjectChannels,
  useDeployments,
  useProjectProgression,
  useKubernetesLiveStatus,
  useEnvironments,
  useLifecycle,
} from '../../src/hooks/useOctopusQuery';
import { Card } from '../../src/components/ui/Card';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ProcessStepsView } from '../../src/components/ProcessStepsView';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';
import type { Release, DashboardEnvironment, DashboardItem, TaskState, Variable, Deployment, KubernetesApplicationStatus, KubernetesLiveStatus, Lifecycle, Phase } from '../../src/lib/api/types';

// Section type for accordion navigation
type SectionId = 'dashboard' | 'process' | 'runbooks' | 'variables' | 'channels';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { serverUrl } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(['dashboard']));
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [showK8sLiveStatus, setShowK8sLiveStatus] = useState(true); // Toggle for K8s live status
  
  const isProjectFavorite = isFavorite(id!);
  
  const handleToggleFavorite = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(id!);
  }, [id, toggleFavorite]);
  
  // Lifecycle modal state
  const [showLifecycleModal, setShowLifecycleModal] = useState(false);
  
  // Data queries
  const { data: project, isLoading: projectLoading, error: projectError, refetch: refetchProject } = useProject(id!);
  const { data: releasesData, isLoading: _releasesLoading, refetch: refetchReleases } = useReleases(id!, { take: 15 });
  const { data: projectSummary, isLoading: summaryLoading, refetch: refetchSummary } = useProjectSummary(id!);
  const { data: deploymentsData, refetch: refetchDeployments } = useDeployments({ projectId: id!, take: 100 });
  const { data: _progression, refetch: refetchProgression } = useProjectProgression(id!);
  const { data: deploymentProcess } = useDeploymentProcess(id!);
  const { data: runbooks } = useProjectRunbooks(id!);
  const { data: variables } = useProjectVariables(id!);
  const { data: channels } = useProjectChannels(id!);
  const { data: allEnvironments } = useEnvironments();
  const { data: lifecycle, isLoading: lifecycleLoading } = useLifecycle(project?.LifecycleId);
  
  const createDeployment = useCreateDeployment();
  
  const releases = releasesData?.Items || [];
  
  // Use environments from the dashboard response (already includes the project's environments)
  const sortedEnvironments = useMemo(() => {
    if (!projectSummary?.Environments) return [];
    // DashboardEnvironment doesn't have SortOrder, so just use the order from API
    return projectSummary.Environments;
  }, [projectSummary]);

  // Build deployment matrix from deployments endpoint
  // Map<ReleaseId, Map<EnvironmentId, DeploymentInfo>>
  const deploymentMatrix = useMemo(() => {
    const matrix = new Map<string, Map<string, { deployment: Deployment; dashboardItem?: DashboardItem }>>();
    
    // First, add all deployments from the deployments endpoint
    deploymentsData?.Items?.forEach(deployment => {
      if (!matrix.has(deployment.ReleaseId)) {
        matrix.set(deployment.ReleaseId, new Map());
      }
      const existing = matrix.get(deployment.ReleaseId)!.get(deployment.EnvironmentId);
      // Keep the most recent deployment per release/env
      if (!existing || new Date(deployment.Created) > new Date(existing.deployment.Created)) {
        matrix.get(deployment.ReleaseId)!.set(deployment.EnvironmentId, { deployment });
      }
    });
    
    // Enrich with dashboard items (which have the task state)
    projectSummary?.Items?.forEach(item => {
      const envMap = matrix.get(item.ReleaseId);
      if (envMap) {
        const existing = envMap.get(item.EnvironmentId);
        if (existing) {
          existing.dashboardItem = item;
        }
      }
    });
    
    return matrix;
  }, [deploymentsData, projectSummary]);

  // Get current (live) status per environment - find the most recent deployment per env
  const liveStatus = useMemo(() => {
    const status = new Map<string, DashboardItem>();
    projectSummary?.Items?.forEach(item => {
      // Filter by current project AND IsCurrent flag
      // Dashboard can return items from multiple projects, so we must filter
      if (item.IsCurrent && item.ProjectId === id) {
        status.set(item.EnvironmentId, item);
      }
    });
    return status;
  }, [projectSummary, id]);

  // Get current deployment IDs for K8s live status queries
  const currentDeploymentIds = useMemo(() => {
    const ids: { envId: string; deploymentId: string }[] = [];
    liveStatus.forEach((item, envId) => {
      if (item.DeploymentId) {
        ids.push({ envId, deploymentId: item.DeploymentId });
      }
    });
    return ids;
  }, [liveStatus]);

  // Query Kubernetes live status for the first current deployment (to check if K8s is available)
  // We only query the first one initially to avoid too many parallel requests
  const firstDeploymentId = currentDeploymentIds[0]?.deploymentId;
  const { data: firstK8sStatus, isLoading: k8sStatusLoading } = useKubernetesLiveStatus(
    firstDeploymentId,
    { enabled: showK8sLiveStatus && !!firstDeploymentId }
  );

  // Track if this project has K8s live status available
  const hasK8sLiveStatus = firstK8sStatus?.IsAvailable === true;

  // Store all K8s statuses in a map (we'll fetch them lazily)
  const [k8sStatuses, setK8sStatuses] = useState<Map<string, KubernetesLiveStatus>>(new Map());

  // Update the first K8s status when it changes
  React.useEffect(() => {
    if (firstK8sStatus && firstDeploymentId) {
      setK8sStatuses(prev => {
        const next = new Map(prev);
        next.set(firstDeploymentId, firstK8sStatus);
        return next;
      });
    }
  }, [firstK8sStatus, firstDeploymentId]);


  const toggleSection = (section: SectionId) => {
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
  };

  const handleRefresh = useCallback(() => {
    refetchProject();
    refetchReleases();
    refetchSummary();
    refetchDeployments();
    refetchProgression();
  }, [refetchProject, refetchReleases, refetchSummary, refetchDeployments, refetchProgression]);

  const handleDeployRelease = useCallback((release: Release, environment: DashboardEnvironment) => {
    Alert.alert(
      'Deploy Release',
      `Deploy ${release.Version} to ${environment.Name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deploy',
          onPress: async () => {
            try {
              await createDeployment.mutateAsync({
                releaseId: release.Id,
                environmentId: environment.Id,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setSelectedRelease(null);
              Alert.alert('Success', 'Deployment started successfully');
            } catch (_error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to start deployment');
            }
          },
        },
      ]
    );
  }, [createDeployment]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStateColor = (state: TaskState): string => {
    switch (state) {
      case 'Success': return colors.status.success;
      case 'Failed': case 'TimedOut': return colors.status.error;
      case 'Executing': case 'Queued': return colors.status.info;
      case 'Canceled': case 'Cancelling': return colors.status.warning;
      default: return colors.text.tertiary;
    }
  };

  const getStateBgColor = (state: TaskState): string => {
    switch (state) {
      case 'Success': return colors.status.successDim;
      case 'Failed': case 'TimedOut': return colors.status.errorDim;
      case 'Executing': case 'Queued': return colors.status.infoDim;
      case 'Canceled': case 'Cancelling': return colors.status.warningDim;
      default: return colors.background.tertiary;
    }
  };

  // Kubernetes status helpers
  const getK8sStatusColor = (status: KubernetesApplicationStatus): string => {
    switch (status) {
      case 'Healthy': return colors.status.success;
      case 'Progressing': return colors.status.info;
      case 'Degraded': return colors.status.error;
      case 'OutOfSync': return colors.status.warning;
      case 'Missing': return colors.status.error;
      case 'Unavailable': return colors.text.tertiary;
      case 'Waiting': return colors.status.info;
      case 'Unknown': 
      default: return colors.text.tertiary;
    }
  };

  const getK8sStatusBgColor = (status: KubernetesApplicationStatus): string => {
    switch (status) {
      case 'Healthy': return colors.status.successDim;
      case 'Progressing': return colors.status.infoDim;
      case 'Degraded': return colors.status.errorDim;
      case 'OutOfSync': return colors.status.warningDim;
      case 'Missing': return colors.status.errorDim;
      case 'Unavailable': return colors.background.tertiary;
      case 'Waiting': return colors.status.infoDim;
      case 'Unknown': 
      default: return colors.background.tertiary;
    }
  };

  const getK8sStatusIcon = (status: KubernetesApplicationStatus): string => {
    switch (status) {
      case 'Healthy': return 'checkmark-circle';
      case 'Progressing': return 'sync-circle';
      case 'Degraded': return 'alert-circle';
      case 'OutOfSync': return 'warning';
      case 'Missing': return 'help-circle';
      case 'Unavailable': return 'remove-circle';
      case 'Waiting': return 'time';
      case 'Unknown': 
      default: return 'help-circle-outline';
    }
  };

  const getK8sStatusLabel = (status: KubernetesApplicationStatus): string => {
    switch (status) {
      case 'Healthy': return 'Healthy';
      case 'Progressing': return 'Progressing';
      case 'Degraded': return 'Degraded';
      case 'OutOfSync': return 'Out of Sync';
      case 'Missing': return 'Missing';
      case 'Unavailable': return 'Unavailable';
      case 'Waiting': return 'Waiting';
      case 'Unknown': 
      default: return 'Unknown';
    }
  };

  if (projectLoading && !project) {
    return <LoadingScreen message="Loading project..." />;
  }

  if (projectError) {
    return (
      <ErrorView
        message={projectError.message}
        onRetry={handleRefresh}
        fullScreen
      />
    );
  }

  if (!project) {
    return (
      <ErrorView
        message="Project not found"
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

  // Render Live Status Row (current release per environment)
  const renderLiveStatus = () => {
    // Determine if we should show K8s status toggle
    const showK8sToggle = hasK8sLiveStatus || k8sStatusLoading;
    
    return (
      <View style={styles.liveStatusSection}>
        <View style={styles.liveStatusHeader}>
          <Text style={styles.subSectionTitle}>Live Status</Text>
          {showK8sToggle && (
            <Pressable 
              style={styles.k8sToggle}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowK8sLiveStatus(!showK8sLiveStatus);
              }}
            >
              <Ionicons 
                name="logo-docker" 
                size={14} 
                color={showK8sLiveStatus ? colors.brand.primary : colors.text.tertiary} 
              />
              <Text style={[
                styles.k8sToggleText,
                showK8sLiveStatus && styles.k8sToggleTextActive
              ]}>
                K8s
              </Text>
            </Pressable>
          )}
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.envRow}
        >
          {sortedEnvironments.map((env) => {
            const deploymentStatus = liveStatus.get(env.Id);
            const deploymentId = deploymentStatus?.DeploymentId;
            const k8sStatus = deploymentId ? k8sStatuses.get(deploymentId) : null;
            
            // Show K8s status if toggle is on and status is available
            const showingK8s = showK8sLiveStatus && k8sStatus?.IsAvailable;
            
            return (
              <Pressable
                key={env.Id}
                style={styles.liveEnvCell}
                onPress={() => {
                  if (deploymentStatus) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/deployment/${deploymentStatus.DeploymentId}`);
                  }
                }}
              >
                <Text style={styles.envHeader}>{env.Name}</Text>
                {deploymentStatus ? (
                  <View style={styles.liveStatusContent}>
                    {showingK8s && k8sStatus ? (
                      // Kubernetes Live Status
                      <>
                        <View style={[
                          styles.statusIndicator,
                          styles.k8sStatusIndicator,
                          { 
                            borderColor: getK8sStatusColor(k8sStatus.ApplicationStatus),
                            backgroundColor: getK8sStatusBgColor(k8sStatus.ApplicationStatus)
                          }
                        ]}>
                          <Ionicons 
                            name={getK8sStatusIcon(k8sStatus.ApplicationStatus) as any} 
                            size={18} 
                            color={getK8sStatusColor(k8sStatus.ApplicationStatus)} 
                          />
                        </View>
                        <Text style={styles.liveVersion}>{deploymentStatus.ReleaseVersion}</Text>
                        <View style={[
                          styles.k8sStatusBadge,
                          { backgroundColor: getK8sStatusBgColor(k8sStatus.ApplicationStatus) }
                        ]}>
                          <Text style={[
                            styles.k8sStatusText,
                            { color: getK8sStatusColor(k8sStatus.ApplicationStatus) }
                          ]}>
                            {getK8sStatusLabel(k8sStatus.ApplicationStatus)}
                          </Text>
                        </View>
                        {k8sStatus.Resources.length > 0 && (
                          <Text style={styles.k8sResourceCount}>
                            {k8sStatus.Resources.length} resource{k8sStatus.Resources.length !== 1 ? 's' : ''}
                          </Text>
                        )}
                      </>
                    ) : (
                      // Standard deployment status
                      <>
                        <View style={[
                          styles.statusIndicator,
                          { 
                            borderColor: getStateColor(deploymentStatus.State),
                            backgroundColor: deploymentStatus.State === 'Executing' || deploymentStatus.State === 'Queued' 
                              ? getStateBgColor(deploymentStatus.State) 
                              : 'transparent'
                          }
                        ]}>
                          {(deploymentStatus.State === 'Executing' || deploymentStatus.State === 'Queued') ? (
                            <Ionicons name="sync" size={18} color={getStateColor(deploymentStatus.State)} />
                          ) : deploymentStatus.State === 'Success' ? (
                            <Ionicons name="checkmark" size={18} color={getStateColor(deploymentStatus.State)} />
                          ) : (
                            <Ionicons name="close" size={18} color={getStateColor(deploymentStatus.State)} />
                          )}
                        </View>
                        <Text style={styles.liveVersion}>{deploymentStatus.ReleaseVersion}</Text>
                        {(deploymentStatus.State === 'Executing' || deploymentStatus.State === 'Queued') && (
                          <View style={styles.progressingBadge}>
                            <Ionicons name="flash" size={10} color={colors.status.info} />
                            <Text style={styles.progressText}>Deploying</Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                ) : (
                  <View style={styles.noDeployment}>
                    <Ionicons name="remove" size={24} color={colors.text.tertiary} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // Render Deployments Grid (releases × environments)
  const renderDeploymentsGrid = () => {
    if (summaryLoading || sortedEnvironments.length === 0) {
      return (
        <View style={styles.deploymentsSection}>
          <Text style={styles.subSectionTitle}>Deployments</Text>
          <Text style={styles.loadingText}>
            {summaryLoading ? 'Loading dashboard...' : 'No environments configured'}
          </Text>
        </View>
      );
    }

    if (releases.length === 0) {
      return (
        <View style={styles.deploymentsSection}>
          <Text style={styles.subSectionTitle}>Deployments</Text>
          <EmptyState
            icon="📋"
            title="No releases"
            message="Create your first release in Octopus Deploy"
          />
        </View>
      );
    }

    return (
      <View style={styles.deploymentsSection}>
        <Text style={styles.subSectionTitle}>Deployments</Text>
        <Text style={styles.scrollHint}>← Scroll horizontally to see all environments →</Text>
        
        {/* Horizontally scrolling grid */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={true}
          style={styles.gridContainer}
          contentContainerStyle={styles.gridContent}
        >
          <View>
            {/* Environment headers */}
            <View style={styles.gridHeaderRow}>
              <View style={styles.releaseCell}>
                <Text style={styles.gridHeaderText}>RELEASE</Text>
              </View>
              {sortedEnvironments.map((env) => (
                <View key={env.Id} style={styles.envCell}>
                  <Text style={styles.gridHeaderText} numberOfLines={1}>
                    {env.Name.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>

            {/* Release rows */}
            {releases.map((release) => {
              const releaseDeployments = deploymentMatrix.get(release.Id);
              const isSelected = selectedRelease?.Id === release.Id;
              
              return (
                <Pressable 
                  key={release.Id}
                  style={[styles.gridRow, isSelected && styles.gridRowSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedRelease(isSelected ? null : release);
                  }}
                >
                  <View style={styles.releaseCell}>
                    <Text style={styles.releaseVersion}>{release.Version}</Text>
                  </View>
                  {sortedEnvironments.map((env) => {
                    const data = releaseDeployments?.get(env.Id);
                    const deployment = data?.deployment;
                    const dashboardItem = data?.dashboardItem;
                    // Use dashboard state if available, otherwise assume Success for completed
                    const state: TaskState = dashboardItem?.State || 'Success';
                    
                    return (
                      <Pressable
                        key={env.Id}
                        style={styles.envCell}
                        onPress={() => {
                          if (deployment) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push(`/deployment/${deployment.Id}`);
                          } else if (isSelected) {
                            handleDeployRelease(release, env);
                          }
                        }}
                      >
                        {deployment ? (
                          <View style={styles.deploymentCell}>
                            <View style={[
                              styles.deploymentStatus,
                              { backgroundColor: getStateBgColor(state) }
                            ]}>
                              <Ionicons 
                                name={state === 'Success' ? 'checkmark-circle' : 
                                      (state === 'Executing' || state === 'Queued') ? 'sync-circle' :
                                      state === 'Failed' ? 'close-circle' : 'ellipse'}
                                size={20}
                                color={getStateColor(state)}
                              />
                            </View>
                            <Text style={styles.deploymentVersion}>{release.Version}</Text>
                            <Text style={styles.deploymentDate}>
                              {formatDate(deployment.Created)}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.emptyCell}>
                            {isSelected ? (
                              <Pressable 
                                style={styles.deployButton}
                                onPress={() => handleDeployRelease(release, env)}
                              >
                                <Ionicons name="add" size={16} color={colors.white} />
                              </Pressable>
                            ) : (
                              <View style={styles.emptyDash}>
                                <Ionicons name="remove" size={20} color={colors.border.muted} />
                              </View>
                            )}
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Render Runbooks
  const renderRunbooks = () => {
    if (!runbooks?.length) {
      return (
        <EmptyState
          ionicon="play-circle-outline"
          title="No runbooks"
          message="Create runbooks in Octopus Deploy"
        />
      );
    }

    return (
      <View style={styles.listContainer}>
        {runbooks.map((rb) => (
          <Pressable 
            key={rb.Id} 
            style={styles.listItem}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/runbook/${rb.Id}`);
            }}
          >
            <Ionicons name="play-circle-outline" size={20} color={colors.brand.primary} />
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{rb.Name}</Text>
              {rb.Description && (
                <Text style={styles.listItemSubtitle} numberOfLines={1}>
                  {rb.Description}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
          </Pressable>
        ))}
      </View>
    );
  };

  // Render Variables
  const [showAllVariables, setShowAllVariables] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<Variable | null>(null);
  const INITIAL_VARIABLES_COUNT = 15;

  const handleCopyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  
  const renderVariables = () => {
    if (!variables?.Variables?.length) {
      return (
        <EmptyState
          icon="🔐"
          title="No variables"
          message="Add project variables in Octopus Deploy"
        />
      );
    }

    const uniqueVars = variables.Variables.reduce((acc, v) => {
      if (!acc.find(x => x.Name === v.Name)) {
        acc.push(v);
      }
      return acc;
    }, [] as Variable[]);

    const displayedVars = showAllVariables ? uniqueVars : uniqueVars.slice(0, INITIAL_VARIABLES_COUNT);
    const hiddenCount = uniqueVars.length - INITIAL_VARIABLES_COUNT;

    const handleVariableLongPress = (variable: Variable) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedVariable(variable);
    };

    return (
      <View style={styles.variablesContainer}>
        {displayedVars.map((variable) => (
          <Pressable 
            key={variable.Id} 
            style={styles.variableRow}
            onLongPress={() => handleVariableLongPress(variable)}
            delayLongPress={300}
          >
            <View style={styles.variableNameContainer}>
              <Text style={styles.variableName} numberOfLines={1}>{variable.Name}</Text>
              {variable.IsSensitive && (
                <Ionicons name="lock-closed" size={12} color={colors.status.warning} style={styles.lockIcon} />
              )}
            </View>
            <Text style={styles.variableValue} numberOfLines={1}>
              {variable.IsSensitive ? '••••••' : (variable.Value || '(empty)')}
            </Text>
          </Pressable>
        ))}
        {hiddenCount > 0 && (
          <Pressable 
            style={styles.showMoreButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAllVariables(!showAllVariables);
            }}
          >
            <Ionicons 
              name={showAllVariables ? 'chevron-up' : 'chevron-down'} 
              size={16} 
              color={colors.brand.primary} 
            />
            <Text style={styles.showMoreText}>
              {showAllVariables ? 'Show less' : `Show ${hiddenCount} more`}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  // Variable Detail Modal
  const renderVariableModal = () => (
    <Modal
      visible={!!selectedVariable}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedVariable(null)}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={() => setSelectedVariable(null)}
      >
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Variable Details</Text>
            <Pressable 
              onPress={() => setSelectedVariable(null)}
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </Pressable>
          </View>

          {/* Variable Name */}
          <View style={styles.modalSection}>
            <Text style={styles.modalLabel}>Name</Text>
            <View style={styles.modalValueRow}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.modalValueScroll}
              >
                <Text style={styles.modalValueText} selectable>
                  {selectedVariable?.Name}
                </Text>
              </ScrollView>
              <Pressable 
                style={styles.copyButton}
                onPress={() => {
                  if (selectedVariable?.Name) {
                    handleCopyToClipboard(selectedVariable.Name, 'Name');
                  }
                }}
              >
                <Ionicons name="copy-outline" size={18} color={colors.brand.primary} />
              </Pressable>
            </View>
          </View>

          {/* Variable Value */}
          <View style={styles.modalSection}>
            <Text style={styles.modalLabel}>Value</Text>
            {selectedVariable?.IsSensitive ? (
              <View style={styles.sensitiveValueContainer}>
                <Ionicons name="lock-closed" size={16} color={colors.status.warning} />
                <Text style={styles.sensitiveValueText}>
                  Sensitive value hidden for security
                </Text>
              </View>
            ) : (
              <View style={styles.modalValueRow}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.modalValueScroll}
                >
                  <Text style={styles.modalValueText} selectable>
                    {selectedVariable?.Value || '(empty)'}
                  </Text>
                </ScrollView>
                {selectedVariable?.Value && (
                  <Pressable 
                    style={styles.copyButton}
                    onPress={() => {
                      if (selectedVariable?.Value) {
                        handleCopyToClipboard(selectedVariable.Value, 'Value');
                      }
                    }}
                  >
                    <Ionicons name="copy-outline" size={18} color={colors.brand.primary} />
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Close Button */}
          <Pressable 
            style={styles.modalCloseButton}
            onPress={() => setSelectedVariable(null)}
          >
            <Text style={styles.modalCloseButtonText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // Render Channels
  const renderChannels = () => {
    if (!channels?.length) {
      return (
        <EmptyState
          icon="🔀"
          title="No channels"
          message="Configure channels in Octopus Deploy"
        />
      );
    }

    return (
      <View style={styles.listContainer}>
        {channels.map((channel) => {
          // Channel uses its own lifecycle, or inherits from project
          const isInherited = !channel.LifecycleId;
          const channelLifecycleName = isInherited 
            ? lifecycle?.Name 
            : lifecycle?.Name; // TODO: Could fetch channel-specific lifecycle if different
          
          return (
            <View key={channel.Id} style={styles.channelItem}>
              <View style={styles.channelHeader}>
                <Ionicons name="git-merge-outline" size={20} color={colors.brand.primary} />
                <Text style={styles.channelName}>{channel.Name}</Text>
                {channel.IsDefault && (
                  <View style={styles.defaultTag}>
                    <Text style={styles.defaultTagText}>Default</Text>
                  </View>
                )}
              </View>
              <Pressable 
                style={styles.channelLifecycleRow}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowLifecycleModal(true);
                }}
              >
                <Text style={styles.channelLifecycleName} numberOfLines={1}>
                  {lifecycleLoading ? 'Loading...' : (channelLifecycleName || 'Default Lifecycle')}
                  {isInherited && ' (inherited)'}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: project.Name,
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.background.secondary },
          headerTintColor: colors.text.primary,
          headerRight: () => (
            <Pressable onPress={handleToggleFavorite} hitSlop={8}>
              <Ionicons 
                name={isProjectFavorite ? 'star' : 'star-outline'} 
                size={24} 
                color={isProjectFavorite ? colors.status.warning : colors.text.tertiary} 
              />
            </Pressable>
          ),
        }} 
      />
      
      {renderVariableModal()}
      
      {/* Lifecycle Modal - Slide up from bottom */}
      <Modal
        visible={showLifecycleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLifecycleModal(false)}
      >
        <Pressable 
          style={styles.lifecycleModalOverlay}
          onPress={() => setShowLifecycleModal(false)}
        >
          <Pressable 
            style={styles.lifecycleModalContent}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <View style={styles.lifecycleModalHandle} />
            
            {/* Header */}
            <View style={styles.lifecycleModalHeader}>
              <View style={styles.lifecycleModalTitleRow}>
                <Ionicons name="git-network-outline" size={24} color={colors.brand.primary} />
                <Text style={styles.lifecycleModalTitle}>{lifecycle?.Name || 'Lifecycle'}</Text>
              </View>
              <Pressable 
                onPress={() => setShowLifecycleModal(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </Pressable>
            </View>
            
            {lifecycle?.Description && (
              <Text style={styles.lifecycleDescription}>{lifecycle.Description}</Text>
            )}
            
            {/* Phases */}
            <ScrollView 
              style={styles.lifecyclePhasesScroll}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.lifecyclePhasesContent}
            >
              {lifecycleLoading ? (
                <View style={styles.lifecycleLoadingContainer}>
                  <Text style={styles.lifecycleLoadingText}>Loading lifecycle details...</Text>
                </View>
              ) : !lifecycle ? (
                <View style={styles.lifecycleLoadingContainer}>
                  <Text style={styles.lifecycleLoadingText}>Could not load lifecycle</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.lifecycleSectionTitle}>Phases</Text>
                  {lifecycle.Phases?.length ? (
                <View style={styles.phasesContainer}>
                  {lifecycle.Phases.map((phase, index) => {
                    const autoEnvNames = phase.AutomaticDeploymentTargets
                      ?.map(envId => allEnvironments?.find(e => e.Id === envId)?.Name)
                      .filter(Boolean) || [];
                    const optionalEnvNames = phase.OptionalDeploymentTargets
                      ?.map(envId => allEnvironments?.find(e => e.Id === envId)?.Name)
                      .filter(Boolean) || [];
                    
                    return (
                      <View key={phase.Id} style={styles.phaseItem}>
                        <View style={styles.phaseTimeline}>
                          <View style={[
                            styles.phaseNumber,
                            index === 0 && styles.phaseNumberFirst
                          ]}>
                            <Text style={styles.phaseNumberText}>{index + 1}</Text>
                          </View>
                          {index < (lifecycle.Phases.length - 1) && (
                            <View style={styles.phaseConnector} />
                          )}
                        </View>
                        <View style={styles.phaseContent}>
                          <Text style={styles.phaseName}>{phase.Name}</Text>
                          
                          {autoEnvNames.length > 0 && (
                            <View style={styles.phaseEnvGroup}>
                              <View style={styles.phaseEnvLabel}>
                                <Ionicons name="flash" size={12} color={colors.status.success} />
                                <Text style={styles.phaseEnvLabelText}>Auto-deploy</Text>
                              </View>
                              <View style={styles.phaseEnvList}>
                                {autoEnvNames.map((name, i) => (
                                  <View key={i} style={styles.phaseEnvTag}>
                                    <Text style={styles.phaseEnvTagText}>{name}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                          
                          {optionalEnvNames.length > 0 && (
                            <View style={styles.phaseEnvGroup}>
                              <View style={styles.phaseEnvLabel}>
                                <Ionicons name="hand-left-outline" size={12} color={colors.status.info} />
                                <Text style={styles.phaseEnvLabelText}>Manual</Text>
                              </View>
                              <View style={styles.phaseEnvList}>
                                {optionalEnvNames.map((name, i) => (
                                  <View key={i} style={[styles.phaseEnvTag, styles.phaseEnvTagManual]}>
                                    <Text style={[styles.phaseEnvTagText, styles.phaseEnvTagTextManual]}>{name}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                          
                          {phase.MinimumEnvironmentsBeforePromotion > 0 && (
                            <Text style={styles.phaseNote}>
                              Requires {phase.MinimumEnvironmentsBeforePromotion} environment{phase.MinimumEnvironmentsBeforePromotion > 1 ? 's' : ''} before promotion
                            </Text>
                          )}
                          
                          {phase.IsOptionalPhase && (
                            <View style={styles.optionalBadge}>
                              <Text style={styles.optionalBadgeText}>Optional</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.noPhasesText}>No phases configured</Text>
              )}
              
                  {/* Retention Policies */}
                  <View style={styles.retentionSection}>
                    <Text style={styles.lifecycleSectionTitle}>Retention Policy</Text>
                    <View style={styles.retentionRow}>
                      <Ionicons name="cube-outline" size={16} color={colors.text.tertiary} />
                      <Text style={styles.retentionText}>
                        Releases: {lifecycle.ReleaseRetentionPolicy?.ShouldKeepForever 
                          ? 'Keep forever' 
                          : `Keep ${lifecycle.ReleaseRetentionPolicy?.QuantityToKeep || 0} ${lifecycle.ReleaseRetentionPolicy?.Unit?.toLowerCase() || 'items'}`}
                      </Text>
                    </View>
                    <View style={styles.retentionRow}>
                      <Ionicons name="server-outline" size={16} color={colors.text.tertiary} />
                      <Text style={styles.retentionText}>
                        Tentacle: {lifecycle.TentacleRetentionPolicy?.ShouldKeepForever 
                          ? 'Keep forever' 
                          : `Keep ${lifecycle.TentacleRetentionPolicy?.QuantityToKeep || 0} ${lifecycle.TentacleRetentionPolicy?.Unit?.toLowerCase() || 'items'}`}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
            
            {/* Close Button */}
            <Pressable 
              style={styles.lifecycleCloseButton}
              onPress={() => setShowLifecycleModal(false)}
            >
              <Text style={styles.lifecycleCloseButtonText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={projectLoading}
              onRefresh={handleRefresh}
              tintColor={colors.brand.primary}
            />
          }
        >
          {/* Project Header */}
          <View style={styles.headerCard}>
            <View style={styles.projectHeader}>
              {project.Logo ? (
                <Image 
                  source={{ uri: `${serverUrl}${project.Logo}` }}
                  style={styles.projectLogo}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.projectIconFallback}>
                  <Ionicons 
                    name={project.IsDisabled ? 'pause-circle' : 'cube'} 
                    size={28} 
                    color={project.IsDisabled ? colors.status.warning : colors.brand.primary} 
                  />
                </View>
              )}
              <View style={styles.projectInfo}>
                <Text style={styles.projectName}>{project.Name}</Text>
                {project.Description && (
                  <Text style={styles.projectDescription} numberOfLines={2}>
                    {project.Description}
                  </Text>
                )}
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: project.IsDisabled ? colors.status.warningDim : colors.status.successDim }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: project.IsDisabled ? colors.status.warning : colors.status.success }
                ]}>
                  {project.IsDisabled ? 'Disabled' : 'Active'}
                </Text>
              </View>
            </View>
          </View>

          {/* Dashboard Section (always visible) */}
          <Card style={styles.sectionCard}>
            <SectionHeader id="dashboard" title="Dashboard" icon="grid-outline" />
            {expandedSections.has('dashboard') && (
              <View style={styles.sectionContent}>
                {renderLiveStatus()}
                {renderDeploymentsGrid()}
              </View>
            )}
          </Card>

          {/* Process Section */}
          <Card style={styles.sectionCard}>
            <SectionHeader 
              id="process" 
              title="Process" 
              icon="git-branch-outline" 
              count={deploymentProcess?.Steps?.length}
            />
            {expandedSections.has('process') && (
              <View style={styles.sectionContent}>
                <ProcessStepsView 
                  steps={deploymentProcess?.Steps || []}
                  environments={allEnvironments}
                  emptyTitle="No deployment steps"
                  emptyMessage="Configure your deployment process"
                />
              </View>
            )}
          </Card>

          {/* Runbooks Section */}
          <Card style={styles.sectionCard}>
            <SectionHeader 
              id="runbooks" 
              title="Runbooks" 
              icon="play-circle-outline" 
              count={runbooks?.length}
            />
            {expandedSections.has('runbooks') && (
              <View style={styles.sectionContent}>
                {renderRunbooks()}
              </View>
            )}
          </Card>

          {/* Variables Section */}
          <Card style={styles.sectionCard}>
            <SectionHeader 
              id="variables" 
              title="Variables" 
              icon="code-slash-outline" 
              count={variables?.Variables?.length}
            />
            {expandedSections.has('variables') && (
              <View style={styles.sectionContent}>
                {renderVariables()}
              </View>
            )}
          </Card>

          {/* Channels Section */}
          <Card style={styles.sectionCard}>
            <SectionHeader 
              id="channels" 
              title="Channels" 
              icon="git-merge-outline" 
              count={channels?.length}
            />
            {expandedSections.has('channels') && (
              <View style={styles.sectionContent}>
                {renderChannels()}
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

  // Header
  headerCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectLogo: {
    width: 48,
    height: 48,
    marginRight: spacing.md,
    borderRadius: borderRadius.sm,
  },
  projectIconFallback: {
    width: 48,
    height: 48,
    marginRight: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  projectDescription: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },

  // Section Cards
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
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  sectionContent: {
    borderTopWidth: 1,
    borderTopColor: colors.border.muted,
  },

  // Live Status
  liveStatusSection: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.muted,
  },
  liveStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  subSectionTitle: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  k8sToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.tertiary,
  },
  k8sToggleText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  k8sToggleTextActive: {
    color: colors.brand.primary,
  },
  envRow: {
    gap: spacing.sm,
  },
  liveEnvCell: {
    width: 120,
    alignItems: 'center',
  },
  envHeader: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  liveStatusContent: {
    alignItems: 'center',
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  k8sStatusIndicator: {
    borderWidth: 0,
  },
  liveVersion: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  progressingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  progressText: {
    fontSize: fontSize.xs,
    color: colors.status.info,
  },
  k8sStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 4,
  },
  k8sStatusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  k8sResourceCount: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  noDeployment: {
    paddingVertical: spacing.md,
  },

  // Deployments Grid
  deploymentsSection: {
    padding: spacing.md,
  },
  scrollHint: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  loadingText: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    padding: spacing.lg,
  },
  gridContainer: {
    marginTop: spacing.sm,
  },
  gridContent: {
    paddingRight: spacing.md,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.border.muted,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
  },
  gridHeaderText: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.muted,
    alignItems: 'center',
    minHeight: 70,
  },
  gridRowSelected: {
    backgroundColor: colors.interactive.focus,
    borderRadius: borderRadius.md,
  },
  releaseCell: {
    width: 90,
    paddingRight: spacing.sm,
    justifyContent: 'center',
  },
  envCell: {
    width: 110,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  releaseVersion: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  deploymentCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deploymentStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deploymentVersion: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: 4,
  },
  deploymentDate: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginTop: 2,
    textAlign: 'center',
  },
  emptyCell: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDash: {
    opacity: 0.3,
  },
  deployButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // List items (runbooks, channels)
  listContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listItemTitle: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  listItemSubtitle: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    flex: 1,
  },
  defaultTag: {
    backgroundColor: colors.status.successDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  defaultTagText: {
    color: colors.status.success,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },

  // Variables
  variablesContainer: {
    padding: spacing.md,
  },
  variableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.muted,
    gap: spacing.md,
  },
  variableNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0, // Allow text truncation
  },
  variableName: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    flexShrink: 1,
  },
  lockIcon: {
    marginLeft: spacing.xs,
    flexShrink: 0,
  },
  variableValue: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    flex: 1,
    textAlign: 'right',
    minWidth: 0, // Allow text truncation
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
  },
  showMoreText: {
    color: colors.brand.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // Variable Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  modalSection: {
    marginBottom: spacing.md,
  },
  modalLabel: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  modalValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    paddingLeft: spacing.sm,
    overflow: 'hidden',
  },
  modalValueScroll: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  modalValueText: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
  },
  sensitiveValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.warningDim,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  sensitiveValueText: {
    color: colors.status.warning,
    fontSize: fontSize.sm,
    flex: 1,
  },
  modalCloseButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalCloseButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },

  // Channel with Lifecycle
  channelItem: {
    gap: spacing.sm,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  channelName: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    flex: 1,
  },
  channelLifecycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 28, // Align with channel name (icon width + gap)
  },
  channelLifecycleName: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    flex: 1,
  },

  // Lifecycle Modal
  lifecycleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  lifecycleModalContent: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  lifecycleModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.muted,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  lifecycleModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  lifecycleModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lifecycleModalTitle: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  lifecycleDescription: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  lifecyclePhasesScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  lifecyclePhasesContent: {
    paddingBottom: spacing.md,
  },
  lifecycleLoadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  lifecycleLoadingText: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
  },
  lifecycleSectionTitle: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  phasesContainer: {
    gap: 0,
  },
  phaseItem: {
    flexDirection: 'row',
    minHeight: 60,
  },
  phaseTimeline: {
    width: 32,
    alignItems: 'center',
  },
  phaseNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phaseNumberFirst: {
    backgroundColor: colors.status.success,
  },
  phaseNumberText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  phaseConnector: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border.muted,
    marginVertical: 4,
  },
  phaseContent: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  phaseName: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  phaseEnvGroup: {
    marginTop: spacing.xs,
  },
  phaseEnvLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  phaseEnvLabelText: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  phaseEnvList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  phaseEnvTag: {
    backgroundColor: colors.status.successDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  phaseEnvTagManual: {
    backgroundColor: colors.status.infoDim,
  },
  phaseEnvTagText: {
    color: colors.status.success,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  phaseEnvTagTextManual: {
    color: colors.status.info,
  },
  phaseNote: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  optionalBadge: {
    backgroundColor: colors.status.warningDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  optionalBadgeText: {
    color: colors.status.warning,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  noPhasesText: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    padding: spacing.lg,
  },
  retentionSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.muted,
  },
  retentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  retentionText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  lifecycleCloseButton: {
    backgroundColor: colors.brand.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  lifecycleCloseButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
