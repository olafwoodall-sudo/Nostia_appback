import { ms } from '../utils/scale';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authAPI, tripsAPI, eventsAPI, friendsAPI } from '../services/api';
import { getCurrentLocation, requestLocationPermission, LocationData } from '../services/location';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState<any>(null);
  const [trips, setTrips] = useState([]);
  const [events, setEvents] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [nearbyEvents, setNearbyEvents] = useState<any[]>([]);
  const locationFetchedRef = useRef(false);

  useEffect(() => {
    loadData();
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    if (locationFetchedRef.current) return;
    locationFetchedRef.current = true;

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setLocationPermissionDenied(true);
        return;
      }

      const currentLocation = await getCurrentLocation();
      if (currentLocation) {
        setLocation(currentLocation);
        // Update user's location on backend
        try {
          await authAPI.updateMe({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          });
        } catch (error) {
          console.log('Failed to update location on server:', error);
        }

        // Fetch nearby events
        try {
          const nearby = await eventsAPI.getNearby(
            currentLocation.latitude,
            currentLocation.longitude,
            50 // 50km radius
          );
          setNearbyEvents(nearby);
        } catch (error) {
          console.log('Failed to fetch nearby events:', error);
        }
      }
    } catch (error) {
      console.error('Error initializing location:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [userData, tripsData, eventsData, friendsData] = await Promise.all([
        authAPI.getMe(),
        tripsAPI.getAll(),
        eventsAPI.getUpcoming(5),
        friendsAPI.getAll(),
      ]);
      setUser(userData);
      setTrips(tripsData);
      setEvents(eventsData);
      setFriends(friendsData);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load home data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const toggleHomeStatus = async () => {
    try {
      const newStatus = user.homeStatus === 'open' ? 'closed' : 'open';
      await authAPI.updateMe({ homeStatus: newStatus });
      setUser({ ...user, homeStatus: newStatus });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update home status');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await authAPI.logout();
          (navigation as any).replace('Login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
      }
    >
      {/* Welcome Header */}
      <LinearGradient
        colors={['#3B82F6', '#8B5CF6']}
        style={styles.welcomeCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.welcomeHeader}>
          <View>
            <Text style={styles.welcomeTitle}>Welcome back,</Text>
            <Text style={styles.welcomeName}>{user?.name || 'Adventurer'}!</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <Text style={styles.welcomeSubtitle}>Your next adventure awaits</Text>
      </LinearGradient>

      {/* Home Status Toggle */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>Home Status</Text>
          <TouchableOpacity
            style={[
              styles.statusToggle,
              user?.homeStatus === 'open' ? styles.statusOpen : styles.statusClosed,
            ]}
            onPress={toggleHomeStatus}
          >
            <Text style={styles.statusToggleText}>
              {user?.homeStatus === 'open' ? '🏠 Open' : '🔒 Closed'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.statusDescription}>
          {user?.homeStatus === 'open'
            ? 'Friends can see you\'re available to host'
            : 'Toggle to let friends know your home is open'}
        </Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <TouchableOpacity style={styles.statCard} onPress={() => (navigation as any).navigate('TripsTab')} activeOpacity={0.7}>
          <Ionicons name="airplane" size={28} color="#3B82F6" />
          <Text style={styles.statNumber}>{trips.length}</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => (navigation as any).navigate('FriendsTab')} activeOpacity={0.7}>
          <Ionicons name="people" size={28} color="#10B981" />
          <Text style={styles.statNumber}>{friends.length}</Text>
          <Text style={styles.statLabel}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => (navigation as any).navigate('DiscoverTab')} activeOpacity={0.7}>
          <Ionicons name="calendar" size={28} color="#F59E0B" />
          <Text style={styles.statNumber}>{events.length}</Text>
          <Text style={styles.statLabel}>Events</Text>
        </TouchableOpacity>
      </View>

      {/* Upcoming Trips Preview */}
      {trips.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Trips</Text>
            <TouchableOpacity onPress={() => (navigation as any).navigate('TripsTab')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {trips.slice(0, 2).map((trip: any) => (
            <TouchableOpacity key={trip.id} style={styles.tripPreviewCard} onPress={() => (navigation as any).navigate('TripsTab')} activeOpacity={0.7}>
              <View style={styles.tripPreviewHeader}>
                <View>
                  <Text style={styles.tripPreviewTitle}>{trip.title}</Text>
                  <Text style={styles.tripPreviewDestination}>{trip.destination}</Text>
                </View>
                <View style={styles.tripPreviewMeta}>
                  <Ionicons name="people-outline" size={16} color="#9CA3AF" />
                  <Text style={styles.tripPreviewMetaText}>
                    {trip.participants?.length || 0}
                  </Text>
                </View>
              </View>
              <Text style={styles.tripPreviewDate}>
                {new Date(trip.startDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
                {' - '}
                {new Date(trip.endDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Nearby Events Preview (location-based) */}
      {nearbyEvents.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Events</Text>
            <TouchableOpacity onPress={() => (navigation as any).navigate('DiscoverTab')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {nearbyEvents.slice(0, 3).map((event: any) => (
            <View key={event.id} style={styles.eventPreviewCard}>
              <View style={styles.eventPreviewHeader}>
                <Text style={styles.eventPreviewTitle}>{event.title}</Text>
                {event.distance !== undefined && (
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceText}>
                      {event.distance < 1
                        ? `${Math.round(event.distance * 1000)}m`
                        : `${event.distance.toFixed(1)}km`}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.eventPreviewLocation}>
                <Ionicons name="location-outline" size={14} /> {event.location}
              </Text>
              <Text style={styles.eventPreviewDate}>
                {new Date(event.eventDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Upcoming Events (fallback if no location) */}
      {nearbyEvents.length === 0 && events.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => (navigation as any).navigate('DiscoverTab')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {events.slice(0, 2).map((event: any) => (
            <View key={event.id} style={styles.eventPreviewCard}>
              <Text style={styles.eventPreviewTitle}>{event.title}</Text>
              <Text style={styles.eventPreviewLocation}>
                <Ionicons name="location-outline" size={14} /> {event.location}
              </Text>
              <Text style={styles.eventPreviewDate}>
                {new Date(event.eventDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ))}
        </View>
      )}

    </ScrollView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  welcomeCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: ms(18),
    color: '#E0E7FF',
  },
  welcomeName: {
    fontSize: ms(28),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  welcomeSubtitle: {
    fontSize: ms(16),
    color: '#E0E7FF',
  },
  logoutButton: {
    padding: 8,
  },
  statusCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: ms(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusOpen: {
    backgroundColor: '#065F46',
  },
  statusClosed: {
    backgroundColor: '#374151',
  },
  statusToggleText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusDescription: {
    fontSize: ms(14),
    color: '#9CA3AF',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  statNumber: {
    fontSize: ms(24),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: ms(12),
    color: '#9CA3AF',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: ms(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  seeAllText: {
    fontSize: ms(14),
    color: '#3B82F6',
    fontWeight: '600',
  },
  tripPreviewCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  tripPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tripPreviewTitle: {
    fontSize: ms(16),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  tripPreviewDestination: {
    fontSize: ms(14),
    color: '#9CA3AF',
  },
  tripPreviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tripPreviewMetaText: {
    fontSize: ms(14),
    color: '#9CA3AF',
  },
  tripPreviewDate: {
    fontSize: ms(14),
    color: '#3B82F6',
    fontWeight: '600',
  },
  eventPreviewCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  eventPreviewTitle: {
    fontSize: ms(16),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  eventPreviewLocation: {
    fontSize: ms(14),
    color: '#9CA3AF',
    marginBottom: 4,
  },
  eventPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventPreviewDate: {
    fontSize: ms(14),
    color: '#F59E0B',
    fontWeight: '600',
  },
  distanceBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: ms(12),
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
