/**
 * Tests for Octopus Deploy API Client - endpoint coverage
 * Covers the exported API functions not exercised by api-client.test.ts
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  OctopusApiError,
  getSpace,
  getDashboard,
  getProjectGroups,
  getEnvironments,
  getEnvironment,
  getLifecycle,
  getLifecycles,
  getReleases,
  getAllReleases,
  getRelease,
  getReleaseProgression,
  getTaskRaw,
  getTaskInterruptions,
  getPendingInterruptions,
  getInterruption,
  takeResponsibility,
  triggerMachineHealthCheck,
  getMachines,
  getChannels,
  getEvents,
  getProjectRunbooks,
  getRunbookRuns,
  getRunbookRun,
  getRunbookSnapshots,
  getRunbookProcess,
  getRunbookProcessById,
  getRunbookEnvironments,
  getDeploymentProcess,
  getProjectVariables,
  getProjectSummary,
  getProjectProgression,
  getArtifacts,
  getArtifactContentUrl,
  getKubernetesLiveStatus,
  getKubernetesResourceDetails,
  getTenants,
  getTenant,
  getTagSets,
  createRelease,
  getReleaseTemplate,
  getPackageVersions,
  getDeploymentPreview,
  getTenantLogoUrl,
  buildTenantLogoUrl,
} from '../../src/lib/api/client';
import * as security from '../../src/lib/security';

// Mock security module
jest.mock('../../src/lib/security');

const mockSecurity = security as jest.Mocked<typeof security>;

describe('Octopus API Client - endpoints', () => {
  let mockAxios: MockAdapter;

  beforeAll(() => {
    mockAxios = new MockAdapter(axios);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.reset();

    mockSecurity.getCredentials.mockResolvedValue({
      serverUrl: 'https://octopus.example.com',
      // Deliberately not a valid Octopus key format so secret scanning ignores it
      apiKey: 'API-FAKE-TEST-KEY',
      spaceId: 'Spaces-1',
    });

    mockSecurity.sanitizePathSegment.mockImplementation((s) => s);
  });

  afterAll(() => {
    mockAxios.restore();
  });

  // ==========================================================================
  // Spaces / Dashboard
  // ==========================================================================
  describe('getSpace', () => {
    it('should return a specific space', async () => {
      mockAxios.onGet('/api/spaces/Spaces-1').reply(200, { Id: 'Spaces-1', Name: 'Default' });

      const result = await getSpace('Spaces-1');

      expect(result.Name).toBe('Default');
    });
  });

  describe('getDashboard', () => {
    it('should return dashboard without filters', async () => {
      mockAxios.onGet('/api/Spaces-1/dashboard').reply(200, { Projects: [], Items: [] });

      const result = await getDashboard();

      expect(result.Projects).toEqual([]);
    });

    it('should pass projectGroupId and releaseId filters', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/dashboard\?/).reply(200, { Projects: [] });

      await getDashboard({ projectGroupId: 'ProjectGroups-1', releaseId: 'Releases-1' });

      expect(mockAxios.history.get[0].url).toContain('projectGroupId=ProjectGroups-1');
      expect(mockAxios.history.get[0].url).toContain('releaseId=Releases-1');
    });
  });

  describe('getProjectGroups', () => {
    it.each([
      ['direct array', [{ Id: 'ProjectGroups-1', Name: 'Default' }], 1],
      ['paginated', { Items: [{ Id: 'ProjectGroups-1' }, { Id: 'ProjectGroups-2' }] }, 2],
      ['empty body', null, 0],
    ])('should handle %s response', async (_label, body, expectedLength) => {
      mockAxios.onGet('/api/Spaces-1/projectgroups').reply(200, body);

      const result = await getProjectGroups();

      expect(result).toHaveLength(expectedLength);
    });
  });

  describe('spacePath without a space', () => {
    it('should use non-space-scoped paths when spaceId is null', async () => {
      mockSecurity.getCredentials.mockResolvedValue({
        serverUrl: 'https://octopus.example.com',
        apiKey: 'API-FAKE-TEST-KEY',
        spaceId: null,
      });
      mockAxios.onGet('/api/environments/all').reply(200, []);

      const result = await getEnvironments();

      expect(result).toEqual([]);
      expect(mockAxios.history.get[0].url).toBe('/api/environments/all');
    });
  });

  // ==========================================================================
  // Environments / Lifecycles
  // ==========================================================================
  describe('getEnvironment', () => {
    it('should return a specific environment', async () => {
      mockAxios.onGet('/api/Spaces-1/environments/Environments-1').reply(200, {
        Id: 'Environments-1',
        Name: 'Production',
      });

      const result = await getEnvironment('Environments-1');

      expect(result.Name).toBe('Production');
    });
  });

  describe('getLifecycle', () => {
    it('should return a specific lifecycle', async () => {
      mockAxios.onGet('/api/Spaces-1/lifecycles/Lifecycles-1').reply(200, {
        Id: 'Lifecycles-1',
        Name: 'Default Lifecycle',
      });

      const result = await getLifecycle('Lifecycles-1');

      expect(result.Id).toBe('Lifecycles-1');
    });
  });

  describe('getLifecycles', () => {
    it('should return lifecycle items', async () => {
      mockAxios.onGet('/api/Spaces-1/lifecycles/all').reply(200, {
        Items: [{ Id: 'Lifecycles-1' }],
      });

      const result = await getLifecycles();

      expect(result).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Releases
  // ==========================================================================
  describe('getReleases', () => {
    it('should return releases for a project with paging params', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/projects\/Projects-1\/releases/).reply(200, {
        Items: [{ Id: 'Releases-1', Version: '1.0.0' }],
        TotalResults: 1,
      });

      const result = await getReleases('Projects-1', { skip: 10, take: 5 });

      expect(result.Items).toHaveLength(1);
      expect(mockAxios.history.get[0].url).toContain('skip=10');
      expect(mockAxios.history.get[0].url).toContain('take=5');
    });
  });

  describe('getAllReleases', () => {
    it('should search releases by version', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/releases\?/).reply(200, {
        Items: [{ Id: 'Releases-1', Version: '1.0.0' }],
      });

      const result = await getAllReleases({ searchByVersion: '1.0', take: 20 });

      expect(result.Items).toHaveLength(1);
      expect(mockAxios.history.get[0].url).toContain('searchByVersion=1.0');
    });
  });

  describe('getRelease', () => {
    it('should return a specific release', async () => {
      mockAxios.onGet('/api/Spaces-1/releases/Releases-1').reply(200, {
        Id: 'Releases-1',
        Version: '1.0.0',
      });

      const result = await getRelease('Releases-1');

      expect(result.Version).toBe('1.0.0');
    });
  });

  describe('getReleaseProgression', () => {
    it('should return release progression', async () => {
      mockAxios.onGet('/api/Spaces-1/releases/Releases-1/progression').reply(200, {
        Phases: [{ Name: 'Dev' }],
      });

      const result = await getReleaseProgression('Releases-1');

      expect(result.Phases).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Tasks / Interruptions
  // ==========================================================================
  describe('getTaskRaw', () => {
    it('should return raw task log text', async () => {
      mockAxios.onGet('/api/tasks/ServerTasks-1/raw').reply(200, 'raw log output');

      const result = await getTaskRaw('ServerTasks-1');

      expect(result).toBe('raw log output');
    });
  });

  describe('getTaskInterruptions', () => {
    it('should query pending interruptions regarding a task', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/interruptions\?/).reply(200, {
        Items: [{ Id: 'Interruptions-1' }],
      });

      const result = await getTaskInterruptions('ServerTasks-1');

      expect(result).toHaveLength(1);
      expect(mockAxios.history.get[0].url).toContain('regarding=ServerTasks-1');
      expect(mockAxios.history.get[0].url).toContain('pendingOnly=true');
    });
  });

  describe('getPendingInterruptions', () => {
    it('should return pending interruptions with regarding filter', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/interruptions\?/).reply(200, {
        Items: [{ Id: 'Interruptions-1' }, { Id: 'Interruptions-2' }],
      });

      const result = await getPendingInterruptions({ regardingDocumentId: 'ServerTasks-1' });

      expect(result).toHaveLength(2);
      expect(mockAxios.history.get[0].url).toContain('regarding=ServerTasks-1');
    });

    it('should return empty array when response has no items', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/interruptions\?/).reply(200, {});

      const result = await getPendingInterruptions();

      expect(result).toEqual([]);
    });
  });

  describe('getInterruption', () => {
    it('should return a specific interruption', async () => {
      mockAxios.onGet('/api/Spaces-1/interruptions/Interruptions-1').reply(200, {
        Id: 'Interruptions-1',
        Title: 'Manual intervention required',
      });

      const result = await getInterruption('Interruptions-1');

      expect(result.Id).toBe('Interruptions-1');
    });
  });

  describe('takeResponsibility', () => {
    it('should PUT to the responsible endpoint', async () => {
      mockAxios.onPut('/api/Spaces-1/interruptions/Interruptions-1/responsible').reply(200);

      await expect(takeResponsibility('Interruptions-1')).resolves.not.toThrow();
      expect(mockAxios.history.put).toHaveLength(1);
    });
  });

  describe('triggerMachineHealthCheck', () => {
    it('should create a Health task for the machine', async () => {
      mockAxios.onPost('/api/tasks').reply(201, { Id: 'ServerTasks-100', Name: 'Health' });

      const result = await triggerMachineHealthCheck('Machines-1');

      expect(result.Id).toBe('ServerTasks-100');
      const body = JSON.parse(mockAxios.history.post[0].data);
      expect(body.Name).toBe('Health');
      expect(body.SpaceId).toBe('Spaces-1');
      expect(body.Arguments.MachineIds).toEqual(['Machines-1']);
    });
  });

  // ==========================================================================
  // Machines - alternate response formats
  // ==========================================================================
  describe('getMachines response formats', () => {
    it('should handle a direct array response', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/machines\/all\/v1/).reply(200, [
        { Id: 'Machines-1', Name: 'web-01' },
      ]);

      const result = await getMachines();

      expect(result.Items).toHaveLength(1);
      expect(result.TotalResults).toBe(1);
    });

    it('should handle a v1 DeploymentTargets response', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/machines\/all\/v1/).reply(200, {
        DeploymentTargets: [{ Id: 'Machines-1' }, { Id: 'Machines-2' }],
      });

      const result = await getMachines();

      expect(result.Items).toHaveLength(2);
    });

    it('should map an object-keyed response with lowercase fields', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/machines\/all\/v1/).reply(200, {
        'Machines-1': {
          id: 'Machines-1',
          name: 'db-01',
          healthStatus: 'Healthy',
          roles: ['db'],
        },
      });

      const result = await getMachines();

      expect(result.Items).toHaveLength(1);
      expect(result.Items[0]).toMatchObject({
        Id: 'Machines-1',
        Name: 'db-01',
        HealthStatus: 'Healthy',
        Roles: ['db'],
        IsDisabled: false,
        Status: 'Unknown',
        SpaceId: 'Spaces-1',
      });
    });

    it('should return empty items for an empty object response', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/machines\/all\/v1/).reply(200, {});

      const result = await getMachines();

      expect(result.Items).toEqual([]);
      expect(result.TotalResults).toBe(0);
    });
  });

  // ==========================================================================
  // Channels / Events
  // ==========================================================================
  describe('getChannels', () => {
    it('should return channels for a project', async () => {
      mockAxios.onGet('/api/Spaces-1/projects/Projects-1/channels').reply(200, {
        Items: [{ Id: 'Channels-1', Name: 'Default' }],
      });

      const result = await getChannels('Projects-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getEvents', () => {
    it('should return paginated events with filters', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/events/).reply(200, {
        Items: [{ Id: 'Events-1' }],
      });

      const result = await getEvents({ skip: 0, take: 30, regarding: 'Deployments-1', user: 'admin' });

      expect(result.Items).toHaveLength(1);
      expect(mockAxios.history.get[0].url).toContain('regarding=Deployments-1');
      expect(mockAxios.history.get[0].url).toContain('user=admin');
    });
  });

  // ==========================================================================
  // Runbooks
  // ==========================================================================
  describe('getProjectRunbooks', () => {
    it('should return runbooks for a project', async () => {
      mockAxios.onGet('/api/Spaces-1/projects/Projects-1/runbooks').reply(200, {
        Items: [{ Id: 'Runbooks-1' }],
      });

      const result = await getProjectRunbooks('Projects-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getRunbookRuns', () => {
    it('should return runbook runs with all filters', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/runbookRuns/).reply(200, { Items: [] });

      await getRunbookRuns({
        skip: 0,
        take: 10,
        runbookId: 'Runbooks-1',
        projectId: 'Projects-1',
        environmentId: 'Environments-1',
        taskState: 'Success',
      });

      const url = mockAxios.history.get[0].url;
      expect(url).toContain('runbooks=Runbooks-1');
      expect(url).toContain('projects=Projects-1');
      expect(url).toContain('environments=Environments-1');
      expect(url).toContain('taskState=Success');
    });
  });

  describe('getRunbookRun', () => {
    it('should return a specific runbook run', async () => {
      mockAxios.onGet('/api/Spaces-1/runbookRuns/RunbookRuns-1').reply(200, {
        Id: 'RunbookRuns-1',
        TaskId: 'ServerTasks-1',
      });

      const result = await getRunbookRun('RunbookRuns-1');

      expect(result.TaskId).toBe('ServerTasks-1');
    });
  });

  describe('getRunbookSnapshots', () => {
    it('should return snapshots with paging', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/runbooks\/Runbooks-1\/runbookSnapshots/).reply(200, {
        Items: [{ Id: 'RunbookSnapshots-1' }],
      });

      const result = await getRunbookSnapshots('Runbooks-1', { skip: 0, take: 10 });

      expect(result.Items).toHaveLength(1);
      expect(mockAxios.history.get[0].url).toContain('take=10');
    });
  });

  describe('getRunbookProcess', () => {
    it('should fetch the runbook then its process', async () => {
      mockAxios.onGet('/api/Spaces-1/runbooks/Runbooks-1').reply(200, {
        Id: 'Runbooks-1',
        RunbookProcessId: 'RunbookProcess-1',
      });
      mockAxios.onGet('/api/Spaces-1/runbookProcesses/RunbookProcess-1').reply(200, {
        Id: 'RunbookProcess-1',
        Steps: [{ Id: 'Steps-1' }],
      });

      const result = await getRunbookProcess('Runbooks-1');

      expect(result.Steps).toHaveLength(1);
    });

    it('should return an empty process when the runbook has no process id', async () => {
      mockAxios.onGet('/api/Spaces-1/runbooks/Runbooks-1').reply(200, {
        Id: 'Runbooks-1',
        RunbookProcessId: null,
      });

      const result = await getRunbookProcess('Runbooks-1');

      expect(result.Steps).toEqual([]);
      expect(result.RunbookId).toBe('Runbooks-1');
      expect(result.SpaceId).toBe('Spaces-1');
    });
  });

  describe('getRunbookProcessById', () => {
    it('should return the process directly', async () => {
      mockAxios.onGet('/api/Spaces-1/runbookProcesses/RunbookProcess-1').reply(200, {
        Id: 'RunbookProcess-1',
        Steps: [],
      });

      const result = await getRunbookProcessById('RunbookProcess-1');

      expect(result.Id).toBe('RunbookProcess-1');
    });
  });

  describe('getRunbookEnvironments', () => {
    it('should return environments a runbook can run in', async () => {
      mockAxios
        .onGet('/api/Spaces-1/projects/Projects-1/runbooks/Runbooks-1/environments')
        .reply(200, [{ Id: 'Environments-1' }]);

      const result = await getRunbookEnvironments('Projects-1', 'Runbooks-1');

      expect(result).toHaveLength(1);
    });

    it('should return empty array when response has no body', async () => {
      mockAxios
        .onGet('/api/Spaces-1/projects/Projects-1/runbooks/Runbooks-1/environments')
        .reply(200);

      const result = await getRunbookEnvironments('Projects-1', 'Runbooks-1');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // Deployment process / Variables / Project summary
  // ==========================================================================
  describe('getDeploymentProcess', () => {
    it('should return the deployment process', async () => {
      mockAxios.onGet('/api/Spaces-1/projects/Projects-1/deploymentprocesses').reply(200, {
        Id: 'deploymentprocess-Projects-1',
        Steps: [{ Id: 'Steps-1' }],
      });

      const result = await getDeploymentProcess('Projects-1');

      expect(result.Steps).toHaveLength(1);
    });
  });

  describe('getProjectVariables', () => {
    it('should return the variable set', async () => {
      mockAxios.onGet('/api/Spaces-1/projects/Projects-1/variables').reply(200, {
        Id: 'variableset-Projects-1',
        Variables: [{ Id: 'var-1', Name: 'DatabaseName' }],
      });

      const result = await getProjectVariables('Projects-1');

      expect(result.Variables).toHaveLength(1);
    });
  });

  describe('getProjectSummary', () => {
    it('should return the project-filtered dashboard', async () => {
      mockAxios.onGet('/api/Spaces-1/dashboard?projects=Projects-1').reply(200, {
        Projects: [{ Id: 'Projects-1' }],
      });

      const result = await getProjectSummary('Projects-1');

      expect(result.Projects).toHaveLength(1);
    });
  });

  describe('getProjectProgression', () => {
    it('should return project progression', async () => {
      mockAxios.onGet('/api/Spaces-1/projects/Projects-1/progression').reply(200, {
        Environments: [{ Id: 'Environments-1' }],
      });

      const result = await getProjectProgression('Projects-1');

      expect(result.Environments).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Artifacts
  // ==========================================================================
  describe('getArtifacts', () => {
    it('should return artifacts regarding a task', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/artifacts\?/).reply(200, {
        Items: [{ Id: 'Artifacts-1', Filename: 'output.log' }],
      });

      const result = await getArtifacts('ServerTasks-1');

      expect(result).toHaveLength(1);
      expect(mockAxios.history.get[0].url).toContain('regarding=ServerTasks-1');
    });
  });

  describe('getArtifactContentUrl', () => {
    it('should build a space-scoped content URL', async () => {
      const url = await getArtifactContentUrl('Artifacts-1');

      expect(url).toBe(
        'https://octopus.example.com/api/Spaces-1/artifacts/Artifacts-1/content?apiKey=API-FAKE-TEST-KEY'
      );
    });

    it('should build a non-space URL when spaceId is null', async () => {
      mockSecurity.getCredentials.mockResolvedValue({
        serverUrl: 'https://octopus.example.com',
        apiKey: 'API-FAKE-TEST-KEY',
        spaceId: null,
      });

      const url = await getArtifactContentUrl('Artifacts-1');

      expect(url).toBe(
        'https://octopus.example.com/api/artifacts/Artifacts-1/content?apiKey=API-FAKE-TEST-KEY'
      );
    });

    it('should throw when no credentials are stored', async () => {
      mockSecurity.getCredentials.mockResolvedValue(null);

      await expect(getArtifactContentUrl('Artifacts-1')).rejects.toThrow(OctopusApiError);
    });
  });

  // ==========================================================================
  // Kubernetes live status
  // ==========================================================================
  describe('getKubernetesLiveStatus', () => {
    const liveStatusUrl = /untenanted\/livestatus/;

    it('should aggregate healthy resources into a Healthy status', async () => {
      mockAxios.onGet(liveStatusUrl).reply(200, {
        MachineStatuses: [
          {
            MachineId: 'Machines-1',
            Status: 'Healthy',
            Resources: [
              { Name: 'web', Kind: 'Deployment', HealthStatus: 'Healthy', ResourceId: 'r-1' },
              { Name: 'svc', Kind: 'Service', HealthStatus: 'InSync' },
            ],
          },
        ],
      });

      const result = await getKubernetesLiveStatus('Projects-1', 'Environments-1');

      expect(result?.ApplicationStatus).toBe('Healthy');
      expect(result?.Resources).toHaveLength(2);
      expect(result?.IsAvailable).toBe(true);
      // Resource without ResourceId falls back to Name
      expect(result?.Resources[1].Id).toBe('svc');
    });

    it.each([
      ['degraded resource', 'Healthy', 'Degraded', 'Degraded'],
      ['progressing resource', 'progressing', 'Progressing', 'Progressing'],
    ])('should report %s', async (_label, machineStatus, resourceStatus, expected) => {
      mockAxios.onGet(liveStatusUrl).reply(200, {
        MachineStatuses: [
          {
            MachineId: 'Machines-1',
            Status: machineStatus,
            Resources: [{ Name: 'web', Kind: 'Deployment', HealthStatus: resourceStatus }],
          },
        ],
      });

      const result = await getKubernetesLiveStatus('Projects-1', 'Environments-1');

      expect(result?.ApplicationStatus).toBe(expected);
    });

    it.each([
      ['healthy', 'Healthy'],
      ['degraded', 'Degraded'],
      ['outofsync', 'OutOfSync'],
      ['progressing', 'Progressing'],
    ])('should derive status from machine status %s when there are no resources', async (machineStatus, expected) => {
      mockAxios.onGet(liveStatusUrl).reply(200, {
        MachineStatuses: [{ MachineId: 'Machines-1', Status: machineStatus, Resources: [] }],
      });

      const result = await getKubernetesLiveStatus('Projects-1', 'Environments-1');

      expect(result?.ApplicationStatus).toBe(expected);
    });

    it('should report unavailable when no machine statuses exist', async () => {
      mockAxios.onGet(liveStatusUrl).reply(200, { MachineStatuses: [] });

      const result = await getKubernetesLiveStatus('Projects-1', 'Environments-1');

      expect(result?.ApplicationStatus).toBe('Unknown');
      expect(result?.IsAvailable).toBe(false);
    });

    it('should pass tenantId as a query parameter', async () => {
      mockAxios.onGet(liveStatusUrl).reply(200, { MachineStatuses: [] });

      await getKubernetesLiveStatus('Projects-1', 'Environments-1', 'Tenants-1');

      expect(mockAxios.history.get[0].url).toContain('tenantId=Tenants-1');
    });

    it('should return null when observability is not available (404)', async () => {
      mockAxios.onGet(liveStatusUrl).reply(404);

      const result = await getKubernetesLiveStatus('Projects-1', 'Environments-1');

      expect(result).toBeNull();
    });

    it('should rethrow non-404 errors', async () => {
      mockAxios.onGet(liveStatusUrl).reply(403);

      await expect(getKubernetesLiveStatus('Projects-1', 'Environments-1')).rejects.toThrow(
        OctopusApiError
      );
    });
  });

  describe('getKubernetesResourceDetails', () => {
    it('should fetch untenanted resource details', async () => {
      mockAxios
        .onGet(/untenanted\/machines\/Machines-1\/resources\/Resources-1/)
        .reply(200, { Name: 'web', Kind: 'Deployment' });

      const result = await getKubernetesResourceDetails(
        'Projects-1',
        'Environments-1',
        'Machines-1',
        'Resources-1'
      );

      expect(result?.Kind).toBe('Deployment');
    });

    it('should fetch tenanted resource details', async () => {
      mockAxios
        .onGet(/tenants\/Tenants-1\/machines\/Machines-1\/resources\/Resources-1/)
        .reply(200, { Name: 'web', Kind: 'Pod' });

      const result = await getKubernetesResourceDetails(
        'Projects-1',
        'Environments-1',
        'Machines-1',
        'Resources-1',
        'Tenants-1'
      );

      expect(result?.Kind).toBe('Pod');
    });

    it('should return null on 404', async () => {
      mockAxios.onGet(/untenanted\/machines/).reply(404);

      const result = await getKubernetesResourceDetails(
        'Projects-1',
        'Environments-1',
        'Machines-1',
        'Resources-1'
      );

      expect(result).toBeNull();
    });

    it('should rethrow non-404 errors', async () => {
      mockAxios.onGet(/untenanted\/machines/).reply(403);

      await expect(
        getKubernetesResourceDetails('Projects-1', 'Environments-1', 'Machines-1', 'Resources-1')
      ).rejects.toThrow(OctopusApiError);
    });
  });

  // ==========================================================================
  // Tenants
  // ==========================================================================
  describe('getTenants', () => {
    it('should return paginated tenants with filters', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/tenants/).reply(200, {
        Items: [{ Id: 'Tenants-1', Name: 'Acme' }],
      });

      const result = await getTenants({
        skip: 0,
        take: 10,
        searchText: 'acme',
        projectId: 'Projects-1',
        tags: ['Region/EU', 'Tier/Gold'],
      });

      expect(result.Items).toHaveLength(1);
      const url = mockAxios.history.get[0].url;
      expect(url).toContain('name=acme');
      expect(url).toContain('projectId=Projects-1');
      expect(url).toContain('tags=Region%2FEU%2CTier%2FGold');
    });
  });

  describe('getTenant', () => {
    it('should return a specific tenant', async () => {
      mockAxios.onGet('/api/Spaces-1/tenants/Tenants-1').reply(200, {
        Id: 'Tenants-1',
        Name: 'Acme',
      });

      const result = await getTenant('Tenants-1');

      expect(result.Name).toBe('Acme');
    });
  });

  describe('getTagSets', () => {
    it('should return tag sets', async () => {
      mockAxios.onGet('/api/Spaces-1/tagsets/all').reply(200, {
        Items: [{ Id: 'TagSets-1', Name: 'Region' }],
      });

      const result = await getTagSets();

      expect(result).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Release creation / templates / packages / previews
  // ==========================================================================
  describe('createRelease', () => {
    it('should POST a new release with options', async () => {
      mockAxios.onPost('/api/Spaces-1/releases').reply(201, {
        Id: 'Releases-100',
        Version: '2.0.0',
      });

      const result = await createRelease('Projects-1', {
        version: '2.0.0',
        channelId: 'Channels-1',
        releaseNotes: 'Notes',
        selectedPackages: [{ ActionName: 'Deploy', Version: '2.0.0' }],
      });

      expect(result.Id).toBe('Releases-100');
      const body = JSON.parse(mockAxios.history.post[0].data);
      expect(body.ProjectId).toBe('Projects-1');
      expect(body.Version).toBe('2.0.0');
      expect(body.ChannelId).toBe('Channels-1');
      expect(body.SelectedPackages).toHaveLength(1);
    });
  });

  describe('getReleaseTemplate', () => {
    it('should fetch the template without a channel', async () => {
      mockAxios.onGet('/api/Spaces-1/projects/Projects-1/releases/template').reply(200, {
        NextVersionIncrement: '1.0.1',
      });

      const result = await getReleaseTemplate('Projects-1');

      expect(result.NextVersionIncrement).toBe('1.0.1');
    });

    it('should fetch the template for a specific channel', async () => {
      mockAxios
        .onGet('/api/Spaces-1/projects/Projects-1/releases/template?channel=Channels-1')
        .reply(200, { NextVersionIncrement: '1.0.2' });

      const result = await getReleaseTemplate('Projects-1', 'Channels-1');

      expect(result.NextVersionIncrement).toBe('1.0.2');
    });
  });

  describe('getPackageVersions', () => {
    it('should return package versions with filters', async () => {
      mockAxios.onGet(/\/api\/Spaces-1\/feeds\/feeds-builtin\/packages\/versions/).reply(200, {
        Items: [{ Version: '1.0.0' }],
      });

      const result = await getPackageVersions('feeds-builtin', 'My.Package', {
        take: 5,
        filter: '1.0',
      });

      expect(result).toHaveLength(1);
      const url = mockAxios.history.get[0].url;
      expect(url).toContain('packageId=My.Package');
      expect(url).toContain('take=5');
      expect(url).toContain('filter=1.0');
    });
  });

  describe('getDeploymentPreview', () => {
    it('should fetch an untenanted preview', async () => {
      mockAxios
        .onGet('/api/Spaces-1/releases/Releases-1/deployments/preview/Environments-1')
        .reply(200, { StepsToExecute: [] });

      const result = await getDeploymentPreview('Releases-1', 'Environments-1');

      expect(result.StepsToExecute).toEqual([]);
    });

    it('should include tenantId when provided', async () => {
      mockAxios
        .onGet('/api/Spaces-1/releases/Releases-1/deployments/preview/Environments-1?tenantId=Tenants-1')
        .reply(200, { StepsToExecute: [] });

      await getDeploymentPreview('Releases-1', 'Environments-1', 'Tenants-1');

      expect(mockAxios.history.get[0].url).toContain('tenantId=Tenants-1');
    });
  });

  // ==========================================================================
  // Tenant logo URLs
  // ==========================================================================
  describe('getTenantLogoUrl', () => {
    it('should build a space-scoped logo URL', async () => {
      const url = await getTenantLogoUrl('Tenants-1');

      expect(url).toBe(
        'https://octopus.example.com/api/Spaces-1/tenants/Tenants-1/logo?apiKey=API-FAKE-TEST-KEY'
      );
    });

    it('should build a non-space logo URL when spaceId is null', async () => {
      mockSecurity.getCredentials.mockResolvedValue({
        serverUrl: 'https://octopus.example.com',
        apiKey: 'API-FAKE-TEST-KEY',
        spaceId: null,
      });

      const url = await getTenantLogoUrl('Tenants-1');

      expect(url).toBe(
        'https://octopus.example.com/api/tenants/Tenants-1/logo?apiKey=API-FAKE-TEST-KEY'
      );
    });

    it('should return null when no credentials are stored', async () => {
      mockSecurity.getCredentials.mockResolvedValue(null);

      const url = await getTenantLogoUrl('Tenants-1');

      expect(url).toBeNull();
    });
  });

  describe('buildTenantLogoUrl', () => {
    it('should build URLs with and without a space', () => {
      expect(
        buildTenantLogoUrl('https://octopus.example.com', 'Spaces-1', 'Tenants-1', 'API-FAKE-TEST-KEY')
      ).toBe('https://octopus.example.com/api/Spaces-1/tenants/Tenants-1/logo?apiKey=API-FAKE-TEST-KEY');

      expect(
        buildTenantLogoUrl('https://octopus.example.com', null, 'Tenants-1', 'API-FAKE-TEST-KEY')
      ).toBe('https://octopus.example.com/api/tenants/Tenants-1/logo?apiKey=API-FAKE-TEST-KEY');
    });
  });
});
