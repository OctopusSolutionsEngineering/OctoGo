/**
 * Tests for the Release detail screen
 * Covers the `!!release.ProjectVariableSetSnapshotId` info-row branch
 * both ways, plus loading / error states and deployment navigation.
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
  useLocalSearchParams: () => ({ id: 'Releases-1' }),
  Stack: { Screen: () => null },
}));

// NOTE: the '@/src/...' specifiers resolve through the manual mocks in
// <rootDir>/__mocks__/@/src which re-export the real modules; these explicit
// mocks replace the hooks/theme modules for this suite.
jest.mock('@/src/hooks/useOctopusQuery', () => ({
  useRelease: jest.fn(),
  useProject: jest.fn(),
  useEnvironments: jest.fn(),
}));

jest.mock('@/src/context/ThemeContext', () => {
  const actual = jest.requireActual('../../src/context/ThemeContext');
  return {
    ...actual,
    useColors: () => actual.darkColors,
  };
});

import { useRelease, useProject, useEnvironments } from '@/src/hooks/useOctopusQuery';
import ReleaseDetailScreen from '../../app/release/[id]';

const mockUseRelease = useRelease as jest.Mock;
const mockUseProject = useProject as jest.Mock;
const mockUseEnvironments = useEnvironments as jest.Mock;

const makeRelease = (overrides: Record<string, unknown> = {}) => ({
  Id: 'Releases-1',
  Version: '1.2.3',
  ProjectId: 'Projects-1',
  ChannelId: 'Channels-42',
  ProjectVariableSetSnapshotId: 'variableset-Projects-1-s-ABC123',
  Assembled: '2026-01-05T10:30:00Z',
  ReleaseNotes: 'Fixed all the bugs',
  SelectedPackages: [
    { ActionName: 'Deploy Web Site', PackageReferenceName: null, Version: '2.0.0' },
  ],
  SpaceId: 'Spaces-1',
  ...overrides,
});

describe('ReleaseDetailScreen', () => {
  beforeEach(() => {
    mockUseRelease.mockReturnValue({
      data: makeRelease(),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseProject.mockReturnValue({
      data: { Id: 'Projects-1', Name: 'Web App' },
      isLoading: false,
    });
    mockUseEnvironments.mockReturnValue({
      data: [
        { Id: 'Environments-1', Name: 'Production', Description: 'Live environment' },
        { Id: 'Environments-2', Name: 'Staging', Description: null },
      ],
    });
  });

  it('renders release details including the variable snapshot row', () => {
    render(<ReleaseDetailScreen />);

    expect(screen.getByText('1.2.3')).toBeTruthy();
    expect(screen.getByText('Web App')).toBeTruthy();
    expect(screen.getByText('Channel 42')).toBeTruthy();
    // Variable snapshot row: last '-' segment of the snapshot id
    expect(screen.getByText('Variable Snapshot')).toBeTruthy();
    expect(screen.getByText('ABC123')).toBeTruthy();
    expect(screen.getByText('Fixed all the bugs')).toBeTruthy();
    expect(screen.getByText('Deploy Web Site')).toBeTruthy();
    expect(screen.getByText('2.0.0')).toBeTruthy();
    expect(screen.getByText('Production')).toBeTruthy();
    expect(screen.getByText('Live environment')).toBeTruthy();
  });

  it('hides the variable snapshot row when the release has no snapshot id', () => {
    mockUseRelease.mockReturnValue({
      data: makeRelease({
        ProjectVariableSetSnapshotId: undefined,
        ReleaseNotes: null,
        SelectedPackages: [],
      }),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<ReleaseDetailScreen />);

    expect(screen.getByText('1.2.3')).toBeTruthy();
    expect(screen.queryByText('Variable Snapshot')).toBeNull();
    expect(screen.getByText('No release notes')).toBeTruthy();
  });

  it('navigates to the deploy screen when Deploy this Release is pressed', () => {
    render(<ReleaseDetailScreen />);

    fireEvent.press(screen.getByText('Deploy this Release'));

    expect(mockPush).toHaveBeenCalledWith('/release/Releases-1/deploy');
  });

  it('navigates to the project when the project name is pressed', () => {
    render(<ReleaseDetailScreen />);

    fireEvent.press(screen.getByText('Web App'));

    expect(mockPush).toHaveBeenCalledWith('/project/Projects-1');
  });

  it('shows the loading screen while the release loads', () => {
    mockUseRelease.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });
    mockUseProject.mockReturnValue({ data: undefined, isLoading: false });

    render(<ReleaseDetailScreen />);

    expect(screen.getByText('Loading release...')).toBeTruthy();
  });

  it('shows an error view when the release fails to load', () => {
    mockUseRelease.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Release not found' },
      refetch: jest.fn(),
    });
    mockUseProject.mockReturnValue({ data: undefined, isLoading: false });

    render(<ReleaseDetailScreen />);

    expect(screen.getByText('Failed to load release')).toBeTruthy();
    expect(screen.getByText('Release not found')).toBeTruthy();
  });
});
