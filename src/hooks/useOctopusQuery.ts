/**
 * Custom hooks for Octopus Deploy API queries
 * Uses TanStack Query for caching, background updates, and error handling
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDashboard,
  getProjects,
  getProject,
  getProjectGroups,
  getEnvironments,
  getEnvironment,
  getLifecycle,
  getReleases,
  getRelease,
  getReleaseProgression,
  getDeployments,
  getDeployment,
  createDeployment,
  getTasks,
  getTask,
  getTaskDetails,
  getTaskRaw,
  getTaskInterruptions,
  submitInterruption,
  takeResponsibility,
  getMachines,
  getMachine,
  triggerMachineHealthCheck,
  getSpaces,
  getSpace,
  getEvents,
  cancelTask,
  getRunbooks,
  getRunbook,
  getProjectRunbooks,
  getRunbookRuns,
  getRunbookRun,
  getRunbookSnapshots,
  createRunbookRun,
  getRunbookProcess,
  getRunbookProcessById,
  getRunbookEnvironments,
  getDeploymentProcess,
  getProjectVariables,
  getProjectSummary,
  getProjectProgression,
  getChannels,
  getKubernetesLiveStatus,
  OctopusApiError,
  getTenants,
  getTenant,
  getTagSets,
  createRelease,
  getReleaseTemplate,
  getPackageVersions,
  getDeploymentPreview,
  globalSearch,
} from '../lib/api/client';
import type {
  Dashboard,
  Project,
  ProjectGroup,
  Environment,
  Lifecycle,
  Release,
  Deployment,
  DeploymentProcess,
  Task,
  TaskDetails,
  Machine,
  Space,
  PaginatedResponse,
  Progression,
  Event,
  Runbook,
  RunbookRun,
  RunbookSnapshot,
  RunbookProcess,
  VariableSet,
  Channel,
  KubernetesLiveStatus,
  Tenant,
  TagSet,
  ReleaseTemplate,
  PackageVersion,
  DeploymentPreviewResponse,
  SelectedPackageVersion,
} from '../lib/api/types';

// Query key factory for consistent cache keys
export const queryKeys = {
  all: ['octopus'] as const,
  
  // Dashboard
  dashboard: () => [...queryKeys.all, 'dashboard'] as const,
  
  // Spaces
  spaces: () => [...queryKeys.all, 'spaces'] as const,
  space: (id: string) => [...queryKeys.spaces(), id] as const,
  
  // Projects
  projects: () => [...queryKeys.all, 'projects'] as const,
  projectList: (params?: { skip?: number; take?: number; searchText?: string }) => 
    [...queryKeys.projects(), 'list', params] as const,
  project: (id: string) => [...queryKeys.projects(), id] as const,
  projectGroups: () => [...queryKeys.all, 'projectGroups'] as const,
  projectSummary: (id: string) => [...queryKeys.project(id), 'summary'] as const,
  projectVariables: (id: string) => [...queryKeys.project(id), 'variables'] as const,
  deploymentProcess: (id: string) => [...queryKeys.project(id), 'process'] as const,
  projectChannels: (id: string) => [...queryKeys.project(id), 'channels'] as const,
  
  // Environments
  environments: () => [...queryKeys.all, 'environments'] as const,
  environment: (id: string) => [...queryKeys.environments(), id] as const,
  
  // Lifecycles
  lifecycles: () => [...queryKeys.all, 'lifecycles'] as const,
  lifecycle: (id: string) => [...queryKeys.lifecycles(), id] as const,
  
  // Releases
  releases: (projectId: string) => [...queryKeys.all, 'releases', projectId] as const,
  releaseList: (projectId: string, params?: { skip?: number; take?: number }) => 
    [...queryKeys.releases(projectId), 'list', params] as const,
  release: (id: string) => [...queryKeys.all, 'release', id] as const,
  releaseProgression: (id: string) => [...queryKeys.release(id), 'progression'] as const,
  
  // Deployments
  deployments: () => [...queryKeys.all, 'deployments'] as const,
  deploymentList: (params?: { projectId?: string; environmentId?: string }) => 
    [...queryKeys.deployments(), 'list', params] as const,
  deployment: (id: string) => [...queryKeys.deployments(), id] as const,
  
  // Tasks
  tasks: () => [...queryKeys.all, 'tasks'] as const,
  taskList: (params?: { states?: string[] }) => [...queryKeys.tasks(), 'list', params] as const,
  task: (id: string) => [...queryKeys.tasks(), id] as const,
  taskDetails: (id: string) => [...queryKeys.task(id), 'details'] as const,
  taskRaw: (id: string) => [...queryKeys.task(id), 'raw'] as const,
  taskInterruptions: (id: string) => [...queryKeys.task(id), 'interruptions'] as const,
  
  // Machines
  machines: () => [...queryKeys.all, 'machines'] as const,
  machineList: (params?: { environmentIds?: string[] }) => 
    [...queryKeys.machines(), 'list', params] as const,
  machine: (id: string) => [...queryKeys.machines(), id] as const,
  
  // Events
  events: () => [...queryKeys.all, 'events'] as const,
  eventList: (params?: { regarding?: string }) => [...queryKeys.events(), 'list', params] as const,
  
  // Runbooks
  runbooks: () => [...queryKeys.all, 'runbooks'] as const,
  runbookList: (params?: { projectId?: string }) => [...queryKeys.runbooks(), 'list', params] as const,
  runbook: (id: string) => [...queryKeys.runbooks(), id] as const,
  projectRunbooks: (projectId: string) => [...queryKeys.runbooks(), 'project', projectId] as const,
  runbookSnapshots: (runbookId: string) => [...queryKeys.runbook(runbookId), 'snapshots'] as const,
  runbookProcess: (runbookId: string) => [...queryKeys.runbook(runbookId), 'process'] as const,
  
  // Runbook Runs
  runbookRuns: () => [...queryKeys.all, 'runbookRuns'] as const,
  runbookRunList: (params?: { runbookId?: string; projectId?: string }) => 
    [...queryKeys.runbookRuns(), 'list', params] as const,
  runbookRun: (id: string) => [...queryKeys.runbookRuns(), id] as const,
  
  // Tenants
  tenants: () => [...queryKeys.all, 'tenants'] as const,
  tenantList: (params?: { searchText?: string; projectId?: string; tags?: string[] }) => 
    [...queryKeys.tenants(), 'list', params] as const,
  tenant: (id: string) => [...queryKeys.tenants(), id] as const,
  tagSets: () => [...queryKeys.all, 'tagSets'] as const,
  
  // Release Templates
  releaseTemplate: (projectId: string, channelId?: string) => 
    [...queryKeys.project(projectId), 'releaseTemplate', channelId] as const,
  packageVersions: (feedId: string, packageId: string) => 
    [...queryKeys.all, 'packageVersions', feedId, packageId] as const,
  
  // Deployment Preview
  deploymentPreview: (releaseId: string, environmentId: string, tenantId?: string) => 
    [...queryKeys.release(releaseId), 'preview', environmentId, tenantId] as const,
  
  // Global Search
  globalSearch: (searchText: string) => [...queryKeys.all, 'search', searchText] as const,
  
  // Observability (Kubernetes Live Status)
  observability: () => [...queryKeys.all, 'observability'] as const,
  kubernetesLiveStatus: (deploymentId: string) => 
    [...queryKeys.observability(), 'liveStatus', deploymentId] as const,
};

// ============================================================================
// Dashboard
// ============================================================================

export const useDashboard = (options?: { 
  projectGroupId?: string;
  enabled?: boolean;
}) => {
  return useQuery<Dashboard, OctopusApiError>({
    queryKey: queryKeys.dashboard(),
    queryFn: () => getDashboard({ projectGroupId: options?.projectGroupId }),
    staleTime: 30 * 1000, // 30 seconds - dashboard should be relatively fresh
    refetchInterval: 60 * 1000, // Refetch every minute
    enabled: options?.enabled !== false,
  });
};

// ============================================================================
// Spaces
// ============================================================================

export const useSpaces = () => {
  return useQuery<Space[], OctopusApiError>({
    queryKey: queryKeys.spaces(),
    queryFn: getSpaces,
    staleTime: 5 * 60 * 1000, // 5 minutes - spaces rarely change
  });
};

export const useSpace = (spaceId: string) => {
  return useQuery<Space, OctopusApiError>({
    queryKey: queryKeys.space(spaceId),
    queryFn: () => getSpace(spaceId),
    enabled: !!spaceId,
    staleTime: 5 * 60 * 1000,
  });
};

// ============================================================================
// Projects
// ============================================================================

export const useProjects = (params?: { skip?: number; take?: number; searchText?: string }) => {
  return useQuery<PaginatedResponse<Project>, OctopusApiError>({
    queryKey: queryKeys.projectList(params),
    queryFn: () => getProjects(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useProject = (projectId: string) => {
  return useQuery<Project, OctopusApiError>({
    queryKey: queryKeys.project(projectId),
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
    staleTime: 0, // Always refetch - project config can change (e.g., lifecycle)
  });
};

export const useProjectGroups = () => {
  return useQuery<ProjectGroup[], OctopusApiError>({
    queryKey: queryKeys.projectGroups(),
    queryFn: getProjectGroups,
    staleTime: 5 * 60 * 1000, // 5 minutes - project groups rarely change
  });
};

// ============================================================================
// Environments
// ============================================================================

export const useEnvironments = () => {
  return useQuery<Environment[], OctopusApiError>({
    queryKey: queryKeys.environments(),
    queryFn: getEnvironments,
    staleTime: 5 * 60 * 1000, // 5 minutes - environments rarely change
  });
};

export const useEnvironment = (environmentId: string) => {
  return useQuery<Environment, OctopusApiError>({
    queryKey: queryKeys.environment(environmentId),
    queryFn: () => getEnvironment(environmentId),
    enabled: !!environmentId,
    staleTime: 5 * 60 * 1000,
  });
};

// ============================================================================
// Lifecycles
// ============================================================================

export const useLifecycle = (lifecycleId: string | null | undefined) => {
  return useQuery<Lifecycle, OctopusApiError>({
    queryKey: queryKeys.lifecycle(lifecycleId || ''),
    queryFn: () => getLifecycle(lifecycleId!),
    enabled: !!lifecycleId,
    staleTime: 0, // Always refetch - lifecycle determines which environments are shown
  });
};

// ============================================================================
// Releases
// ============================================================================

export const useReleases = (projectId: string, params?: { skip?: number; take?: number }) => {
  return useQuery<PaginatedResponse<Release>, OctopusApiError>({
    queryKey: queryKeys.releaseList(projectId, params),
    queryFn: () => getReleases(projectId, params),
    enabled: !!projectId,
    staleTime: 60 * 1000, // 1 minute
  });
};

export const useRelease = (releaseId: string) => {
  return useQuery<Release, OctopusApiError>({
    queryKey: queryKeys.release(releaseId),
    queryFn: () => getRelease(releaseId),
    enabled: !!releaseId,
    staleTime: 60 * 1000,
  });
};

export const useReleaseProgression = (releaseId: string) => {
  return useQuery<Progression, OctopusApiError>({
    queryKey: queryKeys.releaseProgression(releaseId),
    queryFn: () => getReleaseProgression(releaseId),
    enabled: !!releaseId,
    staleTime: 30 * 1000, // 30 seconds - progression can change quickly
  });
};

// ============================================================================
// Deployments
// ============================================================================

export const useDeployments = (params?: { 
  skip?: number; 
  take?: number; 
  projectId?: string; 
  environmentId?: string;
  taskState?: string;
}) => {
  return useQuery<PaginatedResponse<Deployment>, OctopusApiError>({
    queryKey: queryKeys.deploymentList(params),
    queryFn: () => getDeployments(params),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
};

export const useDeployment = (deploymentId: string) => {
  return useQuery<Deployment, OctopusApiError>({
    queryKey: queryKeys.deployment(deploymentId),
    queryFn: () => getDeployment(deploymentId),
    enabled: !!deploymentId,
    staleTime: 30 * 1000,
  });
};

export const useCreateDeployment = () => {
  const queryClient = useQueryClient();
  
  return useMutation<
    Deployment,
    OctopusApiError,
    { releaseId: string; environmentId: string; comments?: string; tenantId?: string }
  >({
    mutationFn: ({ releaseId, environmentId, comments, tenantId }) => 
      createDeployment(releaseId, environmentId, { comments, tenantId }),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.deployments() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
    },
  });
};

// ============================================================================
// Tasks
// ============================================================================

export const useTasks = (params?: { 
  skip?: number; 
  take?: number; 
  states?: string[];
  name?: string;
}) => {
  return useQuery<PaginatedResponse<Task>, OctopusApiError>({
    queryKey: queryKeys.taskList(params),
    queryFn: () => getTasks(params),
    staleTime: 15 * 1000, // 15 seconds - tasks change frequently
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

export const useTask = (taskId: string, options?: { refetchInterval?: number }) => {
  return useQuery<Task, OctopusApiError>({
    queryKey: queryKeys.task(taskId),
    queryFn: () => getTask(taskId),
    enabled: !!taskId,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: options?.refetchInterval ?? 10 * 1000, // Default: refetch every 10 seconds
  });
};

export const useTaskDetails = (taskId: string, options?: { 
  enabled?: boolean; 
  refetchInterval?: number | false | ((query: { state: { data?: TaskDetails } }) => number | false);
}) => {
  return useQuery<TaskDetails, OctopusApiError>({
    queryKey: queryKeys.taskDetails(taskId),
    queryFn: () => getTaskDetails(taskId),
    enabled: options?.enabled !== false && !!taskId,
    staleTime: 5 * 1000, // 5 seconds - logs update frequently
    refetchInterval: options?.refetchInterval,
  });
};

export const useCancelTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation<void, OctopusApiError, string>({
    mutationFn: cancelTask,
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
};

export const useTaskRaw = (taskId: string, options?: { enabled?: boolean; refetchInterval?: number | false }) => {
  return useQuery<string, OctopusApiError>({
    queryKey: queryKeys.taskRaw(taskId),
    queryFn: () => getTaskRaw(taskId),
    enabled: options?.enabled !== false && !!taskId,
    staleTime: 3 * 1000, // 3 seconds - logs update frequently
    refetchInterval: options?.refetchInterval,
  });
};

export const useTaskInterruptions = (taskId: string, options?: { enabled?: boolean; refetchInterval?: number | false }) => {
  return useQuery<any[], OctopusApiError>({
    queryKey: queryKeys.taskInterruptions(taskId),
    queryFn: () => getTaskInterruptions(taskId),
    enabled: options?.enabled !== false && !!taskId,
    staleTime: 5 * 1000,
    refetchInterval: options?.refetchInterval,
    // Don't retry on 404 errors - the endpoint may not exist for this task
    retry: (failureCount, error) => {
      if (error?.statusCode === 404) return false;
      return failureCount < 2;
    },
  });
};

export const useSubmitInterruption = () => {
  const queryClient = useQueryClient();
  
  return useMutation<
    void, 
    OctopusApiError, 
    { interruptionId: string; action: 'Proceed' | 'Abort' | 'Fail' | 'Retry' | 'Ignore' | 'Exclude'; notes?: string }
  >({
    mutationFn: ({ interruptionId, action, notes }) => submitInterruption(interruptionId, action, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
    },
  });
};

export const useTakeResponsibility = () => {
  const queryClient = useQueryClient();
  
  return useMutation<void, OctopusApiError, string>({
    mutationFn: takeResponsibility,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
    },
  });
};

// ============================================================================
// Machines
// ============================================================================

export const useMachines = (params?: { 
  skip?: number; 
  take?: number; 
  environmentIds?: string[];
  healthStatuses?: string[];
}) => {
  return useQuery<PaginatedResponse<Machine>, OctopusApiError>({
    queryKey: queryKeys.machineList(params),
    queryFn: () => getMachines(params),
    staleTime: 60 * 1000, // 1 minute
  });
};

export const useMachine = (machineId: string) => {
  return useQuery<Machine, OctopusApiError>({
    queryKey: queryKeys.machine(machineId),
    queryFn: () => getMachine(machineId),
    enabled: !!machineId,
    staleTime: 60 * 1000,
  });
};

export const useTriggerMachineHealthCheck = () => {
  const queryClient = useQueryClient();
  
  return useMutation<Task, OctopusApiError, string>({
    mutationFn: triggerMachineHealthCheck,
    onSuccess: (task, machineId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.machine(machineId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.machines() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
    },
  });
};

// ============================================================================
// Events
// ============================================================================

export const useEvents = (params?: { 
  skip?: number; 
  take?: number; 
  regarding?: string;
}) => {
  return useQuery<PaginatedResponse<Event>, OctopusApiError>({
    queryKey: queryKeys.eventList(params),
    queryFn: () => getEvents(params),
    staleTime: 60 * 1000, // 1 minute
  });
};

// ============================================================================
// Runbooks
// ============================================================================

export const useRunbooks = (params?: { 
  skip?: number; 
  take?: number; 
  projectId?: string;
}) => {
  return useQuery<PaginatedResponse<Runbook>, OctopusApiError>({
    queryKey: queryKeys.runbookList(params),
    queryFn: () => getRunbooks(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useRunbook = (runbookId: string) => {
  return useQuery<Runbook, OctopusApiError>({
    queryKey: queryKeys.runbook(runbookId),
    queryFn: () => getRunbook(runbookId),
    enabled: !!runbookId,
    staleTime: 2 * 60 * 1000,
  });
};

export const useProjectRunbooks = (projectId: string) => {
  return useQuery<Runbook[], OctopusApiError>({
    queryKey: queryKeys.projectRunbooks(projectId),
    queryFn: () => getProjectRunbooks(projectId),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000,
  });
};

export const useRunbookSnapshots = (runbookId: string, params?: { skip?: number; take?: number }) => {
  return useQuery<PaginatedResponse<RunbookSnapshot>, OctopusApiError>({
    queryKey: queryKeys.runbookSnapshots(runbookId),
    queryFn: () => getRunbookSnapshots(runbookId, params),
    enabled: !!runbookId,
    staleTime: 60 * 1000,
  });
};

export const useRunbookProcess = (runbookId: string) => {
  return useQuery<RunbookProcess, OctopusApiError>({
    queryKey: queryKeys.runbookProcess(runbookId),
    queryFn: () => getRunbookProcess(runbookId),
    enabled: !!runbookId,
    staleTime: 5 * 60 * 1000, // 5 minutes - process rarely changes
  });
};

/**
 * Fetches runbook process by its process ID directly (more efficient when you already have the runbook)
 */
export const useRunbookProcessById = (processId: string | null | undefined) => {
  return useQuery<RunbookProcess, OctopusApiError>({
    queryKey: [...queryKeys.runbooks(), 'process', processId],
    queryFn: () => getRunbookProcessById(processId!),
    enabled: !!processId,
    staleTime: 5 * 60 * 1000, // 5 minutes - process rarely changes
  });
};

/**
 * Fetches the environments a runbook can be run within, based on its EnvironmentScope
 */
export const useRunbookEnvironments = (projectId: string | null | undefined, runbookId: string | null | undefined) => {
  return useQuery<Environment[], OctopusApiError>({
    queryKey: [...queryKeys.runbooks(), runbookId, 'environments'],
    queryFn: () => getRunbookEnvironments(projectId!, runbookId!),
    enabled: !!projectId && !!runbookId,
    staleTime: 5 * 60 * 1000, // 5 minutes - environment scope rarely changes
  });
};

// ============================================================================
// Runbook Runs
// ============================================================================

export const useRunbookRuns = (params?: { 
  skip?: number; 
  take?: number; 
  runbookId?: string;
  projectId?: string;
  environmentId?: string;
  taskState?: string;
}) => {
  return useQuery<PaginatedResponse<RunbookRun>, OctopusApiError>({
    queryKey: queryKeys.runbookRunList(params),
    queryFn: () => getRunbookRuns(params),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
};

export const useRunbookRun = (runbookRunId: string) => {
  return useQuery<RunbookRun, OctopusApiError>({
    queryKey: queryKeys.runbookRun(runbookRunId),
    queryFn: () => getRunbookRun(runbookRunId),
    enabled: !!runbookRunId,
    staleTime: 30 * 1000,
  });
};

export const useCreateRunbookRun = () => {
  const queryClient = useQueryClient();
  
  return useMutation<
    RunbookRun,
    OctopusApiError,
    { runbookId: string; runbookSnapshotId: string; environmentId: string; comments?: string }
  >({
    mutationFn: ({ runbookId, runbookSnapshotId, environmentId, comments }) => 
      createRunbookRun(runbookId, runbookSnapshotId, environmentId, { comments }),
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.runbookRuns() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
    },
  });
};

// ============================================================================
// Project Details (Process, Variables, Summary)
// ============================================================================

export const useDeploymentProcess = (projectId: string) => {
  return useQuery<DeploymentProcess, OctopusApiError>({
    queryKey: queryKeys.deploymentProcess(projectId),
    queryFn: () => getDeploymentProcess(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes - process rarely changes
  });
};

export const useProjectVariables = (projectId: string) => {
  return useQuery<VariableSet, OctopusApiError>({
    queryKey: queryKeys.projectVariables(projectId),
    queryFn: () => getProjectVariables(projectId),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useProjectSummary = (projectId: string) => {
  return useQuery<Dashboard, OctopusApiError>({
    queryKey: queryKeys.projectSummary(projectId),
    queryFn: () => getProjectSummary(projectId),
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds - deployment status can change
    refetchInterval: 60 * 1000, // Refetch every minute
  });
};

export const useProjectChannels = (projectId: string) => {
  return useQuery<Channel[], OctopusApiError>({
    queryKey: queryKeys.projectChannels(projectId),
    queryFn: () => getChannels(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes - channels rarely change
  });
};

export const useProjectProgression = (projectId: string) => {
  return useQuery<any, OctopusApiError>({
    queryKey: [...queryKeys.project(projectId), 'progression'],
    queryFn: () => getProjectProgression(projectId),
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds - progression can change
    refetchInterval: 60 * 1000, // Refetch every minute
  });
};

// ============================================================================
// Observability - Kubernetes Live Object Status
// ============================================================================

/**
 * Gets the Kubernetes live status for a project/environment
 * Returns null if observability is not available (not a K8s deployment)
 */
export const useKubernetesLiveStatus = (
  projectId: string | null | undefined,
  environmentId: string | null | undefined,
  options?: { enabled?: boolean; refetchInterval?: number; tenantId?: string }
) => {
  return useQuery<KubernetesLiveStatus | null, OctopusApiError>({
    queryKey: queryKeys.kubernetesLiveStatus(`${projectId}-${environmentId}-${options?.tenantId || ''}`),
    queryFn: () => getKubernetesLiveStatus(projectId!, environmentId!, options?.tenantId),
    enabled: options?.enabled !== false && !!projectId && !!environmentId,
    staleTime: 15 * 1000, // 15 seconds - live status changes frequently
    refetchInterval: options?.refetchInterval ?? 30 * 1000, // Refetch every 30 seconds
    retry: 1, // Only retry once since 404 means not available
  });
};

// ============================================================================
// Tenants
// ============================================================================

export const useTenants = (params?: {
  skip?: number;
  take?: number;
  searchText?: string;
  projectId?: string;
  tags?: string[];
}) => {
  return useQuery<PaginatedResponse<Tenant>, OctopusApiError>({
    queryKey: queryKeys.tenantList(params),
    queryFn: () => getTenants(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useTenant = (tenantId: string) => {
  return useQuery<Tenant, OctopusApiError>({
    queryKey: queryKeys.tenant(tenantId),
    queryFn: () => getTenant(tenantId),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useTagSets = () => {
  return useQuery<TagSet[], OctopusApiError>({
    queryKey: queryKeys.tagSets(),
    queryFn: () => getTagSets(),
    staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
  });
};

// ============================================================================
// Release Creation
// ============================================================================

export const useReleaseTemplate = (projectId: string, channelId?: string) => {
  return useQuery<ReleaseTemplate, OctopusApiError>({
    queryKey: queryKeys.releaseTemplate(projectId, channelId),
    queryFn: () => getReleaseTemplate(projectId, channelId),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const usePackageVersions = (feedId: string, packageId: string, options?: {
  take?: number;
  filter?: string;
  enabled?: boolean;
}) => {
  return useQuery<PackageVersion[], OctopusApiError>({
    queryKey: queryKeys.packageVersions(feedId, packageId),
    queryFn: () => getPackageVersions(feedId, packageId, { take: options?.take, filter: options?.filter }),
    enabled: options?.enabled !== false && !!feedId && !!packageId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

export const useCreateRelease = () => {
  const queryClient = useQueryClient();
  
  return useMutation<
    Release,
    OctopusApiError,
    {
      projectId: string;
      version?: string;
      channelId?: string;
      releaseNotes?: string;
      selectedPackages?: SelectedPackageVersion[];
    }
  >({
    mutationFn: ({ projectId, version, channelId, releaseNotes, selectedPackages }) => 
      createRelease(projectId, { version, channelId, releaseNotes, selectedPackages }),
    onSuccess: (data) => {
      // Invalidate releases for this project
      queryClient.invalidateQueries({ queryKey: queryKeys.releases(data.ProjectId) });
    },
  });
};

// ============================================================================
// Deployment Preview (for promotion)
// ============================================================================

export const useDeploymentPreview = (
  releaseId: string,
  environmentId: string,
  tenantId?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery<DeploymentPreviewResponse, OctopusApiError>({
    queryKey: queryKeys.deploymentPreview(releaseId, environmentId, tenantId),
    queryFn: () => getDeploymentPreview(releaseId, environmentId, tenantId),
    enabled: options?.enabled !== false && !!releaseId && !!environmentId,
    staleTime: 30 * 1000, // 30 seconds
  });
};

// ============================================================================
// Global Search
// ============================================================================

export const useGlobalSearch = (searchText: string, options?: { 
  take?: number; 
  enabled?: boolean;
  includeVariables?: boolean;
}) => {
  return useQuery<{
    projects: Project[];
    releases: Release[];
    deployments: Deployment[];
    runbooks: Runbook[];
    machines: Machine[];
    environments: Environment[];
    tenants: Tenant[];
    variables: { id: string; type: string; name: string; subtitle?: string; projectId?: string }[];
  }, OctopusApiError>({
    queryKey: queryKeys.globalSearch(searchText),
    queryFn: () => globalSearch(searchText, { 
      take: options?.take,
      includeVariables: options?.includeVariables,
    }),
    enabled: options?.enabled !== false && searchText.length >= 2, // Only search with 2+ chars
    staleTime: 30 * 1000, // 30 seconds
  });
};
