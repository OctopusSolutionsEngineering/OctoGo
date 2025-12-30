/**
 * Global Search Screen
 * Search across projects, releases, deployments, runbooks, machines, environments, tenants, and variables
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  SectionList,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGlobalSearch } from '@/src/hooks/useOctopusQuery';
import { useColors } from '@/src/context/ThemeContext';
import { PageTitle } from '@/src/components/ui/PageTitle';

type SearchResultType = 'project' | 'release' | 'deployment' | 'runbook' | 'machine' | 'environment' | 'tenant' | 'variable';

interface SearchSection {
  title: string;
  type: SearchResultType;
  icon: keyof typeof Ionicons.glyphMap;
  data: { id: string; name: string; subtitle?: string; projectId?: string }[];
}

export default function SearchScreen() {
  const router = useRouter();
  const colors = useColors();
  const [searchText, setSearchText] = useState('');
  const [includeVariables, setIncludeVariables] = useState(false);
  
  const { data: results, isLoading } = useGlobalSearch(searchText, { 
    take: 10,
    enabled: searchText.length >= 2,
    includeVariables,
  });

  const handleItemPress = useCallback((type: SearchResultType, id: string, projectId?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    switch (type) {
      case 'project':
        router.push(`/project/${id}`);
        break;
      case 'release':
        router.push(`/release/${id}` as any);
        break;
      case 'deployment':
        router.push(`/deployment/${id}`);
        break;
      case 'runbook':
        router.push(`/runbook/${id}`);
        break;
      case 'machine':
        router.push(`/machine/${id}`);
        break;
      case 'environment':
        router.push(`/environment/${id}`);
        break;
      case 'tenant':
        router.push(`/tenant/${id}` as any);
        break;
      case 'variable':
        // Navigate to project variables
        if (projectId) {
          router.push(`/project/${projectId}/variables` as any);
        }
        break;
    }
  }, [router]);

  const sections: SearchSection[] = [];
  
  if (results) {
    // Create a project lookup map for showing project names in releases
    const projectMap = new Map(results.projects.map(p => [p.Id, p.Name]));
    
    if (results.projects.length > 0) {
      sections.push({
        title: 'Projects',
        type: 'project',
        icon: 'folder-outline',
        data: results.projects.map(p => ({ id: p.Id, name: p.Name, subtitle: p.Description || undefined })),
      });
    }
    if (results.releases.length > 0) {
      sections.push({
        title: 'Releases',
        type: 'release',
        icon: 'pricetag-outline',
        data: results.releases.map(r => {
          const projectName = projectMap.get(r.ProjectId);
          const projectDisplay = projectName 
            ? projectName 
            : r.ProjectId.replace('Projects-', 'Project ');
          return { 
            id: r.Id, 
            name: r.Version,
            subtitle: projectDisplay,
          };
        }),
      });
    }
    if (results.deployments.length > 0) {
      sections.push({
        title: 'Deployments',
        type: 'deployment',
        icon: 'rocket-outline',
        data: results.deployments.map(d => ({ id: d.Id, name: d.Name })),
      });
    }
    if (results.runbooks.length > 0) {
      sections.push({
        title: 'Runbooks',
        type: 'runbook',
        icon: 'book-outline',
        data: results.runbooks.map(r => ({ id: r.Id, name: r.Name, subtitle: r.Description || undefined })),
      });
    }
    if (results.machines.length > 0) {
      sections.push({
        title: 'Machines',
        type: 'machine',
        icon: 'server-outline',
        data: results.machines.map(m => ({ id: m.Id, name: m.Name, subtitle: m.Roles?.join(', ') })),
      });
    }
    if (results.environments.length > 0) {
      sections.push({
        title: 'Environments',
        type: 'environment',
        icon: 'layers-outline',
        data: results.environments.map(e => ({ id: e.Id, name: e.Name })),
      });
    }
    if (results.tenants.length > 0) {
      sections.push({
        title: 'Tenants',
        type: 'tenant',
        icon: 'people-outline',
        data: results.tenants.map(t => ({ id: t.Id, name: t.Name, subtitle: t.Description || undefined })),
      });
    }
    if (results.variables.length > 0) {
      sections.push({
        title: 'Variables',
        type: 'variable',
        icon: 'code-slash-outline',
        data: results.variables.map(v => ({ 
          id: v.id, 
          name: v.name, 
          subtitle: v.subtitle,
          projectId: v.projectId,
        })),
      });
    }
  }

  const renderSectionHeader = ({ section }: { section: SearchSection }) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.muted,
    }}>
      <Ionicons name={section.icon} size={18} color={colors.text.muted} style={{ marginRight: 8 }} />
      <Text style={{
        fontSize: 13,
        fontWeight: '600',
        color: colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {section.title}
      </Text>
      <Text style={{
        fontSize: 12,
        color: colors.text.subtle,
        marginLeft: 8,
      }}>
        ({section.data.length})
      </Text>
    </View>
  );

  const renderItem = ({ item, section }: { item: { id: string; name: string; subtitle?: string; projectId?: string }; section: SearchSection }) => (
    <Pressable
      onPress={() => handleItemPress(section.type, item.id, item.projectId)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: pressed ? colors.background.tertiary : colors.background.primary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.muted,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: 16,
          fontWeight: '500',
          color: colors.text.primary,
        }}>
          {item.name}
        </Text>
        {item.subtitle && (
          <Text
            style={{
              fontSize: 14,
              color: colors.text.muted,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {item.subtitle}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.text.subtle} />
    </Pressable>
  );

  const renderEmptyState = () => {
    if (searchText.length === 0) {
      return (
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
        }}>
          <Ionicons name="search" size={64} color={colors.text.subtle} />
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: colors.text.secondary,
            marginTop: 16,
            textAlign: 'center',
          }}>
            Search Everything
          </Text>
          <Text style={{
            fontSize: 14,
            color: colors.text.muted,
            marginTop: 8,
            textAlign: 'center',
            lineHeight: 20,
          }}>
            Find projects, releases, deployments, runbooks, machines, environments, tenants, and variables
          </Text>
        </View>
      );
    }

    if (searchText.length < 2) {
      return (
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
        }}>
          <Text style={{
            fontSize: 14,
            color: colors.text.muted,
            textAlign: 'center',
          }}>
            Type at least 2 characters to search
          </Text>
        </View>
      );
    }

    if (!isLoading && sections.length === 0) {
      return (
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
        }}>
          <Ionicons name="search-outline" size={48} color={colors.text.subtle} />
          <Text style={{
            fontSize: 16,
            color: colors.text.muted,
            marginTop: 16,
            textAlign: 'center',
          }}>
            No results found for &ldquo;{searchText}&rdquo;
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Page Title */}
      <PageTitle 
        title="Search" 
        icon="search"
      />
      
      {/* Search Header */}
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: colors.background.secondary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background.tertiary,
          borderRadius: 12,
          paddingHorizontal: 12,
          height: 44,
        }}>
          <Ionicons name="search" size={20} color={colors.text.muted} />
          <TextInput
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 16,
              color: colors.text.primary,
            }}
            placeholder="Search projects, releases, runbooks, variables..."
            placeholderTextColor={colors.text.subtle}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {isLoading && (
            <ActivityIndicator size="small" color={colors.status.info} />
          )}
        </View>
        
        {/* Variable search toggle */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 10,
          paddingHorizontal: 4,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="code-slash-outline" size={16} color={colors.text.muted} style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 13, color: colors.text.secondary }}>
              Include Variables
            </Text>
          </View>
          <Switch
            value={includeVariables}
            onValueChange={setIncludeVariables}
            trackColor={{ false: colors.border.default, true: colors.brand.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Results */}
      {sections.length > 0 ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      ) : (
        renderEmptyState()
      )}
    </SafeAreaView>
  );
}
