import { ms } from '../utils/scale';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { friendsAPI } from '../services/api';

interface FriendLocation {
  id: number;
  username: string;
  name: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export default function FriendsMapScreen() {
  const [friends, setFriends] = useState<FriendLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<FriendLocation | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const data = await friendsAPI.getLocations();
      setFriends(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load friend locations');
    } finally {
      setLoading(false);
    }
  };

  const formatUpdated = (updatedAt: string) => {
    const diff = Date.now() - new Date(updatedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends Map</Text>
        <Text style={styles.headerSub}>
          {friends.length === 0
            ? 'No friends sharing location'
            : `${friends.length} friend${friends.length > 1 ? 's' : ''} visible`}
        </Text>
      </View>

      {/* Expo Go notice */}
      <View style={styles.noticeBanner}>
        <Ionicons name="information-circle-outline" size={16} color="#60A5FA" />
        <Text style={styles.noticeText}>
          Map view requires a development build. Location data shown below.
        </Text>
      </View>

      {friends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#6B7280" />
          <Text style={styles.emptyText}>No friends sharing location</Text>
          <Text style={styles.emptySubtext}>
            Friends appear here once they enable location sharing.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {friends.map((friend) => (
            <TouchableOpacity
              key={friend.id}
              style={[
                styles.friendCard,
                selectedFriend?.id === friend.id && styles.friendCardSelected,
              ]}
              onPress={() =>
                setSelectedFriend(selectedFriend?.id === friend.id ? null : friend)
              }
              activeOpacity={0.7}
            >
              <View style={styles.friendAvatar}>
                <Text style={styles.friendInitial}>
                  {friend.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{friend.name}</Text>
                <Text style={styles.friendUsername}>@{friend.username}</Text>
                <Text style={styles.friendCoords}>
                  {friend.latitude.toFixed(4)}, {friend.longitude.toFixed(4)}
                </Text>
              </View>
              <View style={styles.friendMeta}>
                <Ionicons name="location-outline" size={14} color="#3B82F6" />
                <Text style={styles.friendUpdated}>
                  {formatUpdated(friend.updatedAt)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: { fontSize: ms(22), fontWeight: 'bold', color: '#FFFFFF' },
  headerSub: { fontSize: ms(13), color: '#9CA3AF', marginTop: 2 },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2563EB',
  },
  noticeText: { fontSize: ms(12), color: '#93C5FD', flex: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: ms(18), fontWeight: 'bold', color: '#FFFFFF', marginTop: 16 },
  emptySubtext: {
    fontSize: ms(14),
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  listContent: { padding: 16, paddingBottom: 40 },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 12,
  },
  friendCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A5F',
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendInitial: { fontSize: ms(18), fontWeight: 'bold', color: '#FFFFFF' },
  friendInfo: { flex: 1 },
  friendName: { fontSize: ms(15), fontWeight: '600', color: '#FFFFFF' },
  friendUsername: { fontSize: ms(12), color: '#9CA3AF', marginTop: 1 },
  friendCoords: { fontSize: ms(11), color: '#6B7280', marginTop: 2 },
  friendMeta: { alignItems: 'flex-end', gap: 4 },
  friendUpdated: { fontSize: ms(11), color: '#6B7280' },
});
