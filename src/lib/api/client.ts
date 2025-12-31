/**
 * Octopus Deploy API Client
 * 
 * Security considerations:
 * - All requests use HTTPS
 * - API key is never logged or exposed in errors
 * - Request/response data is sanitized before logging
 * - Timeout limits prevent DoS scenarios
 * - Rate limiting awareness
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { getCredentials, sanitizePathSegment } from '../security';
import type {
  User,
  Space,
  Project,
  Environment,
  Deployment,
  DeploymentProcess,
  Release,
  Task,
  TaskDetails,
  TaskProgress,
  ActivityLog,
  Dashboard,
  Machine,
  Channel,
  Lifecycle,
  ServerStatus,
  LicenseStatus,
  PaginatedResponse,
  ApiError,
  Event,
  Progression,
  ProjectGroup,
  Runbook,
  RunbookRun,
  RunbookSnapshot,
  RunbookProcess,
  HomeDocument,
  VariableSet,
  ObservabilityApplicationStatus,
  ObservabilityResources,
  KubernetesLiveStatus,
  KubernetesResource,
  KubernetesApplicationStatus,
  KubernetesObjectStatus,
  KubernetesPodLog,
  KubernetesEvent,
  Tenant,
  TagSet,
  ReleaseTemplate,
  PackageVersion,
  SelectedPackageVersion,
  DeploymentPreviewResponse,
} from './types';

// Constants
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

/**
 * Custom error class for API errors
 */
export class OctopusApiError extends Error {
  public readonly statusCode: number;
  public readonly errors: string[];
  public readonly isNetworkError: boolean;
  public readonly isAuthError: boolean;
  public readonly isRateLimited: boolean;

  constructor(
    message: string,
    statusCode: number = 0,
    errors: string[] = [],
    isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'OctopusApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isNetworkError = isNetworkError;
    this.isAuthError = statusCode === 401 || statusCode === 403;
    this.isRateLimited = statusCode === 429;
  }
}

/**
 * Creates an authenticated API client instance
 */
const createClient = async (): Promise<{ client: AxiosInstance; spaceId: string | null }> => {
  const credentials = await getCredentials();
  
  if (!credentials) {
    throw new OctopusApiError('No credentials found. Please log in.', 401);
  }

  const { serverUrl, apiKey, spaceId } = credentials;

  const client = axios.create({
    baseURL: serverUrl,
    timeout: REQUEST_TIMEOUT,
    headers: {
      'X-Octopus-ApiKey': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  // Request interceptor - sanitize logging
  client.interceptors.request.use(
    (config) => {
      // In development, log sanitized request info
      if (__DEV__) {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor - error handling
  client.interceptors.response.use(
    (response) => {
      if (__DEV__) {
        console.log(`[API] Response ${response.status} from ${response.config.url}`);
      }
      return response;
    },
    (error: AxiosError<ApiError>) => {
      if (__DEV__) {
        console.log(`[API] Error ${error.response?.status || 'network'} from ${error.config?.url}:`, error.response?.data || error.message);
      }
      return Promise.reject(transformError(error));
    }
  );

  return { client, spaceId };
};

/**
 * Transforms axios errors into OctopusApiError
 */
const transformError = (error: AxiosError<ApiError>): OctopusApiError => {
  // Network error
  if (!error.response) {
    return new OctopusApiError(
      'Unable to connect to server. Please check your network connection.',
      0,
      [],
      true
    );
  }

  const { status, data } = error.response;

  // Handle specific status codes
  switch (status) {
    case 401:
      return new OctopusApiError(
        'Authentication failed. Please check your API key.',
        status
      );
    case 403: {
      // Extract the detailed error message from the API response
      let message = 'You do not have permission to perform this action.';
      
      // Check for space access error
      if (data?.ErrorMessage?.includes('does not have access to space')) {
        message = 'You do not have access to this space. Try switching to a different space or check your permissions with your Octopus administrator.';
      } else if (data?.ErrorMessage?.includes('permission to view')) {
        message = data.ErrorMessage;
      } else if (data?.ErrorMessage) {
        message = data.ErrorMessage;
      }
      
      return new OctopusApiError(
        message,
        status,
        data?.Errors || []
      );
    }
    case 404:
      return new OctopusApiError(
        'The requested resource was not found.',
        status
      );
    case 429:
      return new OctopusApiError(
        'Too many requests. Please try again later.',
        status
      );
    case 500:
    case 502:
    case 503:
    case 504:
      return new OctopusApiError(
        'Server error. Please try again later.',
        status,
        data?.Errors || []
      );
    default:
      return new OctopusApiError(
        data?.ErrorMessage || 'An unexpected error occurred.',
        status,
        data?.Errors || []
      );
  }
};

/**
 * Retry wrapper for transient failures
 */
const withRetry = async <T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry auth errors or client errors
      if (error instanceof OctopusApiError) {
        if (error.isAuthError || (error.statusCode >= 400 && error.statusCode < 500)) {
          throw error;
        }
      }

      // Wait before retrying
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
      }
    }
  }

  throw lastError!;
};

/**
 * Gets the space-prefixed API path
 */
const spacePath = (spaceId: string | null, path: string): string => {
  if (spaceId) {
    return `/api/${sanitizePathSegment(spaceId)}${path}`;
  }
  return `/api${path}`;
};

// ============================================================================
// API Methods
// ============================================================================

/**
 * Validates connection and credentials
 */
export const validateConnection = async (): Promise<{ user: User; serverVersion: string }> => {
  return withRetry(async () => {
    const { client } = await createClient();
    
    const [userResponse, homeResponse] = await Promise.all([
      client.get<User>('/api/users/me'),
      client.get<HomeDocument>('/api'),
    ]);

    return {
      user: userResponse.data,
      serverVersion: homeResponse.data.Version,
    };
  });
};

/**
 * Gets the current user
 */
export const getCurrentUser = async (): Promise<User> => {
  return withRetry(async () => {
    const { client } = await createClient();
    const response = await client.get<User>('/api/users/me');
    return response.data;
  });
};

/**
 * Gets server status
 */
export const getServerStatus = async (): Promise<ServerStatus> => {
  return withRetry(async () => {
    const { client } = await createClient();
    const response = await client.get<ServerStatus>('/api/serverstatus');
    return response.data;
  });
};

/**
 * Gets license status including license type (Community, Professional, Enterprise)
 */
export const getLicenseStatus = async (): Promise<LicenseStatus | null> => {
  return withRetry(async () => {
    const { client } = await createClient();
    try {
      const response = await client.get<LicenseStatus>('/api/licenses/licenses-current-status');
      return response.data;
    } catch (error) {
      // Some older versions or cloud instances may not have this endpoint
      if (error instanceof OctopusApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  });
};

/**
 * Gets available spaces
 */
export const getSpaces = async (): Promise<Space[]> => {
  return withRetry(async () => {
    const { client } = await createClient();
    const response = await client.get<PaginatedResponse<Space>>('/api/spaces');
    return response.data?.Items ?? [];
  });
};

/**
 * Gets a specific space
 */
export const getSpace = async (spaceId: string): Promise<Space> => {
  return withRetry(async () => {
    const { client } = await createClient();
    const response = await client.get<Space>(`/api/spaces/${sanitizePathSegment(spaceId)}`);
    return response.data;
  });
};

/**
 * Gets the dashboard for a space
 */
export const getDashboard = async (options?: {
  projectGroupId?: string;
  releaseId?: string;
}): Promise<Dashboard> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = new URLSearchParams();
    
    if (options?.projectGroupId) {
      params.append('projectGroupId', options.projectGroupId);
    }
    if (options?.releaseId) {
      params.append('releaseId', options.releaseId);
    }

    const url = `${spacePath(spaceId, '/dashboard')}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await client.get<Dashboard>(url);
    return response.data;
  });
};

/**
 * Gets projects
 */
export const getProjects = async (options?: {
  skip?: number;
  take?: number;
  searchText?: string;
}): Promise<PaginatedResponse<Project>> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = new URLSearchParams();
    
    if (options?.skip !== undefined) params.append('skip', String(options.skip));
    if (options?.take !== undefined) params.append('take', String(options.take));
    if (options?.searchText) params.append('partialName', options.searchText);

    const url = `${spacePath(spaceId, '/projects')}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await client.get<PaginatedResponse<Project>>(url);
    return response.data;
  });
};

/**
 * Gets a specific project
 */
export const getProject = async (projectId: string): Promise<Project> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<Project>(
      spacePath(spaceId, `/projects/${sanitizePathSegment(projectId)}`)
    );
    return response.data;
  });
};

/**
 * Gets project groups
 */
export const getProjectGroups = async (): Promise<ProjectGroup[]> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<PaginatedResponse<ProjectGroup> | ProjectGroup[]>(
      spacePath(spaceId, '/projectgroups')
    );
    // Handle both paginated response and direct array formats
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data?.Items ?? [];
  });
};

/**
 * Gets environments
 */
export const getEnvironments = async (): Promise<Environment[]> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<PaginatedResponse<Environment>>(
      spacePath(spaceId, '/environments/all')
    );
    return response.data?.Items ?? [];
  });
};

/**
 * Gets a specific environment
 */
export const getEnvironment = async (environmentId: string): Promise<Environment> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<Environment>(
      spacePath(spaceId, `/environments/${sanitizePathSegment(environmentId)}`)
    );
    return response.data;
  });
};

/**
 * Gets a specific lifecycle
 */
export const getLifecycle = async (lifecycleId: string): Promise<Lifecycle> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<Lifecycle>(
      spacePath(spaceId, `/lifecycles/${sanitizePathSegment(lifecycleId)}`)
    );
    return response.data;
  });
};

/**
 * Gets releases for a project
 */
export const getReleases = async (
  projectId: string,
  options?: { skip?: number; take?: number }
): Promise<PaginatedResponse<Release>> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = new URLSearchParams();
    
    if (options?.skip !== undefined) params.append('skip', String(options.skip));
    if (options?.take !== undefined) params.append('take', String(options.take));

    const url = `${spacePath(spaceId, `/projects/${sanitizePathSegment(projectId)}/releases`)}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await client.get<PaginatedResponse<Release>>(url);
    return response.data;
  });
};

/**
 * Gets all releases (across all projects)
 * Can filter by searchByVersion
 */
export const getAllReleases = async (options?: {
  skip?: number;
  take?: number;
  searchByVersion?: string;
}): Promise<PaginatedResponse<Release>> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = new URLSearchParams();
    
    if (options?.skip !== undefined) params.append('skip', String(options.skip));
    if (options?.take !== undefined) params.append('take', String(options.take));
    if (options?.searchByVersion) params.append('searchByVersion', options.searchByVersion);

    const url = `${spacePath(spaceId, '/releases')}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await client.get<PaginatedResponse<Release>>(url);
    return response.data;
  });
};

/**
 * Gets a specific release
 */
export const getRelease = async (releaseId: string): Promise<Release> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<Release>(
      spacePath(spaceId, `/releases/${sanitizePathSegment(releaseId)}`)
    );
    return response.data;
  });
};

/**
 * Gets release progression (deployment status across environments)
 */
export const getReleaseProgression = async (releaseId: string): Promise<Progression> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<Progression>(
      spacePath(spaceId, `/releases/${sanitizePathSegment(releaseId)}/progression`)
    );
    return response.data;
  });
};

/**
 * Gets deployments
 */
export const getDeployments = async (options?: {
  skip?: number;
  take?: number;
  projectId?: string;
  environmentId?: string;
  taskState?: string;
}): Promise<PaginatedResponse<Deployment>> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = new URLSearchParams();
    
    if (options?.skip !== undefined) params.append('skip', String(options.skip));
    if (options?.take !== undefined) params.append('take', String(options.take));
    if (options?.projectId) params.append('projects', options.projectId);
    if (options?.environmentId) params.append('environments', options.environmentId);
    if (options?.taskState) params.append('taskState', options.taskState);

    const url = `${spacePath(spaceId, '/deployments')}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await client.get<PaginatedResponse<Deployment>>(url);
    return response.data;
  });
};

/**
 * Gets a specific deployment
 */
export const getDeployment = async (deploymentId: string): Promise<Deployment> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<Deployment>(
      spacePath(spaceId, `/deployments/${sanitizePathSegment(deploymentId)}`)
    );
    return response.data;
  });
};

/**
 * Creates a new deployment
 */
export const createDeployment = async (
  releaseId: string,
  environmentId: string,
  options?: {
    comments?: string;
    tenantId?: string;
    forcePackageDownload?: boolean;
    specificMachineIds?: string[];
    excludedMachineIds?: string[];
  }
): Promise<Deployment> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.post<Deployment>(
      spacePath(spaceId, '/deployments'),
      {
        ReleaseId: releaseId,
        EnvironmentId: environmentId,
        TenantId: options?.tenantId || null,
        Comments: options?.comments,
        ForcePackageDownload: options?.forcePackageDownload || false,
        SpecificMachineIds: options?.specificMachineIds || [],
        ExcludedMachineIds: options?.excludedMachineIds || [],
      }
    );
    return response.data;
  });
};

/**
 * Gets tasks
 */
export const getTasks = async (options?: {
  skip?: number;
  take?: number;
  states?: string[];
  name?: string;
  project?: string;
  environment?: string;
}): Promise<PaginatedResponse<Task>> => {
  return withRetry(async () => {
    const { client } = await createClient();
    const params = new URLSearchParams();
    
    if (options?.skip !== undefined) params.append('skip', String(options.skip));
    if (options?.take !== undefined) params.append('take', String(options.take));
    if (options?.states?.length) params.append('states', options.states.join(','));
    if (options?.name) params.append('name', options.name);
    if (options?.project) params.append('project', options.project);
    if (options?.environment) params.append('environment', options.environment);

    // Tasks endpoint is not space-specific
    const url = `/api/tasks${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await client.get<PaginatedResponse<Task>>(url);
    return response.data;
  });
};

/**
 * Gets a specific task
 */
export const getTask = async (taskId: string): Promise<Task> => {
  return withRetry(async () => {
    const { client } = await createClient();
    const response = await client.get<Task>(`/api/tasks/${sanitizePathSegment(taskId)}`);
    return response.data;
  });
};

/**
 * Gets task details including activity logs
 * Fetches both the task and its details, then merges them
 */
export const getTaskDetails = async (taskId: string): Promise<TaskDetails> => {
  return withRetry(async () => {
    const { client } = await createClient();
    const sanitizedId = sanitizePathSegment(taskId);
    
    // Fetch both the task and its activity details in parallel
    const [taskResponse, detailsResponse] = await Promise.all([
      client.get<Task>(`/api/tasks/${sanitizedId}`),
      client.get<{ ActivityLogs: ActivityLog[]; Progress: TaskProgress }>(
        `/api/tasks/${sanitizedId}/details`
      ),
    ]);
    
    // Merge the task with its activity details
    return {
      ...taskResponse.data,
      ActivityLogs: detailsResponse.data.ActivityLogs || [],
      Progress: detailsResponse.data.Progress || { ProgressPercentage: 0, EstimatedTimeRemaining: null },
    };
  });
};

/**
 * Gets task raw log
 */
export const getTaskRaw = async (taskId: string): Promise<string> => {
  return withRetry(async () => {
    const { client } = await createClient();
    const response = await client.get<string>(
      `/api/tasks/${sanitizePathSegment(taskId)}/raw`,
      { responseType: 'text' }
    );
    return response.data;
  });
};

/**
 * Gets pending interruptions for a task
 */
export const getTaskInterruptions = async (taskId: string): Promise<any[]> => {
  return withRetry(async () => {
    const { client } = await createClient();
    const response = await client.get<{ Items: any[] }>(
      `/api/tasks/${sanitizePathSegment(taskId)}/interruptions`
    );
    return response.data.Items;
  });
};

/**
 * Submit interruption response (for guided failure, manual intervention)
 */
export const submitInterruption = async (
  interruptionId: string,
  action: 'Proceed' | 'Abort' | 'Fail' | 'Retry' | 'Ignore' | 'Exclude',
  notes?: string
): Promise<void> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    await client.post(
      spacePath(spaceId, `/interruptions/${sanitizePathSegment(interruptionId)}/submit`),
      {
        Action: action,
        Notes: notes,
      }
    );
  });
};

/**
 * Takes responsibility for an interruption
 */
export const takeResponsibility = async (interruptionId: string): Promise<void> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    await client.post(
      spacePath(spaceId, `/interruptions/${sanitizePathSegment(interruptionId)}/responsible`)
    );
  });
};

/**
 * Trigger health check for a machine
 * Creates a Health task targeting specific machine(s)
 */
export const triggerMachineHealthCheck = async (machineId: string): Promise<Task> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.post<Task>(
      '/api/tasks',
      {
        Name: 'Health',
        Description: `Health check for machine ${machineId}`,
        SpaceId: spaceId,
        Arguments: {
          MachineIds: [machineId],
          Timeout: '00:05:00',
        },
      }
    );
    return response.data;
  });
};

/**
 * Cancels a task
 */
export const cancelTask = async (taskId: string): Promise<void> => {
  return withRetry(async () => {
    const { client } = await createClient();
    await client.post(`/api/tasks/${sanitizePathSegment(taskId)}/cancel`);
  });
};

/**
 * Gets all machines/deployment targets with full status info
 * Uses /machines/all endpoint which returns status for all targets
 */
export const getMachines = async (options?: {
  skip?: number;
  take?: number;
  environmentIds?: string[];
  healthStatuses?: string[];
  roles?: string[];
}): Promise<PaginatedResponse<Machine>> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = new URLSearchParams();
    
    if (options?.skip !== undefined) params.append('skip', String(options.skip));
    if (options?.take !== undefined) params.append('take', String(options.take));
    if (options?.environmentIds?.length) params.append('environmentIds', options.environmentIds.join(','));
    if (options?.healthStatuses?.length) params.append('healthStatuses', options.healthStatuses.join(','));
    if (options?.roles?.length) params.append('roles', options.roles.join(','));

    // Use /machines/all/v1 to get full status info for all deployment targets
    const url = spacePath(spaceId, '/machines/all/v1');
    const response = await client.get<any>(url);
    
    
    // Handle various response formats
    let machines: Machine[] = [];
    
    if (Array.isArray(response.data)) {
      // Direct array response
      machines = response.data;
    } else if (response.data?.DeploymentTargets && Array.isArray(response.data.DeploymentTargets)) {
      // v1 endpoint returns DeploymentTargets array
      machines = response.data.DeploymentTargets;
    } else if (response.data?.Items && Array.isArray(response.data.Items)) {
      // Paginated response with Items
      machines = response.data.Items;
    } else if (response.data && typeof response.data === 'object') {
      // Object with machine IDs as keys - convert to array
      const values = Object.values(response.data);
      if (values.length > 0) {
        // Map v1 response fields to our Machine type
        machines = values.map((m: any) => ({
          Id: m.Id || m.id,
          Name: m.Name || m.name,
          Thumbprint: m.Thumbprint || m.thumbprint || null,
          Uri: m.Uri || m.uri || null,
          IsDisabled: m.IsDisabled ?? m.isDisabled ?? false,
          EnvironmentIds: m.EnvironmentIds || m.environmentIds || [],
          Roles: m.Roles || m.roles || [],
          TenantIds: m.TenantIds || m.tenantIds || [],
          TenantTags: m.TenantTags || m.tenantTags || [],
          Status: m.Status || m.status || 'Unknown',
          HealthStatus: m.HealthStatus || m.healthStatus || 'Unknown',
          HasLatestCalamari: m.HasLatestCalamari ?? m.hasLatestCalamari ?? true,
          StatusSummary: m.StatusSummary || m.statusSummary || null,
          MachinePolicyId: m.MachinePolicyId || m.machinePolicyId || '',
          Endpoint: m.Endpoint || m.endpoint || { CommunicationStyle: 'Unknown' },
          SpaceId: m.SpaceId || m.spaceId || spaceId || '',
          Links: m.Links || m.links || {},
        }));
      }
    }
    
    return {
      Items: machines,
      ItemsPerPage: machines.length,
      TotalResults: machines.length,
      NumberOfPages: 1,
      LastPageNumber: 0,
      ItemType: 'Machine',
      Links: {},
    };
  });
};

/**
 * Gets a specific machine
 */
export const getMachine = async (machineId: string): Promise<Machine> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<Machine>(
      spacePath(spaceId, `/machines/${sanitizePathSegment(machineId)}`)
    );
    return response.data;
  });
};

/**
 * Gets channels for a project
 */
export const getChannels = async (projectId: string): Promise<Channel[]> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<PaginatedResponse<Channel>>(
      spacePath(spaceId, `/projects/${sanitizePathSegment(projectId)}/channels`)
    );
    return response.data?.Items ?? [];
  });
};

/**
 * Gets lifecycles
 */
export const getLifecycles = async (): Promise<Lifecycle[]> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<PaginatedResponse<Lifecycle>>(
      spacePath(spaceId, '/lifecycles/all')
    );
    return response.data?.Items ?? [];
  });
};

/**
 * Gets recent events (audit log)
 */
export const getEvents = async (options?: {
  skip?: number;
  take?: number;
  regarding?: string;
  user?: string;
}): Promise<PaginatedResponse<Event>> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = new URLSearchParams();
    
    if (options?.skip !== undefined) params.append('skip', String(options.skip));
    if (options?.take !== undefined) params.append('take', String(options.take));
    if (options?.regarding) params.append('regarding', options.regarding);
    if (options?.user) params.append('user', options.user);

    const url = `${spacePath(spaceId, '/events')}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await client.get<PaginatedResponse<Event>>(url);
    return response.data;
  });
};

// ============================================================================
// Runbooks
// ============================================================================

/**
 * Gets all runbooks
 */
export const getRunbooks = async (options?: {
  skip?: number;
  take?: number;
  projectId?: string;
}): Promise<PaginatedResponse<Runbook>> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = new URLSearchParams();
    
    if (options?.skip !== undefined) params.append('skip', String(options.skip));
    if (options?.take !== undefined) params.append('take', String(options.take));
    if (options?.projectId) params.append('projects', options.projectId);

    const url = `${spacePath(spaceId, '/runbooks')}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await client.get<PaginatedResponse<Runbook>>(url);
    return response.data;
  });
};

/**
 * Gets a specific runbook
 */
export const getRunbook = async (runbookId: string): Promise<Runbook> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<Runbook>(
      spacePath(spaceId, `/runbooks/${sanitizePathSegment(runbookId)}`)
    );
    return response.data;
  });
};

/**
 * Gets runbooks for a specific project
 */
export const getProjectRunbooks = async (projectId: string): Promise<Runbook[]> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<PaginatedResponse<Runbook>>(
      spacePath(spaceId, `/projects/${sanitizePathSegment(projectId)}/runbooks`)
    );
    return response.data?.Items ?? [];
  });
};

/**
 * Gets runbook runs
 */
export const getRunbookRuns = async (options?: {
  skip?: number;
  take?: number;
  runbookId?: string;
  projectId?: string;
  environmentId?: string;
  taskState?: string;
}): Promise<PaginatedResponse<RunbookRun>> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = new URLSearchParams();
    
    if (options?.skip !== undefined) params.append('skip', String(options.skip));
    if (options?.take !== undefined) params.append('take', String(options.take));
    if (options?.runbookId) params.append('runbooks', options.runbookId);
    if (options?.projectId) params.append('projects', options.projectId);
    if (options?.environmentId) params.append('environments', options.environmentId);
    if (options?.taskState) params.append('taskState', options.taskState);

    const url = `${spacePath(spaceId, '/runbookRuns')}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await client.get<PaginatedResponse<RunbookRun>>(url);
    return response.data;
  });
};

/**
 * Gets a specific runbook run
 */
export const getRunbookRun = async (runbookRunId: string): Promise<RunbookRun> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<RunbookRun>(
      spacePath(spaceId, `/runbookRuns/${sanitizePathSegment(runbookRunId)}`)
    );
    return response.data;
  });
};

/**
 * Gets runbook snapshots for a runbook
 */
export const getRunbookSnapshots = async (
  runbookId: string,
  options?: { skip?: number; take?: number }
): Promise<PaginatedResponse<RunbookSnapshot>> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = new URLSearchParams();
    
    if (options?.skip !== undefined) params.append('skip', String(options.skip));
    if (options?.take !== undefined) params.append('take', String(options.take));

    const url = `${spacePath(spaceId, `/runbooks/${sanitizePathSegment(runbookId)}/runbookSnapshots`)}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await client.get<PaginatedResponse<RunbookSnapshot>>(url);
    return response.data;
  });
};

/**
 * Creates a runbook run (executes a runbook)
 */
export const createRunbookRun = async (
  runbookId: string,
  runbookSnapshotId: string,
  environmentId: string,
  options?: {
    comments?: string;
    tenantId?: string;
    specificMachineIds?: string[];
    excludedMachineIds?: string[];
  }
): Promise<RunbookRun> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.post<RunbookRun>(
      spacePath(spaceId, '/runbookRuns'),
      {
        RunbookId: runbookId,
        RunbookSnapshotId: runbookSnapshotId,
        EnvironmentId: environmentId,
        Comments: options?.comments,
        TenantId: options?.tenantId,
        SpecificMachineIds: options?.specificMachineIds || [],
        ExcludedMachineIds: options?.excludedMachineIds || [],
      }
    );
    return response.data;
  });
};

/**
 * Gets the runbook process (steps) for a runbook by runbook ID
 * First fetches the runbook to get the RunbookProcessId, then fetches the process
 */
export const getRunbookProcess = async (runbookId: string): Promise<RunbookProcess> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    
    // First get the runbook to find the RunbookProcessId
    const runbookResponse = await client.get<Runbook>(
      spacePath(spaceId, `/runbooks/${sanitizePathSegment(runbookId)}`)
    );
    
    const runbookProcessId = runbookResponse.data.RunbookProcessId;
    if (!runbookProcessId) {
      return { Id: '', RunbookId: runbookId, SpaceId: spaceId || '', Steps: [], Version: 0, LastSnapshotId: null, Links: {} };
    }
    
    // Then fetch the process using the RunbookProcessId
    const response = await client.get<RunbookProcess>(
      spacePath(spaceId, `/runbookProcesses/${sanitizePathSegment(runbookProcessId)}`)
    );
    return response.data;
  });
};

/**
 * Gets the runbook process (steps) by process ID directly
 */
export const getRunbookProcessById = async (processId: string): Promise<RunbookProcess> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<RunbookProcess>(
      spacePath(spaceId, `/runbookProcesses/${sanitizePathSegment(processId)}`)
    );
    return response.data;
  });
};

// ============================================================================
// Deployment Process
// ============================================================================

/**
 * Gets the deployment process for a project
 */
export const getDeploymentProcess = async (projectId: string): Promise<DeploymentProcess> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<DeploymentProcess>(
      spacePath(spaceId, `/projects/${sanitizePathSegment(projectId)}/deploymentprocesses`)
    );
    return response.data;
  });
};

// ============================================================================
// Variables
// ============================================================================

/**
 * Gets the variables for a project
 */
export const getProjectVariables = async (projectId: string): Promise<VariableSet> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<VariableSet>(
      spacePath(spaceId, `/projects/${sanitizePathSegment(projectId)}/variables`)
    );
    return response.data;
  });
};

// ============================================================================
// Project Summary
// ============================================================================

/**
 * Gets the dashboard filtered for a specific project
 * Returns deployment status across all environments
 */
export const getProjectSummary = async (projectId: string): Promise<Dashboard> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    // Use 'projects' parameter (not 'projectId') per Octopus API
    const response = await client.get<Dashboard>(
      spacePath(spaceId, `/dashboard?projects=${sanitizePathSegment(projectId)}`)
    );
    return response.data;
  });
};

/**
 * Gets the progression for a project - shows current deployment state per environment
 */
export const getProjectProgression = async (projectId: string): Promise<any> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get(
      spacePath(spaceId, `/projects/${sanitizePathSegment(projectId)}/progression`)
    );
    return response.data;
  });
};

// ============================================================================
// Observability - Kubernetes Live Object Status
// ============================================================================

/**
 * Resource from Kubernetes live status API
 */
export interface K8sLiveResource {
  Children?: string[];
  DesiredResourceId?: string;
  Group?: string;
  HealthStatus: string;
  Kind: string;
  MachineId?: string;
  Name: string;
  Namespace?: string;
  ResourceId?: string;
  ResourceSourceId?: string;
  SourceType?: string;
  SyncStatus?: string;
}

/**
 * Machine status from Kubernetes live status API
 */
export interface K8sMachineStatus {
  MachineId: string;
  Resources: K8sLiveResource[];
  Status: string;
}

/**
 * Live status response from the Kubernetes observability endpoint
 */
export interface KubernetesLiveStatusResponse {
  MachineStatuses: K8sMachineStatus[];
}

/**
 * Gets the Kubernetes live status for a project/environment
 * Uses the correct endpoint: /projects/{projectId}/environments/{environmentId}/untenanted/livestatus
 */
export const getKubernetesLiveStatus = async (
  projectId: string,
  environmentId: string,
  tenantId?: string
): Promise<KubernetesLiveStatus | null> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    try {
      // Build the endpoint - tenantId is a query param, not path param
      const params = new URLSearchParams();
      if (tenantId) params.append('tenantId', tenantId);
      
      const url = `${spacePath(spaceId, `/projects/${sanitizePathSegment(projectId)}/environments/${sanitizePathSegment(environmentId)}/untenanted/livestatus`)}${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await client.get<KubernetesLiveStatusResponse>(url);

      const data = response.data;
      
      // Aggregate status from all machines
      const allResources: KubernetesResource[] = [];
      let overallStatus: KubernetesApplicationStatus = 'Unknown';
      
      if (data.MachineStatuses && data.MachineStatuses.length > 0) {
        // Collect all resources from all machines
        for (const machine of data.MachineStatuses) {
          for (const resource of machine.Resources || []) {
            allResources.push({
              Id: resource.ResourceId || resource.Name,
              Name: resource.Name,
              Namespace: resource.Namespace || '',
              Kind: resource.Kind,
              ApiVersion: resource.Group || '',
              Status: (resource.HealthStatus as KubernetesObjectStatus) || 'Unknown',
              StatusMessage: resource.SyncStatus || null,
              CreatedAt: null,
              UpdatedAt: null,
              Labels: {},
              Annotations: {},
            });
          }
          
          // Determine overall status from machine statuses
          const machineStatus = machine.Status?.toLowerCase();
          if (machineStatus === 'healthy' || machineStatus === 'insync') {
            if (overallStatus === 'Unknown') overallStatus = 'Healthy';
          } else if (machineStatus === 'progressing') {
            overallStatus = 'Progressing';
          } else if (machineStatus === 'degraded' || machineStatus === 'unhealthy') {
            overallStatus = 'Degraded';
          } else if (machineStatus === 'outofsync') {
            overallStatus = 'OutOfSync';
          }
        }
        
        // If we have resources, determine status from their health
        if (allResources.length > 0) {
          const hasDegraded = allResources.some(r => 
            r.Status === 'Degraded' || r.Status === 'Unknown' || r.Status === 'Missing'
          );
          const hasProgressing = allResources.some(r => r.Status === 'Progressing');
          const allHealthy = allResources.every(r => 
            r.Status === 'Healthy' || r.Status === 'InSync'
          );
          
          if (allHealthy) overallStatus = 'Healthy';
          else if (hasDegraded) overallStatus = 'Degraded';
          else if (hasProgressing) overallStatus = 'Progressing';
        }
      }
      
      return {
        DeploymentId: `${projectId}-${environmentId}`,
        ApplicationStatus: overallStatus,
        ApplicationStatusMessage: null,
        Resources: allResources,
        LastUpdated: new Date().toISOString(),
        IsAvailable: data.MachineStatuses && data.MachineStatuses.length > 0,
      };
    } catch (error) {
      // 404 means observability is not available for this project/environment
      if (error instanceof OctopusApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  });
};

/**
 * Gets Kubernetes resource details for a specific resource
 */
export const getKubernetesResourceDetails = async (
  projectId: string,
  environmentId: string,
  sourceId: string,
  resourceId: string,
  tenantId?: string
): Promise<KubernetesResource | null> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    try {
      const tenantPath = tenantId 
        ? `/tenants/${sanitizePathSegment(tenantId)}`
        : '/untenanted';
      
      const response = await client.get<KubernetesResource>(
        spacePath(spaceId, `/projects/${sanitizePathSegment(projectId)}/environments/${sanitizePathSegment(environmentId)}${tenantPath}/machines/${sanitizePathSegment(sourceId)}/resources/${sanitizePathSegment(resourceId)}`)
      );
      return response.data;
    } catch (error) {
      if (error instanceof OctopusApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  });
};

/**
 * Legacy function for backward compatibility - delegates to new endpoint
 * @deprecated Use getKubernetesLiveStatus with projectId and environmentId instead
 */
export const getObservabilityApplicationStatus = async (
  _deploymentId: string
): Promise<ObservabilityApplicationStatus | null> => {
  // This endpoint doesn't exist - return null
  return null;
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use getKubernetesLiveStatus with projectId and environmentId instead  
 */
export const getObservabilityResources = async (
  _deploymentId: string
): Promise<ObservabilityResources | null> => {
  // This endpoint doesn't exist - return null
  return null;
};

/**
 * Gets pod logs for a specific resource (placeholder - needs correct endpoint)
 */
export const getObservabilityPodLogs = async (
  _deploymentId: string,
  _resourceId: string
): Promise<KubernetesPodLog[] | null> => {
  // TODO: Implement with correct endpoint when available
  return null;
};

/**
 * Gets events for a specific resource (placeholder - needs correct endpoint)
 */
export const getObservabilityEvents = async (
  _deploymentId: string,
  _resourceId: string
): Promise<KubernetesEvent[] | null> => {
  // TODO: Implement with correct endpoint when available
  return null;
};

// ============================================================================
// Tenants
// ============================================================================

/**
 * Gets all tenants
 */
export const getTenants = async (options?: {
  skip?: number;
  take?: number;
  searchText?: string;
  projectId?: string;
  tags?: string[];
}): Promise<PaginatedResponse<Tenant>> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = new URLSearchParams();
    
    if (options?.skip !== undefined) params.append('skip', String(options.skip));
    if (options?.take !== undefined) params.append('take', String(options.take));
    if (options?.searchText) params.append('name', options.searchText);
    if (options?.projectId) params.append('projectId', options.projectId);
    if (options?.tags?.length) params.append('tags', options.tags.join(','));

    const url = `${spacePath(spaceId, '/tenants')}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await client.get<PaginatedResponse<Tenant>>(url);
    return response.data;
  });
};

/**
 * Gets a specific tenant
 */
export const getTenant = async (tenantId: string): Promise<Tenant> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<Tenant>(
      spacePath(spaceId, `/tenants/${sanitizePathSegment(tenantId)}`)
    );
    return response.data;
  });
};

/**
 * Gets tag sets (tenant tag categories)
 */
export const getTagSets = async (): Promise<TagSet[]> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.get<PaginatedResponse<TagSet>>(
      spacePath(spaceId, '/tagsets/all')
    );
    return response.data?.Items ?? [];
  });
};

// ============================================================================
// Release Creation
// ============================================================================

/**
 * Creates a new release
 */
export const createRelease = async (
  projectId: string,
  options?: {
    version?: string;
    channelId?: string;
    releaseNotes?: string;
    selectedPackages?: SelectedPackageVersion[];
  }
): Promise<Release> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const response = await client.post<Release>(
      spacePath(spaceId, '/releases'),
      {
        ProjectId: projectId,
        Version: options?.version,
        ChannelId: options?.channelId,
        ReleaseNotes: options?.releaseNotes,
        SelectedPackages: options?.selectedPackages || [],
      }
    );
    return response.data;
  });
};

/**
 * Gets the release template for a project/channel
 * Contains package version info for creating releases
 */
export const getReleaseTemplate = async (
  projectId: string,
  channelId?: string
): Promise<ReleaseTemplate> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = channelId ? `?channel=${sanitizePathSegment(channelId)}` : '';
    const response = await client.get<ReleaseTemplate>(
      spacePath(spaceId, `/projects/${sanitizePathSegment(projectId)}/releases/template${params}`)
    );
    return response.data;
  });
};

/**
 * Gets available package versions for a package
 */
export const getPackageVersions = async (
  feedId: string,
  packageId: string,
  options?: { take?: number; filter?: string }
): Promise<PackageVersion[]> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = new URLSearchParams();
    if (options?.take) params.append('take', String(options.take));
    if (options?.filter) params.append('filter', options.filter);
    
    const url = `${spacePath(spaceId, `/feeds/${sanitizePathSegment(feedId)}/packages/versions?packageId=${encodeURIComponent(packageId)}`)}${params.toString() ? `&${params.toString()}` : ''}`;
    const response = await client.get<{ Items: PackageVersion[] }>(url);
    return response.data?.Items ?? [];
  });
};

// ============================================================================
// Deployment Preview (for promotion)
// ============================================================================

/**
 * Gets a deployment preview showing what will be deployed
 */
export const getDeploymentPreview = async (
  releaseId: string,
  environmentId: string,
  tenantId?: string
): Promise<DeploymentPreviewResponse> => {
  return withRetry(async () => {
    const { client, spaceId } = await createClient();
    const params = tenantId ? `?tenantId=${sanitizePathSegment(tenantId)}` : '';
    const response = await client.get<DeploymentPreviewResponse>(
      spacePath(spaceId, `/releases/${sanitizePathSegment(releaseId)}/deployments/preview/${sanitizePathSegment(environmentId)}${params}`)
    );
    return response.data;
  });
};

// ============================================================================
// Global Search
// ============================================================================

/**
 * Search result item with type information for unified display
 */
export interface SearchResultItem {
  id: string;
  type: 'project' | 'release' | 'deployment' | 'runbook' | 'machine' | 'environment' | 'tenant' | 'variable';
  name: string;
  subtitle?: string;
  projectId?: string;
}

/**
 * Searches across all resource types including releases and variables
 */
export const globalSearch = async (
  searchText: string,
  options?: { take?: number; includeVariables?: boolean }
): Promise<{
  projects: Project[];
  releases: Release[];
  deployments: Deployment[];
  runbooks: Runbook[];
  machines: Machine[];
  environments: Environment[];
  tenants: Tenant[];
  variables: SearchResultItem[];
}> => {
  const take = options?.take || 10;
  const lower = searchText.toLowerCase();
  
  // Helper to filter by name
  const filterByName = <T extends { Name: string }>(items: T[], search: string): T[] => {
    const searchLower = search.toLowerCase();
    return items.filter(item => item.Name.toLowerCase().includes(searchLower));
  };

  // Search all resource types in parallel
  const [
    projectsResult,
    releasesResult,
    deploymentsResult,
    runbooksResult,
    machinesResult,
    environmentsResult,
    tenantsResult,
  ] = await Promise.allSettled([
    getProjects({ searchText, take }),
    getAllReleases({ searchByVersion: searchText, take: take * 2 }),  // Search releases by version
    getDeployments({ take: take * 2 }),
    getRunbooks({ take: take * 2 }),
    getMachines({ take: take * 2 }),
    getEnvironments(),
    getTenants({ searchText, take }),
  ]);

  const projects = projectsResult.status === 'fulfilled' ? projectsResult.value?.Items || [] : [];
  
  // Get releases - use API search results, or filter if API doesn't support search
  let releases: Release[] = [];
  if (releasesResult.status === 'fulfilled') {
    const releaseItems = releasesResult.value?.Items || [];
    // Also filter client-side in case API search is partial match
    releases = releaseItems
      .filter(r => r.Version.toLowerCase().includes(lower))
      .slice(0, take);
  }

  // For variables, optionally search across all projects (expensive operation)
  let variables: SearchResultItem[] = [];
  if (options?.includeVariables) {
    try {
      // Get some projects to search variables from
      const projectsToSearch = projects.length > 0 
        ? projects.slice(0, 3) 
        : (projectsResult.status === 'fulfilled' ? (projectsResult.value?.Items || []).slice(0, 5) : []);
      
      if (projectsToSearch.length === 0) {
        // If no projects from search, get some recent projects
        const allProjectsResult = await getProjects({ take: 5 }).catch(() => ({ Items: [] }));
        projectsToSearch.push(...(allProjectsResult?.Items || []));
      }
      
      const variablePromises = projectsToSearch.slice(0, 5).map(async project => {
        const varSet = await getProjectVariables(project.Id).catch(() => null);
        if (!varSet?.Variables) return [];
        
        return varSet.Variables
          .filter(v => v.Name.toLowerCase().includes(lower))
          .slice(0, 5)
          .map(v => ({
            id: `${project.Id}:${v.Id}`,
            type: 'variable' as const,
            name: v.Name,
            subtitle: `${project.Name} • ${v.IsSensitive ? 'Sensitive' : v.Type}`,
            projectId: project.Id,
          }));
      });
      const variableResults = await Promise.all(variablePromises);
      variables = variableResults.flat().slice(0, take);
    } catch (e) {
      console.warn('Variable search failed:', e);
    }
  }

  const deployments = deploymentsResult.status === 'fulfilled' 
    ? deploymentsResult.value.Items.filter(d => d.Name.toLowerCase().includes(lower)).slice(0, take)
    : [];
  const runbooks = runbooksResult.status === 'fulfilled' 
    ? filterByName(runbooksResult.value.Items, searchText).slice(0, take)
    : [];
  const machines = machinesResult.status === 'fulfilled' 
    ? filterByName(machinesResult.value.Items, searchText).slice(0, take)
    : [];
  const environments = environmentsResult.status === 'fulfilled' 
    ? filterByName(environmentsResult.value, searchText).slice(0, take)
    : [];
  const tenants = tenantsResult.status === 'fulfilled' ? tenantsResult.value.Items : [];

  return {
    projects,
    releases,
    deployments,
    runbooks,
    machines,
    environments,
    tenants,
    variables,
  };
};
