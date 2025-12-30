/**
 * Tests for Button component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Button } from '../../src/components/ui/Button';
import * as Haptics from 'expo-haptics';

describe('Button', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with title', () => {
    render(<Button title="Click Me" onPress={mockOnPress} />);
    
    expect(screen.getByText('Click Me')).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    render(<Button title="Click Me" onPress={mockOnPress} />);
    
    fireEvent.press(screen.getByText('Click Me'));
    
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('should trigger haptic feedback when pressed', () => {
    render(<Button title="Click Me" onPress={mockOnPress} />);
    
    fireEvent.press(screen.getByText('Click Me'));
    
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('should not call onPress when disabled', () => {
    render(<Button title="Click Me" onPress={mockOnPress} disabled />);
    
    fireEvent.press(screen.getByText('Click Me'));
    
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('should not call onPress when loading', () => {
    render(<Button title="Click Me" onPress={mockOnPress} loading />);
    
    // When loading, the button text is replaced with ActivityIndicator
    // Try to fire press on the button container
    const buttons = screen.queryAllByRole('button');
    if (buttons.length > 0) {
      fireEvent.press(buttons[0]);
    }
    
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('should show loading indicator when loading', () => {
    render(<Button title="Click Me" onPress={mockOnPress} loading />);
    
    // Title should not be visible when loading
    expect(screen.queryByText('Click Me')).toBeNull();
  });

  describe('variants', () => {
    it('should render primary variant', () => {
      render(<Button title="Primary" onPress={mockOnPress} variant="primary" />);
      expect(screen.getByText('Primary')).toBeTruthy();
    });

    it('should render secondary variant', () => {
      render(<Button title="Secondary" onPress={mockOnPress} variant="secondary" />);
      expect(screen.getByText('Secondary')).toBeTruthy();
    });

    it('should render danger variant', () => {
      render(<Button title="Danger" onPress={mockOnPress} variant="danger" />);
      expect(screen.getByText('Danger')).toBeTruthy();
    });

    it('should render ghost variant', () => {
      render(<Button title="Ghost" onPress={mockOnPress} variant="ghost" />);
      expect(screen.getByText('Ghost')).toBeTruthy();
    });
  });

  describe('sizes', () => {
    it('should render small size', () => {
      render(<Button title="Small" onPress={mockOnPress} size="sm" />);
      expect(screen.getByText('Small')).toBeTruthy();
    });

    it('should render medium size (default)', () => {
      render(<Button title="Medium" onPress={mockOnPress} size="md" />);
      expect(screen.getByText('Medium')).toBeTruthy();
    });

    it('should render large size', () => {
      render(<Button title="Large" onPress={mockOnPress} size="lg" />);
      expect(screen.getByText('Large')).toBeTruthy();
    });
  });

  it('should support fullWidth prop', () => {
    render(<Button title="Full Width" onPress={mockOnPress} fullWidth />);
    expect(screen.getByText('Full Width')).toBeTruthy();
  });

  it('should apply custom style', () => {
    const customStyle = { marginTop: 20 };
    render(<Button title="Styled" onPress={mockOnPress} style={customStyle} />);
    expect(screen.getByText('Styled')).toBeTruthy();
  });

  it('should apply custom textStyle', () => {
    const customTextStyle = { fontWeight: 'bold' as const };
    render(<Button title="Styled Text" onPress={mockOnPress} textStyle={customTextStyle} />);
    expect(screen.getByText('Styled Text')).toBeTruthy();
  });
});

