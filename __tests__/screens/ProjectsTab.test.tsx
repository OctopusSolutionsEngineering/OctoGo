/**
 * Tests for the Projects tab screen
 * Covers grouping by project group (with favorites first), search, the
 * favorites filter mode, group collapse/expand, favorite toggling,
 * navigation, refresh, and loading / error / empty states.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';

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

jest.mock('../../src/context/FavoritesContext', () => ({
  useFavorites: jest.fn(),
}));

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useProjects: jest.fn(),
  useProjectGroups: jest.fn(),
}));

import { useFavorites } from '../../src/context/FavoritesContext';
import { useProjects, useProjectGroups } from '../../src/hooks/useOctopusQuery';
import ProjectsScreen from '../../app/(tabs)/projects';

const mockUseFavorites = useFavorites as jest.Mock;
const mockUseProjects = useProjects as jest.Mock;
const mockUseProjectGroups = useProjectGroups as jest.Mock;

const mockToggleFavorite = jest.fn();

const makeProject = (overrides: Record<string, unknown> = {}) => ({
  Id: 'Projects-1',
  Name: 'Fav Project',
  Slug: 'fav-project',
  Description: '',
  ProjectGroupId: 'ProjectGroups-1',
  IsDisabled: false,
  TenantedDeploymentMode: 'Untenanted',
  ...overrides,
});

// 4 projects: one favorite, one described + tenanted, one disabled,
// one in an unknown project group.
const projects = [
  makeProject(),
  makeProject({
    Id: 'Projects-2',
    Name: 'API Service',
    Slug: 'api-service',
    Description: 'Handles API traffic',
    TenantedDeploymentMode: 'TenantedOrUntenanted',
  }),
  makeProject({ Id: 'Projects-3', Name: 'Old App', Slug: 'old-app', IsDisabled: true }),
  makeProject({ Id: 'Projects-4', Name: 'Zeta App', Slug: 'zeta-app', ProjectGroupId: 'ProjectGroups-99' }),
];

const setFavorites = (favs: string[]) => {
  mockUseFavorites.mockReturnValue({
    favorites: favs,
    isFavorite: (id: string) => favs.includes(id),
    toggleFavorite: mockToggleFavorite,
  });
};

const setProjects = (items: unknown[], extra: Record<string, unknown> = {}) => {
  mockUseProjects.mockReturnValue({
    data: { Items: items },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    ...extra,
  });
};

describe('ProjectsScreen', () => {
  beforeEach(() => {
    setFavorites(['Projects-1']);
    setProjects(projects);
    mockUseProjectGroups.mockReturnValue({
      data: [
        { Id: 'ProjectGroups-1', Name: 'Group Alpha' },
        { Id: 'ProjectGroups-2', Name: 'Group Beta' },
      ],
    });
  });

  it('groups projects by project group with a favorites section first', () => {
    render(<ProjectsScreen />);

    // Section headers: favorites, known group, unknown group fallback
    expect(screen.getByText('★ Favorites')).toBeTruthy();
    expect(screen.getByText('Group Alpha')).toBeTruthy();
    expect(screen.getByText('Default Project Group')).toBeTruthy();

    // Projects and their slugs
    expect(screen.getByText('Fav Project')).toBeTruthy();
    expect(screen.getByText('API Service')).toBeTruthy();
    expect(screen.getByText('Zeta App')).toBeTruthy();
    expect(screen.getByText('api-service')).toBeTruthy();

    // Description shown only for projects that have one
    expect(screen.getByText('Handles API traffic')).toBeTruthy();

    // Status + tenanted meta branches
    expect(screen.getByText('Disabled')).toBeTruthy();
    expect(screen.getAllByText('Active')).toHaveLength(3);
    expect(screen.getByText('Tenanted')).toBeTruthy();
    expect(screen.getByText('pause-circle-outline')).toBeTruthy();

    // Filter tab counts
    expect(screen.getByText('All (4)')).toBeTruthy();
    expect(screen.getByText('Favorites (1)')).toBeTruthy();
  });

  it('navigates to the project when a card is pressed', () => {
    render(<ProjectsScreen />);

    fireEvent.press(screen.getByText('API Service'));

    expect(mockPush).toHaveBeenCalledWith('/project/Projects-2');
  });

  it('toggles a favorite when the star is pressed', () => {
    render(<ProjectsScreen />);

    // First star-outline belongs to the first non-favorite project (API Service)
    fireEvent.press(screen.getAllByText('star-outline')[0]);

    expect(mockToggleFavorite).toHaveBeenCalledWith('Projects-2');
  });

  it('collapses and expands a group when its header is pressed', () => {
    render(<ProjectsScreen />);

    fireEvent.press(screen.getByText('Group Alpha'));

    expect(screen.queryByText('API Service')).toBeNull();
    expect(screen.getByText('EXPAND')).toBeTruthy();

    fireEvent.press(screen.getByText('Group Alpha'));

    expect(screen.getByText('API Service')).toBeTruthy();
    expect(screen.queryByText('EXPAND')).toBeNull();
  });

  it('passes the search text to useProjects and shows a flat result list', () => {
    render(<ProjectsScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Search projects...'), 'api');

    expect(mockUseProjects).toHaveBeenLastCalledWith({ take: 100, searchText: 'api' });
    expect(screen.getByText('Search Results')).toBeTruthy();
    expect(screen.queryByText('★ Favorites')).toBeNull();

    // Clear button resets the search
    fireEvent.press(screen.getByText('close-circle'));

    expect(mockUseProjects).toHaveBeenLastCalledWith({ take: 100, searchText: undefined });
    expect(screen.queryByText('Search Results')).toBeNull();
  });

  it('shows only favorites in favorites filter mode', () => {
    render(<ProjectsScreen />);

    fireEvent.press(screen.getByText('Favorites (1)'));

    expect(screen.getByText('Favorites')).toBeTruthy();
    expect(screen.getByText('Fav Project')).toBeTruthy();
    expect(screen.queryByText('API Service')).toBeNull();

    fireEvent.press(screen.getByText('All (4)'));

    expect(screen.getByText('API Service')).toBeTruthy();
  });

  it('sorts multiple favorites alphabetically in both filter modes', () => {
    setFavorites(['Projects-1', 'Projects-3']);

    render(<ProjectsScreen />);

    // Favorites section sorts its two entries (covers the sort comparator)
    expect(screen.getByText('★ Favorites')).toBeTruthy();
    expect(screen.getByText('Old App')).toBeTruthy();

    fireEvent.press(screen.getByText('Favorites (2)'));

    expect(screen.getByText('Fav Project')).toBeTruthy();
    expect(screen.getByText('Old App')).toBeTruthy();
    expect(screen.queryByText('API Service')).toBeNull();
  });

  it('shows the empty state when there are no projects', () => {
    setFavorites([]);
    setProjects([]);

    render(<ProjectsScreen />);

    expect(screen.getByText('No projects found')).toBeTruthy();
    expect(screen.getByText('Create your first project in Octopus Deploy')).toBeTruthy();
  });

  it('evaluates the favorites empty-state messages in favorites mode', () => {
    // Favorite id not present in the loaded projects
    setFavorites(['Projects-404']);
    setProjects([]);

    render(<ProjectsScreen />);

    fireEvent.press(screen.getByText('Favorites (0)'));
    expect(screen.queryByText('Fav Project')).toBeNull();

    // Searching with no matches renders the flat Search Results section
    fireEvent.changeText(screen.getByPlaceholderText('Search projects...'), 'zzz');
    expect(screen.getByText('Search Results')).toBeTruthy();
  });

  it('does not render the empty state while loading', () => {
    setFavorites([]);
    setProjects([], { isLoading: true });

    render(<ProjectsScreen />);

    expect(screen.queryByText('No projects found')).toBeNull();
  });

  it('shows an error view when loading projects fails', () => {
    setProjects([], { data: undefined, error: { message: 'Projects unavailable' } });

    render(<ProjectsScreen />);

    expect(screen.getByText('Projects unavailable')).toBeTruthy();
  });

  it('refetches when pull-to-refresh is triggered', () => {
    const refetch = jest.fn();
    setProjects(projects, { refetch });

    render(<ProjectsScreen />);

    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');

    expect(refetch).toHaveBeenCalled();
  });
});
