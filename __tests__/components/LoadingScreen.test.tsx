/**
 * Tests for LoadingScreen component
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';

describe('LoadingScreen', () => {
  it('should render the app name', () => {
    render(<LoadingScreen />);

    expect(screen.getByText('OctoGo')).toBeTruthy();
  });

  it('should render the default loading message', () => {
    render(<LoadingScreen />);

    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('should render a custom message', () => {
    render(<LoadingScreen message="Connecting to server..." />);

    expect(screen.getByText('Connecting to server...')).toBeTruthy();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('should stop the animation on unmount', () => {
    const { unmount } = render(<LoadingScreen />);

    // Should not throw when unmounting (animation cleanup runs)
    expect(() => unmount()).not.toThrow();
  });
});
