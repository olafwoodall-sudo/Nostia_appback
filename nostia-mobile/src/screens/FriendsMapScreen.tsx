import { ms } from '../utils/scale';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
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

  // Inject leaflet CSS dynamically (needed for web bundle)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const existing = document.getElementById('leaflet-css');
      if (!existing) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
    }
  }, []);

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

  // Default center: world view if no friends, otherwise average of friend locations
  const center: [number, number] = friends.length > 0
    ? [
        friends.reduce((s, f) => s + f.latitude, 0) / friends.length,
        friends.reduce((s, f) => s + f.longitude, 0) / friends.length,
      ]
    : [20, 0];

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
        <MapContainer
          center={center}
          zoom={friends.length > 0 ? 4 : 2}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {friends.map((friend) => (
            <CircleMarker
              key={friend.id}
              center={[friend.latitude, friend.longitude]}
              radius={12}
              pathOptions={{ fillColor: '#3B82F6', color: '#FFFFFF', weight: 2, fillOpacity: 0.9 }}
            >
              <Popup>
                <div style={{ textAlign: 'center', minWidth: 100 }}>
                  <strong>{friend.name}</strong>
                  <br />
                  <span style={{ color: '#6B7280', fontSize: ms(12) }}>@{friend.username}</span>
                  <br />
                  <span style={{ color: '#9CA3AF', fontSize: ms(11) }}>
                    Updated {formatUpdated(friend.updatedAt)}
                  </span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </View>

      {/* Empty state */}
      {friends.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyTitle}>No locations to show</Text>
          <Text style={styles.emptyText}>
            Friends appear here once they enable location sharing in the app.
          </Text>
        </View>
      )}
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: {
    fontSize: ms(22),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: ms(13),
    color: '#9CA3AF',
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
  },
  emptyOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: ms(16),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: ms(13),
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
});
