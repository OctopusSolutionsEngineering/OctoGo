/**
 * Shared data types for widget data
 * These types should be mirrored in native widget code (Swift/Kotlin)
 */

export interface WidgetDeploymentData {
  /** Unique deployment ID */
  deploymentId: string;
  /** Project name */
  projectName: string;
  /** Environment name */
  environmentName: string;
  /** Release version */
  releaseVersion: string;
  /** Deployment state */
  state: 'Queued' | 'Executing' | 'Failed' | 'Canceled' | 'TimedOut' | 'Success' | 'Cancelling';
  /** Whether deployment is completed */
  isCompleted: boolean;
  /** Completion time (ISO string) */
  completedTime: string | null;
  /** Task ID for navigation */
  taskId: string;
  /** Last updated timestamp */
  updatedAt: string;
}

export interface WidgetProjectData {
  /** Project ID */
  projectId: string;
  /** Project name */
  projectName: string;
  /** Whether this is a favorite project */
  isFavorite: boolean;
  /** Latest release version */
  latestRelease: string | null;
  /** Environment deployment statuses */
  environments: WidgetEnvironmentStatus[];
  /** Last updated timestamp */
  updatedAt: string;
}

export interface WidgetEnvironmentStatus {
  /** Environment ID */
  environmentId: string;
  /** Environment name */
  environmentName: string;
  /** Current release version */
  releaseVersion: string | null;
  /** Deployment state */
  state: 'Queued' | 'Executing' | 'Failed' | 'Canceled' | 'TimedOut' | 'Success' | 'Cancelling' | null;
  /** Last deployment time */
  deployedAt: string | null;
}

export interface WidgetDashboardData {
  /** Number of successful deployments today */
  successfulToday: number;
  /** Number of failed deployments today */
  failedToday: number;
  /** Number of currently executing tasks */
  executing: number;
  /** Number of queued tasks */
  queued: number;
  /** Recent deployments for display */
  recentDeployments: WidgetDeploymentData[];
  /** Last updated timestamp */
  updatedAt: string;
}

export interface WidgetConfiguration {
  /** Selected space ID */
  spaceId: string | null;
  /** Favorite project IDs to show in widgets */
  favoriteProjectIds: string[];
  /** Widget refresh interval in minutes */
  refreshInterval: number;
}

