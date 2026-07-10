/**
 * Tests for Octopus Deploy API Client - error transformation, retries,
 * interruption submission, global search and cross-instance polling
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  OctopusApiError,
  getCurrentUser,
  getServerStatus,
  getLicenseStatus,
  getProject,
  submitInterruption,
  globalSearch,
  getSpacesForInstance,
  getInterruptionsForInstanceSpace,
  getAllPendingInterruptions,
  submitInterruptionForInstance,
  takeResponsibilityForInstance,
  InstanceCredentials,
} from '../../src/lib/api/client';
import * as security from '../../src/lib/security';

// Mock security module
jest.mock('../../src/lib/security');

const mockSecurity = security as jest.Mocked<typeof security>;

const instanceCreds = (suffix: string): InstanceCredentials => ({
  instanceId: `instance-${suffix}`,
  instanceName: `Instance ${suffix.toUpperCase()}`,
  serverUrl: `https://${suffix}.example.com`,
  apiKey: `API-FAKE-${suffix.toUpperCase()}`,
});

describe('Octopus API Client - errors and cross-instance', () => {
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
  // Error transformation
  // ==========================================================================
  describe('Error transformation', () => {
    it('should map 401 to an authentication failure message', async () => {
      mockAxios.onGet('/api/users/me').reply(401);

      await expect(getCurrentUser()).rejects.toThrow(
        'Authentication failed. Please check your API key.'
      );
    });

    it.each([
      [
        'space access error',
        { ErrorMessage: 'User does not have access to space Spaces-1' },
        'You do not have access to this space. Try switching to a different space or check your permissions with your Octopus administrator.',
      ],
      [
        'permission to view error',
        { ErrorMessage: 'You do not have permission to view this resource' },
        'You do not have permission to view this resource',
      ],
      [
        'other error message',
        { ErrorMessage: 'Forbidden for another reason' },
        'Forbidden for another reason',
      ],
      [
        'no error payload',
        undefined,
        'You do not have permission to perform this action.',
      ],
    ])('should map 403 with %s', async (_label, payload, expectedMessage) => {
      mockAxios.onGet(/\/api\/Spaces-1\/projects\/Projects-1/).reply(403, payload);

      await expect(getProject('Projects-1')).rejects.toThrow(expectedMessage);
    });

    it('should map 429 to rate limited without retrying', async () => {
      mockAxios.onGet('/api/users/me').replyOnce(429).onGet('/api/users/me').reply(200, {});

      try {
        await getCurrentUser();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OctopusApiError);
        expect((error as OctopusApiError).isRateLimited).toBe(true);
        expect((error as OctopusApiError).message).toBe('Too many requests. Please try again later.');
      }
      expect(mockAxios.history.get).toHaveLength(1);
    });

    it('should map 503 to a server error with error details', async () => {
      mockAxios.onGet('/api/serverstatus').reply(503, { Errors: ['Down for maintenance'] });

      try {
        await getServerStatus();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OctopusApiError);
        expect((error as OctopusApiError).message).toBe('Server error. Please try again later.');
        expect((error as OctopusApiError).errors).toEqual(['Down for maintenance']);
      }
    }, 15000);

    it('should use the API error message for unexpected status codes', async () => {
      mockAxios.onGet('/api/users/me').reply(418, { ErrorMessage: 'I am a teapot' });

      await expect(getCurrentUser()).rejects.toThrow('I am a teapot');
    });

    it('should fall back to a generic message for unexpected status codes', async () => {
      mockAxios.onGet('/api/users/me').reply(418);

      await expect(getCurrentUser()).rejects.toThrow('An unexpected error occurred.');
    });
  });

  describe('getLicenseStatus error handling', () => {
    it('should rethrow non-404 errors', async () => {
      mockAxios.onGet('/api/licenses/licenses-current-status').reply(401);

      await expect(getLicenseStatus()).rejects.toThrow(OctopusApiError);
    });
  });

  // ==========================================================================
  // Retry behaviour
  // ==========================================================================
  describe('Retry behaviour', () => {
    it('should retry transient server errors and succeed', async () => {
      mockAxios
        .onGet('/api/serverstatus')
        .replyOnce(500)
        .onGet('/api/serverstatus')
        .reply(200, { Version: '2023.4.1234' });

      const result = await getServerStatus();

      expect(result.Version).toBe('2023.4.1234');
      expect(mockAxios.history.get).toHaveLength(2);
    }, 15000);

    it('should not retry auth errors', async () => {
      mockAxios
        .onGet('/api/users/me')
        .replyOnce(401)
        .onGet('/api/users/me')
        .reply(200, {});

      await expect(getCurrentUser()).rejects.toThrow(OctopusApiError);
      expect(mockAxios.history.get).toHaveLength(1);
    });
  });

  // ==========================================================================
  // submitInterruption
  // ==========================================================================
  describe('submitInterruption', () => {
    const interruptionUrl = '/api/Spaces-1/interruptions/Interruptions-1';

    it('should submit using the Guidance field when the form has one', async () => {
      mockAxios.onGet(interruptionUrl).reply(200, {
        Id: 'Interruptions-1',
        Form: { Values: { Guidance: null } },
      });
      mockAxios.onPost(`${interruptionUrl}/submit`).reply(200);

      await submitInterruption('Interruptions-1', 'Retry');

      const body = JSON.parse(mockAxios.history.post[0].data);
      expect(body.Guidance).toBe('Retry');
      expect(body.Notes).toBeUndefined();
    });

    it('should submit using the Result field with notes otherwise', async () => {
      mockAxios.onGet(interruptionUrl).reply(200, {
        Id: 'Interruptions-1',
        Form: { Values: { Instructions: null } },
      });
      mockAxios.onPost(`${interruptionUrl}/submit`).reply(200);

      await submitInterruption('Interruptions-1', 'Abort', 'Stopping the deployment');

      const body = JSON.parse(mockAxios.history.post[0].data);
      expect(body.Result).toBe('Abort');
      expect(body.Notes).toBe('Stopping the deployment');
    });

    it('should throw when the interruption has no form', async () => {
      mockAxios.onGet(interruptionUrl).reply(200, { Id: 'Interruptions-1', Form: null });

      await expect(submitInterruption('Interruptions-1', 'Proceed')).rejects.toThrow(
        'Interruption has no form to submit'
      );
    }, 15000);
  });

  // ==========================================================================
  // globalSearch
  // ==========================================================================
  describe('globalSearch', () => {
    it('should aggregate and filter results across resource types', async () => {
      // Variables (register before the generic projects matcher)
      mockAxios.onGet(/\/projects\/Projects-1\/variables/).reply(200, {
        Variables: [
          { Id: 'var-1', Name: 'AppSetting', IsSensitive: false, Type: 'String' },
          { Id: 'var-2', Name: 'AppPassword', IsSensitive: true, Type: 'Sensitive' },
          { Id: 'var-3', Name: 'Unrelated', IsSensitive: false, Type: 'String' },
        ],
      });
      mockAxios.onGet(/\/api\/Spaces-1\/projects\?/).reply(200, {
        Items: [{ Id: 'Projects-1', Name: 'Web App' }],
      });
      mockAxios.onGet(/\/api\/Spaces-1\/releases\?/).reply(200, {
        Items: [
          { Id: 'Releases-1', Version: '1.0.0-app' },
          { Id: 'Releases-2', Version: '2.0.0' },
        ],
      });
      mockAxios.onGet(/\/api\/Spaces-1\/deployments\?/).reply(200, {
        Items: [
          { Id: 'Deployments-1', Name: 'Deploy app to prod' },
          { Id: 'Deployments-2', Name: 'Other deploy' },
        ],
      });
      mockAxios.onGet(/\/api\/Spaces-1\/runbooks\?/).reply(200, {
        Items: [
          { Id: 'Runbooks-1', Name: 'Restart App' },
          { Id: 'Runbooks-2', Name: 'Backup DB' },
        ],
      });
      mockAxios.onGet(/\/api\/Spaces-1\/machines\/all\/v1/).reply(200, [
        { Id: 'Machines-1', Name: 'app-server-01' },
        { Id: 'Machines-2', Name: 'db-server-01' },
      ]);
      mockAxios.onGet(/\/api\/Spaces-1\/environments\/all/).reply(200, [
        { Id: 'Environments-1', Name: 'App Testing' },
        { Id: 'Environments-2', Name: 'Production' },
      ]);
      mockAxios.onGet(/\/api\/Spaces-1\/tenants\?/).reply(200, {
        Items: [{ Id: 'Tenants-1', Name: 'Acme' }],
      });

      const result = await globalSearch('app', { take: 10, includeVariables: true });

      expect(result.projects).toHaveLength(1);
      expect(result.releases.map((r) => r.Id)).toEqual(['Releases-1']);
      expect(result.deployments.map((d) => d.Id)).toEqual(['Deployments-1']);
      expect(result.runbooks.map((r) => r.Id)).toEqual(['Runbooks-1']);
      expect(result.machines.map((m) => m.Id)).toEqual(['Machines-1']);
      expect(result.environments.map((e) => e.Id)).toEqual(['Environments-1']);
      expect(result.tenants).toHaveLength(1);
      expect(result.variables.map((v) => v.name)).toEqual(['AppSetting', 'AppPassword']);
      expect(result.variables[0].subtitle).toBe('Web App • String');
      expect(result.variables[1].subtitle).toBe('Web App • Sensitive');
    });

    it('should return empty results when every search fails', async () => {
      mockAxios.onAny().reply(404);

      const result = await globalSearch('app', { includeVariables: true });

      expect(result).toEqual({
        projects: [],
        releases: [],
        deployments: [],
        runbooks: [],
        machines: [],
        environments: [],
        tenants: [],
        variables: [],
      });
    });
  });

  // ==========================================================================
  // Cross-instance polling
  // ==========================================================================
  describe('getSpacesForInstance', () => {
    it('should return mapped spaces', async () => {
      mockAxios.onGet(/\/api\/spaces/).reply(200, {
        Items: [
          { Id: 'Spaces-1', Name: 'Default' },
          { Id: 'Spaces-2', Name: 'Ops' },
        ],
      });

      const result = await getSpacesForInstance(instanceCreds('a'));

      expect(result).toEqual([
        { id: 'Spaces-1', name: 'Default' },
        { id: 'Spaces-2', name: 'Ops' },
      ]);
      expect(mockAxios.history.get[0].baseURL).toBe('https://a.example.com');
      expect(mockAxios.history.get[0].headers?.['X-Octopus-ApiKey']).toBe('API-FAKE-A');
    });

    it('should rethrow auth errors', async () => {
      mockAxios.onGet(/\/api\/spaces/).reply(401);

      await expect(getSpacesForInstance(instanceCreds('a'))).rejects.toThrow(OctopusApiError);
    });

    it('should return empty array for non-auth failures', async () => {
      mockAxios.onGet(/\/api\/spaces/).reply(500);

      const result = await getSpacesForInstance(instanceCreds('a'));

      expect(result).toEqual([]);
    });
  });

  describe('getInterruptionsForInstanceSpace', () => {
    it('should return pending interruptions for the space', async () => {
      mockAxios.onGet('/api/Spaces-1/interruptions?pendingOnly=true').reply(200, {
        Items: [{ Id: 'Interruptions-1' }],
      });

      const result = await getInterruptionsForInstanceSpace(instanceCreds('a'), 'Spaces-1');

      expect(result).toHaveLength(1);
    });

    it('should silently return empty array on failure', async () => {
      mockAxios.onGet('/api/Spaces-1/interruptions?pendingOnly=true').reply(403);

      const result = await getInterruptionsForInstanceSpace(instanceCreds('a'), 'Spaces-1');

      expect(result).toEqual([]);
    });
  });

  describe('getAllPendingInterruptions', () => {
    it('should aggregate interruptions and report auth failures per instance', async () => {
      // Instance A has two spaces, instance B fails auth, instance C has no spaces
      mockAxios.onGet(/\/api\/spaces/).reply((config) => {
        if (config.baseURL === 'https://a.example.com') {
          return [
            200,
            {
              Items: [
                { Id: 'Spaces-1', Name: 'Default' },
                { Id: 'Spaces-2', Name: 'Ops' },
              ],
            },
          ];
        }
        if (config.baseURL === 'https://b.example.com') {
          return [401, {}];
        }
        return [200, { Items: [] }];
      });
      mockAxios.onGet(/\/api\/Spaces-1\/interruptions/).reply(200, {
        Items: [{ Id: 'Interruptions-1', Created: '2026-01-01T00:00:00Z' }],
      });
      mockAxios.onGet(/\/api\/Spaces-2\/interruptions/).reply(200, {
        Items: [{ Id: 'Interruptions-2', Created: '2026-02-01T00:00:00Z' }],
      });

      const result = await getAllPendingInterruptions([
        instanceCreds('a'),
        instanceCreds('b'),
        instanceCreds('c'),
      ]);

      expect(result.interruptions).toHaveLength(2);
      // Sorted newest first
      expect(result.interruptions[0].interruption.Id).toBe('Interruptions-2');
      expect(result.interruptions[0]).toMatchObject({
        instanceId: 'instance-a',
        instanceName: 'Instance A',
        spaceId: 'Spaces-2',
        spaceName: 'Ops',
      });
      expect(result.authFailures).toEqual([
        {
          instanceId: 'instance-b',
          instanceName: 'Instance B',
          serverUrl: 'https://b.example.com',
          message: 'Authentication failed. Please check your API key.',
          statusCode: 401,
        },
      ]);
    });
  });

  describe('submitInterruptionForInstance', () => {
    const interruptionUrl = '/api/Spaces-9/interruptions/Interruptions-1';

    it('should submit Guidance actions with notes', async () => {
      mockAxios.onGet(interruptionUrl).reply(200, {
        Id: 'Interruptions-1',
        Form: { Values: { Guidance: null } },
      });
      mockAxios.onPost(`${interruptionUrl}/submit`).reply(200);

      await submitInterruptionForInstance(
        instanceCreds('a'),
        'Spaces-9',
        'Interruptions-1',
        'Proceed',
        'Approved from mobile'
      );

      const body = JSON.parse(mockAxios.history.post[0].data);
      expect(body.Guidance).toBe('Proceed');
      expect(body.Notes).toBe('Approved from mobile');
    });

    it('should submit Result actions when there is no Guidance field', async () => {
      mockAxios.onGet(interruptionUrl).reply(200, {
        Id: 'Interruptions-1',
        Form: { Values: { Result: null } },
      });
      mockAxios.onPost(`${interruptionUrl}/submit`).reply(200);

      await submitInterruptionForInstance(instanceCreds('a'), 'Spaces-9', 'Interruptions-1', 'Fail');

      const body = JSON.parse(mockAxios.history.post[0].data);
      expect(body.Result).toBe('Fail');
      expect(body.Notes).toBeUndefined();
    });

    it('should throw when the interruption has no form', async () => {
      mockAxios.onGet(interruptionUrl).reply(200, { Id: 'Interruptions-1' });

      await expect(
        submitInterruptionForInstance(instanceCreds('a'), 'Spaces-9', 'Interruptions-1', 'Proceed')
      ).rejects.toThrow('Interruption has no form to submit');
    });
  });

  describe('takeResponsibilityForInstance', () => {
    it('should PUT to the responsible endpoint on the instance', async () => {
      mockAxios.onPut('/api/Spaces-9/interruptions/Interruptions-1/responsible').reply(200);

      await takeResponsibilityForInstance(instanceCreds('a'), 'Spaces-9', 'Interruptions-1');

      expect(mockAxios.history.put).toHaveLength(1);
      expect(mockAxios.history.put[0].baseURL).toBe('https://a.example.com');
    });
  });
});
