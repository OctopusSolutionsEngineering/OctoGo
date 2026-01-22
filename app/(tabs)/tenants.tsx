/**
 * Tenants List Screen
 * Browse and search all tenants
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTenants, useTagSets } from '../../src/hooks/useOctopusQuery';
import { Card } from '../../src/components/ui/Card';
import { LoadingScreen } from '../../src/components/ui/LoadingScreen';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PageTitle } from '../../src/components/ui/PageTitle';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';
import type { Tenant, TagSet } from '../../src/lib/api/types';

export default function TenantsScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const { 
    data: tenantsData, 
    isLoading, 
    error, 
    refetch,
    isRefetching,
  } = useTenants({ 
    searchText: searchText || undefined,
    take: 500,
  });
  
  const { data: tagSets } = useTagSets();

  const tenants = tenantsData?.Items || [];

  // Parse tag sets to create a flat list of tags
  const allTags = useMemo(() => {
    if (!tagSets) return [];
    return tagSets.flatMap(tagSet => 
      tagSet.Tags.map(tag => ({
        id: tag.Id,
        name: tag.Name,
        canonicalName: tag.CanonicalTagName,
        tagSetName: tagSet.Name,
      }))
    );
  }, [tagSets]);

  // Filter tenants by selected tags
  const filteredTenants = useMemo(() => {
    if (selectedTags.length === 0) return tenants;
    return tenants.filter(tenant => 
      selectedTags.every(tagId => 
        tenant.TenantTags.some(tenantTag => 
          allTags.find(t => t.canonicalName === tenantTag)?.id === tagId
        )
      )
    );
  }, [tenants, selectedTags, allTags]);

  // Group tenants by tag (for display purposes)
  const tenantsByTag = useMemo(() => {
    const grouped: Record<string, Tenant[]> = {};
    
    filteredTenants.forEach(tenant => {
      // Get the primary tag (first tag)
      const primaryTag = tenant.TenantTags[0];
      if (primaryTag) {
        const tag = allTags.find(t => t.canonicalName === primaryTag);
        const tagName = tag?.tagSetName || primaryTag;
        if (!grouped[tagName]) {
          grouped[tagName] = [];
        }
        grouped[tagName].push(tenant);
      } else {
        if (!grouped['Untagged']) {
          grouped['Untagged'] = [];
        }
        grouped['Untagged'].push(tenant);
      }
    });

    return grouped;
  }, [filteredTenants, allTags]);

  const handleTenantPress = useCallback((tenant: Tenant) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/tenant/${tenant.Id}`);
  }, [router]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const toggleTag = useCallback((tagId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  if (isLoading && !tenants.length) {
    return <LoadingScreen message="Loading tenants..." />;
  }

  if (error) {
    return (
      <ErrorView
        message={error.message}
        onRetry={handleRefresh}
        fullScreen
      />
    );
  }

  // Get color for tag based on name
  const getTagColor = (tagName: string) => {
    const lowerTag = tagName.toLowerCase();
    if (lowerTag === 'stable') {
      return {
        bg: colors.status.success + '20',
        text: colors.status.success,
      };
    } else if (lowerTag === 'alpha') {
      return {
        bg: colors.status.warning + '20',
        text: colors.status.warning,
      };
    } else if (lowerTag === 'beta') {
      return {
        bg: colors.status.info + '20',
        text: colors.status.info,
      };
    } else {
      // Default color for other tags
      return {
        bg: colors.brand.primary + '15',
        text: colors.brand.primary,
      };
    }
  };

  // Render a single tenant card
  const renderTenant = ({ item: tenant }: { item: Tenant }) => {
    // Get tag badges
    const tagBadges = tenant.TenantTags.slice(0, 3).map(tagCanonical => {
      const tag = allTags.find(t => t.canonicalName === tagCanonical);
      return tag?.name || tagCanonical.split('/')[1] || tagCanonical;
    });
    
    const hasMoreTags = tenant.TenantTags.length > 3;
    const projectCount = Object.keys(tenant.ProjectEnvironments || {}).length;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.tenantCard,
          pressed && styles.tenantCardPressed,
        ]}
        onPress={() => handleTenantPress(tenant)}
      >
        <View style={styles.tenantHeader}>
          <View style={styles.tenantIcon}>
            <Ionicons name="business" size={20} color={colors.brand.primary} />
          </View>
          <View style={styles.tenantInfo}>
            <View style={styles.tenantTopRow}>
              <Text style={styles.tenantName} numberOfLines={1}>
                {tenant.Name}
              </Text>
              {tagBadges.length > 0 && (
                <View style={styles.tagsListInline}>
                  {tagBadges.map((tag, index) => {
                    const tagColor = getTagColor(tag);
                    return (
                      <View 
                        key={index} 
                        style={[styles.tagBadge, { backgroundColor: tagColor.bg }]}
                      >
                        <Text style={[styles.tagText, { color: tagColor.text }]}>
                          {tag}
                        </Text>
                      </View>
                    );
                  })}
                  {hasMoreTags && (
                    <View style={[styles.tagBadge, styles.tagBadgeMore]}>
                      <Text style={styles.tagTextMore}>+{tenant.TenantTags.length - 3}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <View style={styles.tenantBottomRow}>
              <View style={styles.projectCount}>
                <Ionicons name="cube-outline" size={12} color={colors.text.tertiary} />
                <Text style={styles.projectCountText}>
                  {projectCount} {projectCount === 1 ? 'project' : 'projects'}
                </Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Page Title */}
      <PageTitle 
        title="Tenants" 
        icon="business"
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tenants..."
            placeholderTextColor={colors.text.tertiary}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText('')} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <View style={styles.filtersContainer}>
          <Text style={styles.filtersLabel}>Filter by tags:</Text>
          <FlatList
            horizontal
            data={allTags}
            keyExtractor={(item) => item.id}
            renderItem={({ item: tag }) => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <Pressable
                  style={[
                    styles.filterTag,
                    isSelected && styles.filterTagSelected,
                  ]}
                  onPress={() => toggleTag(tag.id)}
                >
                  <Text style={[
                    styles.filterTagText,
                    isSelected && styles.filterTagTextSelected,
                  ]}>
                    {tag.name}
                  </Text>
                </Pressable>
              );
            }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}
          />
        </View>
      )}

      {/* Tenants List */}
      {filteredTenants.length === 0 ? (
        <EmptyState
          ionicon="people-outline"
          title={searchText ? 'No tenants found' : 'No tenants'}
          message={
            searchText 
              ? `No tenants match "${searchText}"`
              : 'Create your first tenant in Octopus Deploy'
          }
        />
      ) : (
        <FlatList
          data={filteredTenants}
          renderItem={renderTenant}
          keyExtractor={(item) => item.Id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.brand.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.countText}>
                {filteredTenants.length} {filteredTenants.length === 1 ? 'tenant' : 'tenants'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
    paddingVertical: spacing.xs,
  },
  filtersContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  filtersLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  filtersScroll: {
    gap: spacing.sm,
  },
  filterTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  filterTagSelected: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  filterTagText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  filterTagTextSelected: {
    color: colors.white,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  listHeader: {
    paddingBottom: spacing.sm,
  },
  countText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tenantCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  tenantCardPressed: {
    backgroundColor: colors.interactive.hover,
  },
  tenantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tenantIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.brand.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  tenantInfo: {
    flex: 1,
  },
  tenantTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  tenantName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
    flexShrink: 1,
  },
  tenantBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagsListInline: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexShrink: 0,
  },
  tagBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  tagBadgeMore: {
    backgroundColor: colors.background.tertiary,
  },
  tagText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  tagTextMore: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  projectCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectCountText: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
});

