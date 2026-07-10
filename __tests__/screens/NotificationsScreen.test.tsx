/**
 * Tests for the Notifications screen
 * Covers the intervention confirmation modal, including the
 * `!!notes` notes-preview branch both ways.
 */

import React from 'react';
import { Alert, Modal, RefreshControl } from 'react-native';
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

  it('shows the loading screen when loading with nothing to display', () => {
    mockUseNotifications.mockReturnValue(
      buildNotifications({
        pendingInterruptions: [],
        isLoading: true,
        totalCount: 0,
      })
    );

    render(<NotificationsScreen />);

    expect(screen.getByText('Loading notifications...')).toBeTruthy();
  });

  it('formats relative timestamps for hours, days and just now', () => {
    mockUseNotifications.mockReturnValue(
      buildNotifications({
        pendingInterruptions: [
          makeInterruption({ Id: 'Interruptions-now', Created: new Date().toISOString() }),
          makeInterruption({
            Id: 'Interruptions-hours',
            Created: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          }),
          makeInterruption({
            Id: 'Interruptions-days',
            Created: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        ],
        totalCount: 3,
        manualInterventionCount: 3,
      })
    );

    render(<NotificationsScreen />);

    expect(screen.getByText('Just now')).toBeTruthy();
    expect(screen.getByText('2h ago')).toBeTruthy();
    expect(screen.getByText('3d ago')).toBeTruthy();
  });

  it('navigates to the task when the task context row is pressed', () => {
    render(<NotificationsScreen />);

    fireEvent.press(screen.getByText('Deploy Web App 1.0.0 to Production'));

    expect(mockPush).toHaveBeenCalledWith('/task/ServerTasks-1');
  });

  it('refetches both current and cross-instance data on pull to refresh', () => {
    const notifications = buildNotifications();
    mockUseNotifications.mockReturnValue(notifications);

    render(<NotificationsScreen />);

    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');

    expect(notifications.refetch).toHaveBeenCalled();
    expect(notifications.refetchCrossInstance).toHaveBeenCalled();
  });

  it('shows a confirmation message per guided-failure action and cancels cleanly', async () => {
    const notifications = buildNotifications({
      pendingInterruptions: [
        makeInterruption({
          Id: 'Interruptions-2',
          Title: 'Step failed on web-01',
          Form: { Values: { Guidance: 'GuidedFailure' }, Elements: [] },
        }),
      ],
      manualInterventionCount: 0,
      guidedFailureCount: 1,
    });
    mockUseNotifications.mockReturnValue(notifications);

    render(<NotificationsScreen />);

    fireEvent.press(screen.getByText('Guided Failure'));

    // Retry -> cancel
    fireEvent.press(screen.getByText('Retry'));
    expect(screen.getByText('This will retry the failed step.')).toBeTruthy();
    fireEvent.press(screen.getByText('Cancel'));
    expect(screen.queryByText('This will retry the failed step.')).toBeNull();

    // Fail -> cancel
    fireEvent.press(screen.getByText('Fail'));
    expect(
      screen.getByText('This will mark the step as failed and stop the deployment.')
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Cancel'));

    // Ignore -> cancel
    fireEvent.press(screen.getByText('Ignore'));
    expect(
      screen.getByText('This will ignore the failure and continue with the deployment.')
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Cancel'));

    // Exclude (ghost variant) -> confirm
    fireEvent.press(screen.getByText('Exclude Machine'));
    expect(
      screen.getByText('This will exclude the machine and continue with the deployment.')
    ).toBeTruthy();
    const excludeButtons = screen.getAllByText('Exclude Machine');
    fireEvent.press(excludeButtons[excludeButtons.length - 1]);

    await waitFor(() => {
      expect(notifications.submitInterruption).toHaveBeenCalledWith(
        'Interruptions-2',
        'Exclude',
        undefined,
        undefined,
        undefined
      );
    });
  });

  it('closes the confirmation modal via the hardware back handler and stops content presses', () => {
    render(<NotificationsScreen />);

    expandIntervention();
    fireEvent.press(screen.getByText('Proceed'));
    expect(screen.getByText('Confirm Proceed')).toBeTruthy();

    // Pressing the modal content should not dismiss (stopPropagation)
    fireEvent.press(screen.getByText('Confirm Proceed'), { stopPropagation: () => {} });
    expect(screen.getByText('Confirm Proceed')).toBeTruthy();

    // The first Modal belongs to the intervention card
    fireEvent(screen.UNSAFE_getAllByType(Modal)[0], 'requestClose');
    expect(screen.queryByText('Confirm Proceed')).toBeNull();
  });

  it('alerts when submitting a response fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const notifications = buildNotifications({
      submitInterruption: jest.fn().mockRejectedValue(new Error('boom')),
    });
    mockUseNotifications.mockReturnValue(notifications);

    render(<NotificationsScreen />);

    expandIntervention();
    fireEvent.press(screen.getByText('Abort'));
    const abortButtons = screen.getAllByText('Abort');
    fireEvent.press(abortButtons[abortButtons.length - 1]);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Failed to submit response. Please try again.'
      );
    });
  });

  it('alerts when taking responsibility fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const notifications = buildNotifications({
      pendingInterruptions: [
        makeInterruption({
          HasResponsibility: false,
          ResponsibleUserId: null,
          CanTakeResponsibility: true,
        }),
      ],
      takeResponsibility: jest.fn().mockRejectedValue(new Error('boom')),
    });
    mockUseNotifications.mockReturnValue(notifications);

    render(<NotificationsScreen />);

    expandIntervention();
    fireEvent.press(screen.getByText('Take Responsibility'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Failed to take responsibility. Please try again.'
      );
    });
  });

  describe('cross-instance interruptions', () => {
    const makeCrossInstance = (overrides: Record<string, unknown> = {}) => ({
      interruption: makeInterruption({ Id: 'Interruptions-x1', Title: 'Approve on staging box' }),
      instanceId: 'instance-2',
      instanceName: 'Staging Instance',
      spaceId: 'Spaces-9',
      spaceName: 'Default',
      ...overrides,
    });

    it('renders the cross-instance section, filters duplicates and submits with instance context', async () => {
      const notifications = buildNotifications({
        crossInstanceInterruptions: [
          // Same instance + space as current: filtered out
          makeCrossInstance({
            interruption: makeInterruption({ Id: 'Interruptions-dup', Title: 'Duplicate item' }),
            instanceId: 'instance-1',
            spaceId: 'Spaces-1',
          }),
          makeCrossInstance(),
        ],
        lastCrossInstancePoll: new Date('2026-07-10T10:30:00'),
      });
      mockUseNotifications.mockReturnValue(notifications);

      render(<NotificationsScreen />);

      expect(screen.getByText('Current Space')).toBeTruthy();
      expect(screen.getByText('Other Instances & Spaces')).toBeTruthy();
      expect(screen.getByText(/Last checked:/)).toBeTruthy();
      expect(screen.getByText('Staging Instance • Default')).toBeTruthy();
      expect(screen.queryByText('Duplicate item')).toBeNull();

      // Expand the cross-instance card (second Manual Intervention label)
      const labels = screen.getAllByText('Manual Intervention');
      fireEvent.press(labels[labels.length - 1]);

      fireEvent.press(screen.getByText('Proceed'));
      const proceedButtons = screen.getAllByText('Proceed');
      fireEvent.press(proceedButtons[proceedButtons.length - 1]);

      await waitFor(() => {
        expect(notifications.submitInterruption).toHaveBeenCalledWith(
          'Interruptions-x1',
          'Proceed',
          undefined,
          'instance-2',
          'Spaces-9'
        );
      });
    });

    it('takes responsibility with the instance and space of the cross-instance item', async () => {
      const notifications = buildNotifications({
        pendingInterruptions: [],
        crossInstanceInterruptions: [
          makeCrossInstance({
            interruption: makeInterruption({
              Id: 'Interruptions-x2',
              HasResponsibility: false,
              ResponsibleUserId: null,
              CanTakeResponsibility: true,
            }),
          }),
        ],
      });
      mockUseNotifications.mockReturnValue(notifications);

      render(<NotificationsScreen />);

      fireEvent.press(screen.getByText('Manual Intervention'));
      fireEvent.press(screen.getByText('Take Responsibility'));

      await waitFor(() => {
        expect(notifications.takeResponsibility).toHaveBeenCalledWith(
          'Interruptions-x2',
          'instance-2',
          'Spaces-9'
        );
      });
    });
  });

  describe('cross-instance auth failure modal', () => {
    const authFailure = {
      instanceId: 'instance-2',
      instanceName: 'Staging Instance',
      serverUrl: 'https://staging.octopus.app',
      message: 'Invalid API key.',
    };

    const renderWithAuthFailure = (overrides: Record<string, unknown> = {}) => {
      const notifications = buildNotifications({
        crossInstanceAuthFailures: [authFailure],
        ...overrides,
      });
      mockUseNotifications.mockReturnValue(notifications);
      render(<NotificationsScreen />);
      return notifications;
    };

    it('shows the failure details and dismisses via the hardware back handler', () => {
      const notifications = renderWithAuthFailure();

      expect(screen.getByText('Instance Login Failed')).toBeTruthy();
      expect(screen.getByText(/Could not authenticate "Staging Instance"/)).toBeTruthy();
      expect(screen.getByText('https://staging.octopus.app')).toBeTruthy();

      const modals = screen.UNSAFE_getAllByType(Modal);
      fireEvent(modals[modals.length - 1], 'requestClose');

      expect(notifications.clearCrossInstanceAuthFailure).toHaveBeenCalledWith('instance-2');
      // The mocked failure list never empties, so the effect re-opens the
      // modal immediately; the dismissal handler having run is what matters.
    });

    it('removes the failed instance successfully', async () => {
      const deleteInstance = jest.fn().mockResolvedValue(undefined);
      mockUseAuth.mockReturnValue({
        currentInstance: { id: 'instance-1' },
        currentSpace: { Id: 'Spaces-1' },
        deleteInstance,
        updateInstanceApiKey: jest.fn(),
      });
      const notifications = renderWithAuthFailure();

      fireEvent.press(screen.getByText('Remove Instance'));

      await waitFor(() => {
        expect(deleteInstance).toHaveBeenCalledWith('instance-2');
        expect(notifications.clearCrossInstanceAuthFailure).toHaveBeenCalledWith('instance-2');
        expect(notifications.refetchCrossInstance).toHaveBeenCalled();
      });
    });

    it('alerts when removing the failed instance fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      mockUseAuth.mockReturnValue({
        currentInstance: { id: 'instance-1' },
        currentSpace: { Id: 'Spaces-1' },
        deleteInstance: jest.fn().mockRejectedValue(new Error('nope')),
        updateInstanceApiKey: jest.fn(),
      });
      renderWithAuthFailure();

      fireEvent.press(screen.getByText('Remove Instance'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Remove Failed',
          'Could not remove this instance. Please try again.'
        );
      });
    });

    it('walks through the API key editor: back, empty key, rejected key, then success', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const updateInstanceApiKey = jest
        .fn()
        .mockResolvedValueOnce({ success: false, error: 'Key was rejected' })
        .mockResolvedValueOnce({ success: true });
      mockUseAuth.mockReturnValue({
        currentInstance: { id: 'instance-1' },
        currentSpace: { Id: 'Spaces-1' },
        deleteInstance: jest.fn(),
        updateInstanceApiKey,
      });
      const notifications = renderWithAuthFailure();

      // Open the editor, then go back
      fireEvent.press(screen.getByText('Update API Key'));
      expect(screen.getByText(/Enter a new API key for "Staging Instance"/)).toBeTruthy();
      fireEvent.press(screen.getByText('Back'));
      expect(screen.getByText('Remove Instance')).toBeTruthy();

      // Open again and try to save an empty key
      fireEvent.press(screen.getByText('Update API Key'));
      fireEvent.press(screen.getByText('Save Key'));
      expect(alertSpy).toHaveBeenCalledWith('API Key Required', 'Please enter a new API key.');
      expect(updateInstanceApiKey).not.toHaveBeenCalled();

      // Save a key that the server rejects
      fireEvent.changeText(screen.getByPlaceholderText('New API key'), 'API-BADKEY');
      fireEvent.press(screen.getByText('Save Key'));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Update Failed', 'Key was rejected');
      });

      // Save again; this time it succeeds
      fireEvent.press(screen.getByText('Save Key'));
      await waitFor(() => {
        expect(notifications.clearCrossInstanceAuthFailure).toHaveBeenCalledWith('instance-2');
        expect(notifications.refetchCrossInstance).toHaveBeenCalled();
      });
    });

    it('alerts when updating the API key throws', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      mockUseAuth.mockReturnValue({
        currentInstance: { id: 'instance-1' },
        currentSpace: { Id: 'Spaces-1' },
        deleteInstance: jest.fn(),
        updateInstanceApiKey: jest.fn().mockRejectedValue(new Error('network down')),
      });
      renderWithAuthFailure();

      fireEvent.press(screen.getByText('Update API Key'));
      fireEvent.changeText(screen.getByPlaceholderText('New API key'), 'API-NEWKEY');
      fireEvent.press(screen.getByText('Save Key'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Update Failed',
          'Could not update the API key. Please try again.'
        );
      });
    });
  });
});
