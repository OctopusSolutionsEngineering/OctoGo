/**
 * Tests for the Tenants tab screen
 * Covers tenant list rendering (tag badges, project counts, logo fallback),
 * tag filtering, debounced search, navigation, refresh, and the
 * loading / error / empty states.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { RefreshControl, Image } from 'react-native';

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
  useTenants: jest.fn(),
  useTagSets: jest.fn(),
}));

jest.mock('../../src/lib/security', () => ({
  getCredentials: jest.fn(),
}));

jest.mock('../../src/lib/api/client', () => ({
  buildTenantLogoUrl: jest.fn(),
}));

import { useTenants, useTagSets } from '../../src/hooks/useOctopusQuery';
import { getCredentials } from '../../src/lib/security';
import { buildTenantLogoUrl } from '../../src/lib/api/client';
import TenantsScreen from '../../app/(tabs)/tenants';

const mockUseTenants = useTenants as jest.Mock;
const mockUseTagSets = useTagSets as jest.Mock;
const mockGetCredentials = getCredentials as jest.Mock;
const mockBuildTenantLogoUrl = buildTenantLogoUrl as jest.Mock;

const tagSets = [
  {
    Id: 'TagSets-1',
    Name: 'Release Ring',
    Tags: [
      { Id: 'Tags-1', Name: 'Stable', CanonicalTagName: 'Release Ring/Stable' },
      { Id: 'Tags-2', Name: 'Alpha', CanonicalTagName: 'Release Ring/Alpha' },
      { Id: 'Tags-3', Name: 'Beta', CanonicalTagName: 'Release Ring/Beta' },
      { Id: 'Tags-4', Name: 'Enterprise', CanonicalTagName: 'Release Ring/Enterprise' },
    ],
  },
];

const makeTenant = (overrides: Record<string, unknown> = {}) => ({
  Id: 'Tenants-1',
  Name: 'Acme Corp',
  TenantTags: [] as string[],
  ProjectEnvironments: {},
  ...overrides,
});

// Tag colour branches: Stable (success), Alpha (warning), Beta (info),
// Enterprise (default) -> shown as "+1" overflow. Also an unknown canonical
// tag and an untagged tenant.
const tenants = [
  makeTenant({
    Id: 'Tenants-1',
    Name: 'Acme Corp',
    TenantTags: [
      'Release Ring/Stable',
      'Release Ring/Alpha',
      'Release Ring/Beta',
      'Release Ring/Enterprise',
    ],
    ProjectEnvironments: { 'Projects-1': {}, 'Projects-2': {} },
  }),
  makeTenant({
    Id: 'Tenants-2',
    Name: 'Beta LLC',
    ProjectEnvironments: { 'Projects-1': {} },
  }),
  makeTenant({
    Id: 'Tenants-3',
    Name: 'Mystery Inc',
    TenantTags: ['Unknown/Foo'],
  }),
];

const setTenants = (items: unknown[], extra: Record<string, unknown> = {}) => {
  mockUseTenants.mockReturnValue({
    data: { Items: items },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
    ...extra,
  });
};

// Flush the pending getCredentials promise inside act()
const flush = () => act(async () => {});

describe('TenantsScreen', () => {
  beforeEach(() => {
    mockGetCredentials.mockResolvedValue({
      serverUrl: 'https://octo.test',
      apiKey: 'API-KEY',
      spaceId: 'Spaces-1',
    });
    mockBuildTenantLogoUrl.mockReturnValue('https://octo.test/logo.png');
    mockUseTagSets.mockReturnValue({ data: tagSets });
    setTenants(tenants);
  });

  it('shows the loading screen while tenants load', async () => {
    setTenants([], { data: undefined, isLoading: true });

    render(<TenantsScreen />);
    await flush();

    expect(screen.getByText('Loading tenants...')).toBeTruthy();
  });

  it('shows an error view when loading tenants fails', async () => {
    setTenants([], { data: undefined, error: { message: 'Tenants unavailable' } });

    render(<TenantsScreen />);
    await flush();

    expect(screen.getByText('Tenants unavailable')).toBeTruthy();
  });

  it('shows the empty state when there are no tenants', async () => {
    setTenants([]);
    mockUseTagSets.mockReturnValue({ data: undefined });

    render(<TenantsScreen />);
    await flush();

    expect(screen.getByText('No tenants')).toBeTruthy();
    expect(screen.getByText('Create your first tenant in Octopus Deploy')).toBeTruthy();
    // No tag filter row without tag sets
    expect(screen.queryByText('Filter by tags:')).toBeNull();
  });

  it('shows a search-specific empty state when a search has no matches', async () => {
    setTenants([]);

    render(<TenantsScreen />);
    await flush();

    fireEvent.changeText(screen.getByPlaceholderText('Search tenants...'), 'zzz');

    expect(screen.getByText('No tenants found')).toBeTruthy();
    expect(screen.getByText('No tenants match "zzz"')).toBeTruthy();

    // Clear button resets the search text
    fireEvent.press(screen.getByText('close-circle'));
    expect(screen.getByText('No tenants')).toBeTruthy();
  });

  it('renders tenants with tag badges, overflow badge and project counts', async () => {
    render(<TenantsScreen />);
    await flush();

    expect(screen.getByText('3 tenants')).toBeTruthy();
    expect(screen.getByText('Acme Corp')).toBeTruthy();
    expect(screen.getByText('Beta LLC')).toBeTruthy();
    expect(screen.getByText('Mystery Inc')).toBeTruthy();

    // Three visible badges plus the "+1" overflow for the fourth tag
    expect(screen.getAllByText('Stable')).toHaveLength(2); // filter pill + badge
    expect(screen.getAllByText('Alpha')).toHaveLength(2);
    expect(screen.getAllByText('Beta')).toHaveLength(2);
    expect(screen.getByText('+1')).toBeTruthy();

    // Unknown canonical tag falls back to the part after the slash
    expect(screen.getByText('Foo')).toBeTruthy();

    // Project counts: plural and singular
    expect(screen.getByText('2 projects')).toBeTruthy();
    expect(screen.getAllByText('1 project')).toHaveLength(1);
    expect(screen.getByText('0 projects')).toBeTruthy();

    expect(screen.getByText('Filter by tags:')).toBeTruthy();
  });

  it('filters tenants by selected tags and toggles the tag off again', async () => {
    render(<TenantsScreen />);
    await flush();

    // The first "Stable" text is the filter pill (filters render above the list)
    fireEvent.press(screen.getAllByText('Stable')[0]);

    expect(screen.getByText('1 tenant')).toBeTruthy();
    expect(screen.getByText('Acme Corp')).toBeTruthy();
    expect(screen.queryByText('Beta LLC')).toBeNull();
    expect(screen.queryByText('Mystery Inc')).toBeNull();

    fireEvent.press(screen.getAllByText('Stable')[0]);

    expect(screen.getByText('3 tenants')).toBeTruthy();
    expect(screen.getByText('Beta LLC')).toBeTruthy();
  });

  it('debounces the search text before passing it to useTenants', async () => {
    jest.useFakeTimers();
    try {
      render(<TenantsScreen />);
      await flush();

      fireEvent.changeText(screen.getByPlaceholderText('Search tenants...'), 'acme');

      // Not yet debounced
      expect(mockUseTenants).toHaveBeenLastCalledWith({ searchText: undefined, take: 500 });

      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(mockUseTenants).toHaveBeenLastCalledWith({ searchText: 'acme', take: 500 });
    } finally {
      jest.useRealTimers();
    }
  });

  it('navigates to the tenant when a card is pressed', async () => {
    render(<TenantsScreen />);
    await flush();

    fireEvent.press(screen.getByText('Acme Corp'));

    expect(mockPush).toHaveBeenCalledWith('/tenant/Tenants-1');
  });

  it('renders tenant logos and falls back to the icon when the image errors', async () => {
    render(<TenantsScreen />);
    await flush();

    const images = screen.UNSAFE_getAllByType(Image);
    expect(images).toHaveLength(3);
    expect(mockBuildTenantLogoUrl).toHaveBeenCalledWith(
      'https://octo.test',
      'Spaces-1',
      'Tenants-1',
      'API-KEY'
    );

    // PageTitle renders one "business" icon; no fallbacks yet
    expect(screen.getAllByText('business')).toHaveLength(1);

    fireEvent(images[0], 'error');

    expect(screen.getAllByText('business')).toHaveLength(2);
    expect(screen.UNSAFE_getAllByType(Image)).toHaveLength(2);
  });

  it('uses the fallback icon for all tenants when credentials are missing', async () => {
    mockGetCredentials.mockResolvedValue(null);

    render(<TenantsScreen />);
    await flush();

    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
    // PageTitle icon + three fallback icons
    expect(screen.getAllByText('business')).toHaveLength(4);
    expect(mockBuildTenantLogoUrl).not.toHaveBeenCalled();
  });

  it('groups tenants sharing a tag and handles slash-less canonical tags', async () => {
    setTenants([
      makeTenant({ Id: 'Tenants-10', Name: 'Ten A', TenantTags: ['Release Ring/Stable'] }),
      makeTenant({ Id: 'Tenants-11', Name: 'Ten B', TenantTags: ['Release Ring/Stable'] }),
      // Canonical tag without a slash and not in any tag set
      makeTenant({ Id: 'Tenants-12', Name: 'Ten C', TenantTags: ['NoSlashTag'] }),
      makeTenant({ Id: 'Tenants-13', Name: 'Ten D' }),
      makeTenant({ Id: 'Tenants-14', Name: 'Ten E' }),
    ]);

    render(<TenantsScreen />);
    await flush();

    expect(screen.getByText('5 tenants')).toBeTruthy();
    // Slash-less unknown tag falls back to the raw canonical name
    expect(screen.getByText('NoSlashTag')).toBeTruthy();
    expect(screen.getByText('Ten A')).toBeTruthy();
    expect(screen.getByText('Ten E')).toBeTruthy();
  });

  it('refetches when pull-to-refresh is triggered', async () => {
    const refetch = jest.fn();
    setTenants(tenants, { refetch });

    render(<TenantsScreen />);
    await flush();

    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');

    expect(refetch).toHaveBeenCalled();
  });
});
