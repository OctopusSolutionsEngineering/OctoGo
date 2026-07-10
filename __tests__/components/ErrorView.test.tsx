/**
 * Tests for ErrorView component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ErrorView } from '../../src/components/ui/ErrorView';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

describe('ErrorView', () => {
  const mockOnRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the message', () => {
    render(<ErrorView message="Something failed" />);

    expect(screen.getByText('Something failed')).toBeTruthy();
  });

  it('should render default title for generic errors', () => {
    render(<ErrorView message="Oops" />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('should render a custom title when provided', () => {
    render(<ErrorView title="Custom Title" message="Oops" />);

    expect(screen.getByText('Custom Title')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  describe('error types', () => {
    it('should render Access Denied title for permission errors', () => {
      render(<ErrorView message="No access" errorType="permission" />);

      expect(screen.getByText('Access Denied')).toBeTruthy();
    });

    it('should render Connection Error title for network errors', () => {
      render(<ErrorView message="Offline" errorType="network" />);

      expect(screen.getByText('Connection Error')).toBeTruthy();
    });

    it('should render Not Found title for notFound errors', () => {
      render(<ErrorView message="Missing" errorType="notFound" />);

      expect(screen.getByText('Not Found')).toBeTruthy();
    });
  });

  describe('retry', () => {
    it('should render Try Again button when onRetry provided', () => {
      render(<ErrorView message="Oops" onRetry={mockOnRetry} />);

      expect(screen.getByText('Try Again')).toBeTruthy();
    });

    it('should call onRetry when Try Again is pressed', () => {
      render(<ErrorView message="Oops" onRetry={mockOnRetry} />);

      fireEvent.press(screen.getByText('Try Again'));

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('should not render Try Again button without onRetry', () => {
      render(<ErrorView message="Oops" />);

      expect(screen.queryByText('Try Again')).toBeNull();
    });
  });

  describe('secondaryAction', () => {
    it('should render and trigger the secondary action', () => {
      const mockSecondary = jest.fn();

      render(
        <ErrorView
          message="Oops"
          secondaryAction={{ title: 'Switch Space', onPress: mockSecondary }}
        />
      );

      fireEvent.press(screen.getByText('Switch Space'));

      expect(mockSecondary).toHaveBeenCalledTimes(1);
    });
  });

  describe('fullScreen', () => {
    it('should render in fullScreen mode', () => {
      render(<ErrorView message="Oops" fullScreen />);

      expect(screen.getByText('Oops')).toBeTruthy();
      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });

    it('should render fullScreen with retry', () => {
      render(<ErrorView message="Oops" fullScreen onRetry={mockOnRetry} />);

      fireEvent.press(screen.getByText('Try Again'));

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });
  });
});
