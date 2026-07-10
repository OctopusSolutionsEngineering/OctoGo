/**
 * Tests for EmptyState component
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { EmptyState } from '../../src/components/ui/EmptyState';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

describe('EmptyState', () => {
  it('should render title', () => {
    render(<EmptyState title="No items" />);

    expect(screen.getByText('No items')).toBeTruthy();
  });

  it('should render message when provided', () => {
    render(<EmptyState title="No items" message="Try adding some items" />);

    expect(screen.getByText('No items')).toBeTruthy();
    expect(screen.getByText('Try adding some items')).toBeTruthy();
  });

  it('should not render message when not provided', () => {
    render(<EmptyState title="No items" />);

    expect(screen.queryByText('Try adding some items')).toBeNull();
  });

  it('should render default emoji icon when no icon provided', () => {
    render(<EmptyState title="No items" />);

    expect(screen.getByText('📭')).toBeTruthy();
  });

  it('should render custom emoji icon', () => {
    render(<EmptyState title="No items" icon="🚀" />);

    expect(screen.getByText('🚀')).toBeTruthy();
    expect(screen.queryByText('📭')).toBeNull();
  });

  it('should render ionicon instead of emoji when provided', () => {
    render(<EmptyState title="No items" ionicon="cube-outline" icon="🚀" />);

    // When an ionicon is set, the emoji icon should not be rendered
    expect(screen.queryByText('🚀')).toBeNull();
    expect(screen.queryByText('📭')).toBeNull();
    expect(screen.getByText('No items')).toBeTruthy();
  });
});
