/**
 * Notifications Context
 * Manages pending interventions and other in-app notifications
 * Supports cross-instance polling for interventions across all configured instances/spaces
 */

import React, { createContext, useContext, useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePendingInterruptions, useSubmitInterruption, useTakeResponsibility } from '../hooks/useOctopusQuery';
import type { Interruption } from '../lib/api/types';
import { useAuth } from './AuthContext';
import { getAllInstanceCredentials } from '../lib/security';
import { 
  getAllPendingInterruptions, 
  submitInterruptionForInstance, 
  takeResponsibilityForInstance,
  type CrossInstanceInterruption,
  type CrossInstanceAuthFailure,
  type InstanceCredentials,
} from '../lib/api/client';

// Cross-instance polling interval (2 minutes)
const CROSS_INSTANCE_POLL_INTERVAL = 2 * 60 * 1000;

interface NotificationsContextType {
  // Current space interruptions (for fast polling)
  pendingInterruptions: Interruption[];
  isLoading: boolean;
  error: Error | null;
  
  // Cross-instance interruptions (all instances/spaces)
  crossInstanceInterruptions: CrossInstanceInterruption[];
  crossInstanceAuthFailures: CrossInstanceAuthFailure[];
  isCrossInstanceLoading: boolean;
  crossInstanceError: Error | null;
  lastCrossInstancePoll: Date | null;
  
  // Counts (combined)
  totalCount: number;
  manualInterventionCount: number;
  guidedFailureCount: number;
  
  // Cross-instance specific counts
  crossInstanceTotalCount: number;
  
  // Actions
  refetch: () => void;
  refetchCrossInstance: () => Promise<void>;
  clearCrossInstanceAuthFailure: (instanceId: string) => void;
  submitInterruption: (
    interruptionId: string,
    action: 'Proceed' | 'Abort' | 'Fail' | 'Retry' | 'Ignore' | 'Exclude',
    notes?: string,
    // Optional: for cross-instance submissions
    instanceId?: string,
    spaceId?: string
  ) => Promise<void>;
  takeResponsibility: (
    interruptionId: string,
    // Optional: for cross-instance
    instanceId?: string,
    spaceId?: string
  ) => Promise<void>;
  isSubmitting: boolean;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, currentSpace, currentInstance } = useAuth();
  
  // Cross-instance state
  const [crossInstanceInterruptions, setCrossInstanceInterruptions] = useState<CrossInstanceInterruption[]>([]);
  const [crossInstanceAuthFailures, setCrossInstanceAuthFailures] = useState<CrossInstanceAuthFailure[]>([]);
  const [isCrossInstanceLoading, setIsCrossInstanceLoading] = useState(false);
  const [crossInstanceError, setCrossInstanceError] = useState<Error | null>(null);
  const [lastCrossInstancePoll, setLastCrossInstancePoll] = useState<Date | null>(null);
  const [instanceCredentialsCache, setInstanceCredentialsCache] = useState<InstanceCredentials[]>([]);
  
  // Refs for managing polling
  const crossInstancePollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);
  
  // Fetch pending interruptions for current space - fast polling (30 seconds)
  const {
    data: interruptions = [],
    isLoading,
    error,
    refetch,
  } = usePendingInterruptions({
    enabled: isAuthenticated && !!currentSpace,
    refetchInterval: 30 * 1000,
  });

  // Mutations for current instance
  const submitMutation = useSubmitInterruption();
  const responsibilityMutation = useTakeResponsibility();

  // Load instance credentials for cross-instance polling
  const loadInstanceCredentials = useCallback(async () => {
    try {
      const credentials = await getAllInstanceCredentials();
      // Map to the format expected by the API functions
      const mapped: InstanceCredentials[] = credentials.map(c => ({
        instanceId: c.instanceId,
        instanceName: c.instanceName,
        serverUrl: c.serverUrl,
        apiKey: c.apiKey,
      }));
      setInstanceCredentialsCache(mapped);
      return mapped;
    } catch (error) {
      console.error('Failed to load instance credentials:', error);
      return [];
    }
  }, []);

  // Cross-instance polling function
  const pollCrossInstance = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setIsCrossInstanceLoading(true);
    setCrossInstanceError(null);
    
    try {
      // Get latest credentials
      const credentials = await loadInstanceCredentials();
      
      if (credentials.length === 0) {
        setCrossInstanceInterruptions([]);
        setCrossInstanceAuthFailures([]);
        return;
      }
      
      // Fetch all interruptions across all instances
      const pollingResult = await getAllPendingInterruptions(credentials);
      setCrossInstanceInterruptions(pollingResult.interruptions);
      setCrossInstanceAuthFailures(pollingResult.authFailures);
      setLastCrossInstancePoll(new Date());
    } catch (error) {
      console.error('Cross-instance polling failed:', error);
      setCrossInstanceError(error instanceof Error ? error : new Error('Failed to poll instances'));
    } finally {
      setIsCrossInstanceLoading(false);
    }
  }, [isAuthenticated, loadInstanceCredentials]);

  // Start cross-instance polling timer
  const startCrossInstancePolling = useCallback(() => {
    // Clear existing timer
    if (crossInstancePollTimer.current) {
      clearInterval(crossInstancePollTimer.current);
    }
    
    // Poll immediately
    pollCrossInstance();
    
    // Set up interval for subsequent polls
    crossInstancePollTimer.current = setInterval(pollCrossInstance, CROSS_INSTANCE_POLL_INTERVAL);
  }, [pollCrossInstance]);

  // Stop cross-instance polling
  const stopCrossInstancePolling = useCallback(() => {
    if (crossInstancePollTimer.current) {
      clearInterval(crossInstancePollTimer.current);
      crossInstancePollTimer.current = null;
    }
  }, []);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // App coming to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Poll immediately when app comes to foreground
        if (isAuthenticated) {
          pollCrossInstance();
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [isAuthenticated, pollCrossInstance]);

  // Start/stop polling based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      startCrossInstancePolling();
    } else {
      stopCrossInstancePolling();
      setCrossInstanceInterruptions([]);
      setCrossInstanceAuthFailures([]);
    }

    return () => {
      stopCrossInstancePolling();
    };
  }, [isAuthenticated, startCrossInstancePolling, stopCrossInstancePolling]);

  // Categorize interruptions (current space only for fast counts)
  const { manualInterventionCount, guidedFailureCount } = useMemo(() => {
    // Combine current space and cross-instance interruptions for counts
    // But dedupe based on interruption ID
    const allInterruptionIds = new Set<string>();
    const allInterruptions: Array<{ Form?: { Values?: { Guidance?: string } } | null }> = [];
    
    // Add current space interruptions
    for (const interruption of interruptions) {
      if (!allInterruptionIds.has(interruption.Id)) {
        allInterruptionIds.add(interruption.Id);
        allInterruptions.push(interruption);
      }
    }
    
    // Add cross-instance interruptions (excluding current instance/space to avoid duplicates)
    for (const ci of crossInstanceInterruptions) {
      const isSameInstanceSpace = 
        ci.instanceId === currentInstance?.id && 
        ci.spaceId === currentSpace?.Id;
      
      if (!isSameInstanceSpace && !allInterruptionIds.has(ci.interruption.Id)) {
        allInterruptionIds.add(ci.interruption.Id);
        allInterruptions.push(ci.interruption);
      }
    }
    
    let manual = 0;
    let guided = 0;
    
    for (const interruption of allInterruptions) {
      const guidance = interruption.Form?.Values?.Guidance;
      if (guidance === 'GuidedFailure') {
        guided++;
      } else {
        manual++;
      }
    }
    
    return { manualInterventionCount: manual, guidedFailureCount: guided };
  }, [interruptions, crossInstanceInterruptions, currentInstance?.id, currentSpace?.Id]);

  // Total count (deduplicated)
  const totalCount = manualInterventionCount + guidedFailureCount;

  // Handle submit interruption - supports both current and cross-instance
  const handleSubmitInterruption = useCallback(async (
    interruptionId: string,
    action: 'Proceed' | 'Abort' | 'Fail' | 'Retry' | 'Ignore' | 'Exclude',
    notes?: string,
    instanceId?: string,
    spaceId?: string
  ) => {
    // If instanceId and spaceId provided, this is a cross-instance submission
    if (instanceId && spaceId) {
      const credentials = instanceCredentialsCache.find(c => c.instanceId === instanceId);
      if (!credentials) {
        throw new Error('Instance credentials not found');
      }
      await submitInterruptionForInstance(credentials, spaceId, interruptionId, action, notes);
      // Refresh cross-instance data
      await pollCrossInstance();
    } else {
      // Current instance submission
      await submitMutation.mutateAsync({ interruptionId, action, notes });
      refetch();
    }
  }, [submitMutation, refetch, instanceCredentialsCache, pollCrossInstance]);

  // Handle take responsibility - supports both current and cross-instance
  const handleTakeResponsibility = useCallback(async (
    interruptionId: string,
    instanceId?: string,
    spaceId?: string
  ) => {
    if (instanceId && spaceId) {
      const credentials = instanceCredentialsCache.find(c => c.instanceId === instanceId);
      if (!credentials) {
        throw new Error('Instance credentials not found');
      }
      await takeResponsibilityForInstance(credentials, spaceId, interruptionId);
      await pollCrossInstance();
    } else {
      await responsibilityMutation.mutateAsync(interruptionId);
      refetch();
    }
  }, [responsibilityMutation, refetch, instanceCredentialsCache, pollCrossInstance]);

  const clearCrossInstanceAuthFailure = useCallback((instanceId: string) => {
    setCrossInstanceAuthFailures(prev => prev.filter(failure => failure.instanceId !== instanceId));
  }, []);

  const value: NotificationsContextType = {
    pendingInterruptions: interruptions,
    isLoading,
    error: error as Error | null,
    crossInstanceInterruptions,
    crossInstanceAuthFailures,
    isCrossInstanceLoading,
    crossInstanceError,
    lastCrossInstancePoll,
    totalCount,
    manualInterventionCount,
    guidedFailureCount,
    crossInstanceTotalCount: crossInstanceInterruptions.length,
    refetch,
    refetchCrossInstance: pollCrossInstance,
    clearCrossInstanceAuthFailure,
    submitInterruption: handleSubmitInterruption,
    takeResponsibility: handleTakeResponsibility,
    isSubmitting: submitMutation.isPending || responsibilityMutation.isPending,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextType => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};

/**
 * Helper function to get the interruption type label
 */
export const getInterruptionTypeLabel = (interruption: Interruption): string => {
  const guidance = interruption.Form?.Values?.Guidance;
  if (guidance === 'GuidedFailure') {
    return 'Guided Failure';
  }
  return 'Manual Intervention';
};

/**
 * Helper function to check if user can respond to an interruption
 */
export const canRespond = (interruption: Interruption): boolean => {
  return interruption.HasResponsibility || !interruption.ResponsibleUserId;
};

/**
 * Helper function to get available actions for an interruption
 */
export const getAvailableActions = (interruption: Interruption): Array<{
  key: 'Proceed' | 'Abort' | 'Fail' | 'Retry' | 'Ignore' | 'Exclude';
  label: string;
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
}> => {
  const guidance = interruption.Form?.Values?.Guidance;
  
  if (guidance === 'GuidedFailure') {
    return [
      { key: 'Retry', label: 'Retry', variant: 'primary' },
      { key: 'Fail', label: 'Fail', variant: 'danger' },
      { key: 'Ignore', label: 'Ignore', variant: 'secondary' },
      { key: 'Exclude', label: 'Exclude Machine', variant: 'ghost' },
    ];
  }
  
  return [
    { key: 'Proceed', label: 'Proceed', variant: 'primary' },
    { key: 'Abort', label: 'Abort', variant: 'danger' },
  ];
};
