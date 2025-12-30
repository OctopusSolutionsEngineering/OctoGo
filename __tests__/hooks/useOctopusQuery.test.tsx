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

