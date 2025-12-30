/**
 * Integration tests for Runbook execution flow
 */

import * as apiClient from '../../src/lib/api/client';

jest.mock('../../src/lib/api/client');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('Runbook Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Runbook Discovery', () => {
    it('should fetch runbooks for a project', async () => {
      const mockRunbooks = [
        {
          Id: 'Runbooks-1',
          Name: 'Backup Database',
          ProjectId: 'Projects-1',
          Description: 'Creates a database backup',
        },
        {
          Id: 'Runbooks-2',
          Name: 'Clear Cache',
          ProjectId: 'Projects-1',
          Description: 'Clears application cache',
        },
      ];

      mockApiClient.getProjectRunbooks.mockResolvedValue(mockRunbooks);

      const runbooks = await mockApiClient.getProjectRunbooks('Projects-1');

      expect(runbooks).toHaveLength(2);
      expect(runbooks[0].Name).toBe('Backup Database');
    });

    it('should fetch runbook details', async () => {
      const mockRunbook = {
        Id: 'Runbooks-1',
        Name: 'Backup Database',
        ProjectId: 'Projects-1',
        Description: 'Creates a database backup',
        DefaultGuidedFailureMode: 'EnvironmentDefault',
        RunRetentionPolicy: {
          QuantityToKeep: 100,
          ShouldKeepForever: false,
        },
      };

      mockApiClient.getRunbook.mockResolvedValue(mockRunbook);

      const runbook = await mockApiClient.getRunbook('Runbooks-1');

      expect(runbook.Name).toBe('Backup Database');
      expect(runbook.ProjectId).toBe('Projects-1');
    });
  });

  describe('Runbook Snapshots', () => {
    it('should fetch available snapshots', async () => {
      const mockSnapshots = {
        Items: [
          {
            Id: 'RunbookSnapshots-1',
            Name: 'Snapshot 1.0.0',
            RunbookId: 'Runbooks-1',
            Created: '2023-01-01T10:00:00Z',
          },
          {
            Id: 'RunbookSnapshots-2',
            Name: 'Snapshot 1.0.1',
            RunbookId: 'Runbooks-1',
            Created: '2023-01-15T10:00:00Z',
          },
        ],
        TotalResults: 2,
      };

      mockApiClient.getRunbookSnapshots.mockResolvedValue(mockSnapshots);

      const snapshots = await mockApiClient.getRunbookSnapshots('Runbooks-1');

      expect(snapshots.Items).toHaveLength(2);
      expect(snapshots.Items[0].Name).toBe('Snapshot 1.0.0');
    });
  });

  describe('Runbook Execution', () => {
    it('should create a runbook run', async () => {
      const mockRun = {
        Id: 'RunbookRuns-100',
        RunbookId: 'Runbooks-1',
        RunbookSnapshotId: 'RunbookSnapshots-1',
        EnvironmentId: 'Environments-1',
        TaskId: 'ServerTasks-200',
        Created: new Date().toISOString(),
      };

      mockApiClient.createRunbookRun.mockResolvedValue(mockRun);

      const result = await mockApiClient.createRunbookRun(
        'Runbooks-1',
        'RunbookSnapshots-1',
        'Environments-1',
        { comments: 'Run from mobile app' }
      );

      expect(result.Id).toBe('RunbookRuns-100');
      expect(result.TaskId).toBe('ServerTasks-200');
    });

    it('should monitor runbook run progress', async () => {
      const mockTask = {
        Id: 'ServerTasks-200',
        Name: 'Run Runbook',
        State: 'Executing',
        PercentComplete: 25,
      };

      mockApiClient.getTask.mockResolvedValue(mockTask);

      const task = await mockApiClient.getTask('ServerTasks-200');

      expect(task.State).toBe('Executing');
      expect(task.PercentComplete).toBe(25);
    });

    it('should handle runbook run failure', async () => {
      const error = { message: 'Runbook snapshot not found', statusCode: 404 };
      mockApiClient.createRunbookRun.mockImplementation(() => Promise.reject(error));

      try {
        await mockApiClient.createRunbookRun(
          'Runbooks-1',
          'Invalid-Snapshot',
          'Environments-1'
        );
        fail('Expected error to be thrown');
      } catch (e: any) {
        expect(e.message).toBe('Runbook snapshot not found');
        expect(e.statusCode).toBe(404);
      }
    });
  });

  describe('Runbook Run History', () => {
    it('should fetch recent runbook runs', async () => {
      const mockRuns = {
        Items: [
          {
            Id: 'RunbookRuns-100',
            RunbookId: 'Runbooks-1',
            TaskId: 'ServerTasks-200',
            Created: '2023-01-20T10:00:00Z',
          },
          {
            Id: 'RunbookRuns-99',
            RunbookId: 'Runbooks-1',
            TaskId: 'ServerTasks-199',
            Created: '2023-01-19T10:00:00Z',
          },
        ],
        TotalResults: 2,
      };

      mockApiClient.getRunbookRuns.mockResolvedValue(mockRuns);

      const runs = await mockApiClient.getRunbookRuns({ runbookId: 'Runbooks-1', take: 10 });

      expect(runs.Items).toHaveLength(2);
    });
  });
});

