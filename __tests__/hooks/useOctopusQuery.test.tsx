/**
 * Tests for custom React Query hooks
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  queryKeys,
  useDashboard,
  useSpaces,
  useProjects,
  useProject,
  useEnvironments,
  useDeployments,
  useDeployment,
  useCreateDeployment,
  useTasks,
  useTask,
  useTaskDetails,
  useCancelTask,
  useMachines,
  useMachine,
  useRunbooks,
  useRunbook,
  useCreateRunbookRun,
  useSpace,
  useProjectGroups,
  useEnvironment,
  useLifecycle,
  useReleases,
  useRelease,
  useReleaseProgression,
  useTaskRaw,
  useTaskInterruptions,
  useSubmitInterruption,
  useTakeResponsibility,
  useArtifacts,
  usePendingInterruptions,
  useInterruption,
  useTriggerMachineHealthCheck,
  useEvents,
  useProjectRunbooks,
  useRunbookSnapshots,
  useRunbookProcess,
  useRunbookProcessById,
  useRunbookEnvironments,
  useRunbookRuns,
  useRunbookRun,
  useDeploymentProcess,
  useProjectVariables,
  useProjectSummary,
  useProjectChannels,
  useProjectProgression,
  useKubernetesLiveStatus,
  useTenants,
  useTenant,
  useTagSets,
  useReleaseTemplate,
  usePackageVersions,
  useCreateRelease,
  useDeploymentPreview,
  useGlobalSearch,
} from '../../src/hooks/useOctopusQuery';
import * as apiClient from '../../src/lib/api/client';

// Mock the API client
jest.mock('../../src/lib/api/client');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryDelay: 0, // Hooks with custom retry functions override retry: false; keep retries instant
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Query Keys', () => {
  describe('queryKeys', () => {
    it('should generate correct dashboard key', () => {
      expect(queryKeys.dashboard()).toEqual(['octopus', 'dashboard']);
    });

    it('should generate correct spaces key', () => {
      expect(queryKeys.spaces()).toEqual(['octopus', 'spaces']);
    });

    it('should generate correct space key with ID', () => {
      expect(queryKeys.space('Spaces-1')).toEqual(['octopus', 'spaces', 'Spaces-1']);
    });

    it('should generate correct projects key', () => {
      expect(queryKeys.projects()).toEqual(['octopus', 'projects']);
    });

    it('should generate correct project key with ID', () => {
      expect(queryKeys.project('Projects-1')).toEqual(['octopus', 'projects', 'Projects-1']);
    });

    it('should generate correct projectList key with params', () => {
      expect(queryKeys.projectList({ searchText: 'test', take: 10 })).toEqual([
        'octopus',
        'projects',
        'list',
        { searchText: 'test', take: 10 },
      ]);
    });

    it('should generate correct environments key', () => {
      expect(queryKeys.environments()).toEqual(['octopus', 'environments']);
    });

    it('should generate correct deployments key', () => {
      expect(queryKeys.deployments()).toEqual(['octopus', 'deployments']);
    });

    it('should generate correct tasks key', () => {
      expect(queryKeys.tasks()).toEqual(['octopus', 'tasks']);
    });

    it('should generate correct taskDetails key', () => {
      expect(queryKeys.taskDetails('ServerTasks-1')).toEqual([
        'octopus',
        'tasks',
        'ServerTasks-1',
        'details',
      ]);
    });

    it('should generate correct machines key', () => {
      expect(queryKeys.machines()).toEqual(['octopus', 'machines']);
    });

    it('should generate correct runbooks key', () => {
      expect(queryKeys.runbooks()).toEqual(['octopus', 'runbooks']);
    });

    it('should generate correct observability keys', () => {
      expect(queryKeys.observability()).toEqual(['octopus', 'observability']);
      expect(queryKeys.kubernetesLiveStatus('Deployments-1')).toEqual([
        'octopus',
        'observability',
        'liveStatus',
        'Deployments-1',
      ]);
    });
  });
});

describe('Dashboard Hooks', () => {
  describe('useDashboard', () => {
    it('should fetch dashboard data', async () => {
      const mockDashboard = {
        Id: 'Dashboard',
        Projects: [],
        Environments: [],
        Tenants: [],
        ProjectGroups: [],
        Items: [],
      };

      mockApiClient.getDashboard.mockResolvedValue(mockDashboard);

      const { result } = renderHook(() => useDashboard(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockDashboard);
      expect(mockApiClient.getDashboard).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const error = new apiClient.OctopusApiError('Network error', 0, [], true);
      mockApiClient.getDashboard.mockRejectedValue(error);

      const { result } = renderHook(() => useDashboard(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeInstanceOf(apiClient.OctopusApiError);
    });

    it('should not fetch when disabled', () => {
      const { result } = renderHook(() => useDashboard({ enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getDashboard).not.toHaveBeenCalled();
    });
  });
});

describe('Spaces Hooks', () => {
  describe('useSpaces', () => {
    it('should fetch spaces', async () => {
      const mockSpaces = [
        { Id: 'Spaces-1', Name: 'Default', IsDefault: true },
        { Id: 'Spaces-2', Name: 'Production', IsDefault: false },
      ];

      mockApiClient.getSpaces.mockResolvedValue(mockSpaces);

      const { result } = renderHook(() => useSpaces(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
    });
  });
});

describe('Projects Hooks', () => {
  describe('useProjects', () => {
    it('should fetch projects with pagination', async () => {
      const mockProjects = {
        Items: [{ Id: 'Projects-1', Name: 'Web App' }],
        TotalResults: 1,
        ItemsPerPage: 30,
      };

      mockApiClient.getProjects.mockResolvedValue(mockProjects);

      const { result } = renderHook(() => useProjects({ take: 30 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Items).toHaveLength(1);
    });

    it('should search projects', async () => {
      const mockProjects = {
        Items: [{ Id: 'Projects-1', Name: 'Test Project' }],
        TotalResults: 1,
        ItemsPerPage: 30,
      };

      mockApiClient.getProjects.mockResolvedValue(mockProjects);

      const { result } = renderHook(() => useProjects({ searchText: 'Test' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiClient.getProjects).toHaveBeenCalledWith({ searchText: 'Test' });
    });
  });

  describe('useProject', () => {
    it('should fetch a specific project', async () => {
      const mockProject = {
        Id: 'Projects-1',
        Name: 'Web App',
        Slug: 'web-app',
      };

      mockApiClient.getProject.mockResolvedValue(mockProject);

      const { result } = renderHook(() => useProject('Projects-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Name).toBe('Web App');
    });

    it('should not fetch with empty ID', () => {
      const { result } = renderHook(() => useProject(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getProject).not.toHaveBeenCalled();
    });
  });
});

describe('Environments Hooks', () => {
  describe('useEnvironments', () => {
    it('should fetch environments', async () => {
      const mockEnvironments = [
        { Id: 'Environments-1', Name: 'Development' },
        { Id: 'Environments-2', Name: 'Production' },
      ];

      mockApiClient.getEnvironments.mockResolvedValue(mockEnvironments);

      const { result } = renderHook(() => useEnvironments(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
    });
  });
});

describe('Deployments Hooks', () => {
  describe('useDeployments', () => {
    it('should fetch deployments', async () => {
      const mockDeployments = {
        Items: [{ Id: 'Deployments-1', ReleaseId: 'Releases-1' }],
        TotalResults: 1,
      };

      mockApiClient.getDeployments.mockResolvedValue(mockDeployments);

      const { result } = renderHook(() => useDeployments(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Items).toHaveLength(1);
    });

    it('should filter by project and environment', async () => {
      const mockDeployments = { Items: [], TotalResults: 0 };
      mockApiClient.getDeployments.mockResolvedValue(mockDeployments);

      renderHook(
        () =>
          useDeployments({
            projectId: 'Projects-1',
            environmentId: 'Environments-1',
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockApiClient.getDeployments).toHaveBeenCalledWith({
          projectId: 'Projects-1',
          environmentId: 'Environments-1',
        });
      });
    });
  });

  describe('useDeployment', () => {
    it('should fetch a specific deployment', async () => {
      const mockDeployment = {
        Id: 'Deployments-1',
        ReleaseId: 'Releases-1',
        EnvironmentId: 'Environments-1',
        TaskId: 'ServerTasks-1',
      };

      mockApiClient.getDeployment.mockResolvedValue(mockDeployment);

      const { result } = renderHook(() => useDeployment('Deployments-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.TaskId).toBe('ServerTasks-1');
    });
  });

  describe('useCreateDeployment', () => {
    it('should create a deployment', async () => {
      const mockDeployment = {
        Id: 'Deployments-100',
        ReleaseId: 'Releases-1',
        EnvironmentId: 'Environments-1',
        TaskId: 'ServerTasks-100',
      };

      mockApiClient.createDeployment.mockResolvedValue(mockDeployment);

      const { result } = renderHook(() => useCreateDeployment(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        releaseId: 'Releases-1',
        environmentId: 'Environments-1',
        comments: 'Test deployment',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Id).toBe('Deployments-100');
    });
  });
});

describe('Tasks Hooks', () => {
  describe('useTasks', () => {
    it('should fetch tasks', async () => {
      const mockTasks = {
        Items: [
          { Id: 'ServerTasks-1', State: 'Executing' },
          { Id: 'ServerTasks-2', State: 'Success' },
        ],
        TotalResults: 2,
      };

      mockApiClient.getTasks.mockResolvedValue(mockTasks);

      const { result } = renderHook(() => useTasks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Items).toHaveLength(2);
    });

    it('should filter by states', async () => {
      const mockTasks = { Items: [], TotalResults: 0 };
      mockApiClient.getTasks.mockResolvedValue(mockTasks);

      renderHook(() => useTasks({ states: ['Executing', 'Queued'] }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockApiClient.getTasks).toHaveBeenCalledWith({
          states: ['Executing', 'Queued'],
        });
      });
    });
  });

  describe('useTask', () => {
    it('should fetch a specific task', async () => {
      const mockTask = {
        Id: 'ServerTasks-1',
        State: 'Executing',
        PercentComplete: 50,
      };

      mockApiClient.getTask.mockResolvedValue(mockTask);

      const { result } = renderHook(() => useTask('ServerTasks-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.State).toBe('Executing');
    });
  });

  describe('useTaskDetails', () => {
    it('should fetch task details with logs', async () => {
      const mockDetails = {
        Task: { Id: 'ServerTasks-1', State: 'Success' },
        ActivityLogs: [{ Id: 'Log-1', Name: 'Step 1', Status: 'Success' }],
      };

      mockApiClient.getTaskDetails.mockResolvedValue(mockDetails);

      const { result } = renderHook(() => useTaskDetails('ServerTasks-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.ActivityLogs).toHaveLength(1);
    });

    it('should not fetch when disabled', () => {
      const { result } = renderHook(
        () => useTaskDetails('ServerTasks-1', { enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getTaskDetails).not.toHaveBeenCalled();
    });
  });

  describe('useCancelTask', () => {
    it('should cancel a task', async () => {
      mockApiClient.cancelTask.mockResolvedValue(undefined);

      const { result } = renderHook(() => useCancelTask(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('ServerTasks-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiClient.cancelTask).toHaveBeenCalled();
      expect(mockApiClient.cancelTask.mock.calls[0][0]).toBe('ServerTasks-1');
    });
  });
});

describe('Machines Hooks', () => {
  describe('useMachines', () => {
    it('should fetch machines', async () => {
      const mockMachines = {
        Items: [
          { Id: 'Machines-1', Name: 'Web Server 1' },
          { Id: 'Machines-2', Name: 'Web Server 2' },
        ],
        TotalResults: 2,
      };

      mockApiClient.getMachines.mockResolvedValue(mockMachines);

      const { result } = renderHook(() => useMachines(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Items).toHaveLength(2);
    });
  });

  describe('useMachine', () => {
    it('should fetch a specific machine', async () => {
      const mockMachine = {
        Id: 'Machines-1',
        Name: 'Web Server 1',
        HealthStatus: 'Healthy',
      };

      mockApiClient.getMachine.mockResolvedValue(mockMachine);

      const { result } = renderHook(() => useMachine('Machines-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.HealthStatus).toBe('Healthy');
    });
  });
});

describe('Runbooks Hooks', () => {
  describe('useRunbooks', () => {
    it('should fetch runbooks', async () => {
      const mockRunbooks = {
        Items: [
          { Id: 'Runbooks-1', Name: 'Backup' },
          { Id: 'Runbooks-2', Name: 'Clear Cache' },
        ],
        TotalResults: 2,
      };

      mockApiClient.getRunbooks.mockResolvedValue(mockRunbooks);

      const { result } = renderHook(() => useRunbooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Items).toHaveLength(2);
    });
  });

  describe('useRunbook', () => {
    it('should fetch a specific runbook', async () => {
      const mockRunbook = {
        Id: 'Runbooks-1',
        Name: 'Backup Database',
        ProjectId: 'Projects-1',
      };

      mockApiClient.getRunbook.mockResolvedValue(mockRunbook);

      const { result } = renderHook(() => useRunbook('Runbooks-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Name).toBe('Backup Database');
    });
  });

  describe('useCreateRunbookRun', () => {
    it('should create a runbook run', async () => {
      const mockRun = {
        Id: 'RunbookRuns-1',
        RunbookId: 'Runbooks-1',
        TaskId: 'ServerTasks-100',
      };

      mockApiClient.createRunbookRun.mockResolvedValue(mockRun);

      const { result } = renderHook(() => useCreateRunbookRun(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        runbookId: 'Runbooks-1',
        runbookSnapshotId: 'RunbookSnapshots-1',
        environmentId: 'Environments-1',
        comments: 'Test run',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Id).toBe('RunbookRuns-1');
    });
  });
});

describe('Space Hooks', () => {
  describe('useSpace', () => {
    it('should fetch a specific space', async () => {
      const mockSpace = { Id: 'Spaces-1', Name: 'Default', IsDefault: true };
      mockApiClient.getSpace.mockResolvedValue(mockSpace);

      const { result } = renderHook(() => useSpace('Spaces-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Name).toBe('Default');
      expect(mockApiClient.getSpace).toHaveBeenCalledWith('Spaces-1');
    });

    it('should not fetch with empty ID', () => {
      const { result } = renderHook(() => useSpace(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getSpace).not.toHaveBeenCalled();
    });
  });
});

describe('Project Groups Hooks', () => {
  describe('useProjectGroups', () => {
    it('should fetch project groups', async () => {
      const mockGroups = [
        { Id: 'ProjectGroups-1', Name: 'Default Project Group' },
        { Id: 'ProjectGroups-2', Name: 'Legacy' },
      ];
      mockApiClient.getProjectGroups.mockResolvedValue(mockGroups);

      const { result } = renderHook(() => useProjectGroups(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
    });
  });
});

describe('Environment Hooks', () => {
  describe('useEnvironment', () => {
    it('should fetch a specific environment', async () => {
      const mockEnvironment = { Id: 'Environments-1', Name: 'Production' };
      mockApiClient.getEnvironment.mockResolvedValue(mockEnvironment);

      const { result } = renderHook(() => useEnvironment('Environments-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Name).toBe('Production');
    });

    it('should not fetch with empty ID', () => {
      const { result } = renderHook(() => useEnvironment(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getEnvironment).not.toHaveBeenCalled();
    });
  });
});

describe('Lifecycle Hooks', () => {
  describe('useLifecycle', () => {
    it('should fetch a lifecycle', async () => {
      const mockLifecycle = { Id: 'Lifecycles-1', Name: 'Default Lifecycle', Phases: [] };
      mockApiClient.getLifecycle.mockResolvedValue(mockLifecycle);

      const { result } = renderHook(() => useLifecycle('Lifecycles-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Name).toBe('Default Lifecycle');
      expect(mockApiClient.getLifecycle).toHaveBeenCalledWith('Lifecycles-1');
    });

    it('should not fetch when lifecycle ID is null', () => {
      const { result } = renderHook(() => useLifecycle(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getLifecycle).not.toHaveBeenCalled();
    });
  });
});

describe('Releases Hooks', () => {
  describe('useReleases', () => {
    it('should fetch releases for a project', async () => {
      const mockReleases = {
        Items: [{ Id: 'Releases-1', Version: '1.0.0' }],
        TotalResults: 1,
      };
      mockApiClient.getReleases.mockResolvedValue(mockReleases);

      const { result } = renderHook(() => useReleases('Projects-1', { take: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Items).toHaveLength(1);
      expect(mockApiClient.getReleases).toHaveBeenCalledWith('Projects-1', { take: 10 });
    });

    it('should not fetch with empty project ID', () => {
      const { result } = renderHook(() => useReleases(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getReleases).not.toHaveBeenCalled();
    });
  });

  describe('useRelease', () => {
    it('should fetch a specific release', async () => {
      const mockRelease = { Id: 'Releases-1', Version: '1.0.0', ProjectId: 'Projects-1' };
      mockApiClient.getRelease.mockResolvedValue(mockRelease);

      const { result } = renderHook(() => useRelease('Releases-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Version).toBe('1.0.0');
    });
  });

  describe('useReleaseProgression', () => {
    it('should fetch release progression', async () => {
      const mockProgression = { Phases: [{ Name: 'Dev', Progress: 'Complete' }] };
      mockApiClient.getReleaseProgression.mockResolvedValue(mockProgression);

      const { result } = renderHook(() => useReleaseProgression('Releases-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Phases).toHaveLength(1);
    });

    it('should not fetch with empty release ID', () => {
      const { result } = renderHook(() => useReleaseProgression(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getReleaseProgression).not.toHaveBeenCalled();
    });
  });
});

describe('Task Log Hooks', () => {
  describe('useTask (options)', () => {
    it('should not fetch when disabled via options', () => {
      const { result } = renderHook(
        () => useTask('ServerTasks-1', { enabled: false, refetchInterval: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getTask).not.toHaveBeenCalled();
    });
  });

  describe('useTaskRaw', () => {
    it('should fetch raw task log', async () => {
      mockApiClient.getTaskRaw.mockResolvedValue('== Task log output ==');

      const { result } = renderHook(() => useTaskRaw('ServerTasks-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBe('== Task log output ==');
      expect(mockApiClient.getTaskRaw).toHaveBeenCalledWith('ServerTasks-1');
    });

    it('should not fetch when disabled', () => {
      const { result } = renderHook(
        () => useTaskRaw('ServerTasks-1', { enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getTaskRaw).not.toHaveBeenCalled();
    });
  });

  describe('useTaskInterruptions', () => {
    it('should fetch task interruptions', async () => {
      const mockInterruptions = [{ Id: 'Interruptions-1', IsPending: true }];
      mockApiClient.getTaskInterruptions.mockResolvedValue(mockInterruptions);

      const { result } = renderHook(() => useTaskInterruptions('ServerTasks-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
    });

    it('should not retry on 404 errors', async () => {
      const notFound = Object.assign(new Error('Not found'), { statusCode: 404 });
      mockApiClient.getTaskInterruptions.mockRejectedValue(notFound);

      const { result } = renderHook(() => useTaskInterruptions('ServerTasks-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(mockApiClient.getTaskInterruptions).toHaveBeenCalledTimes(1);
    });

    it('should retry up to 2 times on non-404 errors', async () => {
      const serverError = Object.assign(new Error('Server error'), { statusCode: 500 });
      mockApiClient.getTaskInterruptions.mockRejectedValue(serverError);

      const { result } = renderHook(() => useTaskInterruptions('ServerTasks-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

      expect(mockApiClient.getTaskInterruptions).toHaveBeenCalledTimes(3);
    });
  });

  describe('useSubmitInterruption', () => {
    it('should submit an interruption result', async () => {
      mockApiClient.submitInterruption.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSubmitInterruption(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        interruptionId: 'Interruptions-1',
        action: 'Proceed',
        notes: 'Looks good',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiClient.submitInterruption).toHaveBeenCalledWith(
        'Interruptions-1',
        'Proceed',
        'Looks good'
      );
    });
  });

  describe('useTakeResponsibility', () => {
    it('should take responsibility for an interruption', async () => {
      mockApiClient.takeResponsibility.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTakeResponsibility(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('Interruptions-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiClient.takeResponsibility.mock.calls[0][0]).toBe('Interruptions-1');
    });
  });
});

describe('Artifacts Hooks', () => {
  describe('useArtifacts', () => {
    it('should fetch artifacts for a task', async () => {
      const mockArtifacts = [{ Id: 'Artifacts-1', Filename: 'output.log' }];
      mockApiClient.getArtifacts.mockResolvedValue(mockArtifacts);

      const { result } = renderHook(() => useArtifacts('ServerTasks-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(mockApiClient.getArtifacts).toHaveBeenCalledWith('ServerTasks-1');
    });

    it('should not retry on 404 errors', async () => {
      const notFound = Object.assign(new Error('Not found'), { statusCode: 404 });
      mockApiClient.getArtifacts.mockRejectedValue(notFound);

      const { result } = renderHook(() => useArtifacts('ServerTasks-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(mockApiClient.getArtifacts).toHaveBeenCalledTimes(1);
    });

    it('should retry on non-404 errors', async () => {
      const serverError = Object.assign(new Error('Server error'), { statusCode: 500 });
      mockApiClient.getArtifacts.mockRejectedValue(serverError);

      const { result } = renderHook(() => useArtifacts('ServerTasks-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

      expect(mockApiClient.getArtifacts).toHaveBeenCalledTimes(3);
    });

    it('should not fetch when disabled', () => {
      const { result } = renderHook(
        () => useArtifacts('ServerTasks-1', { enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getArtifacts).not.toHaveBeenCalled();
    });
  });
});

describe('Pending Interruptions Hooks', () => {
  describe('usePendingInterruptions', () => {
    it('should fetch pending interruptions', async () => {
      const mockInterruptions = [
        { Id: 'Interruptions-1', IsPending: true },
        { Id: 'Interruptions-2', IsPending: true },
      ];
      mockApiClient.getPendingInterruptions.mockResolvedValue(mockInterruptions);

      const { result } = renderHook(() => usePendingInterruptions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
    });

    it('should not fetch when disabled', () => {
      const { result } = renderHook(
        () => usePendingInterruptions({ enabled: false, refetchInterval: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getPendingInterruptions).not.toHaveBeenCalled();
    });

    it('should not retry on 404 errors', async () => {
      const notFound = Object.assign(new Error('Not found'), { statusCode: 404 });
      mockApiClient.getPendingInterruptions.mockRejectedValue(notFound);

      const { result } = renderHook(() => usePendingInterruptions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(mockApiClient.getPendingInterruptions).toHaveBeenCalledTimes(1);
    });

    it('should retry on non-404 errors', async () => {
      const serverError = Object.assign(new Error('Server error'), { statusCode: 500 });
      mockApiClient.getPendingInterruptions.mockRejectedValue(serverError);

      const { result } = renderHook(() => usePendingInterruptions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });

      expect(mockApiClient.getPendingInterruptions).toHaveBeenCalledTimes(3);
    });
  });

  describe('useInterruption', () => {
    it('should fetch a specific interruption', async () => {
      const mockInterruption = { Id: 'Interruptions-1', IsPending: true };
      mockApiClient.getInterruption.mockResolvedValue(mockInterruption);

      const { result } = renderHook(() => useInterruption('Interruptions-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Id).toBe('Interruptions-1');
    });

    it('should not fetch with empty ID', () => {
      const { result } = renderHook(() => useInterruption(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getInterruption).not.toHaveBeenCalled();
    });
  });
});

describe('Machine Mutation Hooks', () => {
  describe('useTriggerMachineHealthCheck', () => {
    it('should trigger a health check', async () => {
      const mockTask = { Id: 'ServerTasks-200', State: 'Queued' };
      mockApiClient.triggerMachineHealthCheck.mockResolvedValue(mockTask);

      const { result } = renderHook(() => useTriggerMachineHealthCheck(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('Machines-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Id).toBe('ServerTasks-200');
      expect(mockApiClient.triggerMachineHealthCheck.mock.calls[0][0]).toBe('Machines-1');
    });
  });
});

describe('Events Hooks', () => {
  describe('useEvents', () => {
    it('should fetch events', async () => {
      const mockEvents = {
        Items: [{ Id: 'Events-1', Category: 'DeploymentSucceeded' }],
        TotalResults: 1,
      };
      mockApiClient.getEvents.mockResolvedValue(mockEvents);

      const { result } = renderHook(() => useEvents({ regarding: 'Deployments-1' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Items).toHaveLength(1);
      expect(mockApiClient.getEvents).toHaveBeenCalledWith({ regarding: 'Deployments-1' });
    });
  });
});

describe('Runbook Detail Hooks', () => {
  describe('useProjectRunbooks', () => {
    it('should fetch runbooks for a project', async () => {
      const mockRunbooks = [{ Id: 'Runbooks-1', Name: 'Backup' }];
      mockApiClient.getProjectRunbooks.mockResolvedValue(mockRunbooks);

      const { result } = renderHook(() => useProjectRunbooks('Projects-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(mockApiClient.getProjectRunbooks).toHaveBeenCalledWith('Projects-1');
    });

    it('should not fetch with empty project ID', () => {
      const { result } = renderHook(() => useProjectRunbooks(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getProjectRunbooks).not.toHaveBeenCalled();
    });
  });

  describe('useRunbookSnapshots', () => {
    it('should fetch runbook snapshots', async () => {
      const mockSnapshots = {
        Items: [{ Id: 'RunbookSnapshots-1', Name: 'Snapshot 1' }],
        TotalResults: 1,
      };
      mockApiClient.getRunbookSnapshots.mockResolvedValue(mockSnapshots);

      const { result } = renderHook(
        () => useRunbookSnapshots('Runbooks-1', { take: 5 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Items).toHaveLength(1);
      expect(mockApiClient.getRunbookSnapshots).toHaveBeenCalledWith('Runbooks-1', { take: 5 });
    });
  });

  describe('useRunbookProcess', () => {
    it('should fetch a runbook process', async () => {
      const mockProcess = { Id: 'RunbookProcess-1', Steps: [] };
      mockApiClient.getRunbookProcess.mockResolvedValue(mockProcess);

      const { result } = renderHook(() => useRunbookProcess('Runbooks-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Id).toBe('RunbookProcess-1');
    });
  });

  describe('useRunbookProcessById', () => {
    it('should fetch a runbook process by process ID', async () => {
      const mockProcess = { Id: 'RunbookProcess-1', Steps: [] };
      mockApiClient.getRunbookProcessById.mockResolvedValue(mockProcess);

      const { result } = renderHook(() => useRunbookProcessById('RunbookProcess-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiClient.getRunbookProcessById).toHaveBeenCalledWith('RunbookProcess-1');
    });

    it('should not fetch when process ID is null', () => {
      const { result } = renderHook(() => useRunbookProcessById(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getRunbookProcessById).not.toHaveBeenCalled();
    });
  });

  describe('useRunbookEnvironments', () => {
    it('should fetch runbook environments', async () => {
      const mockEnvironments = [{ Id: 'Environments-1', Name: 'Production' }];
      mockApiClient.getRunbookEnvironments.mockResolvedValue(mockEnvironments);

      const { result } = renderHook(
        () => useRunbookEnvironments('Projects-1', 'Runbooks-1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(mockApiClient.getRunbookEnvironments).toHaveBeenCalledWith('Projects-1', 'Runbooks-1');
    });

    it('should not fetch when project ID is missing', () => {
      const { result } = renderHook(
        () => useRunbookEnvironments(null, 'Runbooks-1'),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getRunbookEnvironments).not.toHaveBeenCalled();
    });
  });
});

describe('Runbook Runs Hooks', () => {
  describe('useRunbookRuns', () => {
    it('should fetch runbook runs', async () => {
      const mockRuns = {
        Items: [{ Id: 'RunbookRuns-1', RunbookId: 'Runbooks-1' }],
        TotalResults: 1,
      };
      mockApiClient.getRunbookRuns.mockResolvedValue(mockRuns);

      const { result } = renderHook(
        () => useRunbookRuns({ projectId: 'Projects-1' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Items).toHaveLength(1);
      expect(mockApiClient.getRunbookRuns).toHaveBeenCalledWith({ projectId: 'Projects-1' });
    });
  });

  describe('useRunbookRun', () => {
    it('should fetch a specific runbook run', async () => {
      const mockRun = { Id: 'RunbookRuns-1', TaskId: 'ServerTasks-100' };
      mockApiClient.getRunbookRun.mockResolvedValue(mockRun);

      const { result } = renderHook(() => useRunbookRun('RunbookRuns-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.TaskId).toBe('ServerTasks-100');
    });

    it('should not fetch with empty ID', () => {
      const { result } = renderHook(() => useRunbookRun(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getRunbookRun).not.toHaveBeenCalled();
    });
  });
});

describe('Project Detail Hooks', () => {
  describe('useDeploymentProcess', () => {
    it('should fetch the deployment process', async () => {
      const mockProcess = { Id: 'deploymentprocess-Projects-1', Steps: [] };
      mockApiClient.getDeploymentProcess.mockResolvedValue(mockProcess);

      const { result } = renderHook(() => useDeploymentProcess('Projects-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Id).toBe('deploymentprocess-Projects-1');
    });

    it('should not fetch with empty project ID', () => {
      const { result } = renderHook(() => useDeploymentProcess(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getDeploymentProcess).not.toHaveBeenCalled();
    });
  });

  describe('useProjectVariables', () => {
    it('should fetch project variables', async () => {
      const mockVariables = { Id: 'variableset-Projects-1', Variables: [] };
      mockApiClient.getProjectVariables.mockResolvedValue(mockVariables);

      const { result } = renderHook(() => useProjectVariables('Projects-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Id).toBe('variableset-Projects-1');
    });
  });

  describe('useProjectSummary', () => {
    it('should fetch project summary', async () => {
      const mockSummary = { Id: 'Dashboard', Projects: [], Items: [] };
      mockApiClient.getProjectSummary.mockResolvedValue(mockSummary);

      const { result } = renderHook(() => useProjectSummary('Projects-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiClient.getProjectSummary).toHaveBeenCalledWith('Projects-1');
    });
  });

  describe('useProjectChannels', () => {
    it('should fetch project channels', async () => {
      const mockChannels = [{ Id: 'Channels-1', Name: 'Default', IsDefault: true }];
      mockApiClient.getChannels.mockResolvedValue(mockChannels);

      const { result } = renderHook(() => useProjectChannels('Projects-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(mockApiClient.getChannels).toHaveBeenCalledWith('Projects-1');
    });
  });

  describe('useProjectProgression', () => {
    it('should fetch project progression', async () => {
      const mockProgression = { Environments: [], Releases: [] };
      mockApiClient.getProjectProgression.mockResolvedValue(mockProgression);

      const { result } = renderHook(() => useProjectProgression('Projects-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiClient.getProjectProgression).toHaveBeenCalledWith('Projects-1');
    });

    it('should not fetch with empty project ID', () => {
      const { result } = renderHook(() => useProjectProgression(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getProjectProgression).not.toHaveBeenCalled();
    });
  });
});

describe('Observability Hooks', () => {
  describe('useKubernetesLiveStatus', () => {
    it('should fetch kubernetes live status', async () => {
      const mockStatus = { MachineStatuses: [], Summary: {} };
      mockApiClient.getKubernetesLiveStatus.mockResolvedValue(mockStatus);

      const { result } = renderHook(
        () => useKubernetesLiveStatus('Projects-1', 'Environments-1', { tenantId: 'Tenants-1' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiClient.getKubernetesLiveStatus).toHaveBeenCalledWith(
        'Projects-1',
        'Environments-1',
        'Tenants-1'
      );
    });

    it('should not fetch when environment ID is missing', () => {
      const { result } = renderHook(
        () => useKubernetesLiveStatus('Projects-1', null),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getKubernetesLiveStatus).not.toHaveBeenCalled();
    });

    it('should not fetch when disabled', () => {
      const { result } = renderHook(
        () => useKubernetesLiveStatus('Projects-1', 'Environments-1', { enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getKubernetesLiveStatus).not.toHaveBeenCalled();
    });
  });
});

describe('Tenants Hooks', () => {
  describe('useTenants', () => {
    it('should fetch tenants', async () => {
      const mockTenants = {
        Items: [{ Id: 'Tenants-1', Name: 'Customer A' }],
        TotalResults: 1,
      };
      mockApiClient.getTenants.mockResolvedValue(mockTenants);

      const { result } = renderHook(() => useTenants({ searchText: 'Customer' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Items).toHaveLength(1);
      expect(mockApiClient.getTenants).toHaveBeenCalledWith({ searchText: 'Customer' });
    });
  });

  describe('useTenant', () => {
    it('should fetch a specific tenant', async () => {
      const mockTenant = { Id: 'Tenants-1', Name: 'Customer A' };
      mockApiClient.getTenant.mockResolvedValue(mockTenant);

      const { result } = renderHook(() => useTenant('Tenants-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Name).toBe('Customer A');
    });

    it('should not fetch with empty ID', () => {
      const { result } = renderHook(() => useTenant(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getTenant).not.toHaveBeenCalled();
    });
  });

  describe('useTagSets', () => {
    it('should fetch tag sets', async () => {
      const mockTagSets = [{ Id: 'TagSets-1', Name: 'Region', Tags: [] }];
      mockApiClient.getTagSets.mockResolvedValue(mockTagSets);

      const { result } = renderHook(() => useTagSets(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
    });
  });
});

describe('Release Creation Hooks', () => {
  describe('useReleaseTemplate', () => {
    it('should fetch a release template', async () => {
      const mockTemplate = { NextVersionIncrement: '1.0.1', Packages: [] };
      mockApiClient.getReleaseTemplate.mockResolvedValue(mockTemplate);

      const { result } = renderHook(
        () => useReleaseTemplate('Projects-1', 'Channels-1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.NextVersionIncrement).toBe('1.0.1');
      expect(mockApiClient.getReleaseTemplate).toHaveBeenCalledWith('Projects-1', 'Channels-1');
    });

    it('should not fetch with empty project ID', () => {
      const { result } = renderHook(() => useReleaseTemplate(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getReleaseTemplate).not.toHaveBeenCalled();
    });
  });

  describe('usePackageVersions', () => {
    it('should fetch package versions', async () => {
      const mockVersions = [{ Version: '1.0.0' }, { Version: '1.0.1' }];
      mockApiClient.getPackageVersions.mockResolvedValue(mockVersions);

      const { result } = renderHook(
        () => usePackageVersions('Feeds-1', 'MyPackage', { take: 10, filter: '1.0' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(mockApiClient.getPackageVersions).toHaveBeenCalledWith('Feeds-1', 'MyPackage', {
        take: 10,
        filter: '1.0',
      });
    });

    it('should not fetch when package ID is missing', () => {
      const { result } = renderHook(() => usePackageVersions('Feeds-1', ''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getPackageVersions).not.toHaveBeenCalled();
    });

    it('should not fetch when disabled', () => {
      const { result } = renderHook(
        () => usePackageVersions('Feeds-1', 'MyPackage', { enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getPackageVersions).not.toHaveBeenCalled();
    });
  });

  describe('useCreateRelease', () => {
    it('should create a release', async () => {
      const mockRelease = { Id: 'Releases-100', Version: '1.0.1', ProjectId: 'Projects-1' };
      mockApiClient.createRelease.mockResolvedValue(mockRelease);

      const { result } = renderHook(() => useCreateRelease(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        projectId: 'Projects-1',
        version: '1.0.1',
        channelId: 'Channels-1',
        releaseNotes: 'Bug fixes',
        selectedPackages: [],
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.Id).toBe('Releases-100');
      expect(mockApiClient.createRelease).toHaveBeenCalledWith('Projects-1', {
        version: '1.0.1',
        channelId: 'Channels-1',
        releaseNotes: 'Bug fixes',
        selectedPackages: [],
      });
    });

    it('should handle creation errors', async () => {
      const error = Object.assign(new Error('Version already exists'), { statusCode: 400 });
      mockApiClient.createRelease.mockRejectedValue(error);

      const { result } = renderHook(() => useCreateRelease(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ projectId: 'Projects-1', version: '1.0.0' });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe('Version already exists');
    });
  });
});

describe('Deployment Preview Hooks', () => {
  describe('useDeploymentPreview', () => {
    it('should fetch a deployment preview', async () => {
      const mockPreview = { StepsToExecute: [], Changes: [] };
      mockApiClient.getDeploymentPreview.mockResolvedValue(mockPreview);

      const { result } = renderHook(
        () => useDeploymentPreview('Releases-1', 'Environments-1', 'Tenants-1'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockApiClient.getDeploymentPreview).toHaveBeenCalledWith(
        'Releases-1',
        'Environments-1',
        'Tenants-1'
      );
    });

    it('should not fetch when environment ID is missing', () => {
      const { result } = renderHook(
        () => useDeploymentPreview('Releases-1', ''),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getDeploymentPreview).not.toHaveBeenCalled();
    });

    it('should not fetch when disabled', () => {
      const { result } = renderHook(
        () => useDeploymentPreview('Releases-1', 'Environments-1', undefined, { enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.getDeploymentPreview).not.toHaveBeenCalled();
    });
  });
});

describe('Global Search Hooks', () => {
  describe('useGlobalSearch', () => {
    it('should search with 2+ characters', async () => {
      const mockResults = {
        projects: [{ Id: 'Projects-1', Name: 'Web App' }],
        releases: [],
        deployments: [],
        runbooks: [],
        machines: [],
        environments: [],
        tenants: [],
        variables: [],
      };
      mockApiClient.globalSearch.mockResolvedValue(mockResults);

      const { result } = renderHook(
        () => useGlobalSearch('web', { take: 5, includeVariables: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.projects).toHaveLength(1);
      expect(mockApiClient.globalSearch).toHaveBeenCalledWith('web', {
        take: 5,
        includeVariables: true,
      });
    });

    it('should not search with fewer than 2 characters', () => {
      const { result } = renderHook(() => useGlobalSearch('w'), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.globalSearch).not.toHaveBeenCalled();
    });

    it('should not search when disabled', () => {
      const { result } = renderHook(
        () => useGlobalSearch('web app', { enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isPending).toBe(true);
      expect(mockApiClient.globalSearch).not.toHaveBeenCalled();
    });
  });
});

