/**
 * Tests for NotificationsContext
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import {
  NotificationsProvider,
  useNotifications,
  getInterruptionTypeLabel,
  canRespond,
  getAvailableActions,
} from '../../src/context/NotificationsContext';
import { useAuth } from '../../src/context/AuthContext';
import * as security from '../../src/lib/security';
import * as apiClient from '../../src/lib/api/client';
import {
  usePendingInterruptions,
  useSubmitInterruption,
  useTakeResponsibility,
} from '../../src/hooks/useOctopusQuery';
import type { Interruption } from '../../src/lib/api/types';

// Mock the auth context so we can control auth state directly
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock query hooks used for current-space polling and mutations
jest.mock('../../src/hooks/useOctopusQuery');

// Mock the security module and API client
jest.mock('../../src/lib/security');
jest.mock('../../src/lib/api/client');

const mockUseAuth = useAuth as jest.Mock;
const mockUsePendingInterruptions = usePendingInterruptions as jest.Mock;
const mockUseSubmitInterruption = useSubmitInterruption as jest.Mock;
const mockUseTakeResponsibility = useTakeResponsibility as jest.Mock;
const mockSecurity = security as jest.Mocked<typeof security>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const makeInterruption = (id: string, guidance?: string): Interruption =>
  ({
    Id: id,
    Title: `Interruption ${id}`,
    IsPending: true,
    Form: guidance ? { Values: { Guidance: guidance } } : { Values: {} },
  } as unknown as Interruption);

describe('NotificationsContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <NotificationsProvider>{children}</NotificationsProvider>
  );

  let mockRefetch: jest.Mock;
  let mockSubmitMutateAsync: jest.Mock;
  let mockResponsibilityMutateAsync: jest.Mock;
  let appStateHandler: ((state: string) => void) | null;

  beforeEach(() => {
    jest.clearAllMocks();
    appStateHandler = null;

    // Ensure currentState is a string so appState.current.match() works
    (AppState as { currentState: string }).currentState = 'active';

    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _type: string,
      handler: (state: string) => void
    ) => {
      appStateHandler = handler;
      return { remove: jest.fn() };
    }) as never);

    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      currentSpace: { Id: 'Spaces-1', Name: 'Default' },
      currentInstance: { id: 'inst-1', name: 'Primary' },
    });

    mockRefetch = jest.fn();
    mockUsePendingInterruptions.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    mockSubmitMutateAsync = jest.fn().mockResolvedValue(undefined);
    mockUseSubmitInterruption.mockReturnValue({
      mutateAsync: mockSubmitMutateAsync,
      isPending: false,
    });

    mockResponsibilityMutateAsync = jest.fn().mockResolvedValue(undefined);
    mockUseTakeResponsibility.mockReturnValue({
      mutateAsync: mockResponsibilityMutateAsync,
      isPending: false,
    });

    mockSecurity.getAllInstanceCredentials.mockResolvedValue([
      { instanceId: 'inst-1', instanceName: 'Primary', serverUrl: 'https://a.example.com', apiKey: 'API-1' },
      { instanceId: 'inst-2', instanceName: 'Secondary', serverUrl: 'https://b.example.com', apiKey: 'API-2' },
    ]);

    mockApiClient.getAllPendingInterruptions.mockResolvedValue({
      interruptions: [],
      authFailures: [],
    });
    mockApiClient.submitInterruptionForInstance.mockResolvedValue(undefined as never);
    mockApiClient.takeResponsibilityForInstance.mockResolvedValue(undefined as never);
  });

  describe('useNotifications hook', () => {
    it('should throw if used outside NotificationsProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useNotifications());
      }).toThrow('useNotifications must be used within a NotificationsProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('cross-instance polling', () => {
    it('should poll all instances on mount when authenticated', async () => {
      const crossInterruption = {
        instanceId: 'inst-2',
        instanceName: 'Secondary',
        serverUrl: 'https://b.example.com',
        spaceId: 'Spaces-9',
        spaceName: 'Other',
        interruption: makeInterruption('Interruptions-10'),
      };
      mockApiClient.getAllPendingInterruptions.mockResolvedValue({
        interruptions: [crossInterruption],
        authFailures: [],
      } as never);

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() =>
        expect(result.current.crossInstanceInterruptions).toHaveLength(1)
      );

      expect(mockSecurity.getAllInstanceCredentials).toHaveBeenCalled();
      expect(mockApiClient.getAllPendingInterruptions).toHaveBeenCalled();
      expect(result.current.lastCrossInstancePoll).toBeInstanceOf(Date);
      expect(result.current.crossInstanceTotalCount).toBe(1);
      expect(result.current.crossInstanceError).toBeNull();
    });

    it('should not poll when not authenticated', async () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        currentSpace: null,
        currentInstance: null,
      });

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => expect(result.current.isCrossInstanceLoading).toBe(false));

      expect(mockApiClient.getAllPendingInterruptions).not.toHaveBeenCalled();
      expect(result.current.crossInstanceInterruptions).toEqual([]);
      expect(result.current.totalCount).toBe(0);
    });

    it('should clear interruptions when no instance credentials exist', async () => {
      mockSecurity.getAllInstanceCredentials.mockResolvedValue([]);

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => expect(result.current.isCrossInstanceLoading).toBe(false));
      await waitFor(() =>
        expect(mockSecurity.getAllInstanceCredentials).toHaveBeenCalled()
      );

      expect(mockApiClient.getAllPendingInterruptions).not.toHaveBeenCalled();
      expect(result.current.crossInstanceInterruptions).toEqual([]);
      expect(result.current.crossInstanceAuthFailures).toEqual([]);
    });

    it('should record auth failures from polling', async () => {
      mockApiClient.getAllPendingInterruptions.mockResolvedValue({
        interruptions: [],
        authFailures: [
          { instanceId: 'inst-2', instanceName: 'Secondary', serverUrl: 'https://b.example.com', error: 'Unauthorized' },
        ],
      } as never);

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() =>
        expect(result.current.crossInstanceAuthFailures).toHaveLength(1)
      );

      act(() => {
        result.current.clearCrossInstanceAuthFailure('inst-2');
      });

      expect(result.current.crossInstanceAuthFailures).toEqual([]);
    });

    it('should set crossInstanceError when polling fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockApiClient.getAllPendingInterruptions.mockRejectedValue(new Error('Network down'));

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() =>
        expect(result.current.crossInstanceError).toEqual(new Error('Network down'))
      );

      expect(result.current.isCrossInstanceLoading).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should handle credential loading failures gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockSecurity.getAllInstanceCredentials.mockRejectedValue(new Error('Keychain error'));

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => expect(result.current.isCrossInstanceLoading).toBe(false));
      await waitFor(() =>
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to load instance credentials:',
          expect.any(Error)
        )
      );

      expect(mockApiClient.getAllPendingInterruptions).not.toHaveBeenCalled();
      expect(result.current.crossInstanceInterruptions).toEqual([]);

      consoleSpy.mockRestore();
    });

    it('should re-poll via refetchCrossInstance', async () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() =>
        expect(mockApiClient.getAllPendingInterruptions).toHaveBeenCalledTimes(1)
      );

      await act(async () => {
        await result.current.refetchCrossInstance();
      });

      expect(mockApiClient.getAllPendingInterruptions).toHaveBeenCalledTimes(2);
    });

    it('should poll when app returns to foreground', async () => {
      renderHook(() => useNotifications(), { wrapper });

      await waitFor(() =>
        expect(mockApiClient.getAllPendingInterruptions).toHaveBeenCalledTimes(1)
      );
      expect(appStateHandler).not.toBeNull();

      await act(async () => {
        appStateHandler!('background');
        appStateHandler!('active');
      });

      await waitFor(() =>
        expect(mockApiClient.getAllPendingInterruptions).toHaveBeenCalledTimes(2)
      );
    });
  });

  describe('counts', () => {
    it('should count manual interventions and guided failures with dedupe', async () => {
      // Current space interruptions
      mockUsePendingInterruptions.mockReturnValue({
        data: [
          makeInterruption('Interruptions-1', 'GuidedFailure'),
          makeInterruption('Interruptions-2'),
        ],
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      mockApiClient.getAllPendingInterruptions.mockResolvedValue({
        interruptions: [
          // Same instance/space as current - should be excluded
          {
            instanceId: 'inst-1',
            instanceName: 'Primary',
            serverUrl: 'https://a.example.com',
            spaceId: 'Spaces-1',
            spaceName: 'Default',
            interruption: makeInterruption('Interruptions-99'),
          },
          // Duplicate ID of current-space interruption - should be excluded
          {
            instanceId: 'inst-2',
            instanceName: 'Secondary',
            serverUrl: 'https://b.example.com',
            spaceId: 'Spaces-9',
            spaceName: 'Other',
            interruption: makeInterruption('Interruptions-2'),
          },
          // New cross-instance guided failure - should be counted
          {
            instanceId: 'inst-2',
            instanceName: 'Secondary',
            serverUrl: 'https://b.example.com',
            spaceId: 'Spaces-9',
            spaceName: 'Other',
            interruption: makeInterruption('Interruptions-3', 'GuidedFailure'),
          },
        ],
        authFailures: [],
      } as never);

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() =>
        expect(result.current.crossInstanceInterruptions).toHaveLength(3)
      );

      expect(result.current.guidedFailureCount).toBe(2);
      expect(result.current.manualInterventionCount).toBe(1);
      expect(result.current.totalCount).toBe(3);
      expect(result.current.pendingInterruptions).toHaveLength(2);
    });
  });

  describe('submitInterruption', () => {
    it('should submit via mutation for the current instance', async () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => expect(result.current.isCrossInstanceLoading).toBe(false));

      await act(async () => {
        await result.current.submitInterruption('Interruptions-1', 'Proceed', 'looks good');
      });

      expect(mockSubmitMutateAsync).toHaveBeenCalledWith({
        interruptionId: 'Interruptions-1',
        action: 'Proceed',
        notes: 'looks good',
      });
      expect(mockRefetch).toHaveBeenCalled();
      expect(mockApiClient.submitInterruptionForInstance).not.toHaveBeenCalled();
    });

    it('should submit cross-instance when instanceId and spaceId provided', async () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      // Wait for the credential cache to populate via the initial poll
      await waitFor(() =>
        expect(mockApiClient.getAllPendingInterruptions).toHaveBeenCalledTimes(1)
      );

      await act(async () => {
        await result.current.submitInterruption(
          'Interruptions-5',
          'Retry',
          'retrying',
          'inst-2',
          'Spaces-9'
        );
      });

      expect(mockApiClient.submitInterruptionForInstance).toHaveBeenCalledWith(
        expect.objectContaining({ instanceId: 'inst-2' }),
        'Spaces-9',
        'Interruptions-5',
        'Retry',
        'retrying'
      );
      // Should re-poll after cross-instance submission
      expect(mockApiClient.getAllPendingInterruptions).toHaveBeenCalledTimes(2);
      expect(mockSubmitMutateAsync).not.toHaveBeenCalled();
    });

    it('should throw when cross-instance credentials are missing', async () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() =>
        expect(mockApiClient.getAllPendingInterruptions).toHaveBeenCalledTimes(1)
      );

      await expect(
        result.current.submitInterruption(
          'Interruptions-5',
          'Abort',
          undefined,
          'inst-unknown',
          'Spaces-9'
        )
      ).rejects.toThrow('Instance credentials not found');
    });
  });

  describe('takeResponsibility', () => {
    it('should take responsibility via mutation for the current instance', async () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => expect(result.current.isCrossInstanceLoading).toBe(false));

      await act(async () => {
        await result.current.takeResponsibility('Interruptions-1');
      });

      expect(mockResponsibilityMutateAsync).toHaveBeenCalledWith('Interruptions-1');
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should take responsibility cross-instance', async () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() =>
        expect(mockApiClient.getAllPendingInterruptions).toHaveBeenCalledTimes(1)
      );

      await act(async () => {
        await result.current.takeResponsibility('Interruptions-5', 'inst-2', 'Spaces-9');
      });

      expect(mockApiClient.takeResponsibilityForInstance).toHaveBeenCalledWith(
        expect.objectContaining({ instanceId: 'inst-2' }),
        'Spaces-9',
        'Interruptions-5'
      );
      expect(mockApiClient.getAllPendingInterruptions).toHaveBeenCalledTimes(2);
      expect(mockResponsibilityMutateAsync).not.toHaveBeenCalled();
    });

    it('should throw when cross-instance credentials are missing', async () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() =>
        expect(mockApiClient.getAllPendingInterruptions).toHaveBeenCalledTimes(1)
      );

      await expect(
        result.current.takeResponsibility('Interruptions-5', 'inst-unknown', 'Spaces-9')
      ).rejects.toThrow('Instance credentials not found');
    });
  });

  describe('isSubmitting', () => {
    it('should be true when the submit mutation is pending', async () => {
      mockUseSubmitInterruption.mockReturnValue({
        mutateAsync: mockSubmitMutateAsync,
        isPending: true,
      });

      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => expect(result.current.isCrossInstanceLoading).toBe(false));

      expect(result.current.isSubmitting).toBe(true);
    });

    it('should be false when no mutation is pending', async () => {
      const { result } = renderHook(() => useNotifications(), { wrapper });

      await waitFor(() => expect(result.current.isCrossInstanceLoading).toBe(false));

      expect(result.current.isSubmitting).toBe(false);
    });
  });
});

describe('getInterruptionTypeLabel', () => {
  it('should return Guided Failure for guided failure interruptions', () => {
    expect(getInterruptionTypeLabel(makeInterruption('I-1', 'GuidedFailure'))).toBe(
      'Guided Failure'
    );
  });

  it('should return Manual Intervention otherwise', () => {
    expect(getInterruptionTypeLabel(makeInterruption('I-1'))).toBe('Manual Intervention');
  });
});

describe('canRespond', () => {
  it('should return true when user has responsibility', () => {
    const interruption = {
      ...makeInterruption('I-1'),
      HasResponsibility: true,
      ResponsibleUserId: 'Users-2',
    } as unknown as Interruption;

    expect(canRespond(interruption)).toBe(true);
  });

  it('should return true when nobody is responsible', () => {
    const interruption = {
      ...makeInterruption('I-1'),
      HasResponsibility: false,
      ResponsibleUserId: null,
    } as unknown as Interruption;

    expect(canRespond(interruption)).toBe(true);
  });

  it('should return false when someone else is responsible', () => {
    const interruption = {
      ...makeInterruption('I-1'),
      HasResponsibility: false,
      ResponsibleUserId: 'Users-2',
    } as unknown as Interruption;

    expect(canRespond(interruption)).toBe(false);
  });
});

describe('getAvailableActions', () => {
  it('should return guided failure actions', () => {
    const actions = getAvailableActions(makeInterruption('I-1', 'GuidedFailure'));

    expect(actions.map(a => a.key)).toEqual(['Retry', 'Fail', 'Ignore', 'Exclude']);
  });

  it('should return manual intervention actions', () => {
    const actions = getAvailableActions(makeInterruption('I-1'));

    expect(actions.map(a => a.key)).toEqual(['Proceed', 'Abort']);
  });
});
