/**
 * Tests for the Deployments (Tasks) tab screen
 * Covers duration formatting (Number.parseInt / Number.parseFloat) and the
 * `item.IsCompleted && !!item.Duration` rendering branch, both ways.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useFocusEffect: () => {},
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/context/ThemeContext', () => {
  const actual = jest.requireActual('../../src/context/ThemeContext');
  return {
    ...actual,
    useColors: () => actual.darkColors,
  };
});

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useTasks: jest.fn(),
  useSpaces: jest.fn(),
}));

import { useAuth } from '../../src/context/AuthContext';
import { useTasks, useSpaces } from '../../src/hooks/useOctopusQuery';
import DeploymentsScreen from '../../app/(tabs)/deployments';

const mockUseAuth = useAuth as jest.Mock;
const mockUseTasks = useTasks as jest.Mock;
const mockUseSpaces = useSpaces as jest.Mock;

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  Id: 'ServerTasks-1',
  SpaceId: 'Spaces-1',
  Name: 'Deploy',
  Description: 'Deploy Web App release 1.0.0 to Production',
  State: 'Success',
  QueueTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  Duration: '00:01:23.456',
  IsCompleted: true,
  HasWarningsOrErrors: false,
  HasPendingInterruptions: false,
  ...overrides,
});

describe('DeploymentsScreen', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      currentSpace: { Id: 'Spaces-1', Name: 'Default' },
    });
    mockUseSpaces.mockReturnValue({
      data: [
        { Id: 'Spaces-1', Name: 'Default' },
        { Id: 'Spaces-2', Name: 'Sandbox' },
      ],
    });
    mockUseTasks.mockReturnValue({
      data: { Items: [] },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it('formats durations for completed tasks (minutes, hours and seconds)', () => {
    mockUseTasks.mockReturnValue({
      data: {
        Items: [
          makeTask({ Id: 'ServerTasks-1', Duration: '00:01:23.456', Description: 'Deploy A' }),
          makeTask({ Id: 'ServerTasks-2', Duration: '01:05:00', Description: 'Deploy B' }),
          makeTask({ Id: 'ServerTasks-3', Duration: '00:00:45.2', Description: 'Deploy C' }),
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<DeploymentsScreen />);

    expect(screen.getByText('1m 23s')).toBeTruthy();
    expect(screen.getByText('1h 5m')).toBeTruthy();
    expect(screen.getByText('45s')).toBeTruthy();
  });

  it('returns the raw duration string when it is not in hh:mm:ss format', () => {
    mockUseTasks.mockReturnValue({
      data: {
        Items: [makeTask({ Id: 'ServerTasks-4', Duration: '90 seconds', Description: 'Deploy D' })],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<DeploymentsScreen />);

    expect(screen.getByText('90 seconds')).toBeTruthy();
  });

  it('does not render a duration for incomplete tasks or tasks without a duration', () => {
    mockUseTasks.mockReturnValue({
      data: {
        Items: [
          // Executing task: no duration badge, shows progress instead
          makeTask({
            Id: 'ServerTasks-5',
            State: 'Executing',
            IsCompleted: false,
            Duration: '00:00:10',
            Description: 'Deploy In Progress',
          }),
          // Completed task with an empty duration string
          makeTask({ Id: 'ServerTasks-6', Duration: '', Description: 'Deploy No Duration' }),
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<DeploymentsScreen />);

    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.queryByText('10s')).toBeNull();
    // No duration badge icon rendered at all
    expect(screen.queryAllByText('time-outline')).toHaveLength(0);
  });

  it('renders warning and interruption banners', () => {
    mockUseTasks.mockReturnValue({
      data: {
        Items: [
          makeTask({
            Id: 'ServerTasks-7',
            State: 'Failed',
            HasWarningsOrErrors: true,
            HasPendingInterruptions: true,
          }),
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<DeploymentsScreen />);

    expect(screen.getByText('⚠️ Has warnings or errors')).toBeTruthy();
    expect(screen.getByText('⏸️ Awaiting intervention')).toBeTruthy();
  });

  it('navigates to the task screen when a task is pressed', () => {
    mockUseTasks.mockReturnValue({
      data: { Items: [makeTask({ Id: 'ServerTasks-42', Description: 'Deploy Tap Me' })] },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<DeploymentsScreen />);

    fireEvent.press(screen.getByText('Deploy Tap Me'));

    expect(mockPush).toHaveBeenCalledWith('/task/ServerTasks-42');
  });

  it('filters out tasks from other spaces until All Spaces is selected', () => {
    mockUseTasks.mockReturnValue({
      data: {
        Items: [
          makeTask({ Id: 'ServerTasks-8', SpaceId: 'Spaces-1', Description: 'Deploy Current Space' }),
          makeTask({ Id: 'ServerTasks-9', SpaceId: 'Spaces-2', Description: 'Deploy Other Space' }),
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<DeploymentsScreen />);

    expect(screen.getByText('Deploy Current Space')).toBeTruthy();
    expect(screen.queryByText('Deploy Other Space')).toBeNull();

    fireEvent.press(screen.getByText('All Spaces'));

    expect(screen.getByText('Deploy Other Space')).toBeTruthy();
    // Space tags shown when viewing all spaces
    expect(screen.getByText('Sandbox')).toBeTruthy();
  });

  it('passes filter states to useTasks when a filter tab is pressed', () => {
    render(<DeploymentsScreen />);

    fireEvent.press(screen.getByText('Failed'));

    expect(mockUseTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ states: ['Failed', 'TimedOut', 'Canceled'] })
    );
  });

  it('shows the empty state when there are no tasks', () => {
    render(<DeploymentsScreen />);

    expect(screen.getByText('No tasks found')).toBeTruthy();
  });

  it('shows an error view when loading tasks fails', () => {
    mockUseTasks.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Network request failed' },
      refetch: jest.fn(),
    });

    render(<DeploymentsScreen />);

    expect(screen.getByText('Network request failed')).toBeTruthy();
  });
});
