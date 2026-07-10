/**
 * Tests for the Dashboard (Home) tab screen
 * Covers loading / error / empty / populated states, the getTimeAgo helper
 * branches, favorites rendering and navigation from cards and links.
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

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/context/FavoritesContext', () => ({
  useFavorites: jest.fn(),
}));

jest.mock('../../src/context/DrawerContext', () => ({
  useDrawer: jest.fn(),
}));

jest.mock('../../src/context/ThemeContext', () => {
  const actual = jest.requireActual('../../src/context/ThemeContext');
  return {
    ...actual,
    useColors: () => actual.darkColors,
  };
});

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useDashboard: jest.fn(),
  useMachines: jest.fn(),
  useProjects: jest.fn(),
}));

import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { useDrawer } from '../../src/context/DrawerContext';
import { useDashboard, useMachines, useProjects } from '../../src/hooks/useOctopusQuery';
import { OctopusApiError } from '../../src/lib/api/client';
import DashboardScreen from '../../app/(tabs)/index';

const mockUseAuth = useAuth as jest.Mock;
const mockUseFavorites = useFavorites as jest.Mock;
const mockUseDrawer = useDrawer as jest.Mock;
const mockUseDashboard = useDashboard as jest.Mock;
const mockUseMachines = useMachines as jest.Mock;
const mockUseProjects = useProjects as jest.Mock;

const secondsAgo = (s: number) => new Date(Date.now() - s * 1000).toISOString();

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  Id: 'DashboardItems-1',
  DeploymentId: 'Deployments-1',
  ProjectId: 'Projects-1',
  EnvironmentId: 'Environments-1',
  ReleaseId: 'Releases-1',
  ReleaseVersion: '1.0.0',
  State: 'Success',
  Created: secondsAgo(30),
  IsCompleted: true,
  ...overrides,
});

const makeDashboard = (items: any[]) => ({
  Projects: [
    { Id: 'Projects-1', Name: 'Web App' },
    { Id: 'Projects-2', Name: 'API Service' },
  ],
  Environments: [
    { Id: 'Environments-1', Name: 'Production' },
    { Id: 'Environments-2', Name: 'Staging' },
  ],
  Tenants: [],
  Items: items,
  PreviousItems: [],
  IsFiltered: false,
});

describe('DashboardScreen', () => {
  const mockOpenDrawer = jest.fn();
  const mockRefetch = jest.fn();

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { DisplayName: 'Sean' },
      serverVersion: '2025.3',
    });
    mockUseFavorites.mockReturnValue({ favorites: [] });
    mockUseDrawer.mockReturnValue({ openDrawer: mockOpenDrawer });
    mockUseDashboard.mockReturnValue({
      data: makeDashboard([]),
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    mockUseMachines.mockReturnValue({ data: { Items: [] } });
    mockUseProjects.mockReturnValue({ data: { Items: [] } });
  });

  it('shows the loading screen while the dashboard loads', () => {
    mockUseDashboard.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<DashboardScreen />);

    expect(screen.getByText('Loading dashboard...')).toBeTruthy();
  });

  it('shows a generic error view and retries when Try Again is pressed', () => {
    mockUseDashboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Server unreachable' },
      refetch: mockRefetch,
    });

    render(<DashboardScreen />);

    expect(screen.getByText('Server unreachable')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    fireEvent.press(screen.getByText('Try Again'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('shows a permission error with a Select Space action for space access errors', () => {
    mockUseDashboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new OctopusApiError('You do not have access to this space', 403),
      refetch: mockRefetch,
    });

    render(<DashboardScreen />);

    expect(screen.getByText('Access Denied')).toBeTruthy();

    fireEvent.press(screen.getByText('Select Space'));
    expect(mockOpenDrawer).toHaveBeenCalled();
  });

  it('renders stats, recent deployments and time-ago labels for each branch', () => {
    mockUseDashboard.mockReturnValue({
      data: makeDashboard([
        makeItem({ Id: 'd1', DeploymentId: 'Deployments-1', State: 'Success', Created: secondsAgo(30) }),
        makeItem({
          Id: 'd2',
          DeploymentId: 'Deployments-2',
          State: 'Failed',
          Created: secondsAgo(5 * 60),
          ProjectId: 'Projects-2',
          ReleaseVersion: '2.0.0',
        }),
        makeItem({
          Id: 'd3',
          DeploymentId: 'Deployments-3',
          State: 'Executing',
          Created: secondsAgo(3 * 60 * 60),
          EnvironmentId: 'Environments-2',
          ReleaseVersion: '3.0.0',
        }),
        makeItem({
          Id: 'd4',
          DeploymentId: 'Deployments-4',
          State: 'Queued',
          Created: secondsAgo(2 * 24 * 60 * 60),
          ProjectId: 'Projects-unknown',
          EnvironmentId: 'Environments-unknown',
          ReleaseVersion: '4.0.0',
        }),
      ]),
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    mockUseMachines.mockReturnValue({
      data: {
        Items: [
          { Id: 'M1', HealthStatus: 'Healthy' },
          { Id: 'M2', HealthStatus: 'Healthy' },
          { Id: 'M3', HealthStatus: 'Unhealthy' },
          { Id: 'M4', HealthStatus: 'Unavailable' },
          { Id: 'M5', HealthStatus: 'HasWarnings' },
        ],
      },
    });

    render(<DashboardScreen />);

    // Welcome banner
    expect(screen.getByText('Sean')).toBeTruthy();
    expect(screen.getByText('v2025.3')).toBeTruthy();

    // Stats: 3 items in the last 24h, 5 targets
    expect(screen.getByText('In Progress')).toBeTruthy();
    expect(screen.getByText('24h')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Targets')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();

    // Recent deployments with project/environment lookups and fallbacks
    // (d1 and d3 both belong to Web App)
    expect(screen.getAllByText('Web App')).toHaveLength(2);
    expect(screen.getByText('API Service')).toBeTruthy();
    expect(screen.getByText('Unknown Project')).toBeTruthy();
    expect(screen.getByText('Unknown')).toBeTruthy();

    // getTimeAgo branches
    expect(screen.getByText('Just now')).toBeTruthy();
    expect(screen.getByText('5m ago')).toBeTruthy();
    expect(screen.getByText('3h ago')).toBeTruthy();
    expect(screen.getByText('2d ago')).toBeTruthy();

    // Pressing a deployment card navigates to the deployment
    // (most recent Web App deployment is d1)
    fireEvent.press(screen.getAllByText('Web App')[0]);
    expect(mockPush).toHaveBeenCalledWith('/deployment/Deployments-1');
  });

  it('falls back to a generic user name and shows the quiet 24h empty stats', () => {
    mockUseAuth.mockReturnValue({ user: null, serverVersion: '2025.3' });
    mockUseDashboard.mockReturnValue({
      data: makeDashboard([
        makeItem({ Id: 'old-1', Created: secondsAgo(3 * 24 * 60 * 60) }),
      ]),
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<DashboardScreen />);

    expect(screen.getByText('User')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('Quiet 24h')).toBeTruthy();
  });

  it('shows the empty state when there are no recent deployments', () => {
    render(<DashboardScreen />);

    expect(screen.getByText('No recent deployments')).toBeTruthy();
  });

  it('navigates to projects and targets from the overview cards', () => {
    render(<DashboardScreen />);

    fireEvent.press(screen.getByText('Projects'));
    expect(mockPush).toHaveBeenCalledWith('/projects');

    fireEvent.press(screen.getByText('Targets'));
    expect(mockPush).toHaveBeenCalledWith('/targets');
  });

  it('navigates to the full deployments list via See All', () => {
    render(<DashboardScreen />);

    fireEvent.press(screen.getByText('See All'));
    expect(mockPush).toHaveBeenCalledWith('/deployments');
  });

  it('renders favorite projects and navigates to a project when pressed', () => {
    mockUseFavorites.mockReturnValue({ favorites: ['Projects-1', 'Projects-2'] });
    mockUseProjects.mockReturnValue({
      data: {
        Items: [
          { Id: 'Projects-1', Name: 'Fav One' },
          { Id: 'Projects-2', Name: 'Fav Two' },
          { Id: 'Projects-3', Name: 'Not Favorited' },
        ],
      },
    });

    render(<DashboardScreen />);

    expect(screen.getByText('Favorites')).toBeTruthy();
    expect(screen.getByText('Fav One')).toBeTruthy();
    expect(screen.getByText('Fav Two')).toBeTruthy();
    expect(screen.queryByText('Not Favorited')).toBeNull();

    // First See All belongs to the Favorites section
    fireEvent.press(screen.getAllByText('See All')[0]);
    expect(mockPush).toHaveBeenCalledWith('/projects');

    fireEvent.press(screen.getByText('Fav One'));
    expect(mockPush).toHaveBeenCalledWith('/project/Projects-1');
  });
});
