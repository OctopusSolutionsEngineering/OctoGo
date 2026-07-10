/**
 * Tests for the Events (Audit Log) tab screen
 * Covers the `!!item.Category` rendering branch both ways, plus
 * loading / error / empty states and event navigation.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// Mock vector icons to avoid loading expo-font/expo-asset in tests
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Ionicons = (props: { name: string }) => React.createElement(Text, props, props.name);
  Ionicons.glyphMap = {};
  return { Ionicons };
});

jest.mock('../../src/context/ThemeContext', () => {
  const actual = jest.requireActual('../../src/context/ThemeContext');
  return {
    ...actual,
    useColors: () => actual.darkColors,
  };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

// NOTE: the '@/src/...' specifiers resolve through the manual mocks in
// <rootDir>/__mocks__/@/src which re-export the real modules; this explicit
// mock replaces the hooks module for this suite.
jest.mock('@/src/hooks/useOctopusQuery', () => ({
  useEvents: jest.fn(),
}));

import { useEvents } from '@/src/hooks/useOctopusQuery';
import EventsScreen from '../../app/(tabs)/events';

const mockUseEvents = useEvents as jest.Mock;

const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  Id: 'Events-1',
  Message: 'Something happened',
  Category: 'Deployment',
  Username: 'alice',
  Occurred: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  RelatedDocumentIds: [],
  MessageReferences: [],
  ...overrides,
});

const queryResult = (events: any[], extra: Record<string, unknown> = {}) => ({
  data: { Items: events },
  isLoading: false,
  error: null,
  refetch: jest.fn(),
  isRefetching: false,
  ...extra,
});

describe('EventsScreen', () => {
  beforeEach(() => {
    mockUseEvents.mockReturnValue(queryResult([]));
  });

  it('renders a category badge only for events with a category', () => {
    mockUseEvents.mockReturnValue(
      queryResult([
        makeEvent({
          Id: 'Events-1',
          Message: 'Deploy succeeded',
          Category: 'DeploymentSucceeded',
        }),
        makeEvent({
          Id: 'Events-2',
          Message: 'Mystery event',
          Category: '',
          Username: 'bob',
          Occurred: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ])
    );

    render(<EventsScreen />);

    expect(screen.getByText('Deploy succeeded')).toBeTruthy();
    expect(screen.getByText('DeploymentSucceeded')).toBeTruthy();
    expect(screen.getByText('Mystery event')).toBeTruthy();
    // The event with a category renders two separator dots, the one without only one
    expect(screen.getAllByText('•')).toHaveLength(3);
    expect(screen.getByText('2 recent events')).toBeTruthy();
  });

  it('navigates to a task when a task-related event is pressed', () => {
    mockUseEvents.mockReturnValue(
      queryResult([
        makeEvent({
          Id: 'Events-3',
          Message: 'Task queued',
          RelatedDocumentIds: ['ServerTasks-123'],
        }),
      ])
    );

    render(<EventsScreen />);

    fireEvent.press(screen.getByText('Task queued'));

    expect(mockPush).toHaveBeenCalledWith('/task/ServerTasks-123');
  });

  it('navigates to a project when the event references a project document', () => {
    mockUseEvents.mockReturnValue(
      queryResult([
        makeEvent({
          Id: 'Events-4',
          Message: 'Project modified',
          Category: 'Modified',
          MessageReferences: [{ ReferencedDocumentId: 'Projects-77', StartIndex: 0, Length: 1 }],
        }),
      ])
    );

    render(<EventsScreen />);

    fireEvent.press(screen.getByText('Project modified'));

    expect(mockPush).toHaveBeenCalledWith('/project/Projects-77');
  });

  it('does not navigate for events without navigable documents', () => {
    mockUseEvents.mockReturnValue(
      queryResult([
        makeEvent({
          Id: 'Events-5',
          Message: 'Not clickable',
          RelatedDocumentIds: ['Users-1'],
        }),
      ])
    );

    render(<EventsScreen />);

    fireEvent.press(screen.getByText('Not clickable'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows the loading screen while events load', () => {
    mockUseEvents.mockReturnValue(
      queryResult([], { data: undefined, isLoading: true })
    );

    render(<EventsScreen />);

    expect(screen.getByText('Loading events...')).toBeTruthy();
  });

  it('shows an error view when events fail to load', () => {
    mockUseEvents.mockReturnValue(
      queryResult([], { data: undefined, error: { message: 'Server unreachable' } })
    );

    render(<EventsScreen />);

    expect(screen.getByText('Failed to load events')).toBeTruthy();
    expect(screen.getByText('Server unreachable')).toBeTruthy();
  });

  it('shows the empty state when there are no events', () => {
    render(<EventsScreen />);

    expect(screen.getByText('No Events')).toBeTruthy();
  });
});
