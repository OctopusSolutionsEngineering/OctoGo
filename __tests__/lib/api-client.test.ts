/**
 * Tests for Octopus Deploy API Client
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  OctopusApiError,
  validateConnection,
  getCurrentUser,
  getServerStatus,
  getLicenseStatus,
  getSpaces,
  getProjects,
  getProject,
  getEnvironments,
  getDeployments,
  getDeployment,
  createDeployment,
  getTasks,
  getTask,
  getTaskDetails,
  cancelTask,
  getMachines,
  getMachine,
  getRunbooks,
  getRunbook,
  createRunbookRun,
} from '../../src/lib/api/client';
import * as security from '../../src/lib/security';

// Mock security module
jest.mock('../../src/lib/security');

const mockSecurity = security as jest.Mocked<typeof security>;

describe('Octopus API Client', () => {
  let mockAxios: MockAdapter;

  beforeAll(() => {
    // Create mock for axios instance
    mockAxios = new MockAdapter(axios);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.reset();
    
    // Default mock for credentials
    mockSecurity.getCredentials.mockResolvedValue({
      serverUrl: 'https://octopus.example.com',
      apiKey: 'API-KEY123456789012345678901234',
      spaceId: 'Spaces-1',
    });
    
    mockSecurity.sanitizePathSegment.mockImplementation((s) => s);
  });

  afterAll(() => {
    mockAxios.restore();
  });

  // ==========================================================================
  // OctopusApiError
  // ==========================================================================
  describe('OctopusApiError', () => {
    it('should create error with correct properties', () => {
      const error = new OctopusApiError('Test error', 401, ['Error 1']);
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(401);
      expect(error.errors).toEqual(['Error 1']);
      expect(error.isAuthError).toBe(true);
      expect(error.isNetworkError).toBe(false);
      expect(error.isRateLimited).toBe(false);
    });

    it('should identify network errors', () => {
      const error = new OctopusApiError('Network error', 0, [], true);
      
      expect(error.isNetworkError).toBe(true);
      expect(error.isAuthError).toBe(false);
    });

    it('should identify rate limited errors', () => {
      const error = new OctopusApiError('Too many requests', 429);
      
      expect(error.isRateLimited).toBe(true);
    });

    it('should identify 403 as auth error', () => {
      const error = new OctopusApiError('Forbidden', 403);
      
      expect(error.isAuthError).toBe(true);
    });
  });

  // ==========================================================================
  // Authentication
  // ==========================================================================
  describe('Authentication', () => {
    it('should throw error when no credentials found', async () => {
      mockSecurity.getCredentials.mockResolvedValue(null);
      
      await expect(getCurrentUser()).rejects.toThrow('No credentials found');
    });
  });

  // ==========================================================================
  // validateConnection
  // ==========================================================================
  describe('validateConnection', () => {
    it('should return user and server version on success', async () => {
      const mockUser = { Id: 'Users-1', Username: 'admin', DisplayName: 'Admin' };
      const mockHome = { Version: '2023.4.1234' };

      mockAxios.onGet('/api/users/me').reply(200, mockUser);
      mockAxios.onGet('/api').reply(200, mockHome);

      const result = await validateConnection();

      expect(result.user).toEqual(mockUser);
      expect(result.serverVersion).toBe('2023.4.1234');
    });
  });

  // ==========================================================================
  // getCurrentUser
  // ==========================================================================
  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = {
        Id: 'Users-1',
        Username: 'admin',
        DisplayName: 'Admin User',
        EmailAddress: 'admin@example.com',
      };

      mockAxios.onGet('/api/users/me').reply(200, mockUser);

      const result = await getCurrentUser();

      expect(result).toEqual(mockUser);
    });

    it('should throw OctopusApiError on 401', async () => {
      mockAxios.onGet('/api/users/me').reply(401, { ErrorMessage: 'Unauthorized' });

      await expect(getCurrentUser()).rejects.toThrow(OctopusApiError);
    });
  });

  // ==========================================================================
  // getServerStatus
  // ==========================================================================
  describe('getServerStatus', () => {
    it('should return server status', async () => {
      const mockStatus = {
        Version: '2023.4.1234',
        IsMaintenanceMode: false,
        MaximumAvailableVersion: '2023.4.5678',
      };

      mockAxios.onGet('/api/serverstatus').reply(200, mockStatus);

      const result = await getServerStatus();

      expect(result).toEqual(mockStatus);
    });
  });

  // ==========================================================================
  // getLicenseStatus
  // ==========================================================================
  describe('getLicenseStatus', () => {
    it('should return license status', async () => {
      const mockLicense = {
        LicenseType: 'Enterprise',
        HostingEnvironment: 'SelfHosted',
        LicenseExpires: '2025-12-31',
      };

      mockAxios.onGet('/api/licenses/licenses-current-status').reply(200, mockLicense);

      const result = await getLicenseStatus();

      expect(result?.LicenseType).toBe('Enterprise');
    });

    it('should return null if endpoint not available', async () => {
      mockAxios.onGet('/api/licenses/licenses-current-status').reply(404);

      const result = await getLicenseStatus();

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getSpaces
  // ==========================================================================
  describe('getSpaces', () => {
    it('should return list of spaces', async () => {
      const mockSpaces = {
        Items: [
          { Id: 'Spaces-1', Name: 'Default', IsDefault: true },
          { Id: 'Spaces-2', Name: 'Production', IsDefault: false },
        ],
      };

      mockAxios.onGet('/api/spaces').reply(200, mockSpaces);

      const result = await getSpaces();

      expect(result).toHaveLength(2);
      expect(result[0].Name).toBe('Default');
    });

    it('should return empty array when no spaces', async () => {
      mockAxios.onGet('/api/spaces').reply(200, { Items: null });

      const result = await getSpaces();

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getProjects
  // ==========================================================================
  describe('getProjects', () => {
    it('should return paginated projects', async () => {
      const mockProjects = {
        Items: [
          { Id: 'Projects-1', Name: 'Web App', Slug: 'web-app' },
          { Id: 'Projects-2', Name: 'API', Slug: 'api' },
        ],
        TotalResults: 2,
        ItemsPerPage: 30,
      };

      mockAxios.onGet(/\/api\/Spaces-1\/projects/).reply(200, mockProjects);

      const result = await getProjects();

      expect(result.Items).toHaveLength(2);
      expect(result.TotalResults).toBe(2);
    });

    it('should pass search parameters', async () => {
      const mockProjects = { Items: [], TotalResults: 0, ItemsPerPage: 30 };

      mockAxios.onGet(/\/api\/Spaces-1\/projects\?.*partialName=test/).reply(200, mockProjects);

      await getProjects({ searchText: 'test', take: 10 });

      expect(mockAxios.history.get[0].url).toContain('partialName=test');
      expect(mockAxios.history.get[0].url).toContain('take=10');
    });
  });

  // ==========================================================================
  // getProject
  // ==========================================================================
  describe('getProject', () => {
    it('should return a specific project', async () => {
      const mockProject = {
        Id: 'Projects-1',
        Name: 'Web App',
        Slug: 'web-app',
        Description: 'Main web application',
      };

      mockAxios.onGet(/\/api\/Spaces-1\/projects\/Projects-1/).reply(200, mockProject);

      const result = await getProject('Projects-1');

      expect(result.Id).toBe('Projects-1');
      expect(result.Name).toBe('Web App');
    });
  });

  // ==========================================================================
  // getEnvironments
  // ==========================================================================
  describe('getEnvironments', () => {
    it('should return all environments', async () => {
      const mockEnvironments = {
        Items: [
          { Id: 'Environments-1', Name: 'Development' },
          { Id: 'Environments-2', Name: 'Production' },
        ],
      };

      mockAxios.onGet(/\/api\/Spaces-1\/environments\/all/).reply(200, mockEnvironments);

      const result = await getEnvironments();

      expect(result).toHaveLength(2);
    });
  });

  // ==========================================================================
  // getDeployments
  // ==========================================================================
  describe('getDeployments', () => {
    it('should return paginated deployments', async () => {
      const mockDeployments = {
        Items: [
          { Id: 'Deployments-1', ReleaseId: 'Releases-1' },
          { Id: 'Deployments-2', ReleaseId: 'Releases-2' },
        ],
        TotalResults: 2,
      };

      mockAxios.onGet(/\/api\/Spaces-1\/deployments/).reply(200, mockDeployments);

      const result = await getDeployments();

      expect(result.Items).toHaveLength(2);
    });

    it('should pass filter parameters', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/deployments/).reply(200, { Items: [] });

      await getDeployments({ projectId: 'Projects-1', environmentId: 'Environments-1' });

      expect(mockAxios.history.get[0].url).toContain('projects=Projects-1');
      expect(mockAxios.history.get[0].url).toContain('environments=Environments-1');
    });
  });

  // ==========================================================================
  // getDeployment
  // ==========================================================================
  describe('getDeployment', () => {
    it('should return a specific deployment', async () => {
      const mockDeployment = {
        Id: 'Deployments-1',
        ReleaseId: 'Releases-1',
        EnvironmentId: 'Environments-1',
        TaskId: 'ServerTasks-1',
      };

      mockAxios.onGet(/\/api\/Spaces-1\/deployments\/Deployments-1/).reply(200, mockDeployment);

      const result = await getDeployment('Deployments-1');

      expect(result.Id).toBe('Deployments-1');
      expect(result.TaskId).toBe('ServerTasks-1');
    });
  });

  // ==========================================================================
  // createDeployment
  // ==========================================================================
  describe('createDeployment', () => {
    it('should create a new deployment', async () => {
      const mockDeployment = {
        Id: 'Deployments-100',
        ReleaseId: 'Releases-1',
        EnvironmentId: 'Environments-1',
        TaskId: 'ServerTasks-100',
      };

      mockAxios.onPost(/\/api\/Spaces-1\/deployments/).reply(201, mockDeployment);

      const result = await createDeployment('Releases-1', 'Environments-1', {
        comments: 'Deploying from mobile app',
      });

      expect(result.Id).toBe('Deployments-100');
      
      const requestBody = JSON.parse(mockAxios.history.post[0].data);
      expect(requestBody.ReleaseId).toBe('Releases-1');
      expect(requestBody.EnvironmentId).toBe('Environments-1');
      expect(requestBody.Comments).toBe('Deploying from mobile app');
    });
  });

  // ==========================================================================
  // getTasks
  // ==========================================================================
  describe('getTasks', () => {
    it('should return paginated tasks', async () => {
      const mockTasks = {
        Items: [
          { Id: 'ServerTasks-1', State: 'Executing', Name: 'Deploy' },
          { Id: 'ServerTasks-2', State: 'Success', Name: 'Deploy' },
        ],
        TotalResults: 2,
      };

      mockAxios.onGet(/\/api\/tasks/).reply(200, mockTasks);

      const result = await getTasks();

      expect(result.Items).toHaveLength(2);
    });

    it('should filter by states', async () => {
      mockAxios.onGet(/\/api\/tasks/).reply(200, { Items: [] });

      await getTasks({ states: ['Executing', 'Queued'] });

      expect(mockAxios.history.get[0].url).toContain('states=Executing%2CQueued');
    });
  });

  // ==========================================================================
  // getTask
  // ==========================================================================
  describe('getTask', () => {
    it('should return a specific task', async () => {
      const mockTask = {
        Id: 'ServerTasks-1',
        State: 'Executing',
        Name: 'Deploy',
        PercentComplete: 50,
      };

      mockAxios.onGet('/api/tasks/ServerTasks-1').reply(200, mockTask);

      const result = await getTask('ServerTasks-1');

      expect(result.Id).toBe('ServerTasks-1');
      expect(result.State).toBe('Executing');
    });
  });

  // ==========================================================================
  // getTaskDetails
  // ==========================================================================
  describe('getTaskDetails', () => {
    it('should return task with activity logs', async () => {
      const mockDetails = {
        Task: { Id: 'ServerTasks-1', State: 'Success' },
        ActivityLogs: [
          { Id: 'Log-1', Name: 'Step 1', Status: 'Success' },
        ],
      };

      mockAxios.onGet('/api/tasks/ServerTasks-1/details').reply(200, mockDetails);

      const result = await getTaskDetails('ServerTasks-1');

      expect(result.Task.Id).toBe('ServerTasks-1');
      expect(result.ActivityLogs).toHaveLength(1);
    });
  });

  // ==========================================================================
  // cancelTask
  // ==========================================================================
  describe('cancelTask', () => {
    it('should cancel a task', async () => {
      mockAxios.onPost('/api/tasks/ServerTasks-1/cancel').reply(200);

      await expect(cancelTask('ServerTasks-1')).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // getMachines
  // ==========================================================================
  describe('getMachines', () => {
    it('should return paginated machines', async () => {
      const mockMachines = {
        Items: [
          { Id: 'Machines-1', Name: 'Web Server 1', Status: 'Online' },
          { Id: 'Machines-2', Name: 'Web Server 2', Status: 'Offline' },
        ],
        TotalResults: 2,
      };

      mockAxios.onGet(/\/api\/Spaces-1\/machines/).reply(200, mockMachines);

      const result = await getMachines();

      expect(result.Items).toHaveLength(2);
    });

    it('should filter by environment and health status', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/machines/).reply(200, { Items: [] });

      await getMachines({
        environmentIds: ['Environments-1'],
        healthStatuses: ['Healthy', 'Unhealthy'],
      });

      expect(mockAxios.history.get[0].url).toContain('environmentIds=Environments-1');
      expect(mockAxios.history.get[0].url).toContain('healthStatuses=Healthy%2CUnhealthy');
    });
  });

  // ==========================================================================
  // getMachine
  // ==========================================================================
  describe('getMachine', () => {
    it('should return a specific machine', async () => {
      const mockMachine = {
        Id: 'Machines-1',
        Name: 'Web Server 1',
        HealthStatus: 'Healthy',
        Roles: ['web-server'],
      };

      mockAxios.onGet(/\/api\/Spaces-1\/machines\/Machines-1/).reply(200, mockMachine);

      const result = await getMachine('Machines-1');

      expect(result.Id).toBe('Machines-1');
      expect(result.HealthStatus).toBe('Healthy');
    });
  });

  // ==========================================================================
  // Runbooks
  // ==========================================================================
  describe('Runbooks', () => {
    describe('getRunbooks', () => {
      it('should return paginated runbooks', async () => {
        const mockRunbooks = {
          Items: [
            { Id: 'Runbooks-1', Name: 'Backup Database' },
            { Id: 'Runbooks-2', Name: 'Clear Cache' },
          ],
          TotalResults: 2,
        };

        mockAxios.onGet(/\/api\/Spaces-1\/runbooks/).reply(200, mockRunbooks);

        const result = await getRunbooks();

        expect(result.Items).toHaveLength(2);
      });
    });

    describe('getRunbook', () => {
      it('should return a specific runbook', async () => {
        const mockRunbook = {
          Id: 'Runbooks-1',
          Name: 'Backup Database',
          ProjectId: 'Projects-1',
          Description: 'Backup the database',
        };

        mockAxios.onGet(/\/api\/Spaces-1\/runbooks\/Runbooks-1/).reply(200, mockRunbook);

        const result = await getRunbook('Runbooks-1');

        expect(result.Id).toBe('Runbooks-1');
        expect(result.Name).toBe('Backup Database');
      });
    });

    describe('createRunbookRun', () => {
      it('should create a runbook run', async () => {
        const mockRun = {
          Id: 'RunbookRuns-1',
          RunbookId: 'Runbooks-1',
          TaskId: 'ServerTasks-100',
        };

        mockAxios.onPost(/\/api\/Spaces-1\/runbookRuns/).reply(201, mockRun);

        const result = await createRunbookRun(
          'Runbooks-1',
          'RunbookSnapshots-1',
          'Environments-1',
          { comments: 'Running from mobile' }
        );

        expect(result.Id).toBe('RunbookRuns-1');
        
        const requestBody = JSON.parse(mockAxios.history.post[0].data);
        expect(requestBody.RunbookId).toBe('Runbooks-1');
        expect(requestBody.RunbookSnapshotId).toBe('RunbookSnapshots-1');
        expect(requestBody.EnvironmentId).toBe('Environments-1');
      });
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================
  describe('Error handling', () => {
    it('should handle network errors', async () => {
      mockAxios.onGet('/api/users/me').networkError();

      try {
        await getCurrentUser();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OctopusApiError);
        expect((error as OctopusApiError).isNetworkError).toBe(true);
      }
    });

    it('should handle 404 errors', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/projects\/NonExistent/).reply(404);

      try {
        await getProject('NonExistent');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OctopusApiError);
        expect((error as OctopusApiError).statusCode).toBe(404);
      }
    });

    it('should handle 500 errors', async () => {
      mockAxios.onGet('/api/serverstatus').reply(500, {
        ErrorMessage: 'Internal server error',
        Errors: ['Something went wrong'],
      });

      try {
        await getServerStatus();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OctopusApiError);
        expect((error as OctopusApiError).statusCode).toBe(500);
      }
    });
  });
});

