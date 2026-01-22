/**
 * ProcessStepsView Component
 * Generic component for displaying deployment process and runbook steps
 * Used in both project detail and runbook detail screens
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fontSize, spacing, borderRadius } from '../theme/spacing';
import { EmptyState } from './ui/EmptyState';
import type { DeploymentStep, DeploymentAction, Environment } from '../lib/api/types';

interface ProcessStepsViewProps {
  steps: DeploymentStep[];
  environments?: Environment[];
  emptyTitle?: string;
  emptyMessage?: string;
}

export function ProcessStepsView({ 
  steps, 
  environments = [],
  emptyTitle = 'No steps configured',
  emptyMessage = 'Configure your process to add steps',
}: ProcessStepsViewProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;
  const [selectedStep, setSelectedStep] = useState<DeploymentStep | null>(null);
  const [selectedAction, setSelectedAction] = useState<DeploymentAction | null>(null);

  // Helper to resolve environment ID to name
  const getEnvironmentName = (envId: string): string => {
    const env = environments.find(e => e.Id === envId);
    return env?.Name || envId;
  };

  const handleStepPress = useCallback((step: DeploymentStep) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStep(step);
    setSelectedAction(null);
  }, []);

  const handleActionPress = useCallback((action: DeploymentAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAction(action);
  }, []);

  const closeModal = useCallback(() => {
    setSelectedStep(null);
    setSelectedAction(null);
  }, []);

  const goBackToStep = useCallback(() => {
    setSelectedAction(null);
  }, []);

  const getActionTypeIcon = (actionType: string): keyof typeof Ionicons.glyphMap => {
    const type = actionType.toLowerCase();
    if (type.includes('script') || type.includes('powershell') || type.includes('bash')) {
      return 'code-slash';
    }
    if (type.includes('package') || type.includes('deploy')) {
      return 'cube';
    }
    if (type.includes('kubernetes') || type.includes('helm')) {
      return 'logo-docker';
    }
    if (type.includes('azure')) {
      return 'cloud';
    }
    if (type.includes('aws')) {
      return 'logo-amazon';
    }
    if (type.includes('terraform')) {
      return 'grid';
    }
    if (type.includes('email') || type.includes('notification') || type.includes('slack')) {
      return 'notifications';
    }
    if (type.includes('manual') || type.includes('approval')) {
      return 'hand-left';
    }
    if (type.includes('http') || type.includes('api') || type.includes('webhook')) {
      return 'globe';
    }
    if (type.includes('iis') || type.includes('windows')) {
      return 'logo-windows';
    }
    return 'flash';
  };

  const formatActionType = (actionType: string): string => {
    // Remove common prefixes and format nicely
    return actionType
      .replace('Octopus.', '')
      .replace('TentaclePackage', 'Deploy Package')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  };

  if (!steps?.length) {
    return (
      <EmptyState
        ionicon="construct-outline"
        title={emptyTitle}
        message={emptyMessage}
      />
    );
  }

  return (
    <>
      <View style={styles.processList}>
        {steps.map((step, index) => (
          <Pressable
            key={step.Id}
            style={({ pressed }) => [
              styles.processStep,
              pressed && styles.processStepPressed,
            ]}
            onPress={() => handleStepPress(step)}
          >
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepName}>{step.Name}</Text>
              <Text style={styles.stepActions} numberOfLines={2}>
                {step.Actions.map(a => a.Name).join(' → ')}
              </Text>
              <Text style={styles.actionCount}>
                {step.Actions.length} action{step.Actions.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </Pressable>
        ))}
      </View>

      {/* Step Detail Modal */}
      <Modal
        visible={selectedStep !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: spacing.lg + bottomInset }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              {selectedAction ? (
                <Pressable onPress={goBackToStep} style={styles.backButton}>
                  <Ionicons name="chevron-back" size={24} color={colors.brand.primary} />
                </Pressable>
              ) : null}
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedAction ? selectedAction.Name : selectedStep?.Name}
              </Text>
              <Pressable onPress={closeModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedAction ? (
                // Action Details View
                <ActionDetails action={selectedAction} getEnvironmentName={getEnvironmentName} />
              ) : selectedStep ? (
                // Step Details View
                <StepDetails 
                  step={selectedStep} 
                  onActionPress={handleActionPress}
                  getActionTypeIcon={getActionTypeIcon}
                  formatActionType={formatActionType}
                />
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

interface StepDetailsProps {
  step: DeploymentStep;
  onActionPress: (action: DeploymentAction) => void;
  getActionTypeIcon: (actionType: string) => keyof typeof Ionicons.glyphMap;
  formatActionType: (actionType: string) => string;
}

function StepDetails({ step, onActionPress, getActionTypeIcon, formatActionType }: StepDetailsProps) {
  return (
    <View style={styles.detailsContainer}>
      {/* Step Info */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Step Configuration</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Run Condition</Text>
          <Text style={styles.infoValue}>{step.Condition}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Start Trigger</Text>
          <Text style={styles.infoValue}>
            {step.StartTrigger === 'StartAfterPrevious' ? 'After previous step' : 'With previous step'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Package Requirement</Text>
          <Text style={styles.infoValue}>
            {step.PackageRequirement === 'LetOctopusDecide' ? 'Let Octopus decide' : step.PackageRequirement}
          </Text>
        </View>
      </View>

      {/* Actions List */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Actions ({step.Actions.length})</Text>
        
        {step.Actions.map((action, index) => (
          <Pressable
            key={action.Id}
            style={({ pressed }) => [
              styles.actionItem,
              pressed && styles.actionItemPressed,
            ]}
            onPress={() => onActionPress(action)}
          >
            <View style={styles.actionIcon}>
              <Ionicons 
                name={getActionTypeIcon(action.ActionType)} 
                size={20} 
                color={action.IsDisabled ? colors.text.tertiary : colors.brand.primary} 
              />
            </View>
            <View style={styles.actionInfo}>
              <Text style={[styles.actionName, action.IsDisabled && styles.disabledText]}>
                {action.Name}
              </Text>
              <Text style={styles.actionType}>
                {formatActionType(action.ActionType)}
              </Text>
            </View>
            {action.IsDisabled && (
              <View style={styles.disabledBadge}>
                <Text style={styles.disabledBadgeText}>Disabled</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

interface ActionDetailsProps {
  action: DeploymentAction;
  getEnvironmentName: (envId: string) => string;
}

// Map of action types to their main content property keys
const MAIN_CONTENT_KEYS: Record<string, string[]> = {
  'Octopus.Script': ['Octopus.Action.Script.ScriptBody'],
  'Octopus.KubernetesDeployRawYaml': ['Octopus.Action.KubernetesContainers.CustomResourceYaml'],
  'Octopus.KubernetesRunScript': ['Octopus.Action.Script.ScriptBody'],
  'Octopus.Manual': ['Octopus.Action.Manual.Instructions'],
  'Octopus.Email': ['Octopus.Action.Email.Body', 'Octopus.Action.Email.Subject'],
  'Octopus.Slack': ['Octopus.Action.Slack.Message'],
  'Octopus.TerraformApply': ['Octopus.Action.Terraform.Template', 'Octopus.Action.Terraform.TemplateParameters'],
  'Octopus.TerraformPlan': ['Octopus.Action.Terraform.Template'],
  'Octopus.AzurePowerShell': ['Octopus.Action.Script.ScriptBody'],
  'Octopus.AwsRunScript': ['Octopus.Action.Script.ScriptBody'],
};

function ActionDetails({ action, getEnvironmentName }: ActionDetailsProps) {
  // Get the main content for this action type
  const getMainContent = (): { label: string; content: string; syntax: string } | null => {
    const props = action.Properties || {};
    
    // Check for known main content keys based on action type
    const contentKeys = MAIN_CONTENT_KEYS[action.ActionType] || [];
    for (const key of contentKeys) {
      if (props[key] && typeof props[key] === 'string' && props[key].trim()) {
        let label = 'Content';
        let syntax = 'text';
        
        if (key.includes('ScriptBody')) {
          label = props['Octopus.Action.Script.Syntax'] === 'PowerShell' ? 'PowerShell Script' : 
                  props['Octopus.Action.Script.Syntax'] === 'Bash' ? 'Bash Script' :
                  props['Octopus.Action.Script.Syntax'] === 'Python' ? 'Python Script' :
                  'Script';
          syntax = (props['Octopus.Action.Script.Syntax'] || 'bash').toLowerCase();
        } else if (key.includes('Yaml') || key.includes('CustomResourceYaml')) {
          label = 'Kubernetes YAML';
          syntax = 'yaml';
        } else if (key.includes('Template') && action.ActionType.includes('Terraform')) {
          label = 'Terraform Configuration';
          syntax = 'hcl';
        } else if (key.includes('Instructions')) {
          label = 'Instructions';
          syntax = 'text';
        } else if (key.includes('Message')) {
          label = 'Message';
          syntax = 'text';
        } else if (key.includes('Body')) {
          label = 'Email Body';
          syntax = 'html';
        } else if (key.includes('Subject')) {
          label = 'Subject';
          syntax = 'text';
        }
        
        return { label, content: props[key], syntax };
      }
    }
    
    // Fallback: look for common script/content properties
    const fallbackKeys = [
      'Octopus.Action.Script.ScriptBody',
      'Octopus.Action.Template.Body',
      'Octopus.Action.Package.CustomInstallationDirectory',
    ];
    
    for (const key of fallbackKeys) {
      if (props[key] && typeof props[key] === 'string' && props[key].trim()) {
        return { 
          label: key.includes('Script') ? 'Script' : 'Content', 
          content: props[key],
          syntax: 'text'
        };
      }
    }
    
    return null;
  };

  const mainContent = getMainContent();

  // Format action type for display
  const formatActionType = (actionType: string): string => {
    return actionType
      .replace('Octopus.', '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  };

  return (
    <View style={styles.detailsContainer}>
      {/* Main Content - Script/YAML/Instructions - THE IMPORTANT STUFF */}
      {mainContent ? (
        <View style={styles.mainContentSection}>
          <View style={styles.mainContentHeader}>
            <Ionicons name="code-slash" size={18} color={colors.brand.primary} />
            <Text style={styles.mainContentLabel}>{mainContent.label}</Text>
          </View>
          <ScrollView 
            style={styles.codeScrollView} 
            horizontal={false}
            nestedScrollEnabled={true}
          >
            <View style={styles.codeContainer}>
              <Text style={styles.codeText} selectable>
                {mainContent.content}
              </Text>
            </View>
          </ScrollView>
        </View>
      ) : (
        // No main content - show packages if available
        action.Packages && action.Packages.length > 0 ? (
          <View style={styles.infoSection}>
            <View style={styles.mainContentHeader}>
              <Ionicons name="cube" size={18} color={colors.brand.primary} />
              <Text style={styles.mainContentLabel}>Packages</Text>
            </View>
            {action.Packages.map((pkg, index) => (
              <View key={index} style={styles.packageItem}>
                <Ionicons name="cube-outline" size={16} color={colors.brand.primary} />
                <View style={styles.packageInfo}>
                  <Text style={styles.packageName}>{pkg.PackageId}</Text>
                  {pkg.Name && pkg.Name !== pkg.PackageId && (
                    <Text style={styles.packageFeed}>{pkg.Name}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.noContentSection}>
            <Ionicons name="information-circle-outline" size={24} color={colors.text.tertiary} />
            <Text style={styles.noContentText}>
              This action type ({formatActionType(action.ActionType)}) doesn't have viewable content
            </Text>
          </View>
        )
      )}

      {/* Notes if present */}
      {action.Notes && (
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{action.Notes}</Text>
        </View>
      )}

      {/* Environment scope - only if scoped */}
      {(action.Environments.length > 0 || action.ExcludedEnvironments.length > 0) && (
        <View style={styles.scopeSection}>
          <Text style={styles.scopeLabel}>Environment Scope</Text>
          <View style={styles.tagContainer}>
            {action.Environments.map(envId => (
              <View key={envId} style={styles.tag}>
                <Text style={styles.tagText}>{getEnvironmentName(envId)}</Text>
              </View>
            ))}
            {action.ExcludedEnvironments.map(envId => (
              <View key={envId} style={[styles.tag, styles.excludeTag]}>
                <Text style={[styles.tagText, styles.excludeTagText]}>
                  Not {getEnvironmentName(envId)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  processList: {
    gap: spacing.sm,
  },
  processStep: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: 12,
  },
  processStepPressed: {
    opacity: 0.7,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  stepNumberText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  stepName: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepActions: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  actionCount: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.muted,
  },
  backButton: {
    marginRight: spacing.sm,
  },
  modalTitle: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  closeButton: {
    marginLeft: spacing.sm,
  },
  modalBody: {
    flex: 1,
  },

  // Details container
  detailsContainer: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  infoSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  // Main content (script/YAML) - the important stuff
  mainContentSection: {
    marginBottom: spacing.md,
  },
  mainContentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  mainContentLabel: {
    color: colors.brand.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  codeScrollView: {
    maxHeight: 400,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.primary,
  },
  codeContainer: {
    padding: spacing.md,
  },
  codeText: {
    color: colors.text.primary,
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  noContentSection: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  noContentText: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  notesSection: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  notesLabel: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  notesText: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  scopeSection: {
    marginTop: spacing.md,
  },
  scopeLabel: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  // Legacy - keeping for step details
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.muted,
  },
  infoLabel: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  infoValue: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  disabledText: {
    color: colors.text.tertiary,
  },

  // Action items
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  actionItemPressed: {
    opacity: 0.7,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.interactive.focus,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  actionInfo: {
    flex: 1,
  },
  actionName: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  actionType: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  disabledBadge: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  disabledBadgeText: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },

  // Tags
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tag: {
    backgroundColor: colors.interactive.focus,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    color: colors.brand.primary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  excludeTag: {
    backgroundColor: colors.status.errorDim,
  },
  excludeTagText: {
    color: colors.status.error,
  },

  // Packages
  packageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    color: colors.text.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  packageFeed: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});

