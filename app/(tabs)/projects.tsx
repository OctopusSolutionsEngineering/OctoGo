/**
 * Projects Screen
 * List and search projects with favorites support and project groups
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SectionList,
  RefreshControl,
  TextInput,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useProjects, useProjectGroups } from '../../src/hooks/useOctopusQuery';
import { useFavorites } from '../../src/context/FavoritesContext';
import { Card } from '../../src/components/ui/Card';
import { ErrorView } from '../../src/components/ui/ErrorView';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PageTitle } from '../../src/components/ui/PageTitle';
import { colors } from '../../src/theme/colors';
import { fontSize, spacing, borderRadius } from '../../src/theme/spacing';
import type { Project, ProjectGroup } from '../../src/lib/api/types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FilterMode = 'all' | 'favorites';

// Animated star component for favorite animation
const AnimatedStar = ({ isFavorite, onPress }: { isFavorite: boolean; onPress: () => void }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  
  const handlePress = useCallback(() => {
    // Trigger animations
    Animated.parallel([
      // Pop/scale animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.5,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
      ]),
      // Slight rotation wiggle
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: isFavorite ? -0.2 : 0.3,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(rotateAnim, {
          toValue: 0,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    
    // Trigger layout animation for list reorder
    LayoutAnimation.configureNext({
      duration: 350,
      create: {
        type: LayoutAnimation.Types.spring,
        property: LayoutAnimation.Properties.opacity,
        springDamping: 0.7,
      },
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 0.7,
      },
    });
    
    onPress();
  }, [isFavorite, onPress, scaleAnim, rotateAnim]);
  
  const rotation = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-30deg', '30deg'],
  });
  
  return (
    <Pressable 
      style={styles.favoriteButton}
      onPress={handlePress}
      hitSlop={8}
    >
      <Animated.View
        style={{
          transform: [
            { scale: scaleAnim },
            { rotate: rotation },
          ],
        }}
      >
        <Ionicons 
          name={isFavorite ? 'star' : 'star-outline'} 
          size={22} 
          color={isFavorite ? colors.status.warning : colors.text.tertiary} 
        />
      </Animated.View>
    </Pressable>
  );
};

interface ProjectSection {
  title: string;
  data: Project[];
  projectGroupId: string | null;
  collapsed: boolean;
}

export default function ProjectsScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  
  const { data, isLoading, error, refetch } = useProjects({ 
    take: 100,
    searchText: searchText || undefined,
  });
  
  const { data: projectGroups } = useProjectGroups();

  const allProjects = data?.Items || [];
  
  // Create a map of project group IDs to names
  const projectGroupMap = useMemo(() => {
    const map = new Map<string, ProjectGroup>();
    projectGroups?.forEach((group: ProjectGroup) => map.set(group.Id, group));
    return map;
  }, [projectGroups]);
  
  // Filter projects based on mode
  const filteredProjects = useMemo(() => {
    if (filterMode === 'favorites') {
      return allProjects.filter(p => favorites.includes(p.Id));
    }
    return allProjects;
  }, [allProjects, filterMode, favorites]);

  // Group projects by project group - with favorites at the top
  const sections = useMemo((): ProjectSection[] => {
    if (searchText) {
      // When searching, don't group - just show flat list
      return [{
        title: 'Search Results',
        data: filteredProjects,
        projectGroupId: null,
        collapsed: false,
      }];
    }
    
    // Favorites section first
    const favoriteProjects = filteredProjects.filter(p => favorites.includes(p.Id));
    const nonFavoriteProjects = filteredProjects.filter(p => !favorites.includes(p.Id));
    
    const result: ProjectSection[] = [];
    
    // Add favorites section if there are any
    if (favoriteProjects.length > 0 && filterMode === 'all') {
      result.push({
        title: '★ Favorites',
        data: favoriteProjects.sort((a, b) => a.Name.localeCompare(b.Name)),
        projectGroupId: 'favorites',
        collapsed: collapsedGroups.has('favorites'),
      });
    } else if (filterMode === 'favorites') {
      // Just show favorites without grouping
      return [{
        title: 'Favorites',
        data: favoriteProjects.sort((a, b) => a.Name.localeCompare(b.Name)),
        projectGroupId: null,
        collapsed: false,
      }];
    }
    
    // Group non-favorites by project group
    const groupedProjects = new Map<string, Project[]>();
    nonFavoriteProjects.forEach(project => {
      const groupId = project.ProjectGroupId;
      if (!groupedProjects.has(groupId)) {
        groupedProjects.set(groupId, []);
      }
      groupedProjects.get(groupId)!.push(project);
    });
    
    // Sort groups and add to result
    const sortedGroupIds = Array.from(groupedProjects.keys()).sort((a, b) => {
      const groupA = projectGroupMap.get(a);
      const groupB = projectGroupMap.get(b);
      return (groupA?.Name || 'Other').localeCompare(groupB?.Name || 'Other');
    });
    
    sortedGroupIds.forEach(groupId => {
      const group = projectGroupMap.get(groupId);
      const projects = groupedProjects.get(groupId)!;
      result.push({
        title: group?.Name || 'Default Project Group',
        data: projects.sort((a, b) => a.Name.localeCompare(b.Name)),
        projectGroupId: groupId,
        collapsed: collapsedGroups.has(groupId),
      });
    });
    
    return result;
  }, [filteredProjects, favorites, filterMode, projectGroupMap, collapsedGroups, searchText]);

  const handleToggleGroup = useCallback((groupId: string) => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext({
      duration: 250,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleToggleFavorite = useCallback(async (projectId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(projectId);
  }, [toggleFavorite]);

  const handleProjectPress = useCallback((project: Project) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/project/${project.Id}`);
  }, [router]);

  const renderProject = useCallback(({ item }: { item: Project }) => {
    const isProjectFavorite = isFavorite(item.Id);
    
    return (
      <Card
        onPress={() => handleProjectPress(item)}
        style={styles.projectCard}
      >
        <View style={styles.projectHeader}>
          <View style={styles.projectIconContainer}>
            <Ionicons 
              name={item.IsDisabled ? 'pause-circle-outline' : 'cube-outline'} 
              size={24} 
              color={item.IsDisabled ? colors.text.tertiary : colors.brand.primary} 
            />
          </View>
          <View style={styles.projectInfo}>
            <Text style={styles.projectName} numberOfLines={1}>
              {item.Name}
            </Text>
            <Text style={styles.projectSlug} numberOfLines={1}>
              {item.Slug}
            </Text>
          </View>
          <AnimatedStar 
            isFavorite={isProjectFavorite}
            onPress={() => handleToggleFavorite(item.Id)}
          />
          <Text style={styles.chevron}>›</Text>
        </View>
        
        {item.Description ? (
          <Text style={styles.projectDescription} numberOfLines={2}>
            {item.Description}
          </Text>
        ) : null}

        <View style={styles.projectMeta}>
          <View style={[
            styles.statusDot,
            { backgroundColor: item.IsDisabled ? colors.text.tertiary : colors.status.success }
          ]} />
          <Text style={styles.statusText}>
            {item.IsDisabled ? 'Disabled' : 'Active'}
          </Text>
          
          {item.TenantedDeploymentMode !== 'Untenanted' && (
            <>
              <Text style={styles.metaSeparator}>•</Text>
              <Text style={styles.metaText}>Tenanted</Text>
            </>
          )}
        </View>
      </Card>
    );
  }, [handleProjectPress, isFavorite, handleToggleFavorite]);

  const renderSectionHeader = useCallback(({ section }: { section: ProjectSection }) => {
    const projectCount = section.data.length;
    const isCollapsed = section.collapsed;
    const canCollapse = section.projectGroupId !== null;
    
    return (
      <Pressable 
        style={styles.sectionHeader}
        onPress={() => canCollapse && section.projectGroupId && handleToggleGroup(section.projectGroupId)}
        disabled={!canCollapse}
      >
        <View style={styles.sectionHeaderContent}>
          {canCollapse && (
            <Ionicons 
              name={isCollapsed ? 'chevron-forward' : 'chevron-down'} 
              size={18} 
              color={colors.text.secondary}
              style={styles.sectionChevron}
            />
          )}
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{projectCount}</Text>
          </View>
        </View>
        {canCollapse && (
          <Text style={styles.collapseHint}>
            {isCollapsed ? 'EXPAND' : 'COLLAPSE'}
          </Text>
        )}
      </Pressable>
    );
  }, [handleToggleGroup]);

  const keyExtractor = useCallback((item: Project) => item.Id, []);

  if (error) {
    return (
      <ErrorView
        message={error.message}
        onRetry={refetch}
        fullScreen
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Page Title */}
      <PageTitle 
        title="Projects" 
        icon="cube"
      />
      
      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color={colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search projects..."
            placeholderTextColor={colors.text.tertiary}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
            </Pressable>
          )}
        </View>
        
        {/* Filter tabs */}
        <View style={styles.filterContainer}>
          <Pressable
            style={[styles.filterTab, filterMode === 'all' && styles.filterTabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setFilterMode('all');
            }}
          >
            <Text style={[styles.filterTabText, filterMode === 'all' && styles.filterTabTextActive]}>
              All ({allProjects.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterTab, filterMode === 'favorites' && styles.filterTabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setFilterMode('favorites');
            }}
          >
            <Ionicons 
              name="star" 
              size={14} 
              color={filterMode === 'favorites' ? colors.white : colors.status.warning} 
            />
            <Text style={[styles.filterTabText, filterMode === 'favorites' && styles.filterTabTextActive]}>
              Favorites ({favorites.length})
            </Text>
          </Pressable>
        </View>
      </View>

      <SectionList
        sections={sections.map(section => ({
          ...section,
          data: section.collapsed ? [] : section.data,
        }))}
        renderItem={renderProject}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.brand.primary}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="📁"
              title="No projects found"
              message={searchText ? 'Try a different search term' : 'Create your first project in Octopus Deploy'}
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  searchContainer: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: fontSize.md,
    paddingVertical: spacing.md,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.muted,
  },
  filterTabActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  filterTabText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: colors.white,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    flexGrow: 1,
  },
  separator: {
    height: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionChevron: {
    marginRight: spacing.xs,
  },
  sectionTitle: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  sectionBadge: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  sectionBadgeText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  collapseHint: {
    color: colors.text.tertiary,
    fontSize: fontSize.xs,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  sectionSeparator: {
    height: spacing.xs,
  },
  projectCard: {
    padding: spacing.md,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  projectSlug: {
    color: colors.text.tertiary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  favoriteButton: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  chevron: {
    color: colors.text.tertiary,
    fontSize: fontSize.xxl,
    fontWeight: '300',
  },
  projectDescription: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  projectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.muted,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
  },
  metaSeparator: {
    color: colors.text.tertiary,
    marginHorizontal: spacing.sm,
  },
  metaText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
  },
});
