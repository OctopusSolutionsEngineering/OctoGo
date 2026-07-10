/**
 * Tests for widget data manager
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  storeWidgetDeployment,
  storeWidgetProjects,
  storeWidgetDashboard,
  getWidgetConfig,
  saveWidgetConfig,
  updateWidgetAfterDeployment,
  requestWidgetRefresh,
  buildDashboardWidgetData,
} from '../../src/lib/widgetData';
import type {
  WidgetDeploymentData,
  WidgetProjectData,
  WidgetDashboardData,
  WidgetConfiguration,
} from '../../widgets/shared-types';

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const makeDeployment = (overrides: Partial<WidgetDeploymentData> = {}): WidgetDeploymentData => ({
  deploymentId: 'Deployments-1',
  projectName: 'OctoGo',
  environmentName: 'Production',
  releaseVersion: '1.2.3',
  state: 'Success',
  isCompleted: true,
  completedTime: '2026-07-10T00:00:00.000Z',
  taskId: 'ServerTasks-1',
  updatedAt: '2026-07-10T00:00:00.000Z',
  ...overrides,
});

describe('Widget Data Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.getItem.mockResolvedValue(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // ==========================================================================
  // storeWidgetDeployment
  // ==========================================================================
  describe('storeWidgetDeployment', () => {
    it('should store deployment data as JSON', async () => {
      const data = makeDeployment();

      await storeWidgetDeployment(data);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@octogo_widget_deployment',
        JSON.stringify(data)
      );
    });

    it('should swallow storage errors', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      await expect(storeWidgetDeployment(makeDeployment())).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // storeWidgetProjects
  // ==========================================================================
  describe('storeWidgetProjects', () => {
    const projects: WidgetProjectData[] = [
      {
        projectId: 'Projects-1',
        projectName: 'OctoGo',
        isFavorite: true,
        latestRelease: '1.2.3',
        environments: [],
        updatedAt: '2026-07-10T00:00:00.000Z',
      },
    ];

    it('should store project data as JSON', async () => {
      await storeWidgetProjects(projects);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@octogo_widget_projects',
        JSON.stringify(projects)
      );
    });

    it('should swallow storage errors', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      await expect(storeWidgetProjects(projects)).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // storeWidgetDashboard
  // ==========================================================================
  describe('storeWidgetDashboard', () => {
    const dashboard: WidgetDashboardData = {
      successfulToday: 3,
      failedToday: 1,
      executing: 2,
      queued: 0,
      recentDeployments: [],
      updatedAt: '2026-07-10T00:00:00.000Z',
    };

    it('should store dashboard data as JSON', async () => {
      await storeWidgetDashboard(dashboard);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@octogo_widget_dashboard',
        JSON.stringify(dashboard)
      );
    });

    it('should swallow storage errors', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      await expect(storeWidgetDashboard(dashboard)).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // getWidgetConfig / saveWidgetConfig
  // ==========================================================================
  describe('getWidgetConfig', () => {
    const config: WidgetConfiguration = {
      spaceId: 'Spaces-1',
      favoriteProjectIds: ['Projects-1'],
      refreshInterval: 15,
    };

    it('should return the parsed config', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(config));

      const result = await getWidgetConfig();

      expect(result).toEqual(config);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('@octogo_widget_config');
    });

    it('should return null when no config is stored', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getWidgetConfig();

      expect(result).toBeNull();
    });

    it('should return null on storage errors', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Read error'));

      const result = await getWidgetConfig();

      expect(result).toBeNull();
    });
  });

  describe('saveWidgetConfig', () => {
    const config: WidgetConfiguration = {
      spaceId: null,
      favoriteProjectIds: [],
      refreshInterval: 30,
    };

    it('should save the config as JSON', async () => {
      await saveWidgetConfig(config);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@octogo_widget_config',
        JSON.stringify(config)
      );
    });

    it('should rethrow storage errors', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Write error'));

      await expect(saveWidgetConfig(config)).rejects.toThrow('Write error');
    });
  });

  // ==========================================================================
  // updateWidgetAfterDeployment
  // ==========================================================================
  describe('updateWidgetAfterDeployment', () => {
    it('should mark completed states with a completion time', async () => {
      await updateWidgetAfterDeployment(
        'OctoGo',
        'Production',
        '1.2.3',
        'Success',
        'Deployments-1',
        'ServerTasks-1'
      );

      const stored = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(mockAsyncStorage.setItem.mock.calls[0][0]).toBe('@octogo_widget_deployment');
      expect(stored).toMatchObject({
        deploymentId: 'Deployments-1',
        projectName: 'OctoGo',
        environmentName: 'Production',
        releaseVersion: '1.2.3',
        state: 'Success',
        isCompleted: true,
        taskId: 'ServerTasks-1',
      });
      expect(typeof stored.completedTime).toBe('string');
      expect(typeof stored.updatedAt).toBe('string');
    });

    it('should treat Failed as a completed state', async () => {
      await updateWidgetAfterDeployment('P', 'E', '1.0', 'Failed', 'D-1', 'T-1');

      const stored = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(stored.isCompleted).toBe(true);
      expect(stored.completedTime).not.toBeNull();
    });

    it('should leave in-progress deployments without a completion time', async () => {
      await updateWidgetAfterDeployment(
        'OctoGo',
        'Staging',
        '2.0.0',
        'Executing',
        'Deployments-2',
        'ServerTasks-2'
      );

      const stored = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(stored.isCompleted).toBe(false);
      expect(stored.completedTime).toBeNull();
    });
  });

  // ==========================================================================
  // requestWidgetRefresh
  // ==========================================================================
  describe('requestWidgetRefresh', () => {
    it('should resolve without error (placeholder implementation)', async () => {
      await expect(requestWidgetRefresh()).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // buildDashboardWidgetData
  // ==========================================================================
  describe('buildDashboardWidgetData', () => {
    it('should build dashboard data from counts', () => {
      const deployments = [makeDeployment({ deploymentId: 'D-1' })];

      const result = buildDashboardWidgetData(4, 2, 1, 3, deployments);

      expect(result).toMatchObject({
        successfulToday: 4,
        failedToday: 2,
        executing: 1,
        queued: 3,
        recentDeployments: deployments,
      });
      expect(typeof result.updatedAt).toBe('string');
    });

    it('should limit recent deployments to 5', () => {
      const deployments = Array.from({ length: 8 }, (_, i) =>
        makeDeployment({ deploymentId: `D-${i}` })
      );

      const result = buildDashboardWidgetData(0, 0, 0, 0, deployments);

      expect(result.recentDeployments).toHaveLength(5);
      expect(result.recentDeployments[0].deploymentId).toBe('D-0');
      expect(result.recentDeployments[4].deploymentId).toBe('D-4');
    });
  });
});
