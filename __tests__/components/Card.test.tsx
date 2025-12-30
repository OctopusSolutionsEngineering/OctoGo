/**
 * Tests for Card component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../../src/components/ui/Card';
import * as Haptics from 'expo-haptics';

describe('Card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children', () => {
    render(
      <Card>
        <Text>Card Content</Text>
      </Card>
    );
    
    expect(screen.getByText('Card Content')).toBeTruthy();
  });

  it('should render as a View when no onPress provided', () => {
    render(
      <Card>
        <Text>Static Card</Text>
      </Card>
    );
    
    expect(screen.getByText('Static Card')).toBeTruthy();
  });

  it('should render as Pressable when onPress provided', () => {
    const mockOnPress = jest.fn();
    
    render(
      <Card onPress={mockOnPress}>
        <Text>Pressable Card</Text>
      </Card>
    );
    
    fireEvent.press(screen.getByText('Pressable Card'));
    
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('should trigger haptic feedback when pressed', () => {
    const mockOnPress = jest.fn();
    
    render(
      <Card onPress={mockOnPress}>
        <Text>Haptic Card</Text>
      </Card>
    );
    
    fireEvent.press(screen.getByText('Haptic Card'));
    
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('should not trigger haptic when no onPress', () => {
    render(
      <Card>
        <Text>No Haptic</Text>
      </Card>
    );
    
    // There's no press event for a View
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  describe('variants', () => {
    it('should render default variant', () => {
      render(
        <Card variant="default">
          <Text>Default</Text>
        </Card>
      );
      
      expect(screen.getByText('Default')).toBeTruthy();
    });

    it('should render elevated variant', () => {
      render(
        <Card variant="elevated">
          <Text>Elevated</Text>
        </Card>
      );
      
      expect(screen.getByText('Elevated')).toBeTruthy();
    });
  });

  it('should apply custom style', () => {
    const customStyle = { marginTop: 20, padding: 30 };
    
    render(
      <Card style={customStyle}>
        <Text>Styled Card</Text>
      </Card>
    );
    
    expect(screen.getByText('Styled Card')).toBeTruthy();
  });

  it('should render multiple children', () => {
    render(
      <Card>
        <Text>First Child</Text>
        <Text>Second Child</Text>
        <Text>Third Child</Text>
      </Card>
    );
    
    expect(screen.getByText('First Child')).toBeTruthy();
    expect(screen.getByText('Second Child')).toBeTruthy();
    expect(screen.getByText('Third Child')).toBeTruthy();
  });
});

