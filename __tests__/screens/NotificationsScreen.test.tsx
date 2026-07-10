/**
 * Tests for the Notifications screen
 * Covers the intervention confirmation modal, including the
 * `!!notes` notes-preview branch both ways.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Stack: { Screen: () => null },
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/context/NotificationsContext', () => {
  const actual = jest.requireActual('../../src/context/NotificationsContext');
  return {
    ...actual,
    useNotifications: jest.fn(),
  };
});

jest.mock('../../src/hooks/useOctopusQuery', () => ({
  useTask: jest.fn(),
}));

import { useAuth } from '../../src/context/AuthContext';
import { useNotifications } from '../../src/context/NotificationsContext';
import { useTask } from '../../src/hooks/useOctopusQuery';
import NotificationsScreen from '../../app/notifications';

const mockUseAuth = useAuth as jest.Mock;
const mockUseNotifications = useNotifications as unknown as jest.Mock;
const mockUseTask = useTask as jest.Mock;

const makeInterruption = (overrides: Record<string, unknown> = {}) => ({
  Id: 'Interruptions-1',
  Title: 'Approve production deployment',
  Created: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  IsPending: true,
  Form: {
    Values: {},
    Elements: [
      {
        Name: 'Instructions',
        Control: { Type: 'Paragraph', Text: 'Please verify before continuing' },
        IsValueRequired: false,
      },
    ],
  },
  RelatedDocumentIds: [],
  ResponsibleTeamIds: [],
  ResponsibleUserId: 'Users-1',
  CanTakeResponsibility: true,
  HasResponsibility: true,
  TaskId: 'ServerTasks-1',
  CorrelationId: '',
  IsLinkedToOtherInterruption: false,
  SpaceId: 'Spaces-1',
  ...overrides,
});

const buildNotifications = (overrides: Record<string, unknown> = {}) => ({
  pendingInterruptions: [makeInterruption()],
  isLoading: false,
  totalCount: 1,
  manualInterventionCount: 1,
  guidedFailureCount: 0,
  refetch: jest.fn(),
  refetchCrossInstance: jest.fn(),
  submitInterruption: jest.fn().mockResolvedValue(undefined),
  takeResponsibility: jest.fn().mockResolvedValue(undefined),
  isSubmitting: false,
  crossInstanceInterruptions: [],
  crossInstanceAuthFailures: [],
  clearCrossInstanceAuthFailure: jest.fn(),
  isCrossInstanceLoading: false,
  lastCrossInstancePoll: null,
  ...overrides,
});

describe('NotificationsScreen', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      currentInstance: { id: 'instance-1' },
      currentSpace: { Id: 'Spaces-1' },
      deleteInstance: jest.fn(),
      updateInstanceApiKey: jest.fn(),
    });
    mockUseTask.mockReturnValue({
      data: { Id: 'ServerTasks-1', Description: 'Deploy Web App 1.0.0 to Production' },
    });
    mockUseNotifications.mockReturnValue(buildNotifications());
  });

  const expandIntervention = () => {
    fireEvent.press(screen.getByText('Manual Intervention'));
  };

  it('renders a pending manual intervention with its task context', () => {
    render(<NotificationsScreen />);

    expect(screen.getByText('Manual Intervention')).toBeTruthy();
    expect(screen.getByText('Approve production deployment')).toBeTruthy();
    expect(screen.getByText('Deploy Web App 1.0.0 to Production')).toBeTruthy();
  });

  it('shows the notes preview in the confirmation modal when notes were entered', async () => {
    const notifications = buildNotifications();
    mockUseNotifications.mockReturnValue(notifications);

    render(<NotificationsScreen />);

    expandIntervention();
    expect(screen.getByText('Please verify before continuing')).toBeTruthy();

    fireEvent.press(screen.getByText('Add notes (optional)'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Add notes about your decision...'),
      'Checked with the release manager'
    );

    fireEvent.press(screen.getByText('Proceed'));

    // Confirmation modal with notes preview
    expect(screen.getByText('Confirm Proceed')).toBeTruthy();
    expect(screen.getByText('Your notes:')).toBeTruthy();
    expect(screen.getByText('Checked with the release manager')).toBeTruthy();

    // Confirm the action: the modal confirm button is the last 'Proceed'
    const proceedButtons = screen.getAllByText('Proceed');
    fireEvent.press(proceedButtons[proceedButtons.length - 1]);

    await waitFor(() => {
      expect(notifications.submitInterruption).toHaveBeenCalledWith(
        'Interruptions-1',
        'Proceed',
        'Checked with the release manager',
        undefined,
        undefined
      );
    });
  });

  it('does not show a notes preview when no notes were entered', () => {
    render(<NotificationsScreen />);

    expandIntervention();
    fireEvent.press(screen.getByText('Abort'));

    expect(screen.getByText('Confirm Abort')).toBeTruthy();
    expect(
      screen.getByText(/This will reject the intervention and abort the deployment/)
    ).toBeTruthy();
    expect(screen.queryByText('Your notes:')).toBeNull();
  });

  it('shows the take-responsibility flow when the user has no responsibility', () => {
    const notifications = buildNotifications({
      pendingInterruptions: [
        makeInterruption({
          HasResponsibility: false,
          ResponsibleUserId: null,
          CanTakeResponsibility: true,
        }),
      ],
    });
    mockUseNotifications.mockReturnValue(notifications);

    render(<NotificationsScreen />);

    expandIntervention();

    expect(
      screen.getByText('You need to take responsibility before you can respond')
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Take Responsibility'));
    expect(notifications.takeResponsibility).toHaveBeenCalledWith(
      'Interruptions-1',
      undefined,
      undefined
    );
  });

  it('renders guided failure actions and the summary header for multiple interventions', () => {
    mockUseNotifications.mockReturnValue(
      buildNotifications({
        pendingInterruptions: [
          makeInterruption(),
          makeInterruption({
            Id: 'Interruptions-2',
            Title: 'Step failed on web-01',
            Form: { Values: { Guidance: 'GuidedFailure' }, Elements: [] },
          }),
        ],
        totalCount: 2,
        manualInterventionCount: 1,
        guidedFailureCount: 1,
      })
    );

    render(<NotificationsScreen />);

    expect(screen.getByText('Total Pending')).toBeTruthy();

    // 'Guided Failure' appears in the summary header and as the card type
    // label; expand the card via its type label (the last occurrence).
    const guidedFailureLabels = screen.getAllByText('Guided Failure');
    fireEvent.press(guidedFailureLabels[guidedFailureLabels.length - 1]);
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.getByText('Exclude Machine')).toBeTruthy();
  });

  it('navigates to the task when View Full Task is pressed', () => {
    render(<NotificationsScreen />);

    expandIntervention();
    fireEvent.press(screen.getByText('View Full Task'));

    expect(mockPush).toHaveBeenCalledWith('/task/ServerTasks-1');
  });

  it('shows the empty state when there is nothing pending', () => {
    mockUseNotifications.mockReturnValue(
      buildNotifications({
        pendingInterruptions: [],
        totalCount: 0,
        manualInterventionCount: 0,
        guidedFailureCount: 0,
      })
    );

    render(<NotificationsScreen />);

    expect(screen.getByText('All Clear!')).toBeTruthy();
  });
});
