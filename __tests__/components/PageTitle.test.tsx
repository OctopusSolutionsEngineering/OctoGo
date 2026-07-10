/**
 * Tests for PageTitle component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PageTitle } from '../../src/components/ui/PageTitle';
import { ThemeProvider } from '../../src/context/ThemeContext';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

// AsyncStorage is auto-mocked by jest.setup.js

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe('PageTitle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('should render the title', async () => {
    renderWithTheme(<PageTitle title="Projects" />);

    expect(screen.getByText('Projects')).toBeTruthy();

    // Wait for the theme provider to finish loading to avoid act warnings
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
  });

  it('should render the subtitle when provided', async () => {
    renderWithTheme(<PageTitle title="Projects" subtitle="All your projects" />);

    expect(screen.getByText('Projects')).toBeTruthy();
    expect(screen.getByText('All your projects')).toBeTruthy();

    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
  });

  it('should not render a subtitle when not provided', async () => {
    renderWithTheme(<PageTitle title="Projects" />);

    expect(screen.queryByText('All your projects')).toBeNull();

    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
  });

  it('should render with an icon', async () => {
    renderWithTheme(<PageTitle title="Projects" icon="cube-outline" />);

    expect(screen.getByText('Projects')).toBeTruthy();

    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
  });
});
