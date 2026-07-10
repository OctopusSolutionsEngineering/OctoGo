/**
 * Tests for the Runbook detail screen (app/runbook/[id].tsx)
 * Covers loading / error / not-found states, the header/configuration/runs
 * sections, the getTimeAgo helper branches, the run modal (environment
 * selection, single + multi environment runs, failure path) and refresh.
 */

import React from 'react';
import { Alert, Modal, RefreshControl } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Keep icon rendering trivial but observable
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
  useSegments: () => [],
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useRunbook: jest.fn(),
  useProject: jest.fn(),
  useEnvironments: jest.fn(),
  useRunbookEnvironments: jest.fn(),
  useRunbookSnapshots: jest.fn(),
  useRunbookRuns: jest.fn(),
  useRunbookProcessById: jest.fn(),
  useCreateRunbookRun: jest.fn(),
}));

import {
  useRunbook,
  useProject,
  useEnvironments,
  useRunbookEnvironments,
  useRunbookSnapshots,
  useRunbookRuns,
  useRunbookProcessById,
  useCreateRunbookRun,
} from '../../src/hooks/useOctopusQuery';
import RunbookDetailScreen from '../../app/runbook/[id]';

const mockUseRunbook = useRunbook as jest.Mock;
const mockUseProject = useProject as jest.Mock;
const mockUseEnvironments = useEnvironments as jest.Mock;
const mockUseRunbookEnvironments = useRunbookEnvironments as jest.Mock;
const mockUseRunbookSnapshots = useRunbookSnapshots as jest.Mock;
const mockUseRunbookRuns = useRunbookRuns as jest.Mock;
const mockUseRunbookProcessById = useRunbookProcessById as jest.Mock;
const mockUseCreateRunbookRun = useCreateRunbookRun as jest.Mock;

const RUNBOOK_ID = 'Runbooks-1';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const makeRunbook = (overrides: Record<string, unknown> = {}) => ({
  Id: RUNBOOK_ID,
  Name: 'Restart Service',
  Description: 'Restarts the app pool',
  ProjectId: 'Projects-1',
  RunbookProcessId: 'RunbookProcess-1',
  PublishedRunbookSnapshotId: 'RunbookSnapshots-1',
  MultiTenancyMode: 'Untenanted',
  EnvironmentScope: 'All',
  DefaultGuidedFailureMode: 'EnvironmentDefault',
  ...overrides,
});

const NOW = Date.now();
const runFixtures = [
  { Id: 'RunbookRuns-1', TaskId: 'ServerTasks-r1', EnvironmentId: 'Environments-1', Created: new Date(NOW - 30 * 1000).toISOString() },
  { Id: 'RunbookRuns-2', TaskId: 'ServerTasks-r2', EnvironmentId: 'Environments-2', Created: new Date(NOW - 5 * 60 * 1000).toISOString() },
  { Id: 'RunbookRuns-3', TaskId: 'ServerTasks-r3', EnvironmentId: 'Environments-404', Created: new Date(NOW - 5 * 3600 * 1000).toISOString() },
  { Id: 'RunbookRuns-4', TaskId: 'ServerTasks-r4', EnvironmentId: 'Environments-2', Created: new Date(NOW - 3 * 86400 * 1000 - 3600 * 1000).toISOString() },
];

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

describe('RunbookDetailScreen', () => {
  const refetchRunbook = jest.fn();
  const refetchSnapshots = jest.fn();
  const refetchRuns = jest.fn();
  const mutateAsync = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: RUNBOOK_ID });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockUseRunbook.mockReturnValue({
      data: makeRunbook(),
      isLoading: false,
      error: null,
      refetch: refetchRunbook,
    });
    mockUseProject.mockReturnValue({ data: { Id: 'Projects-1', Name: 'Web App' } });
    mockUseEnvironments.mockReturnValue({
      data: [
        { Id: 'Environments-1', Name: 'Dev' },
        { Id: 'Environments-2', Name: 'Prod' },
      ],
    });
    mockUseRunbookEnvironments.mockReturnValue({
      data: [
        { Id: 'Environments-10', Name: 'QA' },
        { Id: 'Environments-20', Name: 'Production-X' },
      ],
      isLoading: false,
    });
    mockUseRunbookSnapshots.mockReturnValue({
      data: { Items: [{ Id: 'RunbookSnapshots-1', Name: 'Snapshot v1' }] },
      isLoading: false,
      refetch: refetchSnapshots,
    });
    mockUseRunbookRuns.mockReturnValue({
      data: { Items: runFixtures },
      isLoading: false,
      refetch: refetchRuns,
    });
    mockUseRunbookProcessById.mockReturnValue({ data: undefined });
    mutateAsync.mockResolvedValue({ Id: 'RunbookRuns-new', TaskId: 'ServerTasks-9' });
    mockUseCreateRunbookRun.mockReturnValue({ mutateAsync, isPending: false });
  });

  it('shows the loading screen while the runbook loads', () => {
    mockUseRunbook.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: refetchRunbook });

    render(<RunbookDetailScreen />);

    expect(screen.getByText('Loading runbook...')).toBeTruthy();
  });

  it('shows an error view and retries all queries', () => {
    mockUseRunbook.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'runbook kaboom' },
      refetch: refetchRunbook,
    });

    render(<RunbookDetailScreen />);

    expect(screen.getByText('runbook kaboom')).toBeTruthy();
    fireEvent.press(screen.getByText('Try Again'));
    expect(refetchRunbook).toHaveBeenCalled();
    expect(refetchSnapshots).toHaveBeenCalled();
    expect(refetchRuns).toHaveBeenCalled();
  });

  it('shows a not-found error when the runbook is missing', () => {
    mockUseRunbook.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: refetchRunbook });

    render(<RunbookDetailScreen />);

    expect(screen.getByText('Runbook not found')).toBeTruthy();
  });

  it('renders header, configuration, steps and recent runs with time-ago branches', () => {
    render(<RunbookDetailScreen />);

    // Header
    expect(screen.getByText('Restart Service')).toBeTruthy();
    expect(screen.getByText('Web App')).toBeTruthy();
    expect(screen.getByText('Restarts the app pool')).toBeTruthy();

    // Configuration
    expect(screen.getByText('Untenanted')).toBeTruthy();
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('EnvironmentDefault')).toBeTruthy();
    expect(screen.getByText('Published Snapshot')).toBeTruthy();
    expect(screen.getByText('Snapshot v1')).toBeTruthy();

    // Steps (no process loaded)
    expect(screen.getByText('Steps (0)')).toBeTruthy();
    expect(screen.getByText('No steps configured')).toBeTruthy();

    // Recent runs with env-name fallback and every time-ago branch
    expect(screen.getByText('Recent Runs (4)')).toBeTruthy();
    expect(screen.getByText('Dev')).toBeTruthy();
    expect(screen.getAllByText('Prod')).toHaveLength(2);
    expect(screen.getByText('Environments-404')).toBeTruthy();
    expect(screen.getByText('Just now')).toBeTruthy();
    expect(screen.getByText('5m ago')).toBeTruthy();
    expect(screen.getByText('5h ago')).toBeTruthy();
    expect(screen.getByText('3d ago')).toBeTruthy();

    // Press a run row navigates to its task
    fireEvent.press(screen.getByText('Dev'));
    expect(Haptics.impactAsync).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/task/ServerTasks-r1');

    // Pull-to-refresh
    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
    expect(refetchRunbook).toHaveBeenCalled();
    expect(refetchSnapshots).toHaveBeenCalled();
    expect(refetchRuns).toHaveBeenCalled();
  });

  it('falls back to the first snapshot when the published snapshot is not in the list', () => {
    mockUseRunbookSnapshots.mockReturnValue({
      data: { Items: [{ Id: 'RunbookSnapshots-99', Name: 'Older Snapshot' }] },
      isLoading: false,
      refetch: refetchSnapshots,
    });

    render(<RunbookDetailScreen />);

    expect(screen.getByText('Older Snapshot')).toBeTruthy();
  });

  it('alerts when running without a published snapshot and shows project fallback', () => {
    mockUseRunbook.mockReturnValue({
      data: makeRunbook({ PublishedRunbookSnapshotId: null, Description: null }),
      isLoading: false,
      error: null,
      refetch: refetchRunbook,
    });
    mockUseProject.mockReturnValue({ data: undefined });
    mockUseRunbookSnapshots.mockReturnValue({
      data: { Items: [] },
      isLoading: false,
      refetch: refetchSnapshots,
    });
    mockUseRunbookRuns.mockReturnValue({ data: undefined, isLoading: false, refetch: refetchRuns });

    render(<RunbookDetailScreen />);

    // Project not loaded yet + empty runs state
    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(screen.getByText('No runs yet')).toBeTruthy();
    expect(screen.queryByText('Published Snapshot')).toBeNull();

    fireEvent.press(screen.getByText('Run Now'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'No Published Snapshot',
      'This runbook does not have a published snapshot. Please publish a snapshot in Octopus Deploy first.'
    );
    expect(screen.queryByText('Select Environments')).toBeNull();
  });

  it('runs the runbook on a single environment and offers task navigation', async () => {
    render(<RunbookDetailScreen />);

    fireEvent.press(screen.getByText('Run Now'));

    expect(screen.getByText('Run Restart Service')).toBeTruthy();
    expect(screen.getByText('Select Environments')).toBeTruthy();

    // Select, deselect, re-select QA
    fireEvent.press(screen.getByText('QA'));
    fireEvent.press(screen.getByText('QA'));
    fireEvent.press(screen.getByText('QA'));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);

    await act(async () => {
      fireEvent.press(screen.getByText('Run'));
    });

    expect(mutateAsync).toHaveBeenCalledWith({
      runbookId: RUNBOOK_ID,
      runbookSnapshotId: 'RunbookSnapshots-1',
      environmentId: 'Environments-10',
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Runbook Started',
        'Restart Service is now running on QA',
        expect.any(Array)
      );
    });
    expect(refetchRuns).toHaveBeenCalled();

    await pressAlertButton('View Task');
    expect(mockRouter.push).toHaveBeenCalledWith('/task/ServerTasks-9');

    // Modal closed after the run
    expect(screen.queryByText('Select Environments')).toBeNull();
  });

  it('runs the runbook on multiple environments', async () => {
    render(<RunbookDetailScreen />);

    fireEvent.press(screen.getByText('Run Now'));
    fireEvent.press(screen.getByText('QA'));
    fireEvent.press(screen.getByText('Production-X'));

    await act(async () => {
      fireEvent.press(screen.getByText('Run on 2 Envs'));
    });

    expect(mutateAsync).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Runbook Started',
        'Restart Service is now running on 2 environments: QA, Production-X',
        [{ text: 'OK' }]
      );
    });
  });

  it('shows an error alert when the run fails', async () => {
    mutateAsync.mockRejectedValue({});

    render(<RunbookDetailScreen />);

    fireEvent.press(screen.getByText('Run Now'));
    fireEvent.press(screen.getByText('QA'));

    await act(async () => {
      fireEvent.press(screen.getByText('Run'));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to run runbook');
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });

  it('shows the loading state for runbook environments and cancels the modal', async () => {
    mockUseRunbookEnvironments.mockReturnValue({ data: undefined, isLoading: true });

    render(<RunbookDetailScreen />);

    fireEvent.press(screen.getByText('Run Now'));
    expect(screen.getByText('Loading environments...')).toBeTruthy();

    fireEvent.press(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByText('Select Environments')).toBeNull();
    });

    // Re-open and close via the hardware back handler (onRequestClose)
    fireEvent.press(screen.getByText('Run Now'));
    expect(screen.getByText('Select Environments')).toBeTruthy();
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
    await waitFor(() => {
      expect(screen.queryByText('Select Environments')).toBeNull();
    });
  });

  it('shows the empty state when no environments are available and closes via the icon', async () => {
    mockUseRunbookEnvironments.mockReturnValue({ data: [], isLoading: false });

    render(<RunbookDetailScreen />);

    fireEvent.press(screen.getByText('Run Now'));
    expect(screen.getByText('No environments available for this runbook')).toBeTruthy();

    // The Ionicons mock renders the 'close' icon name as pressable text
    fireEvent.press(screen.getByText('close'));
    await waitFor(() => {
      expect(screen.queryByText('Select Environments')).toBeNull();
    });
  });
});
