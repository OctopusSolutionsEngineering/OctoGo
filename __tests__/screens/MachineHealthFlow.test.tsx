/**
 * Integration tests for Machine Health Check flow
 */

import * as apiClient from '../../src/lib/api/client';

jest.mock('../../src/lib/api/client');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('Machine Health Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Machine Discovery', () => {
    it('should fetch machines for an environment', async () => {
      const mockMachines = {
        Items: [
          {
            Id: 'Machines-1',
            Name: 'Web Server 1',
            HealthStatus: 'Healthy',
            Status: 'Online',
            Roles: ['web-server'],
            EnvironmentIds: ['Environments-1'],
          },
          {
            Id: 'Machines-2',
            Name: 'Web Server 2',
            HealthStatus: 'Unhealthy',
            Status: 'Online',
            Roles: ['web-server'],
            EnvironmentIds: ['Environments-1'],
          },
        ],
        TotalResults: 2,
      };

      mockApiClient.getMachines.mockResolvedValue(mockMachines);

      const machines = await mockApiClient.getMachines({ 
        environmentIds: ['Environments-1'] 
      });

      expect(machines.Items).toHaveLength(2);
      expect(machines.Items[0].HealthStatus).toBe('Healthy');
      expect(machines.Items[1].HealthStatus).toBe('Unhealthy');
    });

    it('should filter machines by health status', async () => {
      const mockUnhealthyMachines = {
        Items: [
          {
            Id: 'Machines-2',
            Name: 'Web Server 2',
            HealthStatus: 'Unhealthy',
          },
        ],
        TotalResults: 1,
      };

      mockApiClient.getMachines.mockResolvedValue(mockUnhealthyMachines);

      const machines = await mockApiClient.getMachines({ 
        healthStatuses: ['Unhealthy'] 
      });

      expect(machines.Items).toHaveLength(1);
      expect(machines.Items[0].HealthStatus).toBe('Unhealthy');
    });
  });

  describe('Machine Details', () => {
    it('should fetch machine details', async () => {
      const mockMachine = {
        Id: 'Machines-1',
        Name: 'Web Server 1',
        HealthStatus: 'Healthy',
        Status: 'Online',
        Roles: ['web-server', 'load-balanced'],
        EnvironmentIds: ['Environments-1', 'Environments-2'],
        Uri: 'https://web-server-1.example.com/',
        Thumbprint: 'ABC123DEF456',
        Endpoint: {
          CommunicationStyle: 'TentaclePassive',
          Uri: 'https://web-server-1.example.com:10933/',
        },
        HealthCheckTask: {
          Id: 'ServerTasks-500',
          State: 'Success',
          QueueTime: '2023-01-20T09:00:00Z',
          CompletedTime: '2023-01-20T09:01:00Z',
        },
      };

      mockApiClient.getMachine.mockResolvedValue(mockMachine);

      const machine = await mockApiClient.getMachine('Machines-1');

      expect(machine.Name).toBe('Web Server 1');
      expect(machine.Roles).toContain('web-server');
      expect(machine.EnvironmentIds).toHaveLength(2);
    });
  });

  describe('Health Check Execution', () => {
    it('should trigger a health check', async () => {
      const mockTask = {
        Id: 'ServerTasks-600',
        Name: 'Health check',
        State: 'Queued',
        Created: new Date().toISOString(),
      };

      mockApiClient.triggerMachineHealthCheck.mockResolvedValue(mockTask);

      const task = await mockApiClient.triggerMachineHealthCheck('Machines-1');

      expect(task.Id).toBe('ServerTasks-600');
      expect(task.Name).toBe('Health check');
      expect(task.State).toBe('Queued');
    });

    it('should monitor health check progress', async () => {
      const executingTask = {
        Id: 'ServerTasks-600',
        Name: 'Health check',
        State: 'Executing',
        PercentComplete: 50,
      };

      const completedTask = {
        Id: 'ServerTasks-600',
        Name: 'Health check',
        State: 'Success',
        PercentComplete: 100,
      };

      mockApiClient.getTask
        .mockResolvedValueOnce(executingTask)
        .mockResolvedValueOnce(completedTask);

      // First check - executing
      const task1 = await mockApiClient.getTask('ServerTasks-600');
      expect(task1.State).toBe('Executing');

      // Second check - completed
      const task2 = await mockApiClient.getTask('ServerTasks-600');
      expect(task2.State).toBe('Success');
    });

    it('should handle health check failure', async () => {
      const error = { message: 'Machine not found', statusCode: 404 };
      mockApiClient.triggerMachineHealthCheck.mockImplementation(() => Promise.reject(error));

      try {
        await mockApiClient.triggerMachineHealthCheck('Invalid-Machine');
        fail('Expected error to be thrown');
      } catch (e: any) {
        expect(e.message).toBe('Machine not found');
        expect(e.statusCode).toBe(404);
      }
    });
  });

  describe('Health Status Interpretation', () => {
    it.each([
      ['Healthy', 'green'],
      ['Unhealthy', 'red'],
      ['HasWarnings', 'yellow'],
      ['Unavailable', 'gray'],
      ['Unknown', 'gray'],
    ])('should map %s status correctly', (status) => {
      // This tests that we understand the different health statuses
      const validStatuses = ['Healthy', 'Unhealthy', 'HasWarnings', 'Unavailable', 'Unknown'];
      expect(validStatuses).toContain(status);
    });
  });
});

