/**
 * Tests for Input component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Input } from '../../src/components/ui/Input';

describe('Input', () => {
  it('should render with a label', () => {
    render(<Input label="Server URL" placeholder="Enter URL" />);

    expect(screen.getByText('Server URL')).toBeTruthy();
  });

  it('should render without a label', () => {
    render(<Input placeholder="Enter URL" />);

    expect(screen.getByPlaceholderText('Enter URL')).toBeTruthy();
  });

  it('should call onChangeText when typing', () => {
    const mockOnChangeText = jest.fn();
    render(<Input placeholder="Enter URL" onChangeText={mockOnChangeText} />);

    fireEvent.changeText(screen.getByPlaceholderText('Enter URL'), 'https://octopus.example.com');

    expect(mockOnChangeText).toHaveBeenCalledWith('https://octopus.example.com');
  });

  it('should show error text when error provided', () => {
    render(<Input placeholder="Enter URL" error="Invalid URL" />);

    expect(screen.getByText('Invalid URL')).toBeTruthy();
  });

  it('should show hint text when hint provided and no error', () => {
    render(<Input placeholder="Enter URL" hint="Use https" />);

    expect(screen.getByText('Use https')).toBeTruthy();
  });

  it('should hide hint text when there is an error', () => {
    render(<Input placeholder="Enter URL" hint="Use https" error="Invalid URL" />);

    expect(screen.queryByText('Use https')).toBeNull();
    expect(screen.getByText('Invalid URL')).toBeTruthy();
  });

  it('should handle focus and blur events', () => {
    render(<Input placeholder="Enter URL" />);

    const input = screen.getByPlaceholderText('Enter URL');

    fireEvent(input, 'focus');
    fireEvent(input, 'blur');

    // Should not crash and still be rendered
    expect(screen.getByPlaceholderText('Enter URL')).toBeTruthy();
  });

  describe('secure text entry toggle', () => {
    it('should show the Show toggle for secure fields with showToggle', () => {
      render(<Input placeholder="API Key" secureTextEntry showToggle />);

      expect(screen.getByText('Show')).toBeTruthy();
    });

    it('should toggle between Show and Hide when pressed', () => {
      render(<Input placeholder="API Key" secureTextEntry showToggle />);

      fireEvent.press(screen.getByText('Show'));
      expect(screen.getByText('Hide')).toBeTruthy();

      fireEvent.press(screen.getByText('Hide'));
      expect(screen.getByText('Show')).toBeTruthy();
    });

    it('should not show a toggle when showToggle is false', () => {
      render(<Input placeholder="API Key" secureTextEntry />);

      expect(screen.queryByText('Show')).toBeNull();
    });

    it('should not show a toggle when field is not secure', () => {
      render(<Input placeholder="API Key" showToggle />);

      expect(screen.queryByText('Show')).toBeNull();
    });
  });
});
