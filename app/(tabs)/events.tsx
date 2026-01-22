/**
 * Events/Audit Log Screen
 * View recent activity and audit trail
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEvents } from '@/src/hooks/useOctopusQuery';
import { LoadingScreen } from '@/src/components/ui/LoadingScreen';
import { ErrorView } from '@/src/components/ui/ErrorView';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { PageTitle } from '@/src/components/ui/PageTitle';
import { colors } from '@/src/theme/colors';
import type { Event } from '@/src/lib/api/types';

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const getEventIcon = (category: string): keyof typeof Ionicons.glyphMap => {
  const categoryLower = category.toLowerCase();
  
  if (categoryLower.includes('deployment')) return 'rocket-outline';
  if (categoryLower.includes('release')) return 'pricetag-outline';
  if (categoryLower.includes('project')) return 'folder-outline';
  if (categoryLower.includes('machine') || categoryLower.includes('target')) return 'server-outline';
  if (categoryLower.includes('runbook')) return 'book-outline';
  if (categoryLower.includes('variable')) return 'code-outline';
  if (categoryLower.includes('environment')) return 'layers-outline';
  if (categoryLower.includes('tenant')) return 'people-outline';
  if (categoryLower.includes('user') || categoryLower.includes('login')) return 'person-outline';
  if (categoryLower.includes('certificate')) return 'shield-checkmark-outline';
  if (categoryLower.includes('feed') || categoryLower.includes('package')) return 'cube-outline';
  if (categoryLower.includes('task') || categoryLower.includes('queue')) return 'time-outline';
  if (categoryLower.includes('retention') || categoryLower.includes('delete')) return 'trash-outline';
  if (categoryLower.includes('created')) return 'add-circle-outline';
  if (categoryLower.includes('modified') || categoryLower.includes('updated')) return 'create-outline';
  
  return 'ellipse-outline';
};

const getEventColor = (category: string): string => {
  const categoryLower = category.toLowerCase();
  
  if (categoryLower.includes('failed') || categoryLower.includes('error')) return colors.status.error;
  if (categoryLower.includes('success') || categoryLower.includes('completed')) return colors.status.success;
  if (categoryLower.includes('warning')) return colors.status.warning;
  if (categoryLower.includes('created')) return colors.status.success;
  if (categoryLower.includes('deleted') || categoryLower.includes('remove')) return colors.status.error;
  if (categoryLower.includes('deployment')) return colors.octopus.primary;
  
  return colors.status.info;
};

export default function EventsScreen() {
  const router = useRouter();
  
  const { data, isLoading, error, refetch, isRefetching } = useEvents({ take: 50 });

  const events = useMemo(() => data?.Items ?? [], [data]);
  
  const isEventClickable = useCallback((event: Event): boolean => {
    const docIds: string[] = [
      ...(event.RelatedDocumentIds || []),
      ...(event.MessageReferences || []).map(ref => ref.ReferencedDocumentId)
    ];
    
    return docIds.some(docId => 
      docId.startsWith('ServerTasks-') ||
      docId.startsWith('Deployments-') ||
      docId.startsWith('Projects-') ||
      docId.startsWith('Releases-') ||
      docId.startsWith('Runbooks-') ||
      docId.startsWith('Machines-')
    );
  }, []);

  const handleEventPress = useCallback((event: Event) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Collect all document IDs from both RelatedDocumentIds and MessageReferences
    const docIds: string[] = [
      ...(event.RelatedDocumentIds || []),
      ...(event.MessageReferences || []).map(ref => ref.ReferencedDocumentId)
    ];
    
    // Try to find the most relevant document to navigate to
    // Prioritize tasks first since they're often what users want to see
    for (const docId of docIds) {
      if (docId.startsWith('ServerTasks-')) {
        router.push(`/task/${docId}`);
        return;
      }
    }
    
    // Then check other document types
    for (const docId of docIds) {
      if (docId.startsWith('Deployments-')) {
        router.push(`/deployment/${docId}`);
        return;
      }
      if (docId.startsWith('Projects-')) {
        router.push(`/project/${docId}`);
        return;
      }
      if (docId.startsWith('Releases-')) {
        router.push(`/release/${docId}` as any);
        return;
      }
      if (docId.startsWith('Runbooks-')) {
        router.push(`/runbook/${docId}`);
        return;
      }
      if (docId.startsWith('Machines-')) {
        router.push(`/machine/${docId}`);
        return;
      }
    }
  }, [router]);

  const renderEvent = useCallback(({ item }: { item: Event }) => {
    const icon = getEventIcon(item.Category);
    const iconColor = getEventColor(item.Category);
    const isClickable = isEventClickable(item);
    
    return (
      <Pressable
        onPress={() => isClickable && handleEventPress(item)}
        disabled={!isClickable}
        style={({ pressed }) => ({
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: pressed ? colors.background.tertiary : colors.background.primary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.muted,
          opacity: isClickable ? 1 : 0.8,
        })}
      >
        {/* Icon */}
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: `${iconColor}20`,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 15,
            color: colors.text.primary,
            lineHeight: 20,
          }}>
            {item.Message}
          </Text>
          
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 6,
          }}>
            <Text style={{
              fontSize: 12,
              color: colors.text.muted,
            }}>
              {item.Username}
            </Text>
            <Text style={{
              fontSize: 12,
              color: colors.text.subtle,
              marginHorizontal: 6,
            }}>
              •
            </Text>
            <Text style={{
              fontSize: 12,
              color: colors.text.subtle,
            }}>
              {formatTimeAgo(item.Occurred)}
            </Text>
            {item.Category && (
              <>
                <Text style={{
                  fontSize: 12,
                  color: colors.text.subtle,
                  marginHorizontal: 6,
                }}>
                  •
                </Text>
                <View style={{
                  backgroundColor: `${iconColor}20`,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}>
                  <Text style={{
                    fontSize: 11,
                    color: iconColor,
                    fontWeight: '500',
                  }}>
                    {item.Category}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {isClickable && (
          <Ionicons 
            name="chevron-forward" 
            size={16} 
            color={colors.text.subtle} 
            style={{ alignSelf: 'center', marginLeft: 8 }}
          />
        )}
      </Pressable>
    );
  }, [handleEventPress, isEventClickable]);

  if (isLoading && !data) {
    return <LoadingScreen message="Loading events..." />;
  }

  if (error) {
    return (
      <ErrorView
        message={error.message || 'An error occurred'}
        onRetry={refetch}
        title="Failed to load events"
      />
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon="time-outline"
        title="No Events"
        message="Activity and audit logs will appear here"
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Page Title */}
      <PageTitle 
        title="Audit Log" 
        icon="time-outline"
      />

      {/* Header */}
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.background.secondary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
      }}>
        <Text style={{
          fontSize: 14,
          color: colors.text.muted,
        }}>
          {events.length} recent events
        </Text>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.Id}
        renderItem={renderEvent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.octopus.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}

