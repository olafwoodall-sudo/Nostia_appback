import { ms } from '../utils/scale';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
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

const DEFAULT_REGION = {
  latitude: 51.505,
  longitude: -0.09,
  latitudeDelta: 10,
  longitudeDelta: 10,
};

export default function FriendsMapScreen() {
  const [friends, setFriends] = useState<FriendLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<FriendLocation | null>(null);
  const mapRef = useRef<MapView>(null);

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

  const focusFriend = (friend: FriendLocation) => {
    setSelectedFriend(friend);
    mapRef.current?.animateToRegion(
      {
        latitude: friend.latitude,
        longitude: friend.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      500,
    );
  };

  const getInitialRegion = () => {
    if (friends.length === 0) return DEFAULT_REGION;
    return {
      latitude: friends[0].latitude,
      longitude: friends[0].longitude,
      latitudeDelta: 5,
      longitudeDelta: 5,
    };
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

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={getInitialRegion()}
          showsUserLocation
          showsMyLocationButton
        >
          {friends.map((friend) => (
            <Marker
              key={friend.id}
              coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
              title={friend.name}
              description={`@${friend.username} · ${formatUpdated(friend.updatedAt)}`}
              onPress={() => setSelectedFriend(friend)}
            />
          ))}
        </MapView>

        {friends.length === 0 && (
          <View style={styles.emptyOverlay}>
            <Ionicons name="people-outline" size={32} color="#6B7280" />
            <Text style={styles.emptyOverlayText}>
              Friends appear here once they enable location sharing.
            </Text>
          </View>
        )}
      </View>

      {/* Selected friend card */}
      {selectedFriend && (
        <View style={styles.selectedCard}>
          <View style={styles.friendAvatar}>
            <Text style={styles.friendInitial}>
              {selectedFriend.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.friendInfo}>
            <Text style={styles.friendName}>{selectedFriend.name}</Text>
            <Text style={styles.friendUsername}>@{selectedFriend.username}</Text>
            <Text style={styles.friendUpdated}>
              Updated {formatUpdated(selectedFriend.updatedAt)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedFriend(null)} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Friend list chips */}
      {friends.length > 0 && !selectedFriend && (
        <View style={styles.chipRow}>
          {friends.map((friend) => (
            <TouchableOpacity
              key={friend.id}
              style={styles.chip}
              onPress={() => focusFriend(friend)}
            >
              <View style={styles.chipAvatar}>
                <Text style={styles.chipInitial}>
                  {friend.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.chipName}>{friend.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(17,24,39,0.6)',
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyOverlayText: {
    fontSize: ms(14),
    color: '#9CA3AF',
    textAlign: 'center',
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    margin: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 12,
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
  friendUpdated: { fontSize: ms(11), color: '#6B7280', marginTop: 2 },
  closeBtn: { padding: 4 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
    backgroundColor: '#1F2937',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    maxHeight: 120,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  chipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipInitial: { fontSize: ms(11), fontWeight: 'bold', color: '#FFFFFF' },
  chipName: { fontSize: ms(12), color: '#FFFFFF' },
});
