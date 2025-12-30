/**
 * Widget Data Manager
 * Handles storing and updating data for native widgets
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { 
  WidgetDeploymentData, 
  WidgetProjectData, 
  WidgetDashboardData,
  WidgetConfiguration,
} from '../../widgets/shared-types';

// Storage keys
const WIDGET_DEPLOYMENT_KEY = '@octogo_widget_deployment';
const WIDGET_PROJECTS_KEY = '@octogo_widget_projects';
const WIDGET_DASHBOARD_KEY = '@octogo_widget_dashboard';
const WIDGET_CONFIG_KEY = '@octogo_widget_config';

/**
 * Store the most recent deployment for widget display
 */
export const storeWidgetDeployment = async (data: WidgetDeploymentData): Promise<void> => {
  try {
    await AsyncStorage.setItem(WIDGET_DEPLOYMENT_KEY, JSON.stringify(data));
    // Note: In a full implementation, you would also update the shared
    // UserDefaults/SharedPreferences for native widget access
    // This would require react-native-shared-group-preferences or similar
  } catch (error) {
    console.error('Failed to store widget deployment data:', error);
  }
};

/**
 * Store project data for widget display
 */
export const storeWidgetProjects = async (data: WidgetProjectData[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(WIDGET_PROJECTS_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to store widget projects data:', error);
  }
};

/**
 * Store dashboard data for widget display
 */
export const storeWidgetDashboard = async (data: WidgetDashboardData): Promise<void> => {
  try {
    await AsyncStorage.setItem(WIDGET_DASHBOARD_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to store widget dashboard data:', error);
  }
};

/**
 * Get widget configuration
 */
export const getWidgetConfig = async (): Promise<WidgetConfiguration | null> => {
  try {
    const data = await AsyncStorage.getItem(WIDGET_CONFIG_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get widget config:', error);
    return null;
  }
};

/**
 * Save widget configuration
 */
export const saveWidgetConfig = async (config: WidgetConfiguration): Promise<void> => {
  try {
    await AsyncStorage.setItem(WIDGET_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save widget config:', error);
    throw error;
  }
};

/**
 * Update widget data after a deployment completes
 */
export const updateWidgetAfterDeployment = async (
  projectName: string,
  environmentName: string,
  releaseVersion: string,
  state: WidgetDeploymentData['state'],
  deploymentId: string,
  taskId: string
): Promise<void> => {
  const data: WidgetDeploymentData = {
    deploymentId,
    projectName,
    environmentName,
    releaseVersion,
    state,
    isCompleted: ['Success', 'Failed', 'Canceled', 'TimedOut'].includes(state),
    completedTime: ['Success', 'Failed', 'Canceled', 'TimedOut'].includes(state) 
      ? new Date().toISOString() 
      : null,
    taskId,
    updatedAt: new Date().toISOString(),
  };
  
  await storeWidgetDeployment(data);
};

/**
 * Request a widget refresh
 * Note: This is a placeholder - actual implementation requires native module
 */
export const requestWidgetRefresh = async (): Promise<void> => {
  // In a full implementation, this would call a native module to trigger
  // WidgetCenter.shared.reloadAllTimelines() on iOS
  // or AppWidgetManager.notifyAppWidgetViewDataChanged() on Android
  // Widget refresh triggered
};

/**
 * Build dashboard widget data from current state
 */
export const buildDashboardWidgetData = (
  successfulToday: number,
  failedToday: number,
  executing: number,
  queued: number,
  recentDeployments: WidgetDeploymentData[]
): WidgetDashboardData => ({
  successfulToday,
  failedToday,
  executing,
  queued,
  recentDeployments: recentDeployments.slice(0, 5), // Limit to 5 for widget
  updatedAt: new Date().toISOString(),
});

