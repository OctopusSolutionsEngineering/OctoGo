/**
 * Tests for the DrawerMenu component
 * Covers the hidden state, header/user rendering, the enterprise-only
 * Insights entry, active-route highlighting, navigation presses,
 * logout and the exit animation that hides the modal.
 */

import React from 'react';
import { Animated } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

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
  usePathname: jest.fn(),
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

// The selectors have their own test suites; keep them inert here
jest.mock('../../src/components/SpaceSelector', () => ({
  SpaceSelector: () => null,
}));
jest.mock('../../src/components/InstanceSelector', () => ({
  InstanceSelector: () => null,
}));

import { usePathname } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { DrawerMenu } from '../../src/components/DrawerMenu';

const mockUsePathname = usePathname as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const buildAuth = (overrides: Record<string, unknown> = {}) => ({
  user: { DisplayName: 'Sean W', EmailAddress: 'sean@example.com' },
  isEnterprise: false,
  logout: jest.fn().mockResolvedValue(undefined),
  instances: [
    { id: 'instance-1', name: 'Prod', serverUrl: 'https://prod.octopus.app' },
    { id: 'instance-2', name: 'Dev', serverUrl: 'https://dev.octopus.app' },
  ],
  currentInstance: { id: 'instance-1', name: 'Prod', serverUrl: 'https://prod.octopus.app' },
  ...overrides,
});

// Animation stubs: complete immediately so open/close effects run synchronously
const instantAnimation = () =>
  ({
    start: (cb?: Animated.EndCallback) => cb?.({ finished: true }),
    stop: jest.fn(),
    reset: jest.fn(),
  }) as unknown as Animated.CompositeAnimation;

describe('DrawerMenu', () => {
  beforeEach(() => {
    jest.spyOn(Animated, 'timing').mockImplementation(instantAnimation);
    jest.spyOn(Animated, 'spring').mockImplementation(instantAnimation);

    mockUsePathname.mockReturnValue('/');
    mockUseAuth.mockReturnValue(buildAuth());
  });

  it('renders nothing when not visible', () => {
    render(<DrawerMenu visible={false} onClose={jest.fn()} />);

    expect(screen.queryByText('OctoGo')).toBeNull();
  });

  it('renders the header, user info and menu sections when visible', () => {
    render(<DrawerMenu visible onClose={jest.fn()} />);

    expect(screen.getByText('OctoGo')).toBeTruthy();
    expect(screen.getByText('Sean W')).toBeTruthy();
    expect(screen.getByText('sean@example.com')).toBeTruthy();

    expect(screen.getByText('Main')).toBeTruthy();
    expect(screen.getByText('Operations')).toBeTruthy();
    for (const label of [
      'Dashboard',
      'Projects',
      'Task Log',
      'Search',
      'Runbooks',
      'Targets',
      'Environments',
      'Tenants',
      'Audit Log',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // Not enterprise -> no Insights entry
    expect(screen.queryByText('Insights')).toBeNull();
    expect(screen.getByText('Sign Out')).toBeTruthy();
  });

  it('shows Insights for enterprise users and falls back for missing user info', () => {
    mockUseAuth.mockReturnValue(buildAuth({ isEnterprise: true, user: null }));

    render(<DrawerMenu visible onClose={jest.fn()} />);

    expect(screen.getByText('Insights')).toBeTruthy();
    expect(screen.getByText('User')).toBeTruthy();
    expect(screen.queryByText('sean@example.com')).toBeNull();
  });

  it('highlights the dashboard when on the index route', () => {
    mockUsePathname.mockReturnValue('/index');

    render(<DrawerMenu visible onClose={jest.fn()} />);

    // Active items use the filled icon variant
    expect(screen.getByText('grid')).toBeTruthy();
    expect(screen.getByText('cube-outline')).toBeTruthy();
  });

  it('highlights a section route via prefix matching', () => {
    mockUsePathname.mockReturnValue('/projects/Projects-1');

    render(<DrawerMenu visible onClose={jest.fn()} />);

    expect(screen.getByText('cube')).toBeTruthy();
    expect(screen.getByText('grid-outline')).toBeTruthy();
  });

  it('closes the drawer and navigates when a menu item is pressed', async () => {
    const onClose = jest.fn();
    render(<DrawerMenu visible onClose={onClose} />);

    fireEvent.press(screen.getByText('Projects'));

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(onClose).toHaveBeenCalled();
    // Navigation happens after a short delay so the drawer can close first
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects');
    });
  });

  it('logs out and closes when Sign Out is pressed', async () => {
    const onClose = jest.fn();
    const auth = buildAuth();
    mockUseAuth.mockReturnValue(auth);

    render(<DrawerMenu visible onClose={onClose} />);

    fireEvent.press(screen.getByText('Sign Out'));

    expect(onClose).toHaveBeenCalled();
    await waitFor(() => {
      expect(auth.logout).toHaveBeenCalled();
    });
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('animates out and unmounts the modal when visibility is removed', async () => {
    const onClose = jest.fn();
    const { rerender } = render(<DrawerMenu visible onClose={onClose} />);

    expect(screen.getByText('OctoGo')).toBeTruthy();

    rerender(<DrawerMenu visible={false} onClose={onClose} />);

    await waitFor(
      () => {
        expect(screen.queryByText('OctoGo')).toBeNull();
      },
      { timeout: 3000 }
    );
  });
});
