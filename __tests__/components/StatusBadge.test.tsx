/**
 * Tests for StatusBadge component
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StatusBadge } from '../../src/components/ui/StatusBadge';

describe('StatusBadge', () => {
  describe('Status text rendering', () => {
    it('should render Success status', () => {
      render(<StatusBadge status="Success" />);
      expect(screen.getByText('Success')).toBeTruthy();
    });

    it('should render Failed status', () => {
      render(<StatusBadge status="Failed" />);
      expect(screen.getByText('Failed')).toBeTruthy();
    });

    it('should render Executing status', () => {
      render(<StatusBadge status="Executing" />);
      expect(screen.getByText('Executing')).toBeTruthy();
    });

    it('should render Queued status', () => {
      render(<StatusBadge status="Queued" />);
      expect(screen.getByText('Queued')).toBeTruthy();
    });

    it('should render Canceled status', () => {
      render(<StatusBadge status="Canceled" />);
      expect(screen.getByText('Canceled')).toBeTruthy();
    });

    it('should render Cancelling status', () => {
      render(<StatusBadge status="Cancelling" />);
      expect(screen.getByText('Cancelling')).toBeTruthy();
    });

    it('should render TimedOut status', () => {
      render(<StatusBadge status="TimedOut" />);
      expect(screen.getByText('TimedOut')).toBeTruthy();
    });

    it('should render custom/unknown status', () => {
      render(<StatusBadge status="CustomStatus" />);
      expect(screen.getByText('CustomStatus')).toBeTruthy();
    });
  });

  describe('Status icons', () => {
    it('should show checkmark icon for Success', () => {
      render(<StatusBadge status="Success" showIcon={true} />);
      expect(screen.getByText('✓')).toBeTruthy();
    });

    it('should show X icon for Failed', () => {
      render(<StatusBadge status="Failed" showIcon={true} />);
      expect(screen.getByText('✕')).toBeTruthy();
    });

    it('should show filled circle for Executing', () => {
      render(<StatusBadge status="Executing" showIcon={true} />);
      expect(screen.getByText('●')).toBeTruthy();
    });

    it('should show clock icon for Queued', () => {
      render(<StatusBadge status="Queued" showIcon={true} />);
      expect(screen.getByText('◷')).toBeTruthy();
    });

    it('should show empty circle for Canceled', () => {
      render(<StatusBadge status="Canceled" showIcon={true} />);
      expect(screen.getByText('◌')).toBeTruthy();
    });

    it('should hide icon when showIcon is false', () => {
      render(<StatusBadge status="Success" showIcon={false} />);
      expect(screen.queryByText('✓')).toBeNull();
    });

    it('should show icon by default', () => {
      render(<StatusBadge status="Success" />);
      expect(screen.getByText('✓')).toBeTruthy();
    });
  });

  describe('Sizes', () => {
    it('should render small size', () => {
      render(<StatusBadge status="Success" size="sm" />);
      expect(screen.getByText('Success')).toBeTruthy();
    });

    it('should render medium size (default)', () => {
      render(<StatusBadge status="Success" size="md" />);
      expect(screen.getByText('Success')).toBeTruthy();
    });

    it('should render large size', () => {
      render(<StatusBadge status="Success" size="lg" />);
      expect(screen.getByText('Success')).toBeTruthy();
    });
  });

  describe('Color mapping', () => {
    // Note: We can't easily test actual colors in React Native Testing Library
    // but we can ensure the component renders without error for each status

    const statuses = [
      'Success',
      'Failed',
      'TimedOut',
      'Executing',
      'Queued',
      'Canceled',
      'Cancelling',
      'Unknown',
    ];

    statuses.forEach((status) => {
      it(`should render ${status} without error`, () => {
        const { getByText } = render(<StatusBadge status={status} />);
        expect(getByText(status)).toBeTruthy();
      });
    });
  });
});

