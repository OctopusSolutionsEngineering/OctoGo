/**
 * Screen tests for the Task Detail screen (app/task/[id].tsx)
 * Renders the real screen with real react-query hooks and a mocked API client.
 */

import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';

import TaskDetailScreen from '../../app/task/[id]';
import * as apiClient from '../../src/lib/api/client';

jest.mock('../../src/lib/api/client');

// Override the global expo-router mock so we can control params and assert navigation
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
  useSegments: () => [],
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

// Keep icon rendering trivial
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const mockApi = apiClient as jest.Mocked<typeof apiClient>;
const TASK_ID = 'ServerTasks-1';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  Id: TASK_ID,
  SpaceId: 'Spaces-1',
  Name: 'Deploy',
  Description: 'Deploy Swift Bridge release 25.12.1 to Development',
  Arguments: {} as Record<string, unknown>,
  State: 'Success',
  Completed: '2026-01-01T10:05:00Z',
  QueueTime: '2026-01-01T10:00:00Z',
  QueueTimeExpiry: null,
  StartTime: '2026-01-01T10:00:05Z',
  LastUpdatedTime: '2026-01-01T10:05:00Z',
  CompletedTime: '2026-01-01T10:05:00Z',
  ServerNode: null,
  Duration: '00:04:55.2',
  ErrorMessage: null,
  HasBeenPickedUpByProcessor: true,
  IsCompleted: true,
  FinishedSuccessfully: true,
  HasPendingInterruptions: false,
  CanRerun: false,
  HasWarningsOrErrors: false,
  ActivityLogs: [] as unknown[],
  Progress: { ProgressPercentage: 0, EstimatedTimeRemaining: null },
  ...overrides,
});

const mockDeployment = {
  Id: 'Deployments-1',
  Name: 'Deploy to Dev',
  ReleaseId: 'Releases-1',
  EnvironmentId: 'Environments-1',
  ProjectId: 'Projects-1',
  TenantId: 'Tenants-1',
  TaskId: TASK_ID,
};

const mockRunbookRun = {
  Id: 'RunbookRuns-1',
  Name: 'Run 1',
  RunbookId: 'Runbooks-1',
  RunbookSnapshotId: 'RunbookSnapshots-1',
  EnvironmentId: 'Environments-1',
  ProjectId: 'Projects-1',
  TenantId: 'Tenants-1',
  TaskId: TASK_ID,
};

const artifactFixtures = [
  { Id: 'Artifacts-1', Filename: 'report.html', Created: '2026-01-01T10:05:00Z', ServerTaskId: TASK_ID },
  { Id: 'Artifacts-2', Filename: 'settings.json', Created: '2026-01-01T10:05:01Z', ServerTaskId: TASK_ID },
  { Id: 'Artifacts-3', Filename: 'output.log', Created: '2026-01-01T10:05:02Z', ServerTaskId: TASK_ID },
  { Id: 'Artifacts-4', Filename: 'bundle.zip', Created: '2026-01-01T10:05:03Z', ServerTaskId: TASK_ID },
  { Id: 'Artifacts-5', Filename: 'screenshot.png', Created: '2026-01-01T10:05:04Z', ServerTaskId: TASK_ID },
  { Id: 'Artifacts-6', Filename: 'summary.pdf', Created: '2026-01-01T10:05:05Z', ServerTaskId: TASK_ID },
  { Id: 'Artifacts-7', Filename: 'README', Created: '2026-01-01T10:05:06Z', ServerTaskId: TASK_ID },
];

const renderScreen = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TaskDetailScreen />
    </QueryClientProvider>
  );
};

// Find the button with the given label in the most recent Alert.alert call and press it
const pressAlertButton = async (label: string) => {
  const lastCall = (Alert.alert as jest.Mock).mock.calls.at(-1);
  expect(lastCall).toBeDefined();
  const buttons = (lastCall?.[2] ?? []) as { text: string; onPress?: () => Promise<void> | void }[];
  const button = buttons.find((b) => b.text === label);
  expect(button).toBeDefined();
  await act(async () => {
    await button!.onPress?.();
  });
};

describe('TaskDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: TASK_ID });

    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Sensible defaults; individual tests override getTaskDetails etc.
    mockApi.getTaskDetails.mockResolvedValue(makeTask() as never);
    mockApi.getArtifacts.mockResolvedValue([] as never);
    mockApi.getTaskInterruptions.mockResolvedValue([] as never);
    mockApi.getTaskRaw.mockResolvedValue('RAW TASK LOG CONTENT' as never);
    mockApi.getDeployment.mockResolvedValue(mockDeployment as never);
    mockApi.getRunbookRun.mockResolvedValue(mockRunbookRun as never);
    mockApi.getProject.mockResolvedValue({ Id: 'Projects-1', Name: 'SwiftBridgeProj' } as never);
    mockApi.getRelease.mockResolvedValue({
      Id: 'Releases-1',
      Version: '25.12.1',
      ReleaseNotes: '- Fixed the flux capacitor',
    } as never);
    mockApi.getEnvironment.mockResolvedValue({ Id: 'Environments-1', Name: 'DevEnv' } as never);
    mockApi.getTenant.mockResolvedValue({ Id: 'Tenants-1', Name: 'AcmeTenant' } as never);
    mockApi.getRunbook.mockResolvedValue({ Id: 'Runbooks-1', Name: 'Restart Service' } as never);
    mockApi.cancelTask.mockResolvedValue(undefined as never);
    mockApi.submitInterruption.mockResolvedValue(undefined as never);
    mockApi.takeResponsibility.mockResolvedValue(undefined as never);
    mockApi.createDeployment.mockResolvedValue({ Id: 'Deployments-2', TaskId: 'ServerTasks-99' } as never);
    mockApi.createRunbookRun.mockResolvedValue({ Id: 'RunbookRuns-2', TaskId: 'ServerTasks-77' } as never);
    mockApi.getArtifactContentUrl.mockResolvedValue('https://octopus.example.com/artifact-content' as never);
  });

  describe('loading / error states', () => {
    it('shows the loading screen while task details load', () => {
      mockApi.getTaskDetails.mockImplementation(() => new Promise(() => {}) as never);

      renderScreen();

      expect(screen.getByText('Loading task details...')).toBeTruthy();
    });

    it('shows an error view when loading the task fails', async () => {
      mockApi.getTaskDetails.mockRejectedValue(new Error('Server exploded'));

      renderScreen();

      expect(await screen.findByText('Server exploded')).toBeTruthy();
    });

    it('shows a not-found error when the task is missing', async () => {
      mockApi.getTaskDetails.mockResolvedValue(null as never);

      renderScreen();

      expect(await screen.findByText('Task not found')).toBeTruthy();
    });
  });

  describe('completed deployment task', () => {
    const successTask = makeTask({
      State: 'Success',
      Arguments: { DeploymentId: 'Deployments-1' },
      Duration: '01:02:03.5',
      ActivityLogs: [
        {
          Id: 'root',
          Name: 'Deploy Swift Bridge',
          Status: 'Success',
          LogElements: [],
          Children: [
            {
              Id: 'step-1',
              Name: 'Acquire packages',
              Status: 'Success',
              Children: [],
              LogElements: [
                { Category: 'Info', MessageText: '14:32:01   Info   Extracting package' },
                { Category: 'Warning', MessageText: 'Low disk space' },
                { Category: 'Highlight', MessageText: 'Something notable' },
              ],
            },
            {
              Id: 'step-2',
              Name: 'Deploy step',
              Status: 'Skipped',
              LogElements: [{ Category: 'Error', MessageText: 'oops happened' }],
              Children: [
                {
                  Id: 'step-2-1',
                  Name: 'Nested child',
                  Status: 'Pending',
                  Children: [],
                  LogElements: [{ Category: 'Wait', MessageText: 'Waiting for lock' }],
                },
              ],
            },
          ],
        },
      ],
    });

    it('renders context, release notes, timing, artifacts and activity logs', async () => {
      mockApi.getTaskDetails.mockResolvedValue(successTask as never);
      mockApi.getArtifacts.mockResolvedValue(artifactFixtures as never);

      renderScreen();

      // Header
      expect(await screen.findByText('Deploy Swift Bridge release 25.12.1 to Development')).toBeTruthy();

      // Context card built from API data
      expect(await screen.findByText('SwiftBridgeProj')).toBeTruthy();
      expect(screen.getByText('DevEnv')).toBeTruthy();
      expect(screen.getByText('25.12.1')).toBeTruthy();
      expect(screen.getByText('AcmeTenant')).toBeTruthy();

      // Release notes for successful deployments
      expect(screen.getByText('Release Notes')).toBeTruthy();
      expect(screen.getByText('- Fixed the flux capacitor')).toBeTruthy();

      // Timing card with hours-branch duration formatting
      expect(screen.getByText('Duration')).toBeTruthy();
      expect(screen.getByText('1h 2m 4s')).toBeTruthy();
      expect(screen.getByText('Completed')).toBeTruthy();

      // Artifacts card
      expect(screen.getByText('Artifacts')).toBeTruthy();
      expect(screen.getByText('7')).toBeTruthy();
      for (const artifact of artifactFixtures) {
        expect(screen.getByText(artifact.Filename)).toBeTruthy();
      }

      // Activity logs (root shows success-with-warning because a child log warns)
      expect(screen.getByText('Deploy Swift Bridge')).toBeTruthy();
      expect(screen.getByText('Acquire packages')).toBeTruthy();
      expect(screen.getByText('Extracting package', { exact: false })).toBeTruthy();
      expect(screen.getByText('Low disk space')).toBeTruthy();
      expect(screen.getByText('oops happened')).toBeTruthy();

      // Nested child at depth 2 starts collapsed; expand it
      fireEvent.press(screen.getByText('Nested child'));
      expect(screen.getByText('Waiting for lock')).toBeTruthy();

      // Collapse the root activity again
      fireEvent.press(screen.getByText('Deploy Swift Bridge'));

      // Navigate via a context row
      fireEvent.press(screen.getByText('SwiftBridgeProj'));
      expect(mockRouter.push).toHaveBeenCalledWith('/project/Projects-1');
    });

    it('opens an artifact successfully', async () => {
      mockApi.getTaskDetails.mockResolvedValue(successTask as never);
      mockApi.getArtifacts.mockResolvedValue(artifactFixtures as never);

      renderScreen();

      const artifactRow = await screen.findByText('report.html');
      await act(async () => {
        fireEvent.press(artifactRow);
      });

      await waitFor(() => {
        expect(mockApi.getArtifactContentUrl).toHaveBeenCalledWith('Artifacts-1');
        expect(Linking.openURL).toHaveBeenCalledWith('https://octopus.example.com/artifact-content');
      });
      expect(Haptics.selectionAsync).toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('shows an alert when opening an artifact fails', async () => {
      mockApi.getTaskDetails.mockResolvedValue(successTask as never);
      mockApi.getArtifacts.mockResolvedValue(artifactFixtures as never);
      mockApi.getArtifactContentUrl.mockRejectedValue(new Error('content url failed'));

      renderScreen();

      const artifactRow = await screen.findByText('settings.json');
      await act(async () => {
        fireEvent.press(artifactRow);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Unable to open artifact. Please try again.');
      });
      expect(console.error).toHaveBeenCalledWith('Failed to open artifact:', expect.any(Error));
      expect(Linking.openURL).not.toHaveBeenCalled();
    });

    it('switches to raw logs view and toggles auto-scroll', async () => {
      mockApi.getTaskDetails.mockResolvedValue(successTask as never);

      renderScreen();

      await screen.findByText('Logs');
      await act(async () => {
        fireEvent.press(screen.getByText('Raw'));
      });

      expect(await screen.findByText('RAW TASK LOG CONTENT')).toBeTruthy();
      expect(mockApi.getTaskRaw).toHaveBeenCalledWith(TASK_ID);

      // Toggle auto-scroll off and back to the activity view
      fireEvent.press(screen.getByText('Auto-scroll'));
      await act(async () => {
        fireEvent.press(screen.getByText('Activity'));
      });
      expect(screen.getByText('Deploy Swift Bridge')).toBeTruthy();
    });
  });

  describe('failed deployment retry', () => {
    const failedDeploymentTask = makeTask({
      State: 'Failed',
      ErrorMessage: 'The deployment failed badly',
      Arguments: { DeploymentId: 'Deployments-1' },
      Duration: '00:04:55.2',
      FinishedSuccessfully: false,
    });

    it('retries a failed deployment and navigates to the new task', async () => {
      mockApi.getTaskDetails.mockResolvedValue(failedDeploymentTask as never);

      renderScreen();

      // Error banner and minutes-branch duration
      expect(await screen.findByText('The deployment failed badly')).toBeTruthy();
      expect(screen.getByText('4m 55s')).toBeTruthy();

      const retryButton = await screen.findByText('Retry Deployment');
      fireEvent.press(retryButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Retry Deployment',
        expect.stringContaining('This will create a new deployment'),
        expect.any(Array)
      );

      await pressAlertButton('Retry');

      expect(mockApi.createDeployment).toHaveBeenCalledWith('Releases-1', 'Environments-1', {
        comments: 'Retry of Deploy to Dev',
        tenantId: 'Tenants-1',
      });
      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/task/ServerTasks-99');
      });
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    });

    it('shows an error alert when retrying the deployment fails', async () => {
      mockApi.getTaskDetails.mockResolvedValue(failedDeploymentTask as never);
      mockApi.createDeployment.mockRejectedValue(new Error('retry failed'));

      renderScreen();

      fireEvent.press(await screen.findByText('Retry Deployment'));
      await pressAlertButton('Retry');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to retry deployment. Please try again.');
      });
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });

  describe('failed runbook run retry', () => {
    const failedRunbookTask = makeTask({
      State: 'TimedOut',
      Name: 'RunbookRun',
      Description: 'Run Restart Service on Development',
      Arguments: { RunbookRunId: 'RunbookRuns-1' },
      Duration: '00:00:42.4',
      FinishedSuccessfully: false,
    });

    it('retries a failed runbook run and navigates to the new task', async () => {
      mockApi.getTaskDetails.mockResolvedValue(failedRunbookTask as never);

      renderScreen();

      // Seconds-only duration branch
      expect(await screen.findByText('42s')).toBeTruthy();

      // Runbook context row from API data
      expect(await screen.findByText('Restart Service')).toBeTruthy();
      fireEvent.press(screen.getByText('Restart Service'));
      expect(mockRouter.push).toHaveBeenCalledWith('/runbook/Runbooks-1');

      fireEvent.press(await screen.findByText('Retry Runbook Run'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Retry Runbook Run',
        expect.stringContaining('runbook run'),
        expect.any(Array)
      );

      await pressAlertButton('Retry');

      expect(mockApi.createRunbookRun).toHaveBeenCalledWith(
        'Runbooks-1',
        'RunbookSnapshots-1',
        'Environments-1',
        { comments: 'Retry of Run 1' }
      );
      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/task/ServerTasks-77');
      });
    });
  });

  describe('executing task and cancellation', () => {
    const executingTask = makeTask({
      State: 'Executing',
      IsCompleted: false,
      FinishedSuccessfully: false,
      CompletedTime: null,
      Completed: null,
      Duration: 'PT5S', // not HH:MM:SS -> rendered as-is
      HasPendingInterruptions: true,
      ActivityLogs: [
        {
          Id: 'root',
          Name: 'Deploy in progress',
          Status: 'Running',
          LogElements: [],
          Children: [
            { Id: 'c1', Name: 'Step one', Status: 'Success', Children: [], LogElements: [] },
            { Id: 'c2', Name: 'Step two', Status: 'Failed', Children: [], LogElements: [{ Category: 'Fatal', MessageText: 'fatal issue' }] },
            { Id: 'c3', Name: 'Step three', Status: 'Canceled', Children: [], LogElements: [] },
            { Id: 'c4', Name: 'Step four', Status: 'Warning', Children: [], LogElements: [{ Category: 'Planned', MessageText: 'planned item' }] },
            { Id: 'c5', Name: 'Step five', Status: 'Running', Children: [], LogElements: [] },
          ],
        },
      ],
    });

    it('shows progress, pending-intervention hint and live raw logs', async () => {
      mockApi.getTaskDetails.mockResolvedValue(executingTask as never);

      renderScreen();

      // 4 of 5 steps are terminal -> 80%
      expect(await screen.findByText('80%')).toBeTruthy();
      // Duration fallback branch (unparseable format is shown untouched)
      expect(screen.getByText('PT5S')).toBeTruthy();
      // Pending interruptions flagged but none loaded yet -> hint card
      expect(screen.getByText('Intervention Pending')).toBeTruthy();
      expect(screen.getByText('This task is waiting for manual intervention')).toBeTruthy();

      // Raw view shows the live indicator while running
      await act(async () => {
        fireEvent.press(screen.getByText('Raw'));
      });
      expect(await screen.findByText('Live')).toBeTruthy();
    });

    it('cancels the task after confirmation', async () => {
      mockApi.getTaskDetails.mockResolvedValue(executingTask as never);

      renderScreen();

      fireEvent.press(await screen.findByText('Cancel Task'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Cancel Task',
        'Are you sure you want to cancel this task?',
        expect.any(Array)
      );

      await pressAlertButton('Yes, Cancel');

      // react-query passes a context object as a second argument to mutationFn
      expect(mockApi.cancelTask).toHaveBeenCalledWith(TASK_ID, expect.anything());
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    });

    it('shows an error alert when cancellation fails', async () => {
      mockApi.getTaskDetails.mockResolvedValue(executingTask as never);
      mockApi.cancelTask.mockRejectedValue(new Error('cannot cancel'));

      renderScreen();

      fireEvent.press(await screen.findByText('Cancel Task'));
      await pressAlertButton('Yes, Cancel');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to cancel task');
      });
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
    });
  });

  describe('interruptions', () => {
    const interruptedTask = makeTask({
      State: 'Executing',
      IsCompleted: false,
      CompletedTime: null,
      Duration: '',
      HasPendingInterruptions: true,
    });

    const manualIntervention = {
      Id: 'Interruptions-1',
      Title: 'Approve deployment to production?',
      IsPending: true,
      CanTakeResponsibility: true,
      ResponsibleUserId: 'Users-1',
      Form: {
        Values: {},
        Elements: [{ Name: 'Instructions', Control: { Type: 'Paragraph', Text: 'Please verify the staging site' } }],
      },
    };

    const guidedFailure = {
      Id: 'Interruptions-2',
      Title: 'Step failed - choose how to continue',
      IsPending: true,
      CanTakeResponsibility: true,
      ResponsibleUserId: 'Users-1',
      Form: {
        Values: { Guidance: 'GuidedFailure' },
        Elements: [{ Name: 'Instructions', Control: { Type: 'Paragraph', Text: 'The step failed on Machine-1' } }],
      },
    };

    const needsResponsibility = {
      ...manualIntervention,
      Id: 'Interruptions-3',
      ResponsibleUserId: null,
    };

    it('renders a manual intervention and submits a rejection (with modal cancel first)', async () => {
      mockApi.getTaskDetails.mockResolvedValue(interruptedTask as never);
      mockApi.getTaskInterruptions.mockResolvedValue([manualIntervention] as never);

      renderScreen();

      expect(await screen.findByText('Manual Intervention')).toBeTruthy();
      expect(screen.getByText('Approve deployment to production?')).toBeTruthy();
      expect(screen.getByText('Please verify the staging site')).toBeTruthy();

      // Open the Approve confirmation, then back out of it
      fireEvent.press(screen.getByText('Approve'));
      expect(await screen.findByText('Confirm Approve')).toBeTruthy();
      expect(screen.getByText(/This will approve the manual intervention/)).toBeTruthy();
      fireEvent.press(screen.getByText('Cancel'));
      await waitFor(() => {
        expect(screen.queryByText('Confirm Approve')).toBeNull();
      });

      // Now reject
      fireEvent.press(screen.getByText('Reject'));
      expect(await screen.findByText('Confirm Reject')).toBeTruthy();
      expect(screen.getByText(/abort the deployment/)).toBeTruthy();

      const rejectButtons = screen.getAllByText('Reject');
      await act(async () => {
        fireEvent.press(rejectButtons[rejectButtons.length - 1]);
      });

      await waitFor(() => {
        expect(mockApi.submitInterruption).toHaveBeenCalledWith('Interruptions-1', 'Abort', undefined);
      });
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    });

    it('renders a guided failure and submits a retry with notes', async () => {
      mockApi.getTaskDetails.mockResolvedValue(interruptedTask as never);
      mockApi.getTaskInterruptions.mockResolvedValue([guidedFailure] as never);

      renderScreen();

      expect(await screen.findByText('Guided Failure')).toBeTruthy();
      expect(screen.getByText('Fail')).toBeTruthy();
      expect(screen.getByText('Ignore')).toBeTruthy();
      expect(screen.getByText('Exclude Machine')).toBeTruthy();

      // Add notes
      fireEvent.press(screen.getByText('Add notes (optional)'));
      const notesInput = screen.getByPlaceholderText('Add notes about your decision...');
      fireEvent.changeText(notesInput, 'my retry notes');
      expect(screen.getByText('Hide notes')).toBeTruthy();

      // Trigger the Retry confirmation
      fireEvent.press(screen.getByText('Retry'));
      expect(await screen.findByText('Confirm Retry')).toBeTruthy();
      expect(screen.getByText('This will retry the failed step.')).toBeTruthy();
      expect(screen.getByText('my retry notes')).toBeTruthy();

      const retryButtons = screen.getAllByText('Retry');
      await act(async () => {
        fireEvent.press(retryButtons[retryButtons.length - 1]);
      });

      await waitFor(() => {
        expect(mockApi.submitInterruption).toHaveBeenCalledWith('Interruptions-2', 'Retry', 'my retry notes');
      });
      expect(Haptics.impactAsync).toHaveBeenCalled();
    });

    it('shows an error alert when submitting an interruption fails', async () => {
      mockApi.getTaskDetails.mockResolvedValue(interruptedTask as never);
      mockApi.getTaskInterruptions.mockResolvedValue([guidedFailure] as never);
      mockApi.submitInterruption.mockRejectedValue(new Error('submit failed'));

      renderScreen();

      await screen.findByText('Guided Failure');
      fireEvent.press(screen.getByText('Fail'));
      expect(await screen.findByText('Confirm Fail')).toBeTruthy();
      expect(screen.getByText(/mark the step as failed/)).toBeTruthy();

      const failButtons = screen.getAllByText('Fail');
      await act(async () => {
        fireEvent.press(failButtons[failButtons.length - 1]);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to submit response');
      });
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
    });

    it('takes responsibility for an interruption', async () => {
      mockApi.getTaskDetails.mockResolvedValue(interruptedTask as never);
      mockApi.getTaskInterruptions.mockResolvedValue([needsResponsibility] as never);

      renderScreen();

      expect(await screen.findByText('Take responsibility to unlock approval actions')).toBeTruthy();

      await act(async () => {
        fireEvent.press(screen.getByText('Take Responsibility'));
      });

      await waitFor(() => {
        expect(mockApi.takeResponsibility).toHaveBeenCalledWith('Interruptions-3', expect.anything());
      });
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    });

    it('shows an error alert when taking responsibility fails', async () => {
      mockApi.getTaskDetails.mockResolvedValue(interruptedTask as never);
      mockApi.getTaskInterruptions.mockResolvedValue([needsResponsibility] as never);
      mockApi.takeResponsibility.mockRejectedValue(new Error('nope'));

      renderScreen();

      await screen.findByText('Take Responsibility');
      await act(async () => {
        fireEvent.press(screen.getByText('Take Responsibility'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to take responsibility');
      });
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
    });
  });
});
