/**
 * Tests for the customize-tabs screen
 * Covers tab toggling (add, remove, max-reached and last-tab guards),
 * the enterprise-only tab filter, the preview (including missing-tab
 * branch) and the reset-to-defaults confirmation.
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Ionicons = (props: { name: string }) => React.createElement(Text, props, props.name);
  Ionicons.glyphMap = {};
  return { Ionicons };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/context/TabCustomizationContext', () => {
  const actual = jest.requireActual('../../src/context/TabCustomizationContext');
  return {
    ...actual,
    useTabCustomization: jest.fn(),
  };
});

import { useAuth } from '../../src/context/AuthContext';
import {
  useTabCustomization,
  AVAILABLE_TABS,
} from '../../src/context/TabCustomizationContext';
import CustomizeTabsScreen from '../../app/customize-tabs';

const mockUseAuth = useAuth as jest.Mock;
const mockUseTabCustomization = useTabCustomization as jest.Mock;

describe('CustomizeTabsScreen', () => {
  const mockToggleTab = jest.fn();
  const mockResetToDefaults = jest.fn();

  const customization = (selectedTabIds: string[], overrides: Record<string, unknown> = {}) => ({
    availableTabs: AVAILABLE_TABS,
    selectedTabIds,
    toggleTab: mockToggleTab,
    canAddMoreTabs: selectedTabIds.length < 4,
    isTabSelected: (id: string) => selectedTabIds.includes(id),
    resetToDefaults: mockResetToDefaults,
    ...overrides,
  });

  beforeEach(() => {
    mockUseAuth.mockReturnValue({ isEnterprise: false });
    mockUseTabCustomization.mockReturnValue(
      customization(['dashboard', 'projects', 'deployments', 'search'])
    );
    mockToggleTab.mockResolvedValue(undefined);
    mockResetToDefaults.mockResolvedValue(undefined);
  });

  it('renders the counter, max-reached hint and hides enterprise tabs', () => {
    render(<CustomizeTabsScreen />);

    expect(screen.getByText('4 / 4 tabs selected')).toBeTruthy();
    expect(screen.getByText('Maximum reached')).toBeTruthy();

    // Non-enterprise users do not see the enterprise-only Insights tab
    expect(screen.queryByText('Insights')).toBeNull();

    // Unselected tabs render once in the list, selected tabs also in the preview
    expect(screen.getByText('Runbooks')).toBeTruthy();
    expect(screen.getAllByText('Dashboard')).toHaveLength(2);
  });

  it('shows enterprise-only tabs with a badge for enterprise users', () => {
    mockUseAuth.mockReturnValue({ isEnterprise: true });

    render(<CustomizeTabsScreen />);

    expect(screen.getByText('Insights')).toBeTruthy();
    expect(screen.getByText('Enterprise')).toBeTruthy();
  });

  it('toggles an unselected tab on when below the maximum', async () => {
    mockUseTabCustomization.mockReturnValue(customization(['dashboard', 'projects']));

    render(<CustomizeTabsScreen />);

    expect(screen.getByText('2 / 4 tabs selected')).toBeTruthy();
    expect(screen.queryByText('Maximum reached')).toBeNull();

    fireEvent.press(screen.getByText('Runbooks'));

    await waitFor(() => {
      expect(mockToggleTab).toHaveBeenCalledWith('runbooks');
    });
  });

  it('toggles a selected tab off when more than one tab remains', async () => {
    mockUseTabCustomization.mockReturnValue(customization(['dashboard', 'projects']));

    render(<CustomizeTabsScreen />);

    // First occurrence is the selectable list item (preview comes later)
    fireEvent.press(screen.getAllByText('Projects')[0]);

    await waitFor(() => {
      expect(mockToggleTab).toHaveBeenCalledWith('projects');
    });
  });

  it('blocks removing the last remaining tab with an alert', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockUseTabCustomization.mockReturnValue(customization(['dashboard']));

    render(<CustomizeTabsScreen />);

    fireEvent.press(screen.getAllByText('Dashboard')[0]);

    expect(alertSpy).toHaveBeenCalledWith(
      'Cannot Remove',
      'You must have at least one tab in the navigation.',
      [{ text: 'OK' }]
    );
    expect(mockToggleTab).not.toHaveBeenCalled();
  });

  it('blocks adding a tab when the maximum is reached', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<CustomizeTabsScreen />);

    fireEvent.press(screen.getByText('Runbooks'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Maximum Reached',
      'You can only have up to 4 tabs in the navigation. Remove a tab first.',
      [{ text: 'OK' }]
    );
    expect(mockToggleTab).not.toHaveBeenCalled();
  });

  it('skips unknown tab ids in the preview', () => {
    mockUseTabCustomization.mockReturnValue(customization(['dashboard', 'bogus-tab']));

    render(<CustomizeTabsScreen />);

    expect(screen.getByText('2 / 4 tabs selected')).toBeTruthy();
    // Only the known tab is previewed
    expect(screen.getAllByText('Dashboard')).toHaveLength(2);
  });

  it('confirms before resetting to the default tabs', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<CustomizeTabsScreen />);

    fireEvent.press(screen.getByText('Reset to Default'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Reset Navigation',
      'Reset to default tabs (Dashboard, Projects, Tasks, Search)?',
      expect.any(Array)
    );

    const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    const confirm = buttons.find(b => b.text === 'Reset');
    confirm?.onPress?.();

    await waitFor(() => {
      expect(mockResetToDefaults).toHaveBeenCalled();
    });
  });
});
