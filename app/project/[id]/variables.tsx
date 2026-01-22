/**
 * Variables Viewer Screen
 * Read-only view of project variables with scope filtering
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  SafeAreaView,
  RefreshControl,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useProjectVariables } from '@/src/hooks/useOctopusQuery';
import { LoadingScreen } from '@/src/components/ui/LoadingScreen';
import { ErrorView } from '@/src/components/ui/ErrorView';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { colors } from '@/src/theme/colors';
import type { Variable, ScopeValue } from '@/src/lib/api/types';

type ScopeFilterType = 'all' | 'environment' | 'role' | 'machine' | 'channel';

export default function VariablesScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  
  const { 
    data: variableSet, 
    isLoading, 
    error, 
    refetch,
    isRefetching,
  } = useProjectVariables(projectId || '');
  
  // Note: We could use environments for enhanced scope display, but using ScopeValues is sufficient
  
  const [searchText, setSearchText] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilterType>('all');
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const [expandedVariables, setExpandedVariables] = useState<Set<string>>(new Set());

  // Create lookup maps for scope values
  const scopeValueMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (variableSet?.ScopeValues) {
      Object.values(variableSet.ScopeValues).forEach((values: ScopeValue[]) => {
        values.forEach(v => {
          map[v.Id] = v.Name;
        });
      });
    }
    return map;
  }, [variableSet]);

  // Filter variables
  const filteredVariables = useMemo(() => {
    if (!variableSet?.Variables) return [];
    
    let filtered = variableSet.Variables;
    
    // Text search
    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter(v => 
        v.Name.toLowerCase().includes(lower) ||
        (v.Value && !v.IsSensitive && v.Value.toLowerCase().includes(lower))
      );
    }
    
    // Scope filter
    if (scopeFilter !== 'all' && selectedScopeId) {
      filtered = filtered.filter(v => {
        const scope = v.Scope;
        if (!scope) return false;
        
        switch (scopeFilter) {
          case 'environment':
            return scope.Environment?.includes(selectedScopeId);
          case 'role':
            return scope.Role?.includes(selectedScopeId);
          case 'machine':
            return scope.Machine?.includes(selectedScopeId);
          case 'channel':
            return scope.Channel?.includes(selectedScopeId);
          default:
            return true;
        }
      });
    }
    
    // Sort by name
    return filtered.sort((a, b) => a.Name.localeCompare(b.Name));
  }, [variableSet, searchText, scopeFilter, selectedScopeId]);

  // Get available scope values for the current filter
  const availableScopeValues = useMemo(() => {
    if (!variableSet?.ScopeValues) return [];
    
    switch (scopeFilter) {
      case 'environment':
        return variableSet.ScopeValues.Environments || [];
      case 'role':
        return variableSet.ScopeValues.Roles || [];
      case 'machine':
        return variableSet.ScopeValues.Machines || [];
      case 'channel':
        return variableSet.ScopeValues.Channels || [];
      default:
        return [];
    }
  }, [variableSet, scopeFilter]);

  const toggleExpanded = useCallback((variableId: string) => {
    Haptics.selectionAsync();
    setExpandedVariables(prev => {
      const next = new Set(prev);
      if (next.has(variableId)) {
        next.delete(variableId);
      } else {
        next.add(variableId);
      }
      return next;
    });
  }, []);

  const getScopeDisplay = useCallback((variable: Variable) => {
    const parts: string[] = [];
    const scope = variable.Scope;
    
    if (!scope) return 'No scope';
    
    if (scope.Environment?.length) {
      parts.push(`Env: ${scope.Environment.map(id => scopeValueMap[id] || id).join(', ')}`);
    }
    if (scope.Role?.length) {
      parts.push(`Role: ${scope.Role.map(id => scopeValueMap[id] || id).join(', ')}`);
    }
    if (scope.Machine?.length) {
      parts.push(`Machine: ${scope.Machine.map(id => scopeValueMap[id] || id).join(', ')}`);
    }
    if (scope.Channel?.length) {
      parts.push(`Channel: ${scope.Channel.map(id => scopeValueMap[id] || id).join(', ')}`);
    }
    if (scope.Action?.length) {
      parts.push(`Step: ${scope.Action.map(id => scopeValueMap[id] || id).join(', ')}`);
    }
    
    return parts.length > 0 ? parts.join(' | ') : 'All scopes';
  }, [scopeValueMap]);

  const renderVariable = useCallback(({ item }: { item: Variable }) => {
    const isExpanded = expandedVariables.has(item.Id);
    const hasScope = item.Scope && Object.values(item.Scope).some(arr => arr?.length > 0);
    
    return (
      <Pressable
        onPress={() => toggleExpanded(item.Id)}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.background.tertiary : colors.background.secondary,
          borderRadius: 10,
          marginBottom: 8,
          overflow: 'hidden',
        })}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
        }}>
          {/* Icon */}
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: item.IsSensitive 
              ? colors.status.warning + '20'
              : colors.status.info + '20',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}>
            <Ionicons 
              name={item.IsSensitive ? 'lock-closed' : 'code-slash'} 
              size={16} 
              color={item.IsSensitive ? colors.status.warning : colors.status.info} 
            />
          </View>
          
          {/* Name & Value Preview */}
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 15,
              fontWeight: '600',
              color: colors.text.primary,
            }}>
              {item.Name}
            </Text>
            {!isExpanded && (
              <Text 
                style={{
                  fontSize: 13,
                  color: colors.text.muted,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {item.IsSensitive ? '••••••••' : (item.Value || '(empty)')}
              </Text>
            )}
          </View>
          
          {/* Expand indicator */}
          <Ionicons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={18} 
            color={colors.text.subtle} 
          />
        </View>
        
        {/* Expanded Content */}
        {isExpanded && (
          <View style={{
            paddingHorizontal: 14,
            paddingBottom: 14,
            borderTopWidth: 1,
            borderTopColor: colors.border.muted,
          }}>
            {/* Value */}
            <View style={{ marginTop: 12 }}>
              <Text style={{
                fontSize: 12,
                color: colors.text.subtle,
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                Value
              </Text>
              <View style={{
                backgroundColor: colors.background.tertiary,
                borderRadius: 6,
                padding: 10,
              }}>
                <Text style={{
                  fontSize: 13,
                  color: colors.text.primary,
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                }}>
                  {item.IsSensitive ? '••••••••••••••' : (item.Value || '(empty)')}
                </Text>
              </View>
            </View>
            
            {/* Scope */}
            {hasScope && (
              <View style={{ marginTop: 12 }}>
                <Text style={{
                  fontSize: 12,
                  color: colors.text.subtle,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>
                  Scope
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: colors.text.muted,
                }}>
                  {getScopeDisplay(item)}
                </Text>
              </View>
            )}
            
            {/* Description */}
            {item.Description && (
              <View style={{ marginTop: 12 }}>
                <Text style={{
                  fontSize: 12,
                  color: colors.text.subtle,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>
                  Description
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: colors.text.muted,
                }}>
                  {item.Description}
                </Text>
              </View>
            )}
            
            {/* Type & Prompt */}
            <View style={{
              flexDirection: 'row',
              marginTop: 12,
              gap: 12,
            }}>
              <View style={{
                backgroundColor: colors.background.primary,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 4,
              }}>
                <Text style={{ fontSize: 11, color: colors.text.muted }}>
                  {item.Type}
                </Text>
              </View>
              {item.Prompt && (
                <View style={{
                  backgroundColor: colors.status.info + '20',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                }}>
                  <Text style={{ fontSize: 11, color: colors.status.info }}>
                    Prompted
                  </Text>
                </View>
              )}
              {!item.IsEditable && (
                <View style={{
                  backgroundColor: colors.status.warning + '20',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                }}>
                  <Text style={{ fontSize: 11, color: colors.status.warning }}>
                    Read-only
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </Pressable>
    );
  }, [expandedVariables, toggleExpanded, getScopeDisplay]);

  if (isLoading) {
    return <LoadingScreen message="Loading variables..." />;
  }

  if (error) {
    return (
      <ErrorView
        message={error.message || 'An error occurred'}
        title="Failed to load variables"
        onRetry={refetch}
      />
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Variables',
          headerBackTitle: 'Project',
        }}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
        {/* Search & Filter Header */}
        <View style={{
          padding: 12,
          backgroundColor: colors.background.secondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.default,
        }}>
          {/* Search */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background.tertiary,
            borderRadius: 10,
            paddingHorizontal: 12,
            height: 40,
            marginBottom: 12,
          }}>
            <Ionicons name="search" size={18} color={colors.text.muted} />
            <TextInput
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 15,
                color: colors.text.primary,
              }}
              placeholder="Search variables..."
              placeholderTextColor={colors.text.subtle}
              value={searchText}
              onChangeText={setSearchText}
              clearButtonMode="while-editing"
            />
          </View>
          
          {/* Scope Filter Tabs */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['all', 'environment', 'role'] as ScopeFilterType[]).map(filter => (
              <Pressable
                key={filter}
                onPress={() => {
                  Haptics.selectionAsync();
                  setScopeFilter(filter);
                  setSelectedScopeId(null);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  backgroundColor: scopeFilter === filter 
                    ? colors.octopus.primary 
                    : colors.background.tertiary,
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: scopeFilter === filter ? '#FFFFFF' : colors.text.secondary,
                }}>
                  {filter === 'all' ? 'All' : 
                   filter === 'environment' ? 'Environment' :
                   filter === 'role' ? 'Role' : filter}
                </Text>
              </Pressable>
            ))}
          </View>
          
          {/* Scope Value Selector */}
          {scopeFilter !== 'all' && availableScopeValues.length > 0 && (
            <View style={{ 
              flexDirection: 'row', 
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 10,
            }}>
              {availableScopeValues.map(sv => (
                <Pressable
                  key={sv.Id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedScopeId(selectedScopeId === sv.Id ? null : sv.Id);
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 5,
                    backgroundColor: selectedScopeId === sv.Id 
                      ? colors.status.info
                      : colors.background.primary,
                    borderWidth: 1,
                    borderColor: selectedScopeId === sv.Id 
                      ? colors.status.info
                      : colors.border.muted,
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    color: selectedScopeId === sv.Id ? '#FFFFFF' : colors.text.secondary,
                  }}>
                    {sv.Name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Variables List */}
        {filteredVariables.length === 0 ? (
          <EmptyState
            ionicon="code-slash-outline"
            title="No Variables Found"
            message={searchText ? `No variables match "${searchText}"` : 'This project has no variables'}
          />
        ) : (
          <FlatList
            data={filteredVariables}
            keyExtractor={(item) => item.Id}
            renderItem={renderVariable}
            contentContainerStyle={{ padding: 12 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={colors.octopus.primary}
              />
            }
            ListHeaderComponent={() => (
              <Text style={{
                fontSize: 13,
                color: colors.text.muted,
                marginBottom: 12,
              }}>
                {filteredVariables.length} variable{filteredVariables.length !== 1 ? 's' : ''}
              </Text>
            )}
          />
        )}
      </SafeAreaView>
    </>
  );
}

