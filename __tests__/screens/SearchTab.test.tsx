/**
 * Tests for the global Search tab screen
 * Covers the empty-state branches (no text / short text / no results),
 * section building for every result type, per-type navigation,
 * the release project-name fallback, and the include-variables toggle.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ActivityIndicator, Switch } from 'react-native';

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

jest.mock('@/src/context/ThemeContext', () => {
  const actual = jest.requireActual('@/src/context/ThemeContext');
  return {
    ...actual,
    useColors: () => actual.darkColors,
  };
});

jest.mock('@/src/hooks/useOctopusQuery', () => ({
  useGlobalSearch: jest.fn(),
}));

import { useGlobalSearch } from '@/src/hooks/useOctopusQuery';
import SearchScreen from '../../app/(tabs)/search';

const mockUseGlobalSearch = useGlobalSearch as jest.Mock;

const emptyResults = {
  projects: [],
  releases: [],
  deployments: [],
  runbooks: [],
  machines: [],
  environments: [],
  tenants: [],
  variables: [],
};

const setResults = (results: Record<string, unknown> | undefined, isLoading = false) => {
  mockUseGlobalSearch.mockReturnValue({
    data: results ? { ...emptyResults, ...results } : undefined,
    isLoading,
  });
};

const typeSearch = (text: string) => {
  fireEvent.changeText(
    screen.getByPlaceholderText('Search projects, releases, runbooks, variables...'),
    text
  );
};

describe('SearchScreen', () => {
  beforeEach(() => {
    setResults(undefined);
  });

  it('shows the initial empty state before any text is entered', () => {
    render(<SearchScreen />);

    expect(screen.getByText('Search Everything')).toBeTruthy();
    expect(
      screen.getByText(
        'Find projects, releases, deployments, runbooks, machines, environments, tenants, and variables'
      )
    ).toBeTruthy();
  });

  it('prompts for at least 2 characters and disables the query for short text', () => {
    render(<SearchScreen />);

    typeSearch('a');

    expect(screen.getByText('Type at least 2 characters to search')).toBeTruthy();
    expect(mockUseGlobalSearch).toHaveBeenLastCalledWith('a', {
      take: 10,
      enabled: false,
      includeVariables: false,
    });
  });

  it('shows a spinner while searching and no empty state', () => {
    setResults(undefined, true);

    render(<SearchScreen />);
    typeSearch('web');

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(screen.queryByText(/No results found/)).toBeNull();
    expect(mockUseGlobalSearch).toHaveBeenLastCalledWith('web', {
      take: 10,
      enabled: true,
      includeVariables: false,
    });
  });

  it('shows the no-results state when the search returns nothing', () => {
    setResults({});

    render(<SearchScreen />);
    typeSearch('xyz');

    expect(screen.getByText(/No results found for/)).toBeTruthy();
  });

  it('renders project and release sections and navigates on press', () => {
    setResults({
      projects: [
        { Id: 'Projects-1', Name: 'Alpha Project', Description: 'First project' },
        { Id: 'Projects-2', Name: 'Beta Project', Description: '' },
      ],
      releases: [
        { Id: 'Releases-1', Version: '1.2.3', ProjectId: 'Projects-1' },
        { Id: 'Releases-2', Version: '4.5.6', ProjectId: 'Projects-99' },
      ],
    });

    render(<SearchScreen />);
    typeSearch('al');

    expect(screen.getByText('Projects')).toBeTruthy();
    expect(screen.getByText('Releases')).toBeTruthy();
    expect(screen.getAllByText('(2)')).toHaveLength(2);

    // Project description subtitle rendered only when present
    expect(screen.getByText('First project')).toBeTruthy();

    // Release subtitle: known project name (item + subtitle) vs. "Project N" fallback
    expect(screen.getAllByText('Alpha Project')).toHaveLength(2);
    expect(screen.getByText('Project 99')).toBeTruthy();

    fireEvent.press(screen.getByText('Beta Project'));
    expect(mockPush).toHaveBeenCalledWith('/project/Projects-2');

    fireEvent.press(screen.getByText('1.2.3'));
    expect(mockPush).toHaveBeenCalledWith('/release/Releases-1');
  });

  it('renders deployment and runbook sections and navigates on press', () => {
    setResults({
      deployments: [{ Id: 'Deployments-1', Name: 'Deploy to Prod' }],
      runbooks: [
        { Id: 'Runbooks-1', Name: 'Restart Services', Description: 'Restarts everything' },
        { Id: 'Runbooks-2', Name: 'Backup DB', Description: '' },
      ],
    });

    render(<SearchScreen />);
    typeSearch('re');

    expect(screen.getByText('Deployments')).toBeTruthy();
    expect(screen.getByText('Runbooks')).toBeTruthy();
    expect(screen.getByText('Restarts everything')).toBeTruthy();

    fireEvent.press(screen.getByText('Deploy to Prod'));
    expect(mockPush).toHaveBeenCalledWith('/deployment/Deployments-1');

    fireEvent.press(screen.getByText('Restart Services'));
    expect(mockPush).toHaveBeenCalledWith('/runbook/Runbooks-1');
  });

  it('renders machine and environment sections and navigates on press', () => {
    setResults({
      machines: [
        { Id: 'Machines-1', Name: 'Machine One', Roles: ['web', 'db'] },
        { Id: 'Machines-2', Name: 'Machine Two' },
      ],
      environments: [{ Id: 'Environments-1', Name: 'Production' }],
    });

    render(<SearchScreen />);
    typeSearch('ma');

    expect(screen.getByText('Machines')).toBeTruthy();
    expect(screen.getByText('Environments')).toBeTruthy();
    // Roles joined as the machine subtitle
    expect(screen.getByText('web, db')).toBeTruthy();

    fireEvent.press(screen.getByText('Machine One'));
    expect(mockPush).toHaveBeenCalledWith('/machine/Machines-1');

    fireEvent.press(screen.getByText('Production'));
    expect(mockPush).toHaveBeenCalledWith('/environment/Environments-1');
  });

  it('renders tenant and variable sections and navigates on press', () => {
    setResults({
      tenants: [
        { Id: 'Tenants-1', Name: 'Tenant One', Description: 'Big customer' },
        { Id: 'Tenants-2', Name: 'Tenant Two' },
      ],
      variables: [
        { id: 'var-1', type: 'variable', name: 'ConnectionString', subtitle: 'Alpha Project', projectId: 'Projects-1' },
        { id: 'var-2', type: 'variable', name: 'OrphanVar' },
      ],
    });

    render(<SearchScreen />);
    typeSearch('te');

    expect(screen.getByText('Tenants')).toBeTruthy();
    expect(screen.getByText('Variables')).toBeTruthy();
    expect(screen.getByText('Big customer')).toBeTruthy();

    fireEvent.press(screen.getByText('Tenant One'));
    expect(mockPush).toHaveBeenCalledWith('/tenant/Tenants-1');

    fireEvent.press(screen.getByText('ConnectionString'));
    expect(mockPush).toHaveBeenCalledWith('/project/Projects-1/variables');

    // Variables without a projectId do not navigate
    mockPush.mockClear();
    fireEvent.press(screen.getByText('OrphanVar'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('passes the include-variables toggle through to useGlobalSearch', () => {
    render(<SearchScreen />);

    expect(screen.getByText('Include Variables')).toBeTruthy();

    fireEvent(screen.UNSAFE_getByType(Switch), 'valueChange', true);

    expect(mockUseGlobalSearch).toHaveBeenLastCalledWith('', {
      take: 10,
      enabled: false,
      includeVariables: true,
    });
  });
});
