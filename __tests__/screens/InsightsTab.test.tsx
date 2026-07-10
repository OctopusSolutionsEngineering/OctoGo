/**
 * Tests for the Insights tab screen
 * Covers the duration parsing (Number.parseInt / Number.parseFloat) in the
 * average-duration metric, including malformed duration strings.
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

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useDashboard: jest.fn(),
}));

import { useDashboard } from '../../src/hooks/useOctopusQuery';
import InsightsScreen from '../../app/(tabs)/insights';

const mockUseDashboard = useDashboard as jest.Mock;

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  Id: 'DashboardItems-1',
  ProjectId: 'Projects-1',
  EnvironmentId: 'Environments-1',
  ReleaseId: 'Releases-1',
  State: 'Success',
  Created: hoursAgo(1),
  IsCompleted: true,
  Duration: '00:01:30',
  ...overrides,
});

const dashboard = {
  Projects: [
    { Id: 'Projects-1', Name: 'Web App' },
    { Id: 'Projects-2', Name: 'API Service' },
  ],
  Environments: [
    { Id: 'Environments-1', Name: 'Production' },
    { Id: 'Environments-2', Name: 'Staging' },
  ],
  Tenants: [],
  Items: [
    // 90 seconds
    makeItem({ Id: 'd1', Created: hoursAgo(1) }),
    // 1 hour and half a second -> exercises hours/minutes/seconds parsing
    makeItem({
      Id: 'd2',
      Duration: '01:00:00.5',
      State: 'Failed',
      ProjectId: 'Projects-2',
      EnvironmentId: 'Environments-2',
      Created: hoursAgo(2),
    }),
    // Malformed duration (fewer than 3 parts) -> contributes 0 seconds
    makeItem({ Id: 'd3', Duration: '90', Created: hoursAgo(30) }),
    // Unparseable seconds -> Number.parseFloat falls back to 0
    makeItem({ Id: 'd5', Duration: '00:00:bad', Created: hoursAgo(30) }),
    // Not completed -> excluded from average duration
    makeItem({ Id: 'd4', IsCompleted: false, Duration: '00:10:00', Created: hoursAgo(3) }),
  ],
  PreviousItems: [],
  IsFiltered: false,
};

describe('InsightsScreen', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      data: dashboard,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it('computes the average duration from completed deployments', () => {
    render(<InsightsScreen />);

    // Completed with duration: 90s + 3600.5s + 0s + 0s (malformed) over
    // 4 items = 922.6s -> rounds to 15m
    expect(screen.getByText('15m')).toBeTruthy();
    expect(screen.getByText('Avg Duration')).toBeTruthy();
  });

  it('shows deployment totals and per-project / per-environment breakdowns', () => {
    render(<InsightsScreen />);

    expect(screen.getByText('Total Deploys')).toBeTruthy();
    expect(screen.getByText(/Based on 5 deployments/)).toBeTruthy();
    expect(screen.getByText('Web App')).toBeTruthy();
    expect(screen.getByText('API Service')).toBeTruthy();
    expect(screen.getByText('Production')).toBeTruthy();
    expect(screen.getByText('Staging')).toBeTruthy();
  });

  it('recomputes metrics when the time range changes', () => {
    render(<InsightsScreen />);

    fireEvent.press(screen.getByText('24 Hours'));

    // The 30h-old items drop out of range: 3 deployments remain
    expect(screen.getByText(/Based on 3 deployments/)).toBeTruthy();
    // Average now (90 + 3600.5) / 2 = 1845.25s -> 31m
    expect(screen.getByText('31m')).toBeTruthy();
  });

  it('shows the loading screen while the dashboard loads', () => {
    mockUseDashboard.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(<InsightsScreen />);

    expect(screen.getByText('Loading insights...')).toBeTruthy();
  });

  it('shows an error view when the dashboard fails to load', () => {
    mockUseDashboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Dashboard unavailable' },
      refetch: jest.fn(),
    });

    render(<InsightsScreen />);

    expect(screen.getByText('Dashboard unavailable')).toBeTruthy();
  });
});
