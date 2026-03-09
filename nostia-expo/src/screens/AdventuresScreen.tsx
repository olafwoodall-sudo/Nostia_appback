import { ms } from '../utils/scale';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { adventuresAPI, feedAPI, tripsAPI, authAPI } from '../services/api';
import CreatePostModal from '../components/CreatePostModal';
import CommentsModal from '../components/CommentsModal';

export default function AdventuresScreen() {
  const [adventures, setAdventures] = useState([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'adventures' | 'feed'>('adventures');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const categories = [
    { id: 'all', label: 'All', icon: 'grid-outline' },
    { id: 'hiking', label: 'Hiking', icon: 'walk-outline' },
    { id: 'climbing', label: 'Climbing', icon: 'trending-up-outline' },
    { id: 'water-sports', label: 'Water', icon: 'water-outline' },
    { id: 'camping', label: 'Camping', icon: 'bonfire-outline' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [adventuresData, feedData, tripsData, userData] = await Promise.all([
        adventuresAPI.getAll(),
        feedAPI.getUserFeed(20),
        tripsAPI.getAll().catch(() => []),
        authAPI.getMe().catch(() => null),
      ]);
      setAdventures(adventuresData);
      setFeed(feedData);
      setTrips(tripsData);
      setCurrentUser(userData);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filterAdventures = () => {
    if (!selectedCategory || selectedCategory === 'all') {
      return adventures;
    }
    return adventures.filter((adv: any) => adv.category === selectedCategory);
  };

  const handleLike = async (postId: number, isLiked: boolean) => {
    try {
      if (isLiked) {
        await feedAPI.unlikePost(postId);
      } else {
        await feedAPI.likePost(postId);
      }
      // Update local state
      setFeed(feed.map(post =>
        post.id === postId
          ? { ...post, isLiked: !isLiked, likeCount: isLiked ? post.likeCount - 1 : post.likeCount + 1 }
          : post
      ));
    } catch (error) {
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const handleOpenComments = (postId: number) => {
    setSelectedPostId(postId);
    setShowComments(true);
  };

  const handleCommentAdded = () => {
    // Update comment count in local state
    if (selectedPostId) {
      setFeed(feed.map(post =>
        post.id === selectedPostId
          ? { ...post, commentCount: post.commentCount + 1 }
          : post
      ));
    }
  };

  const handlePostCreated = () => {
    setShowCreatePost(false);
    loadData();
  };

  const handleViewProfile = async (userId: number) => {
    if (!userId) return;
    setLoadingProfile(true);
    setShowProfile(true);
    try {
      const user = await authAPI.getUserById(userId);
      setSelectedProfile(user);
    } catch {
      setShowProfile(false);
      Alert.alert('Error', 'Could not load profile');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleAddToTrip = (adventure: any) => {
    const ownedTrips = trips.filter((t: any) => t.createdBy === currentUser?.id);
    if (ownedTrips.length === 0) {
      Alert.alert('No Trips', 'Create a trip first before adding adventures to it.');
      return;
    }
    Alert.alert(
      'Add to Trip',
      `Add "${adventure.title}" to which trip?`,
      [
        ...ownedTrips.map((trip: any) => ({
          text: trip.title,
          onPress: async () => {
            try {
              const current = trip.description || '';
              const append = `\n• ${adventure.title} (${adventure.location || adventure.category || 'adventure'})`;
              await tripsAPI.update(trip.id, { description: current + append });
              Alert.alert('Added!', `"${adventure.title}" added to ${trip.title}`);
            } catch {
              Alert.alert('Error', 'Failed to add adventure to trip');
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderAdventureCard = ({ item }: { item: any }) => (
    <View style={styles.adventureCard}>
      <LinearGradient
        colors={['#F59E0B', '#EC4899']}
        style={styles.adventureImage}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="compass" size={40} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.adventureContent}>
        <Text style={styles.adventureTitle}>{item.title}</Text>
        <Text style={styles.adventureLocation}>
          <Ionicons name="location-outline" size={14} /> {item.location}
        </Text>
        {item.description && (
          <Text style={styles.adventureDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.adventureTagRow}>
          <View style={styles.adventureTags}>
            {item.category && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{item.category}</Text>
              </View>
            )}
            {item.difficulty && (
              <View style={[styles.tag, styles.difficultyTag]}>
                <Text style={styles.tagText}>{item.difficulty}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.addToTripButton} onPress={() => handleAddToTrip(item)}>
            <Ionicons name="add-circle-outline" size={16} color="#10B981" />
            <Text style={styles.addToTripText}>Add to Trip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderFeedPost = ({ item }: { item: any }) => (
    <View style={styles.feedCard}>
      {/* Header */}
      <TouchableOpacity style={styles.feedHeader} onPress={() => handleViewProfile(item.userId)} activeOpacity={0.7}>
        <View style={styles.feedAvatar}>
          <Text style={styles.feedInitial}>{item.name?.charAt(0) || 'U'}</Text>
        </View>
        <View style={styles.feedInfo}>
          <Text style={styles.feedName}>{item.name}</Text>
          <Text style={styles.feedTime}>{formatTime(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>

      {/* Image */}
      {item.imageData && (
        <Image source={{ uri: item.imageData }} style={styles.feedImage} resizeMode="cover" />
      )}

      {/* Actions */}
      <View style={styles.feedActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(item.id, item.isLiked)}
        >
          <Ionicons
            name={item.isLiked ? "heart" : "heart-outline"}
            size={26}
            color={item.isLiked ? "#EF4444" : "#FFFFFF"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleOpenComments(item.id)}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Like count */}
      {item.likeCount > 0 && (
        <Text style={styles.likeCount}>
          {item.likeCount} {item.likeCount === 1 ? 'like' : 'likes'}
        </Text>
      )}

      {/* Caption */}
      {item.content && (
        <View style={styles.captionContainer}>
          <Text style={styles.captionName}>{item.name}</Text>
          <Text style={styles.captionText}>{item.content}</Text>
        </View>
      )}

      {/* Comment count */}
      {item.commentCount > 0 && (
        <TouchableOpacity onPress={() => handleOpenComments(item.id)}>
          <Text style={styles.commentCountText}>
            View all {item.commentCount} {item.commentCount === 1 ? 'comment' : 'comments'}
          </Text>
        </TouchableOpacity>
      )}

      {item.tripTitle && (
        <View style={styles.feedRelated}>
          <Ionicons name="airplane-outline" size={16} color="#3B82F6" />
          <Text style={styles.feedRelatedText}>{item.tripTitle}</Text>
        </View>
      )}
      {item.eventTitle && (
        <View style={styles.feedRelated}>
          <Ionicons name="calendar-outline" size={16} color="#8B5CF6" />
          <Text style={styles.feedRelatedText}>{item.eventTitle}</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'adventures' && styles.activeTab]}
          onPress={() => setActiveTab('adventures')}
        >
          <Ionicons
            name="compass"
            size={20}
            color={activeTab === 'adventures' ? '#FFFFFF' : '#9CA3AF'}
          />
          <Text style={[styles.tabText, activeTab === 'adventures' && styles.activeTabText]}>
            Adventures
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.activeTab]}
          onPress={() => setActiveTab('feed')}
        >
          <Ionicons
            name="newspaper"
            size={20}
            color={activeTab === 'feed' ? '#FFFFFF' : '#9CA3AF'}
          />
          <Text style={[styles.tabText, activeTab === 'feed' && styles.activeTabText]}>
            Feed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter for Adventures */}
      {activeTab === 'adventures' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContainer}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategory === cat.id && styles.selectedCategoryChip,
              ]}
              onPress={() => setSelectedCategory(cat.id === 'all' ? null : cat.id)}
            >
              <Ionicons
                name={cat.icon as any}
                size={18}
                color={selectedCategory === cat.id ? '#FFFFFF' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat.id && styles.selectedCategoryText,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Content */}
      {activeTab === 'adventures' ? (
        <FlatList
          data={filterAdventures()}
          renderItem={renderAdventureCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3B82F6"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="compass-outline" size={64} color="#6B7280" />
              <Text style={styles.emptyText}>No adventures found</Text>
            </View>
          }
        />
      ) : (
        <>
          <FlatList
            data={feed}
            renderItem={renderFeedPost}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#3B82F6"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="camera-outline" size={64} color="#6B7280" />
                <Text style={styles.emptyText}>No posts yet</Text>
                <Text style={styles.emptySubtext}>Share your first photo!</Text>
              </View>
            }
          />

          {/* FAB for creating new post */}
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setShowCreatePost(true)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#EC4899', '#8B5CF6']}
              style={styles.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="camera" size={28} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      <CreatePostModal
        visible={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onPostCreated={handlePostCreated}
      />

      <CommentsModal
        visible={showComments}
        postId={selectedPostId}
        onClose={() => {
          setShowComments(false);
          setSelectedPostId(null);
        }}
        onCommentAdded={handleCommentAdded}
      />

      {/* Profile Modal */}
      <Modal visible={showProfile} animationType="slide" transparent onRequestClose={() => { setShowProfile(false); setSelectedProfile(null); }}>
        <View style={styles.profileOverlay}>
          <View style={styles.profileSheet}>
            <TouchableOpacity style={styles.profileClose} onPress={() => { setShowProfile(false); setSelectedProfile(null); }}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            {loadingProfile ? (
              <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
            ) : selectedProfile ? (
              <>
                <View style={styles.profileAvatarLarge}>
                  <Text style={styles.profileAvatarText}>{selectedProfile.name?.charAt(0) || 'U'}</Text>
                </View>
                <Text style={styles.profileName}>{selectedProfile.name}</Text>
                {selectedProfile.username && (
                  <Text style={styles.profileUsername}>@{selectedProfile.username}</Text>
                )}
                {selectedProfile.homeStatus && (
                  <View style={styles.profileStatusRow}>
                    <Ionicons name="home-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.profileStatusText}>{selectedProfile.homeStatus}</Text>
                  </View>
                )}
                <Text style={styles.profileJoined}>
                  Joined {new Date(selectedProfile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    color: '#9CA3AF',
    fontSize: ms(16),
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  categoryScroll: {
    marginBottom: 12,
  },
  categoryContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginRight: 8,
  },
  selectedCategoryChip: {
    backgroundColor: '#3B82F6',
  },
  categoryText: {
    color: '#9CA3AF',
    fontSize: ms(14),
    fontWeight: '600',
  },
  selectedCategoryText: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
  },
  adventureCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
  adventureImage: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adventureContent: {
    padding: 16,
  },
  adventureTitle: {
    fontSize: ms(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  adventureLocation: {
    fontSize: ms(14),
    color: '#9CA3AF',
    marginBottom: 8,
  },
  adventureDescription: {
    fontSize: ms(14),
    color: '#D1D5DB',
    lineHeight: 20,
    marginBottom: 12,
  },
  adventureTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  adventureTags: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  addToTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  addToTripText: {
    fontSize: ms(12),
    color: '#10B981',
    fontWeight: '600',
  },
  tag: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  difficultyTag: {
    backgroundColor: '#7C3AED',
  },
  tagText: {
    fontSize: ms(12),
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  feedCard: {
    backgroundColor: '#1F2937',
    borderRadius: 0,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  feedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  feedInitial: {
    fontSize: ms(14),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  feedInfo: {
    flex: 1,
  },
  feedName: {
    fontSize: ms(14),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  feedTime: {
    fontSize: ms(12),
    color: '#9CA3AF',
  },
  feedImage: {
    width: '100%',
    aspectRatio: 1,
  },
  feedActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 16,
  },
  actionButton: {
    padding: 2,
  },
  likeCount: {
    fontSize: ms(14),
    fontWeight: 'bold',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  captionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  captionName: {
    fontSize: ms(14),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 6,
  },
  captionText: {
    fontSize: ms(14),
    color: '#D1D5DB',
    flex: 1,
  },
  commentCountText: {
    fontSize: ms(14),
    color: '#9CA3AF',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  feedRelated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  feedRelatedText: {
    fontSize: ms(14),
    color: '#3B82F6',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySubtext: {
    fontSize: ms(14),
    color: '#9CA3AF',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: ms(20),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
  },
  profileOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  profileSheet: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
    paddingBottom: 40,
    minHeight: 280,
  },
  profileClose: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  profileAvatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  profileAvatarText: {
    fontSize: ms(32),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: ms(22),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: ms(15),
    color: '#9CA3AF',
    marginBottom: 12,
  },
  profileStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  profileStatusText: {
    fontSize: ms(14),
    color: '#9CA3AF',
  },
  profileJoined: {
    fontSize: ms(13),
    color: '#6B7280',
    marginTop: 8,
  },
});
