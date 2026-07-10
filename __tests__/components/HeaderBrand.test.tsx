/**
 * Tests for the HeaderBrand component
 * Covers the pressable/non-pressable render branches, dashboard
 * navigation on press, and the size variants.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

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

import { HeaderBrand } from '../../src/components/HeaderBrand';

describe('HeaderBrand', () => {
  it('renders the brand and navigates to the dashboard on press', () => {
    render(<HeaderBrand />);

    fireEvent.press(screen.getByText('OctoGo'));

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('renders a non-pressable brand when navigation is disabled', () => {
    render(<HeaderBrand navigateToDashboard={false} />);

    // Content still renders, but pressing does not navigate
    fireEvent.press(screen.getByText('OctoGo'));

    expect(mockPush).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('renders the large size variant', () => {
    render(<HeaderBrand size="large" />);

    expect(screen.getByText('OctoGo')).toBeTruthy();
  });

  it('renders the compact size variant', () => {
    render(<HeaderBrand size="compact" />);

    expect(screen.getByText('OctoGo')).toBeTruthy();
  });
});
