/**
 * Tests for ProcessStepsView component
 * Covers step list rendering, step/action detail modals, and the
 * package name rendering branch (`!!pkg.Name && pkg.Name !== pkg.PackageId`).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => React.createElement(Text, props, props.name),
  };
});
import { ProcessStepsView } from '../../src/components/ProcessStepsView';

const makeAction = (overrides: Record<string, unknown> = {}) => ({
  Id: 'Actions-1',
  Name: 'Deploy Package',
  ActionType: 'Octopus.TentaclePackage',
  Notes: null,
  IsDisabled: false,
  Environments: [],
  ExcludedEnvironments: [],
  Packages: [],
  Properties: {},
  ...overrides,
});

const makeStep = (actions: any[], overrides: Record<string, unknown> = {}) => ({
  Id: 'Steps-1',
  Name: 'Step One',
  Condition: 'Success',
  StartTrigger: 'StartAfterPrevious',
  PackageRequirement: 'LetOctopusDecide',
  Actions: actions,
  ...overrides,
});

describe('ProcessStepsView', () => {
  it('renders empty state when there are no steps', () => {
    render(<ProcessStepsView steps={[]} />);

    expect(screen.getByText('No steps configured')).toBeTruthy();
    expect(screen.getByText('Configure your process to add steps')).toBeTruthy();
  });

  it('renders the step list with action names and counts', () => {
    const step = makeStep([
      makeAction({ Id: 'Actions-1', Name: 'First Action' }),
      makeAction({ Id: 'Actions-2', Name: 'Second Action', ActionType: 'Octopus.Script' }),
    ]);

    render(<ProcessStepsView steps={[step as any]} />);

    expect(screen.getByText('Step One')).toBeTruthy();
    expect(screen.getByText('First Action → Second Action')).toBeTruthy();
    expect(screen.getByText('2 actions')).toBeTruthy();
  });

  it('shows package names only when Name is set and differs from PackageId', () => {
    const action = makeAction({
      Packages: [
        // Name differs from PackageId -> secondary label rendered
        { Id: 'p1', Name: 'CustomName', PackageId: 'Acme.Lib', FeedId: 'feeds-1', AcquisitionLocation: 'Server', Properties: {} },
        // Name equals PackageId -> no secondary label
        { Id: 'p2', Name: 'Acme.Web', PackageId: 'Acme.Web', FeedId: 'feeds-1', AcquisitionLocation: 'Server', Properties: {} },
        // No Name -> no secondary label
        { Id: 'p3', Name: '', PackageId: 'Acme.Api', FeedId: 'feeds-1', AcquisitionLocation: 'Server', Properties: {} },
      ],
    });
    const step = makeStep([action]);

    render(<ProcessStepsView steps={[step as any]} />);

    // Open step details, then the action details
    fireEvent.press(screen.getByText('Step One'));
    const actionEntries = screen.getAllByText('Deploy Package');
    fireEvent.press(actionEntries[actionEntries.length - 1]);

    expect(screen.getByText('Packages')).toBeTruthy();
    expect(screen.getByText('Acme.Lib')).toBeTruthy();
    expect(screen.getByText('CustomName')).toBeTruthy();
    // Only the package with a distinct Name renders the secondary label
    expect(screen.getByText('Acme.Web')).toBeTruthy();
    expect(screen.getByText('Acme.Api')).toBeTruthy();
    expect(screen.queryAllByText('CustomName')).toHaveLength(1);
    expect(screen.queryAllByText('Acme.Web')).toHaveLength(1);
    expect(screen.queryAllByText('Acme.Api')).toHaveLength(1);
  });

  it('shows the no-viewable-content message for actions without content or packages', () => {
    const action = makeAction({
      Name: 'Health Check',
      ActionType: 'Octopus.HealthCheck',
      Packages: [],
    });
    const step = makeStep([action]);

    render(<ProcessStepsView steps={[step as any]} />);

    fireEvent.press(screen.getByText('Step One'));
    const actionEntries = screen.getAllByText('Health Check');
    fireEvent.press(actionEntries[actionEntries.length - 1]);

    expect(
      screen.getByText(/doesn't have viewable content/)
    ).toBeTruthy();
  });

  it('renders script content and environment scope for script actions', () => {
    const action = makeAction({
      Name: 'Run Script',
      ActionType: 'Octopus.Script',
      Properties: {
        'Octopus.Action.Script.ScriptBody': 'echo "hello"',
        'Octopus.Action.Script.Syntax': 'Bash',
      },
      Notes: 'Some notes',
      Environments: ['Environments-1'],
      ExcludedEnvironments: ['Environments-2'],
    });
    const step = makeStep([action]);
    const environments = [
      { Id: 'Environments-1', Name: 'Production' },
      { Id: 'Environments-2', Name: 'Staging' },
    ];

    render(<ProcessStepsView steps={[step as any]} environments={environments as any} />);

    fireEvent.press(screen.getByText('Step One'));
    const actionEntries = screen.getAllByText('Run Script');
    fireEvent.press(actionEntries[actionEntries.length - 1]);

    expect(screen.getByText('Bash Script')).toBeTruthy();
    expect(screen.getByText('echo "hello"')).toBeTruthy();
    expect(screen.getByText('Some notes')).toBeTruthy();
    expect(screen.getByText('Production')).toBeTruthy();
    expect(screen.getByText('Not Staging')).toBeTruthy();
  });

  it('shows step configuration details when a step is opened', () => {
    const action = makeAction({ Name: 'Deploy Package' });
    const step = makeStep([action]);

    render(<ProcessStepsView steps={[step as any]} />);

    fireEvent.press(screen.getByText('Step One'));

    expect(screen.getByText('Step Configuration')).toBeTruthy();
    expect(screen.getByText('After previous step')).toBeTruthy();
    expect(screen.getByText('Let Octopus decide')).toBeTruthy();
  });

  it('shows alternate start trigger and raw package requirement values', () => {
    const step = makeStep([makeAction()], {
      StartTrigger: 'StartWithPrevious',
      PackageRequirement: 'AfterPackageAcquisition',
    });

    render(<ProcessStepsView steps={[step as any]} />);

    fireEvent.press(screen.getByText('Step One'));

    expect(screen.getByText('With previous step')).toBeTruthy();
    expect(screen.getByText('AfterPackageAcquisition')).toBeTruthy();
  });

  it('maps action types to their icons in the actions list', () => {
    const typed = (id: string, name: string, actionType: string) =>
      makeAction({ Id: id, Name: name, ActionType: actionType });
    const step = makeStep([
      typed('a0', 'Push Package', 'Octopus.TentaclePackage'),
      typed('a1', 'Helm Upgrade', 'Octopus.HelmChartUpgrade'),
      typed('a2', 'Azure Deploy', 'Octopus.AzureWebApp'),
      typed('a3', 'AWS CF', 'Octopus.AwsRunCloudFormation'),
      typed('a4', 'TF Apply', 'Octopus.TerraformApply'),
      typed('a5', 'Send Email', 'Octopus.Email'),
      typed('a6', 'Approval', 'Octopus.Manual'),
      typed('a7', 'Call Webhook', 'Octopus.HttpRequest'),
      typed('a8', 'IIS Site', 'Octopus.IisWebSite'),
      typed('a9', 'Mystery', 'Octopus.Vhd'),
      typed('a10', 'Run Script', 'Octopus.Script'),
    ]);

    render(<ProcessStepsView steps={[step as any]} />);

    fireEvent.press(screen.getByText('Step One'));

    // Ionicons are mocked to render their name as text
    expect(screen.getByText('Actions (11)')).toBeTruthy();
    expect(screen.getByText('cube')).toBeTruthy();
    expect(screen.getByText('logo-docker')).toBeTruthy();
    expect(screen.getByText('cloud')).toBeTruthy();
    expect(screen.getByText('logo-amazon')).toBeTruthy();
    expect(screen.getByText('grid')).toBeTruthy();
    expect(screen.getByText('notifications')).toBeTruthy();
    expect(screen.getByText('hand-left')).toBeTruthy();
    expect(screen.getByText('globe')).toBeTruthy();
    expect(screen.getByText('logo-windows')).toBeTruthy();
    expect(screen.getByText('flash')).toBeTruthy();
    expect(screen.getByText('code-slash')).toBeTruthy();
  });

  it('marks disabled actions with a badge', () => {
    const step = makeStep([makeAction({ Name: 'Old Step', IsDisabled: true })]);

    render(<ProcessStepsView steps={[step as any]} />);

    fireEvent.press(screen.getByText('Step One'));

    expect(screen.getByText('Disabled')).toBeTruthy();
  });

  describe('action main content rendering', () => {
    const openActionDetails = (actionName: string) => {
      fireEvent.press(screen.getByText('Step One'));
      const entries = screen.getAllByText(actionName);
      fireEvent.press(entries[entries.length - 1]);
    };

    it.each([
      [
        'PowerShell script',
        'Octopus.Script',
        {
          'Octopus.Action.Script.ScriptBody': 'Write-Host "hi"',
          'Octopus.Action.Script.Syntax': 'PowerShell',
        },
        'PowerShell Script',
        'Write-Host "hi"',
      ],
      [
        'Python script',
        'Octopus.Script',
        {
          'Octopus.Action.Script.ScriptBody': 'print(1)',
          'Octopus.Action.Script.Syntax': 'Python',
        },
        'Python Script',
        'print(1)',
      ],
      [
        'script without syntax',
        'Octopus.Script',
        { 'Octopus.Action.Script.ScriptBody': 'run-thing' },
        'Script',
        'run-thing',
      ],
      [
        'Kubernetes YAML',
        'Octopus.KubernetesDeployRawYaml',
        { 'Octopus.Action.KubernetesContainers.CustomResourceYaml': 'kind: Pod' },
        'Kubernetes YAML',
        'kind: Pod',
      ],
      [
        'Terraform configuration',
        'Octopus.TerraformApply',
        { 'Octopus.Action.Terraform.Template': 'resource "x" {}' },
        'Terraform Configuration',
        'resource "x" {}',
      ],
      [
        'manual instructions',
        'Octopus.Manual',
        { 'Octopus.Action.Manual.Instructions': 'Check the site' },
        'Instructions',
        'Check the site',
      ],
      [
        'Slack message',
        'Octopus.Slack',
        { 'Octopus.Action.Slack.Message': 'hello team' },
        'Message',
        'hello team',
      ],
      [
        'email body',
        'Octopus.Email',
        { 'Octopus.Action.Email.Body': '<p>Deployed</p>' },
        'Email Body',
        '<p>Deployed</p>',
      ],
      [
        'email subject only',
        'Octopus.Email',
        { 'Octopus.Action.Email.Subject': 'Release shipped' },
        'Subject',
        'Release shipped',
      ],
      [
        'fallback script body for unknown types',
        'Octopus.WildWest',
        { 'Octopus.Action.Script.ScriptBody': 'echo fallback' },
        'Script',
        'echo fallback',
      ],
      [
        'fallback template body for unknown types',
        'Octopus.WildWest',
        { 'Octopus.Action.Template.Body': 'template-body' },
        'Content',
        'template-body',
      ],
    ])('renders %s', (_label, actionType, properties, expectedLabel, expectedContent) => {
      const action = makeAction({
        Name: 'Target Action',
        ActionType: actionType,
        Properties: properties,
      });

      render(<ProcessStepsView steps={[makeStep([action]) as any]} />);
      openActionDetails('Target Action');

      expect(screen.getByText(expectedLabel)).toBeTruthy();
      expect(screen.getByText(expectedContent)).toBeTruthy();
    });

    it('falls back to the raw environment id when it cannot be resolved', () => {
      const action = makeAction({
        Name: 'Scoped Action',
        Environments: ['Environments-99'],
      });

      render(<ProcessStepsView steps={[makeStep([action]) as any]} />);
      openActionDetails('Scoped Action');

      expect(screen.getByText('Environment Scope')).toBeTruthy();
      expect(screen.getByText('Environments-99')).toBeTruthy();
    });

    it('navigates back from the action details and closes the modal', () => {
      const action = makeAction({ Name: 'Drill In' });

      render(<ProcessStepsView steps={[makeStep([action]) as any]} />);
      openActionDetails('Drill In');

      // Back to the step details (icons are mocked to render their name)
      fireEvent.press(screen.getByText('chevron-back'));
      expect(screen.getByText('Step Configuration')).toBeTruthy();

      fireEvent.press(screen.getByText('close'));
      expect(screen.queryByText('Step Configuration')).toBeNull();
    });
  });
});
