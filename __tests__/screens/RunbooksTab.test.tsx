/**
 * Tests for the Runbooks tab screen
 * Covers loading / error / empty / populated states, the draft badge and
 * description branches, last-run info vs "Never run", the getTimeAgo helper
 * branches, stats (including the quiet-24h branch) and navigation.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Ionicons = (props: { name: string }) => React.createElement(Text, props, props.name);
  Ionicons.glyphMap = {};
  return { Ionicons };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('../../src/context/ThemeContext', () => {
  const actual = jest.requireActual('../../src/context/ThemeContext');
  return {
    ...actual,
    useColors: () => actual.darkColors,
  };
});

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useRunbooks: jest.fn(),
  useRunbookRuns: jest.fn(),
  useProjects: jest.fn(),
}));

import { useRunbooks, useRunbookRuns, useProjects } from '../../src/hooks/useOctopusQuery';
import RunbooksScreen from '../../app/(tabs)/runbooks';

const mockUseRunbooks = useRunbooks as jest.Mock;
const mockUseRunbookRuns = useRunbookRuns as jest.Mock;
const mockUseProjects = useProjects as jest.Mock;

const secondsAgo = (s: number) => new Date(Date.now() - s * 1000).toISOString();

const makeRunbook = (overrides: Record<string, unknown> = {}) => ({
  Id: 'Runbooks-1',
  Name: 'Restart Web',
  Description: null,
  ProjectId: 'Projects-1',
  PublishedRunbookSnapshotId: 'Snapshots-1',
  ...overrides,
});

const makeRun = (overrides: Record<string, unknown> = {}) => ({
  Id: 'RunbookRuns-1',
  RunbookId: 'Runbooks-1',
  TaskId: 'ServerTasks-1',
  Created: secondsAgo(60),
  ...overrides,
});

const queryResult = (items: any[], extra: Record<string, unknown> = {}) => ({
  data: { Items: items },
  isLoading: false,
  error: null,
  refetch: jest.fn(),
  ...extra,
});

describe('RunbooksScreen', () => {
  beforeEach(() => {
    mockUseRunbooks.mockReturnValue(queryResult([]));
    mockUseRunbookRuns.mockReturnValue(queryResult([]));
    mockUseProjects.mockReturnValue(
      queryResult([
        { Id: 'Projects-1', Name: 'Web App' },
        { Id: 'Projects-2', Name: 'API Service' },
      ])
    );
  });

  it('shows the loading screen while runbooks load', () => {
    mockUseRunbooks.mockReturnValue(queryResult([], { data: undefined, isLoading: true }));

    render(<RunbooksScreen />);

    expect(screen.getByText('Loading runbooks...')).toBeTruthy();
  });

  it('shows an error view and refetches everything on retry', () => {
    const refetchRunbooks = jest.fn();
    const refetchRuns = jest.fn();
    mockUseRunbooks.mockReturnValue(
      queryResult([], { data: undefined, error: { message: 'Runbooks unavailable' }, refetch: refetchRunbooks })
    );
    mockUseRunbookRuns.mockReturnValue(queryResult([], { refetch: refetchRuns }));

    render(<RunbooksScreen />);

    expect(screen.getByText('Runbooks unavailable')).toBeTruthy();

    fireEvent.press(screen.getByText('Try Again'));
    expect(refetchRunbooks).toHaveBeenCalled();
    expect(refetchRuns).toHaveBeenCalled();
  });

  it('shows the empty state when there are no runbooks', () => {
    render(<RunbooksScreen />);

    expect(screen.getByText('No runbooks found')).toBeTruthy();
  });

  it('renders runbooks with last-run info, draft badges and stats', () => {
    mockUseRunbooks.mockReturnValue(
      queryResult([
        makeRunbook({ Id: 'Runbooks-1', Name: 'Restart Web', Description: 'Restarts the web tier' }),
        makeRunbook({ Id: 'Runbooks-2', Name: 'Rotate Keys', ProjectId: 'Projects-2' }),
        makeRunbook({ Id: 'Runbooks-3', Name: 'Cleanup Disk' }),
        makeRunbook({ Id: 'Runbooks-4', Name: 'Backup DB' }),
        makeRunbook({
          Id: 'Runbooks-5',
          Name: 'Zulu Draft',
          ProjectId: 'Projects-unknown',
          PublishedRunbookSnapshotId: null,
        }),
        makeRunbook({
          Id: 'Runbooks-6',
          Name: 'Alpha Draft',
          PublishedRunbookSnapshotId: null,
        }),
      ])
    );
    mockUseRunbookRuns.mockReturnValue(
      queryResult([
        // Older run for the same runbook: dedup keeps only the latest
        makeRun({ Id: 'Run-0', RunbookId: 'Runbooks-1', Created: secondsAgo(2 * 60 * 60) }),
        makeRun({ Id: 'Run-1', RunbookId: 'Runbooks-1', Created: secondsAgo(30) }),
        // Run without a TaskId -> Queued badge
        makeRun({ Id: 'Run-2', RunbookId: 'Runbooks-2', TaskId: null, Created: secondsAgo(5 * 60) }),
        makeRun({ Id: 'Run-3', RunbookId: 'Runbooks-3', Created: secondsAgo(3 * 60 * 60) }),
        makeRun({ Id: 'Run-4', RunbookId: 'Runbooks-4', Created: secondsAgo(2 * 24 * 60 * 60) }),
      ])
    );

    render(<RunbooksScreen />);

    // Stats: 6 total, 4 published, 4 runs in last 24h (Run-0 counted too)
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('Published')).toBeTruthy();
    expect(screen.getByText('Runs 24h')).toBeTruthy();

    // Project name lookup and fallback (several runbooks belong to Web App)
    expect(screen.getAllByText('Web App').length).toBeGreaterThan(0);
    expect(screen.getByText('API Service')).toBeTruthy();
    expect(screen.getByText('Unknown Project')).toBeTruthy();

    // Description branch
    expect(screen.getByText('Restarts the web tier')).toBeTruthy();

    // Draft badges only for unpublished runbooks
    expect(screen.getAllByText('Draft')).toHaveLength(2);

    // Never run for runbooks without runs
    expect(screen.getAllByText('Never run')).toHaveLength(2);

    // getTimeAgo branches (dedup keeps 30s run, not the 2h one)
    expect(screen.getByText('Just now')).toBeTruthy();
    expect(screen.getByText('5m ago')).toBeTruthy();
    expect(screen.getByText('3h ago')).toBeTruthy();
    expect(screen.getByText('2d ago')).toBeTruthy();
  });

  it('shows the quiet 24h stat when there are no recent runs', () => {
    mockUseRunbooks.mockReturnValue(queryResult([makeRunbook()]));
    mockUseRunbookRuns.mockReturnValue(
      queryResult([makeRun({ Created: secondsAgo(3 * 24 * 60 * 60) })])
    );

    render(<RunbooksScreen />);

    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('Quiet 24h')).toBeTruthy();
  });

  it('navigates to the runbook screen when a runbook is pressed', () => {
    mockUseRunbooks.mockReturnValue(
      queryResult([makeRunbook({ Id: 'Runbooks-42', Name: 'Tap Me' })])
    );

    render(<RunbooksScreen />);

    fireEvent.press(screen.getByText('Tap Me'));

    expect(mockPush).toHaveBeenCalledWith('/runbook/Runbooks-42');
  });
});
