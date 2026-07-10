/**
 * Tests for the project Variables viewer screen (app/project/[id]/variables.tsx)
 * Covers loading / error states, sensitive-value masking, expanded variable
 * details (value, scope display, description, type/prompt/read-only badges),
 * search filtering, scope filter tabs + scope value chips, and refresh.
 */

import React from 'react';
import { RefreshControl } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';

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
  useProjectVariables: jest.fn(),
}));

import { useProjectVariables } from '../../src/hooks/useOctopusQuery';
import VariablesScreen from '../../app/project/[id]/variables';

// The screen uses react-native's deprecated SafeAreaView, which is resolved
// through a lazy getter. Rendering LoadingScreen first (the loading test)
// breaks that lazy require, so prime the getter before any test renders.
void require('react-native').SafeAreaView;

const mockUseProjectVariables = useProjectVariables as jest.Mock;

const variableFixtures = [
  {
    Id: 'var-1',
    Name: 'ApiUrl',
    Value: 'https://api.example.com',
    IsSensitive: false,
    Type: 'String',
    IsEditable: true,
    Description: 'Base API url',
    Prompt: { Label: 'API' },
    Scope: {
      Environment: ['Environments-1', 'Environments-404'],
      Role: ['role-web'],
      Machine: ['Machines-1'],
      Channel: ['Channels-1'],
      Action: ['Actions-1'],
    },
  },
  {
    Id: 'var-2',
    Name: 'DbPassword',
    Value: 'super-secret',
    IsSensitive: true,
    Type: 'Sensitive',
    IsEditable: false,
    Scope: { Environment: ['Environments-1'] },
  },
  {
    Id: 'var-3',
    Name: 'EmptyVar',
    Value: '',
    IsSensitive: false,
    Type: 'String',
    IsEditable: true,
    Scope: undefined,
  },
];

const makeVariableSet = (overrides: Record<string, unknown> = {}) => ({
  Id: 'variableset-Projects-1',
  Variables: variableFixtures,
  ScopeValues: {
    Environments: [{ Id: 'Environments-1', Name: 'Dev' }],
    Roles: [{ Id: 'role-web', Name: 'web-server' }],
    Machines: [{ Id: 'Machines-1', Name: 'Web01' }],
    Channels: [{ Id: 'Channels-1', Name: 'Default' }],
    Actions: [{ Id: 'Actions-1', Name: 'Deploy Step' }],
  },
  ...overrides,
});

describe('VariablesScreen', () => {
  const refetch = jest.fn();

  beforeEach(() => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'Projects-1' });

    mockUseProjectVariables.mockReturnValue({
      data: makeVariableSet(),
      isLoading: false,
      error: null,
      refetch,
      isRefetching: false,
    });
  });

  it('shows the loading screen while variables load', () => {
    mockUseProjectVariables.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch,
      isRefetching: false,
    });

    render(<VariablesScreen />);

    expect(screen.getByText('Loading variables...')).toBeTruthy();
  });

  it('shows an error view with retry and a message fallback', () => {
    mockUseProjectVariables.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: {},
      refetch,
      isRefetching: false,
    });

    render(<VariablesScreen />);

    expect(screen.getByText('Failed to load variables')).toBeTruthy();
    expect(screen.getByText('An error occurred')).toBeTruthy();
    fireEvent.press(screen.getByText('Try Again'));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders the variable list with sensitive masking and expands details', () => {
    render(<VariablesScreen />);

    // Sorted list with count header
    expect(screen.getByText('3 variables')).toBeTruthy();
    expect(screen.getByText('ApiUrl')).toBeTruthy();
    expect(screen.getByText('DbPassword')).toBeTruthy();
    expect(screen.getByText('EmptyVar')).toBeTruthy();

    // Collapsed previews: sensitive mask, value, empty fallback
    expect(screen.getByText('••••••••')).toBeTruthy();
    expect(screen.getByText('https://api.example.com')).toBeTruthy();
    expect(screen.getByText('(empty)')).toBeTruthy();

    // Expand ApiUrl: full scope display incl. unknown-id fallback, description, badges
    fireEvent.press(screen.getByText('ApiUrl'));
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(
      screen.getByText(
        'Env: Dev, Environments-404 | Role: web-server | Machine: Web01 | Channel: Default | Step: Deploy Step'
      )
    ).toBeTruthy();
    expect(screen.getByText('Base API url')).toBeTruthy();
    expect(screen.getByText('String')).toBeTruthy();
    expect(screen.getByText('Prompted')).toBeTruthy();
    expect(screen.queryByText('Read-only')).toBeNull();

    // Expand DbPassword: masked expanded value, read-only badge, single-env scope
    fireEvent.press(screen.getByText('DbPassword'));
    expect(screen.getByText('••••••••••••••')).toBeTruthy();
    expect(screen.queryByText('super-secret')).toBeNull();
    expect(screen.getByText('Read-only')).toBeTruthy();
    expect(screen.getByText('Env: Dev')).toBeTruthy();

    // Expand EmptyVar: no scope section is rendered
    fireEvent.press(screen.getByText('EmptyVar'));
    expect(screen.getAllByText('Value').length).toBe(3);
    expect(screen.getAllByText('Scope').length).toBe(2);

    // Collapse ApiUrl again
    fireEvent.press(screen.getByText('ApiUrl'));
    expect(screen.queryByText('Base API url')).toBeNull();

    // Pull-to-refresh
    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
    expect(refetch).toHaveBeenCalled();
  });

  it('filters variables by search text (name and non-sensitive value only)', () => {
    render(<VariablesScreen />);

    const search = screen.getByPlaceholderText('Search variables...');

    // Name match
    fireEvent.changeText(search, 'apiurl');
    expect(screen.getByText('1 variable')).toBeTruthy();
    expect(screen.getByText('ApiUrl')).toBeTruthy();
    expect(screen.queryByText('DbPassword')).toBeNull();

    // Value match
    fireEvent.changeText(search, 'example.com');
    expect(screen.getByText('ApiUrl')).toBeTruthy();

    // Sensitive values are not searched
    fireEvent.changeText(search, 'super-secret');
    expect(screen.getByText('No Variables Found')).toBeTruthy();
    expect(screen.getByText('No variables match "super-secret"')).toBeTruthy();

    // Clearing the search restores the list
    fireEvent.changeText(search, '');
    expect(screen.getByText('3 variables')).toBeTruthy();
  });

  it('filters by environment and role scope with selectable chips', () => {
    render(<VariablesScreen />);

    // Environment tab shows the environment scope values
    fireEvent.press(screen.getByText('Environment'));
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(screen.getByText('Dev')).toBeTruthy();

    // Selecting Dev filters out the unscoped variable
    fireEvent.press(screen.getByText('Dev'));
    expect(screen.getByText('2 variables')).toBeTruthy();
    expect(screen.getByText('ApiUrl')).toBeTruthy();
    expect(screen.getByText('DbPassword')).toBeTruthy();
    expect(screen.queryByText('EmptyVar')).toBeNull();

    // Deselecting Dev restores the list
    fireEvent.press(screen.getByText('Dev'));
    expect(screen.getByText('3 variables')).toBeTruthy();

    // Role tab: only ApiUrl has the web-server role scope
    fireEvent.press(screen.getByText('Role'));
    fireEvent.press(screen.getByText('web-server'));
    expect(screen.getByText('1 variable')).toBeTruthy();
    expect(screen.getByText('ApiUrl')).toBeTruthy();
    expect(screen.queryByText('DbPassword')).toBeNull();

    // Back to All
    fireEvent.press(screen.getByText('All'));
    expect(screen.getByText('3 variables')).toBeTruthy();
  });

  it('shows an empty state when the project has no variables', () => {
    mockUseProjectVariables.mockReturnValue({
      data: makeVariableSet({ Variables: [], ScopeValues: undefined }),
      isLoading: false,
      error: null,
      refetch,
      isRefetching: false,
    });

    render(<VariablesScreen />);

    expect(screen.getByText('No Variables Found')).toBeTruthy();
    expect(screen.getByText('This project has no variables')).toBeTruthy();

    // With no ScopeValues the scope chips row is not rendered
    fireEvent.press(screen.getByText('Environment'));
    expect(screen.queryByText('Dev')).toBeNull();
  });
});
