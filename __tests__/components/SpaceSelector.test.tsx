/**
 * Tests for SpaceSelector component
 * Covers the current space display (including the
 * `!!currentSpaceDescription` branch) and the space switch modal.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useSpaces: jest.fn(),
}));

jest.mock('../../src/context/ThemeContext', () => {
  const actual = jest.requireActual('../../src/context/ThemeContext');
  return {
    ...actual,
    useColors: () => actual.darkColors,
  };
});

import { useAuth } from '../../src/context/AuthContext';
import { useSpaces } from '../../src/hooks/useOctopusQuery';
import { SpaceSelector } from '../../src/components/SpaceSelector';

const mockUseAuth = useAuth as jest.Mock;
const mockUseSpaces = useSpaces as jest.Mock;

const spaces = [
  { Id: 'Spaces-1', Name: 'Default', Description: 'Main team space', IsDefault: true },
  { Id: 'Spaces-2', Name: 'Sandbox', Description: null, IsDefault: false },
];

describe('SpaceSelector', () => {
  beforeEach(() => {
    mockUseSpaces.mockReturnValue({ data: spaces, isLoading: false });
    mockUseAuth.mockReturnValue({
      currentSpace: spaces[0],
      switchSpace: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('shows the current space name and description', () => {
    render(<SpaceSelector />);

    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.getByText('Main team space')).toBeTruthy();
  });

  it('falls back to the space Id when there is no description', () => {
    mockUseAuth.mockReturnValue({
      currentSpace: spaces[1],
      switchSpace: jest.fn(),
    });

    render(<SpaceSelector />);

    expect(screen.getByText('Sandbox')).toBeTruthy();
    expect(screen.getByText('Spaces-2')).toBeTruthy();
  });

  it('shows no description line when there is no current space', () => {
    mockUseAuth.mockReturnValue({
      currentSpace: null,
      switchSpace: jest.fn(),
    });

    render(<SpaceSelector />);

    expect(screen.getByText('Select Space')).toBeTruthy();
    expect(screen.queryByText('Main team space')).toBeNull();
  });

  it('opens the modal and switches spaces', async () => {
    const switchSpace = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ currentSpace: spaces[0], switchSpace });

    render(<SpaceSelector />);

    fireEvent.press(screen.getByText('Default'));
    expect(screen.getByText('Switch Space')).toBeTruthy();
    // The default space shows its badge, the other shows its Id fallback
    expect(screen.getByText('Sandbox')).toBeTruthy();
    expect(screen.getByText('Spaces-2')).toBeTruthy();

    fireEvent.press(screen.getByText('Sandbox'));

    await waitFor(() => {
      expect(switchSpace).toHaveBeenCalledWith('Spaces-2');
    });
  });

  it('shows a loading state inside the modal while spaces load', () => {
    mockUseSpaces.mockReturnValue({ data: undefined, isLoading: true });

    render(<SpaceSelector />);

    fireEvent.press(screen.getByText('Default'));

    expect(screen.getByText('Loading spaces...')).toBeTruthy();
  });
});
