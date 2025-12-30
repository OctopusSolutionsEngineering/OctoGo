/**
 * Deployment Detail Screen
 * Redirects to task detail with deployment context
 */

import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDeployment } from '../../src/hooks/useOctopusQuery';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { ErrorView } from '../../src/components/ui/ErrorView';

export default function DeploymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const { data: deployment, isLoading, error } = useDeployment(id!);

  useEffect(() => {
    // Redirect to task screen once we have the task ID
    if (deployment?.TaskId) {
      router.replace(`/task/${deployment.TaskId}`);
    }
  }, [deployment, router]);

  if (isLoading) {
    return <LoadingScreen message="Loading deployment..." />;
  }

  if (error) {
    return (
      <ErrorView
        message={error.message}
        onRetry={() => router.back()}
        fullScreen
      />
    );
  }

  return <LoadingScreen message="Redirecting to task..." />;
}
