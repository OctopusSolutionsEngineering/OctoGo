/**
 * Tests for the Tenant detail screen (app/tenant/[id].tsx)
 * Covers loading / error / not-found states, tenant header (logo + fallback),
 * tag parsing, connected projects with deployment status, collapsible
 * sections, navigation and refresh.
 */

import React from 'react';
import { Image, RefreshControl } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
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
  useTenant: jest.fn(),
  useProjects: jest.fn(),
  useEnvironments: jest.fn(),
  useTagSets: jest.fn(),
  useDashboard: jest.fn(),
}));

jest.mock('../../src/lib/security', () => ({
  getCredentials: jest.fn(),
}));

jest.mock('../../src/lib/api/client', () => ({
  buildTenantLogoUrl: jest.fn(),
}));

import {
  useTenant,
  useProjects,
  useEnvironments,
  useTagSets,
  useDashboard,
} from '../../src/hooks/useOctopusQuery';
import { getCredentials } from '../../src/lib/security';
import { buildTenantLogoUrl } from '../../src/lib/api/client';
import TenantDetailScreen from '../../app/tenant/[id]';

const mockUseTenant = useTenant as jest.Mock;
const mockUseProjects = useProjects as jest.Mock;
const mockUseEnvironments = useEnvironments as jest.Mock;
const mockUseTagSets = useTagSets as jest.Mock;
const mockUseDashboard = useDashboard as jest.Mock;
const mockGetCredentials = getCredentials as jest.Mock;
const mockBuildTenantLogoUrl = buildTenantLogoUrl as jest.Mock;

const TENANT_ID = 'Tenants-1';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const makeTenant = (overrides: Record<string, unknown> = {}) => ({
  Id: TENANT_ID,
  SpaceId: 'Spaces-1',
  Name: 'Acme Corp',
  Description: 'Main customer tenant',
  ClonedFromTenantId: 'Tenants-0',
  TenantTags: ['Ring/Beta', 'Other/Gamma'],
  ProjectEnvironments: {
    'Projects-1': ['Environments-1', 'Environments-2'],
    'Projects-404': ['Environments-404'],
  },
  ...overrides,
});

describe('TenantDetailScreen', () => {
  const refetch = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: TENANT_ID });

    // Never resolves by default so tests stay synchronous; the logo test overrides it
    mockGetCredentials.mockReturnValue(new Promise(() => {}));
    mockBuildTenantLogoUrl.mockReturnValue('https://octo.example.com/tenant-logo.png');

    mockUseTenant.mockReturnValue({
      data: makeTenant(),
      isLoading: false,
      error: null,
      refetch,
      isRefetching: false,
    });
    mockUseProjects.mockReturnValue({
      data: { Items: [{ Id: 'Projects-1', Name: 'Web App' }] },
    });
    mockUseEnvironments.mockReturnValue({
      data: [
        { Id: 'Environments-1', Name: 'Dev' },
        { Id: 'Environments-2', Name: 'Prod' },
      ],
    });
    mockUseTagSets.mockReturnValue({
      data: [{ Name: 'Ring', Tags: [{ Name: 'Beta', Description: '#00FF00' }] }],
    });
    mockUseDashboard.mockReturnValue({
      data: {
        Items: [
          {
            ProjectId: 'Projects-1',
            EnvironmentId: 'Environments-1',
            TenantId: TENANT_ID,
            State: 'Success',
            ReleaseVersion: '1.0.0',
          },
        ],
      },
    });
  });

  it('shows the loading screen while the tenant loads', () => {
    mockUseTenant.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch, isRefetching: false });

    render(<TenantDetailScreen />);

    expect(screen.getByText('Loading tenant...')).toBeTruthy();
  });

  it('shows an error view with retry when loading fails', () => {
    mockUseTenant.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'tenant boom' },
      refetch,
      isRefetching: false,
    });

    render(<TenantDetailScreen />);

    expect(screen.getByText('Failed to load tenant')).toBeTruthy();
    expect(screen.getByText('tenant boom')).toBeTruthy();
    fireEvent.press(screen.getByText('Try Again'));
    expect(refetch).toHaveBeenCalled();
  });

  it('falls back to a generic error message when the error has none', () => {
    mockUseTenant.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: {},
      refetch,
      isRefetching: false,
    });

    render(<TenantDetailScreen />);

    expect(screen.getByText('An error occurred')).toBeTruthy();
  });

  it('shows a not-found error when the tenant is missing', () => {
    mockUseTenant.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch, isRefetching: false });

    render(<TenantDetailScreen />);

    expect(screen.getByText('Tenant Not Found')).toBeTruthy();
    expect(screen.getByText('The requested tenant could not be found')).toBeTruthy();
  });

  it('renders header, tags and connected projects with deployment status', () => {
    render(<TenantDetailScreen />);

    // Header (fallback icon because credentials are still loading)
    expect(screen.getByText('Acme Corp')).toBeTruthy();
    expect(screen.getByText('Main customer tenant')).toBeTruthy();
    expect(screen.getByText('business')).toBeTruthy();

    // Tag parsing: known tag and unknown tag-set fallback
    expect(screen.getByText('Release Ring')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();

    // Overview expanded by default: projects with name fallbacks
    expect(screen.getByText('Projects (2)')).toBeTruthy();
    expect(screen.getByText('Web App')).toBeTruthy();
    expect(screen.getByText('Projects-404')).toBeTruthy();
    expect(screen.getByText('Dev')).toBeTruthy();
    expect(screen.getByText('Prod')).toBeTruthy();
    expect(screen.getByText('Environments-404')).toBeTruthy();

    // Deployment status for Dev; the other environments have no deployment
    expect(screen.getByText(/Success/)).toBeTruthy();
    expect(screen.getByText('1.0.0')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(2);

    // Navigate to the project
    fireEvent.press(screen.getByText('Web App'));
    expect(Haptics.impactAsync).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/project/Projects-1');
  });

  it('expands and collapses the sections', () => {
    render(<TenantDetailScreen />);

    // Variables section starts collapsed
    expect(screen.queryByText('No variables')).toBeNull();
    fireEvent.press(screen.getByText('Variables'));
    expect(screen.getByText('No variables')).toBeTruthy();

    // Settings section
    fireEvent.press(screen.getByText('Settings'));
    expect(screen.getByText('Tenant ID')).toBeTruthy();
    expect(screen.getByText(TENANT_ID)).toBeTruthy();
    expect(screen.getByText('Space ID')).toBeTruthy();
    expect(screen.getByText('Spaces-1')).toBeTruthy();
    expect(screen.getByText('Cloned From')).toBeTruthy();
    expect(screen.getByText('Tenants-0')).toBeTruthy();

    // Collapse the overview
    expect(screen.getByText('Projects (2)')).toBeTruthy();
    fireEvent.press(screen.getByText('Overview'));
    expect(screen.queryByText('Projects (2)')).toBeNull();

    // Collapse variables again
    fireEvent.press(screen.getByText('Variables'));
    expect(screen.queryByText('No variables')).toBeNull();
  });

  it('renders a minimal tenant with no tags, projects or clone info', () => {
    mockUseTenant.mockReturnValue({
      data: makeTenant({
        Description: undefined,
        ClonedFromTenantId: undefined,
        TenantTags: undefined,
        ProjectEnvironments: undefined,
      }),
      isLoading: false,
      error: null,
      refetch,
      isRefetching: false,
    });
    mockUseProjects.mockReturnValue({ data: undefined });
    mockUseEnvironments.mockReturnValue({ data: undefined });
    mockUseTagSets.mockReturnValue({ data: undefined });
    mockUseDashboard.mockReturnValue({ data: undefined });

    render(<TenantDetailScreen />);

    expect(screen.getByText('Projects (0)')).toBeTruthy();
    expect(screen.getByText('No projects')).toBeTruthy();
    expect(screen.queryByText('Release Ring')).toBeNull();

    fireEvent.press(screen.getByText('Settings'));
    expect(screen.queryByText('Cloned From')).toBeNull();

    // Pull-to-refresh
    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
    expect(refetch).toHaveBeenCalled();
  });

  it('renders the tenant logo once credentials load and falls back on image error', async () => {
    mockGetCredentials.mockResolvedValue({
      serverUrl: 'https://octo.example.com',
      apiKey: 'API-KEY',
      spaceId: 'Spaces-1',
    });

    render(<TenantDetailScreen />);

    await waitFor(() => {
      expect(screen.UNSAFE_getByType(Image)).toBeTruthy();
    });
    expect(mockBuildTenantLogoUrl).toHaveBeenCalledWith(
      'https://octo.example.com',
      'Spaces-1',
      TENANT_ID,
      'API-KEY'
    );
    expect(screen.queryByText('business')).toBeNull();

    // Simulate the image failing to load -> fallback icon
    fireEvent(screen.UNSAFE_getByType(Image), 'error');
    expect(screen.getByText('business')).toBeTruthy();
  });
});
