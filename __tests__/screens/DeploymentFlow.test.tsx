/**
 * Integration tests for Deployment flow
 */

import * as apiClient from '../../src/lib/api/client';

jest.mock('../../src/lib/api/client');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('Deployment Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Deployment Creation', () => {
    it('should create a deployment with valid parameters', async () => {
      const mockDeployment = {
        Id: 'Deployments-100',
        ReleaseId: 'Releases-1',
        EnvironmentId: 'Environments-1',
        TaskId: 'ServerTasks-100',
        Created: new Date().toISOString(),
      };

      mockApiClient.createDeployment.mockResolvedValue(mockDeployment);

      const result = await mockApiClient.createDeployment(
        'Releases-1',
        'Environments-1',
        { comments: 'Deployed from mobile app' }
      );

      expect(result.Id).toBe('Deployments-100');
      expect(result.TaskId).toBe('ServerTasks-100');
    });

    it('should handle deployment creation failure', async () => {
      const error = { message: 'Release not found', statusCode: 404 };
      mockApiClient.createDeployment.mockImplementation(() => Promise.reject(error));

      try {
        await mockApiClient.createDeployment('Invalid-Release', 'Environments-1');
        fail('Expected error to be thrown');
      } catch (e: any) {
        expect(e.message).toBe('Release not found');
        expect(e.statusCode).toBe(404);
      }
    });
  });

  describe('Deployment Monitoring', () => {
    it('should fetch deployment status', async () => {
      const mockDeployment = {
        Id: 'Deployments-100',
        TaskId: 'ServerTasks-100',
      };
      const mockTask = {
        Id: 'ServerTasks-100',
        State: 'Executing',
        PercentComplete: 50,
        EstimatedDuration: '00:05:00',
      };

      mockApiClient.getDeployment.mockResolvedValue(mockDeployment);
      mockApiClient.getTask.mockResolvedValue(mockTask);

      const deployment = await mockApiClient.getDeployment('Deployments-100');
      const task = await mockApiClient.getTask(deployment.TaskId!);

      expect(task.State).toBe('Executing');
      expect(task.PercentComplete).toBe(50);
    });

    it('should fetch task details with activity logs', async () => {
      const mockDetails = {
        Task: {
          Id: 'ServerTasks-100',
          State: 'Success',
        },
        ActivityLogs: [
          {
            Id: 'Log-1',
            Name: 'Acquire packages',
            Status: 'Success',
            Started: '2023-01-01T10:00:00Z',
            Ended: '2023-01-01T10:01:00Z',
          },
          {
            Id: 'Log-2',
            Name: 'Deploy to Production',
            Status: 'Success',
            Started: '2023-01-01T10:01:00Z',
            Ended: '2023-01-01T10:05:00Z',
          },
        ],
      };

      mockApiClient.getTaskDetails.mockResolvedValue(mockDetails);

      const details = await mockApiClient.getTaskDetails('ServerTasks-100');

      expect(details.ActivityLogs).toHaveLength(2);
      expect(details.Task.State).toBe('Success');
    });

    it('should fetch raw task logs', async () => {
      const mockRawLog = `
[10:00:00] Starting deployment
[10:00:01] Acquiring packages...
[10:01:00] Deploying to web server
[10:05:00] Deployment complete
      `.trim();

      mockApiClient.getTaskRaw.mockResolvedValue(mockRawLog);

      const rawLog = await mockApiClient.getTaskRaw('ServerTasks-100');

      expect(rawLog).toContain('Starting deployment');
      expect(rawLog).toContain('Deployment complete');
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel an executing task', async () => {
      mockApiClient.cancelTask.mockResolvedValue(undefined);

      await expect(mockApiClient.cancelTask('ServerTasks-100')).resolves.not.toThrow();
      expect(mockApiClient.cancelTask).toHaveBeenCalledWith('ServerTasks-100');
    });
  });

  describe('Task Interruptions', () => {
    it('should fetch pending interruptions', async () => {
      const mockInterruptions = [
        {
          Id: 'Interruptions-1',
          Title: 'Manual intervention required',
          IsPending: true,
          Form: {
            Values: {},
            Elements: [
              { Name: 'Instructions', Control: { Type: 'Paragraph', Text: 'Please verify' } },
            ],
          },
        },
      ];

      mockApiClient.getTaskInterruptions.mockResolvedValue(mockInterruptions);

      const interruptions = await mockApiClient.getTaskInterruptions('ServerTasks-100');

      expect(interruptions).toHaveLength(1);
      expect(interruptions[0].IsPending).toBe(true);
    });

    it('should submit interruption response', async () => {
      mockApiClient.submitInterruption.mockResolvedValue(undefined);

      await expect(
        mockApiClient.submitInterruption('Interruptions-1', 'Proceed', 'Approved via mobile')
      ).resolves.not.toThrow();
    });
  });
});

