/**
 * TypeScript types for Octopus Deploy API responses
 * Based on the Octopus Deploy REST API specification
 */

// Base types
export interface OctopusResource {
  Id: string;
  Links: Record<string, string>;
}

// Home document (root API endpoint)
export interface HomeDocument {
  Application: string;
  Version: string;
  ApiVersion: string;
  InstallationId: string;
  HasLongTermSupport: boolean;
  IsEarlyAccessProgram: boolean;
  Links: Record<string, string>;
}

export interface PaginatedResponse<T> {
  Items: T[];
  ItemsPerPage: number;
  TotalResults: number;
  NumberOfPages: number;
  LastPageNumber: number;
  ItemType: string;
  Links: Record<string, string>;
}

// User types
export interface User extends OctopusResource {
  Username: string;
  DisplayName: string;
  IsActive: boolean;
  IsService: boolean;
  EmailAddress: string | null;
}

export interface UserPermissions {
  SpacePermissions: Record<string, string[]>;
  SystemPermissions: string[];
  Teams: {
    Id: string;
    Name: string;
    SpaceId: string | null;
  }[];
}

// Space types
export interface SpaceIcon {
  Id: string;
  Color: string;
}

export interface Space extends OctopusResource {
  Name: string;
  Slug: string;
  Description: string | null;
  Icon: SpaceIcon | null;
  IsDefault: boolean;
  IsPrivate: boolean;
  TaskQueueStopped: boolean;
  SpaceManagersTeams: string[];
  SpaceManagersTeamMembers: string[];
}

// Project types
export interface Project extends OctopusResource {
  Name: string;
  Description: string;
  Slug: string;
  IsDisabled: boolean;
  ProjectGroupId: string;
  LifecycleId: string;
  ClonedFromProjectId: string | null;
  IncludedLibraryVariableSetIds: string[];
  TenantedDeploymentMode: 'Untenanted' | 'TenantedOrUntenanted' | 'Tenanted';
  DiscreteChannelRelease: boolean;
  Logo: string | null;
}

export interface ProjectGroup extends OctopusResource {
  Name: string;
  Description: string | null;
  EnvironmentIds: string[];
  RetentionPolicyId: string | null;
}

// Environment types
export interface Environment extends OctopusResource {
  Name: string;
  Description: string | null;
  SortOrder: number;
  UseGuidedFailure: boolean;
  AllowDynamicInfrastructure: boolean;
  SpaceId: string;
}

// Deployment types
export interface Deployment extends OctopusResource {
  ReleaseId: string;
  EnvironmentId: string;
  TenantId: string | null;
  ForcePackageDownload: boolean;
  ForcePackageRedeployment: boolean;
  SkipActions: string[];
  SpecificMachineIds: string[];
  ExcludedMachineIds: string[];
  ManifestVariableSetId: string | null;
  TaskId: string;
  ProjectId: string;
  ChannelId: string;
  Created: string;
  QueueTime: string | null;
  QueueTimeExpiry: string | null;
  Name: string;
  Comments: string | null;
}

export interface DeploymentProcess extends OctopusResource {
  ProjectId: string;
  Steps: DeploymentStep[];
  Version: number;
  LastSnapshotId: string | null;
}

export interface DeploymentStep {
  Id: string;
  Name: string;
  Condition: 'Success' | 'Failure' | 'Always' | 'Variable';
  StartTrigger: 'StartAfterPrevious' | 'StartWithPrevious';
  PackageRequirement: 'LetOctopusDecide' | 'BeforePackageAcquisition' | 'AfterPackageAcquisition' | 'Never';
  Actions: DeploymentAction[];
  Properties: Record<string, string>;
}

export interface DeploymentAction {
  Id: string;
  Name: string;
  ActionType: string;
  Notes: string | null;
  IsDisabled: boolean;
  CanBeUsedForProjectVersioning: boolean;
  IsRequired: boolean;
  WorkerPoolId: string | null;
  Container: {
    Image: string | null;
    FeedId: string | null;
  };
  WorkerPoolVariable: string | null;
  Environments: string[];
  ExcludedEnvironments: string[];
  Channels: string[];
  TenantTags: string[];
  Packages: Package[];
  Condition: string;
  Properties: Record<string, string>;
}

export interface Package {
  Id: string | null;
  Name: string;
  PackageId: string;
  FeedId: string;
  AcquisitionLocation: string;
  Properties: Record<string, string>;
}

// Release types
export interface Release extends OctopusResource {
  Version: string;
  ChannelId: string;
  ProjectId: string;
  ProjectVariableSetSnapshotId: string;
  LibraryVariableSetSnapshotIds: string[];
  ProjectDeploymentProcessSnapshotId: string;
  SelectedPackages: SelectedPackage[];
  ReleaseNotes: string | null;
  Assembled: string;
  SpaceId: string;
}

export interface SelectedPackage {
  ActionName: string;
  PackageReferenceName: string | null;
  Version: string;
}

// Task types
export type TaskState = 
  | 'Queued'
  | 'Executing'
  | 'Failed'
  | 'Canceled'
  | 'TimedOut'
  | 'Success'
  | 'Cancelling';

export interface Task extends OctopusResource {
  SpaceId: string | null;
  Name: string;
  Description: string;
  Arguments: Record<string, unknown>;
  State: TaskState;
  Completed: string | null;
  QueueTime: string;
  QueueTimeExpiry: string | null;
  StartTime: string | null;
  LastUpdatedTime: string;
  CompletedTime: string | null;
  ServerNode: string | null;
  Duration: string;
  ErrorMessage: string | null;
  HasBeenPickedUpByProcessor: boolean;
  IsCompleted: boolean;
  FinishedSuccessfully: boolean;
  HasPendingInterruptions: boolean;
  CanRerun: boolean;
  HasWarningsOrErrors: boolean;
}

export interface TaskDetails extends Task {
  ActivityLogs: ActivityLog[];
  Progress: TaskProgress;
}

export interface TaskProgress {
  ProgressPercentage: number;
  EstimatedTimeRemaining: string | null;
}

export interface ActivityLog {
  Id: string;
  Name: string;
  Started: string | null;
  Ended: string | null;
  Status: 'Pending' | 'Running' | 'Success' | 'Failed' | 'Skipped' | 'Canceled' | 'Warning';
  Children: ActivityLog[];
  LogElements: LogElement[];
}

export interface LogElement {
  Category: 'Info' | 'Trace' | 'Verbose' | 'Warning' | 'Error' | 'Fatal' | 'Planned' | 'Highlight' | 'Wait' | 'Gap' | 'Abandoned';
  OccurredAt: string;
  MessageText: string;
  Detail: string | null;
  Percentage: number | null;
}

// Dashboard types
export interface Dashboard {
  Projects: DashboardProject[];
  Environments: DashboardEnvironment[];
  Tenants: DashboardTenant[];
  Items: DashboardItem[];
  PreviousItems: DashboardItem[];
  IsFiltered: boolean;
}

export interface DashboardProject {
  Id: string;
  Name: string;
  Slug: string;
  ProjectGroupId: string;
  EnvironmentIds: string[];
}

export interface DashboardEnvironment {
  Id: string;
  Name: string;
}

export interface DashboardTenant {
  Id: string;
  Name: string;
}

export interface DashboardItem {
  Id: string;
  ProjectId: string;
  EnvironmentId: string;
  TenantId: string | null;
  ReleaseId: string;
  DeploymentId: string;
  TaskId: string;
  ChannelId: string;
  ReleaseVersion: string;
  Created: string;
  QueueTime: string;
  StartTime: string | null;
  CompletedTime: string | null;
  State: TaskState;
  HasPendingInterruptions: boolean;
  HasWarningsOrErrors: boolean;
  ErrorMessage: string | null;
  Duration: string;
  IsCurrent: boolean;
  IsPrevious: boolean;
  IsCompleted: boolean;
}

// Machine/Target types
export interface Machine extends OctopusResource {
  Name: string;
  Thumbprint: string | null;
  Uri: string | null;
  IsDisabled: boolean;
  EnvironmentIds: string[];
  Roles: string[];
  TenantIds: string[];
  TenantTags: string[];
  Status: 'Unknown' | 'Online' | 'Offline' | 'NeedsUpgrade' | 'CalamariNeedsUpgrade' | 'Disabled';
  HealthStatus: 'Unknown' | 'Unavailable' | 'Unhealthy' | 'HasWarnings' | 'Healthy';
  HasLatestCalamari: boolean;
  StatusSummary: string | null;
  MachinePolicyId: string;
  Endpoint: MachineEndpoint;
  SpaceId: string;
}

export interface MachineEndpoint {
  CommunicationStyle: string;
  [key: string]: unknown;
}

// Channel types
export interface Channel extends OctopusResource {
  Name: string;
  Description: string | null;
  ProjectId: string;
  LifecycleId: string | null;
  IsDefault: boolean;
  Rules: ChannelRule[];
  TenantTags: string[];
  SpaceId: string;
}

export interface ChannelRule {
  Id: string;
  Tag: string | null;
  VersionRange: string | null;
  ActionPackages: ActionPackage[];
}

export interface ActionPackage {
  DeploymentAction: string;
  PackageReference: string;
}

// Lifecycle types
export interface Lifecycle extends OctopusResource {
  Name: string;
  Description: string | null;
  ReleaseRetentionPolicy: RetentionPolicy;
  TentacleRetentionPolicy: RetentionPolicy;
  Phases: Phase[];
  SpaceId: string;
}

export interface RetentionPolicy {
  Unit: 'Days' | 'Items';
  QuantityToKeep: number;
  ShouldKeepForever: boolean;
}

export interface Phase {
  Id: string;
  Name: string;
  OptionalDeploymentTargets: string[];
  AutomaticDeploymentTargets: string[];
  MinimumEnvironmentsBeforePromotion: number;
  IsOptionalPhase: boolean;
  ReleaseRetentionPolicy: RetentionPolicy | null;
  TentacleRetentionPolicy: RetentionPolicy | null;
}

// Server status
export interface ServerStatus {
  ServerId: string;
  ServerVersion: string;
  MaximumRetentionPeriod: string;
  MaintenanceExpires: string | null;
  IsInMaintenanceMode: boolean;
  IsEarlyAccessProgram: boolean;
}

// License information
export interface License {
  Id: string;
  LicenseText: string;
}

export interface LicenseStatus {
  IsCompliant: boolean;
  Limits: LicenseLimits;
  HostingEnvironment: string;
  LicenseType: string; // 'Community' | 'Professional' | 'Enterprise' | 'Unlimited'
  MaintenanceExpiresIn: string | null;
  DaysToEffectiveExpiry: number | null;
  EffectiveExpiryDate: string | null;
  IsExpired: boolean;
  EffectiveExpiryReason: string | null;
}

export interface LicenseLimits {
  Projects: LicenseLimit;
  Machines: LicenseLimit;
  Tenants: LicenseLimit;
  Users: LicenseLimit;
}

export interface LicenseLimit {
  CurrentUsage: number;
  EffectiveLimit: number;
  IsUnlimited: boolean;
  IsCompliant: boolean;
}

// API Error types
export interface ApiError {
  ErrorMessage: string;
  Errors: string[];
  FullException: string | null;
  HelpText: string | null;
  Details: Record<string, unknown> | null;
  ParsedHelpLinks: string[] | null;
}

// Event types for audit
export interface Event extends OctopusResource {
  RelatedDocumentIds: string[];
  Category: string;
  UserId: string;
  Username: string;
  IsService: boolean;
  IdentityEstablishedWith: string;
  UserAgent: string | null;
  Occurred: string;
  Message: string;
  MessageHtml: string;
  MessageReferences: MessageReference[];
  Comments: string | null;
  Details: string | null;
  SpaceId: string | null;
  ChangeDetails: ChangeDetails;
}

export interface MessageReference {
  ReferencedDocumentId: string;
  StartIndex: number;
  Length: number;
}

export interface ChangeDetails {
  DocumentContext: string | null;
  Differences: Difference[] | null;
}

export interface Difference {
  path: string;
  value: unknown;
}

// Progression/Deployment Preview
export interface Progression {
  Phases: PhaseProgression[];
  NextDeployments: string[];
  NextDeploymentsMinimumRequired: number;
  ChannelEnvironments: Record<string, string[]>;
}

export interface PhaseProgression {
  Id: string;
  Name: string;
  Blocked: boolean;
  Progress: 'None' | 'Current' | 'Complete';
  Deployments: Record<string, DeploymentPreview[]>;
  AutomaticDeploymentTargets: string[];
  OptionalDeploymentTargets: string[];
  MinimumEnvironmentsBeforePromotion: number;
  IsOptionalPhase: boolean;
  ReleaseRetentionPolicy: RetentionPolicy | null;
  TentacleRetentionPolicy: RetentionPolicy | null;
}

export interface DeploymentPreview {
  ReleaseId: string;
  DeploymentId: string;
  TaskId: string;
  State: TaskState;
  CompletedTime: string | null;
  HasWarningsOrErrors: boolean;
}

// Runbook types
export interface Runbook extends OctopusResource {
  Name: string;
  Description: string | null;
  ProjectId: string;
  SpaceId: string;
  RunbookProcessId: string;
  PublishedRunbookSnapshotId: string | null;
  MultiTenancyMode: 'Untenanted' | 'TenantedOrUntenanted' | 'Tenanted';
  ConnectivityPolicy: {
    AllowDeploymentsToNoTargets: boolean;
    TargetRoles: string[];
    ExcludeUnhealthyTargets: boolean;
    SkipMachineBehavior: string;
  };
  EnvironmentScope: 'All' | 'Specified' | 'FromProjectLifecycles';
  Environments: string[];
  DefaultGuidedFailureMode: 'EnvironmentDefault' | 'Off' | 'On';
  RunRetentionPolicy: {
    QuantityToKeep: number;
    ShouldKeepForever: boolean;
  };
}

export interface RunbookSnapshot extends OctopusResource {
  Name: string;
  RunbookId: string;
  SpaceId: string;
  ProjectId: string;
  Notes: string | null;
  Assembled: string;
  FrozenRunbookProcessId: string;
  FrozenProjectVariableSetId: string;
}

export interface RunbookRun extends OctopusResource {
  RunbookId: string;
  RunbookSnapshotId: string;
  ProjectId: string;
  EnvironmentId: string;
  TenantId: string | null;
  TaskId: string;
  SpaceId: string;
  Created: string;
  QueueTime: string | null;
  StartTime: string | null;
  CompletedTime: string | null;
  Name: string;
  Comments: string | null;
}

export interface RunbookRunPreview {
  RunbookId: string;
  RunbookSnapshotId: string;
  EnvironmentId: string;
  TaskId: string;
  State: TaskState;
  Created: string;
  CompletedTime: string | null;
  HasWarningsOrErrors: boolean;
}

export interface RunbookProcess extends OctopusResource {
  RunbookId: string;
  SpaceId: string;
  Steps: DeploymentStep[];
  Version: number;
  LastSnapshotId: string | null;
}

// Variable types
export interface VariableSet extends OctopusResource {
  OwnerId: string;
  Version: number;
  Variables: Variable[];
  ScopeValues: ScopeValues;
}

export interface Variable {
  Id: string;
  Name: string;
  Value: string | null;
  Description: string | null;
  Scope: VariableScope;
  IsEditable: boolean;
  Prompt: VariablePrompt | null;
  Type: 'String' | 'Sensitive' | 'Certificate' | 'WorkerPool' | 'AmazonWebServicesAccount' | 'AzureAccount' | 'GoogleCloudAccount';
  IsSensitive: boolean;
}

export interface VariableScope {
  Environment?: string[];
  Machine?: string[];
  Role?: string[];
  Channel?: string[];
  TenantTag?: string[];
  Action?: string[];
  ProcessOwner?: string[];
}

export interface VariablePrompt {
  Label: string;
  Description: string | null;
  Required: boolean;
  DisplaySettings: Record<string, string>;
}

export interface ScopeValues {
  Environments: ScopeValue[];
  Machines: ScopeValue[];
  Actions: ScopeValue[];
  Roles: ScopeValue[];
  Channels: ScopeValue[];
  TenantTags: ScopeValue[];
  Processes: ScopeValue[];
}

export interface ScopeValue {
  Id: string;
  Name: string;
}

// Project Summary (from dashboard filtered by project)
export interface ProjectSummary {
  Project: DashboardProject;
  Environments: DashboardEnvironment[];
  Items: DashboardItem[];
}

// ============================================================================
// Kubernetes Live Object Status (Observability)
// ============================================================================

/**
 * Application status for Kubernetes deployments
 * Represents the overall health/sync status of a deployment's K8s resources
 */
export type KubernetesApplicationStatus = 
  | 'Progressing'
  | 'Healthy'
  | 'Unknown'
  | 'Degraded'
  | 'OutOfSync'
  | 'Missing'
  | 'Unavailable'
  | 'Waiting';

/**
 * Individual Kubernetes object status
 */
export type KubernetesObjectStatus = 
  | 'Progressing'
  | 'Healthy'
  | 'Unknown'
  | 'Degraded'
  | 'OutOfSync'
  | 'Missing'
  | 'InSync'
  | 'Suspended';

/**
 * Kubernetes resource information from the monitor
 */
export interface KubernetesResource {
  Id: string;
  Name: string;
  Namespace: string;
  Kind: string;
  ApiVersion: string;
  Status: KubernetesObjectStatus;
  StatusMessage: string | null;
  CreatedAt: string | null;
  UpdatedAt: string | null;
  Labels: Record<string, string>;
  Annotations: Record<string, string>;
}

/**
 * Live status response for a deployment's Kubernetes objects
 */
export interface KubernetesLiveStatus {
  DeploymentId: string;
  ApplicationStatus: KubernetesApplicationStatus;
  ApplicationStatusMessage: string | null;
  Resources: KubernetesResource[];
  LastUpdated: string;
  IsAvailable: boolean;
}

// ============================================================================
// Tenant Types
// ============================================================================

export interface Tenant extends OctopusResource {
  Name: string;
  TenantTags: string[];
  ProjectEnvironments: Record<string, string[]>;
  ClonedFromTenantId: string | null;
  Description: string | null;
  SpaceId: string;
}

export interface TenantTag {
  Id: string;
  Name: string;
  CanonicalTagName: string;
  Description: string | null;
  SortOrder: number;
}

export interface TagSet extends OctopusResource {
  Name: string;
  Description: string | null;
  SortOrder: number;
  Tags: TenantTag[];
  SpaceId: string;
}

// ============================================================================
// Release Creation Types
// ============================================================================

export interface CreateReleaseRequest {
  ProjectId: string;
  Version?: string;
  ChannelId?: string;
  ReleaseNotes?: string;
  SelectedPackages?: SelectedPackageVersion[];
}

export interface SelectedPackageVersion {
  ActionName: string;
  PackageReferenceName?: string;
  Version: string;
}

export interface ReleaseTemplate {
  DeploymentProcessId: string;
  NextVersionIncrement: string;
  VersioningPackageStepName: string | null;
  VersioningPackageReferenceName: string | null;
  Packages: ReleaseTemplatePackage[];
}

export interface ReleaseTemplatePackage {
  ActionName: string;
  PackageReferenceName: string | null;
  PackageId: string;
  FeedId: string;
  IsResolvable: boolean;
  VersionSelectedLastRelease: string | null;
}

export interface PackageVersion {
  Id: string;
  Version: string;
  Title: string | null;
  Description: string | null;
  Published: string | null;
  PackageId: string;
  FeedId: string;
}

// ============================================================================
// Interruptions (Manual Interventions, Guided Failures)
// ============================================================================

export interface Interruption extends OctopusResource {
  Title: string;
  Created: string;
  IsPending: boolean;
  Form: InterruptionForm | null;
  RelatedDocumentIds: string[];
  ResponsibleTeamIds: string[];
  ResponsibleUserId: string | null;
  CanTakeResponsibility: boolean;
  HasResponsibility: boolean;
  TaskId: string;
  CorrelationId: string;
  IsLinkedToOtherInterruption: boolean;
  SpaceId: string;
}

export interface InterruptionForm {
  Values: Record<string, string>;
  Elements: InterruptionFormElement[];
}

export interface InterruptionFormElement {
  Name: string;
  Control: InterruptionFormControl;
  IsValueRequired: boolean;
}

export interface InterruptionFormControl {
  Type: 'Paragraph' | 'TextArea' | 'VariableValue' | 'Select';
  Text?: string;
  Label?: string;
  Description?: string;
  Options?: { Value: string; Text: string }[];
}

// ============================================================================
// Artifacts
// ============================================================================

export interface Artifact extends OctopusResource {
  SpaceId: string;
  Filename: string;
  Source: string | null;
  ServerTaskId: string;
  Created: string;
  LogCorrelationId: string | null;
}

// ============================================================================
// Deployment Preview (for promotion)
// ============================================================================

export interface DeploymentPreviewRequest {
  ReleaseId: string;
  EnvironmentId: string;
  TenantId?: string;
}

export interface DeploymentPreviewResponse {
  StepsToExecute: DeploymentPreviewStep[];
  Changes: DeploymentPreviewChange[];
  HasPreviouslyBeenDeployed: boolean;
}

export interface DeploymentPreviewStep {
  ActionId: string;
  ActionName: string;
  ActionNumber: string;
  Roles: string[];
  MachineNames: string[];
  IsDisabled: boolean;
}

export interface DeploymentPreviewChange {
  Version: string;
  ReleaseNotes: string | null;
  WorkItems: unknown[];
}

