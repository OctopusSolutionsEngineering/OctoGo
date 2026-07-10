/**
 * Tests for the Deployment detail screen (app/deployment/[id].tsx)
 * A redirect-style screen: loads the deployment then replaces the route
 * with the corresponding task screen.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Keep icon rendering trivial (ErrorView renders an Ionicons icon)
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
  useSegments: () => [],
  Stack: { Screen: () => null },
  Tabs: { Screen: () => null },
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useDeployment: jest.fn(),
}));

import { useDeployment } from '../../src/hooks/useOctopusQuery';
import DeploymentDetailScreen from '../../app/deployment/[id]';

const mockUseDeployment = useDeployment as jest.Mock;

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

describe('DeploymentDetailScreen', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'Deployments-1' });
  });

  it('shows the loading screen while the deployment loads', () => {
    mockUseDeployment.mockReturnValue({ data: undefined, isLoading: true, error: null });

    render(<DeploymentDetailScreen />);

    expect(screen.getByText('Loading deployment...')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('shows an error view and goes back on retry', () => {
    mockUseDeployment.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'deployment not reachable' },
    });

    render(<DeploymentDetailScreen />);

    expect(screen.getByText('deployment not reachable')).toBeTruthy();

    fireEvent.press(screen.getByText('Try Again'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('redirects to the task screen once the deployment has a task id', () => {
    mockUseDeployment.mockReturnValue({
      data: { Id: 'Deployments-1', TaskId: 'ServerTasks-77' },
      isLoading: false,
      error: null,
    });

    render(<DeploymentDetailScreen />);

    expect(screen.getByText('Redirecting to task...')).toBeTruthy();
    expect(mockRouter.replace).toHaveBeenCalledWith('/task/ServerTasks-77');
  });

  it('does not redirect when the deployment has no task id', () => {
    mockUseDeployment.mockReturnValue({
      data: { Id: 'Deployments-1', TaskId: null },
      isLoading: false,
      error: null,
    });

    render(<DeploymentDetailScreen />);

    expect(screen.getByText('Redirecting to task...')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
