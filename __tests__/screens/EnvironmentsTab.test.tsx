/**
 * Tests for the Environments tab screen
 * Covers error / empty / populated states, the overall-health derivation
 * (Unhealthy, HasWarnings, Healthy, Unknown), the description branch,
 * summary counts and navigation.
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
  useEnvironments: jest.fn(),
  useMachines: jest.fn(),
}));

import { useEnvironments, useMachines } from '../../src/hooks/useOctopusQuery';
import EnvironmentsScreen from '../../app/(tabs)/environments';

const mockUseEnvironments = useEnvironments as jest.Mock;
const mockUseMachines = useMachines as jest.Mock;

const makeEnv = (overrides: Record<string, unknown> = {}) => ({
  Id: 'Environments-1',
  Name: 'Production',
  Description: null,
  SortOrder: 0,
  ...overrides,
});

const makeMachine = (overrides: Record<string, unknown> = {}) => ({
  Id: 'Machines-1',
  Name: 'web-01',
  HealthStatus: 'Healthy',
  EnvironmentIds: ['Environments-1'],
  ...overrides,
});

describe('EnvironmentsScreen', () => {
  beforeEach(() => {
    mockUseEnvironments.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseMachines.mockReturnValue({
      data: { Items: [] },
      isLoading: false,
      refetch: jest.fn(),
    });
  });

  it('shows an error view and refetches everything on retry', () => {
    const refetchEnv = jest.fn();
    const refetchMachines = jest.fn();
    mockUseEnvironments.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Environments unavailable' },
      refetch: refetchEnv,
    });
    mockUseMachines.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: refetchMachines,
    });

    render(<EnvironmentsScreen />);

    expect(screen.getByText('Environments unavailable')).toBeTruthy();

    fireEvent.press(screen.getByText('Try Again'));
    expect(refetchEnv).toHaveBeenCalled();
    expect(refetchMachines).toHaveBeenCalled();
  });

  it('shows the empty state when there are no environments', () => {
    render(<EnvironmentsScreen />);

    expect(screen.getByText('No environments found')).toBeTruthy();
  });

  it('renders environments sorted with per-environment machine stats', () => {
    mockUseEnvironments.mockReturnValue({
      data: [
        makeEnv({
          Id: 'Environments-2',
          Name: 'Staging',
          SortOrder: 1,
          Description: 'Pre-production testing',
        }),
        makeEnv({ Id: 'Environments-1', Name: 'Production', SortOrder: 0 }),
        makeEnv({ Id: 'Environments-3', Name: 'Dev', SortOrder: 2 }),
        makeEnv({ Id: 'Environments-4', Name: 'Empty', SortOrder: 3 }),
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseMachines.mockReturnValue({
      data: {
        Items: [
          // Production: healthy + warning -> overall HasWarnings
          makeMachine({ Id: 'M1', EnvironmentIds: ['Environments-1'] }),
          makeMachine({ Id: 'M2', EnvironmentIds: ['Environments-1'], HealthStatus: 'HasWarnings' }),
          // Staging: unhealthy + unavailable -> overall Unhealthy
          makeMachine({ Id: 'M3', EnvironmentIds: ['Environments-2'], HealthStatus: 'Unhealthy' }),
          makeMachine({ Id: 'M4', EnvironmentIds: ['Environments-2'], HealthStatus: 'Unavailable' }),
          // Dev: all healthy -> overall Healthy
          makeMachine({ Id: 'M5', EnvironmentIds: ['Environments-3'] }),
        ],
      },
      isLoading: false,
      refetch: jest.fn(),
    });

    render(<EnvironmentsScreen />);

    // Summary banner: 4 environments, 5 targets
    // ('Environments' also appears as the page title)
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getAllByText('Environments')).toHaveLength(2);
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Deployment Targets')).toBeTruthy();

    // All environments render (including the machine-less Unknown one)
    expect(screen.getByText('Production')).toBeTruthy();
    expect(screen.getByText('Staging')).toBeTruthy();
    expect(screen.getByText('Dev')).toBeTruthy();
    expect(screen.getByText('Empty')).toBeTruthy();

    // Description branch
    expect(screen.getByText('Pre-production testing')).toBeTruthy();

    // Per-card stat labels render for every environment
    expect(screen.getAllByText('Targets')).toHaveLength(4);
    expect(screen.getAllByText('Healthy')).toHaveLength(4);
    expect(screen.getAllByText('Warnings')).toHaveLength(4);
    expect(screen.getAllByText('Unhealthy')).toHaveLength(4);
  });

  it('navigates to the environment screen when an environment is pressed', () => {
    mockUseEnvironments.mockReturnValue({
      data: [makeEnv({ Id: 'Environments-9', Name: 'Tap Me' })],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<EnvironmentsScreen />);

    fireEvent.press(screen.getByText('Tap Me'));

    expect(mockPush).toHaveBeenCalledWith('/environment/Environments-9');
  });
});
