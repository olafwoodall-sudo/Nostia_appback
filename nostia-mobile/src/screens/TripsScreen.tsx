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
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { tripsAPI, analyticsAPI } from '../services/api';
import CreateTripModal from '../components/CreateTripModal';
import AIChatModal from '../components/AIChatModal';

export default function TripsScreen() {
  const navigation = useNavigation();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [selectedTripForAI, setSelectedTripForAI] = useState<any>(null);
  const [editingTrip, setEditingTrip] = useState<any>(null);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    try {
      setLoading(true);
      const data = await tripsAPI.getAll();
      setTrips(data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrips();
    setRefreshing(false);
  };

  const handleTripCreated = () => {
    setShowCreateModal(false);
    loadTrips();
    analyticsAPI.track({
      eventType: 'action',
      eventName: 'trip_created',
    }).catch(() => {});
  };

  const handleViewVault = (trip: any) => {
    analyticsAPI.track({
      eventType: 'action',
      eventName: 'vault_opened',
      metadata: JSON.stringify({ tripId: trip.id }),
    }).catch(() => {});
    // Navigate to VaultScreen with trip ID
    (navigation as any).navigate('Vault', { tripId: trip.id, tripTitle: trip.title });
  };

  const handleDeleteTrip = (trip: any) => {
    Alert.alert(
      'Delete Trip',
      `Are you sure you want to delete "${trip.title}"? This will remove all associated data including expenses, photos, and participants.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await tripsAPI.delete(trip.id);
              Alert.alert('Success', 'Trip deleted successfully');
              loadTrips();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete trip');
            }
          },
        },
      ]
    );
  };

  const renderTripCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleViewVault(item)}
      onLongPress={() => handleDeleteTrip(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.tripInfo}>
          <Text style={styles.tripTitle}>{item.title}</Text>
          <Text style={styles.tripDestination}>{item.destination}</Text>
        </View>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>
            {new Date(item.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>

      {item.description && (
        <Text style={styles.tripDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.statItem}>
          <Ionicons name="people-outline" size={18} color="#9CA3AF" />
          <Text style={styles.statText}>{item.participants?.length || 0} people</Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.aiButton}
            onPress={() => {
              setSelectedTripForAI(item);
              setShowAIChat(true);
            }}
          >
            <Ionicons name="sparkles" size={16} color="#A78BFA" />
            <Text style={styles.aiButtonText}>AI Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editTripButton} onPress={() => setEditingTrip(item)}>
            <Ionicons name="pencil-outline" size={15} color="#9CA3AF" />
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Ionicons name="wallet-outline" size={18} color="#10B981" />
            <Text style={styles.vaultText}>Vault</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
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
      <FlatList
        data={trips}
        renderItem={renderTripCard}
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
            <Ionicons name="airplane-outline" size={64} color="#6B7280" />
            <Text style={styles.emptyText}>No trips yet</Text>
            <Text style={styles.emptySubtext}>Create your first adventure!</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#3B82F6', '#8B5CF6']}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      <CreateTripModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTripCreated={handleTripCreated}
      />

      <EditTripModal
        visible={!!editingTrip}
        trip={editingTrip}
        onClose={() => setEditingTrip(null)}
        onSaved={() => { setEditingTrip(null); loadTrips(); }}
      />

      <AIChatModal
        visible={showAIChat}
        onClose={() => {
          setShowAIChat(false);
          setSelectedTripForAI(null);
        }}
        tripContext={selectedTripForAI}
        onGenerateItinerary={(itinerary) => {
          console.log('Generated itinerary:', itinerary);
          Alert.alert('Success', 'Itinerary generated! Check the AI chat for details.');
        }}
      />
    </View>
  );
}

function EditTripModal({ visible, trip, onClose, onSaved }: { visible: boolean; trip: any; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (trip) {
      setTitle(trip.title || '');
      setDestination(trip.destination || '');
      setDescription(trip.description || '');
      setStartDate(trip.startDate ? trip.startDate.slice(0, 10) : '');
      setEndDate(trip.endDate ? trip.endDate.slice(0, 10) : '');
    }
  }, [trip]);

  const handleSave = async () => {
    if (!title || !destination) {
      Alert.alert('Missing Info', 'Title and destination are required');
      return;
    }
    setSaving(true);
    try {
      await tripsAPI.update(trip.id, { title, destination, description, startDate, endDate });
      onSaved();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update trip');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#1F2937', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#374151' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' }}>Edit Trip</Text>
                <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color="#FFFFFF" /></TouchableOpacity>
              </View>
              <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                {[
                  { label: 'Title *', value: title, setter: setTitle, placeholder: 'Trip title' },
                  { label: 'Destination *', value: destination, setter: setDestination, placeholder: 'Destination' },
                  { label: 'Start Date', value: startDate, setter: setStartDate, placeholder: 'YYYY-MM-DD' },
                  { label: 'End Date', value: endDate, setter: setEndDate, placeholder: 'YYYY-MM-DD' },
                ].map(({ label, value, setter, placeholder }) => (
                  <View key={label} style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#D1D5DB', marginBottom: 6 }}>{label}</Text>
                    <TextInput style={{ backgroundColor: '#374151', borderRadius: 8, padding: 14, fontSize: 15, color: '#FFFFFF', borderWidth: 1, borderColor: '#4B5563' }} value={value} onChangeText={setter} placeholder={placeholder} placeholderTextColor="#6B7280" />
                  </View>
                ))}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#D1D5DB', marginBottom: 6 }}>Description</Text>
                  <TextInput style={{ backgroundColor: '#374151', borderRadius: 8, padding: 14, fontSize: 15, color: '#FFFFFF', borderWidth: 1, borderColor: '#4B5563', minHeight: 80, textAlignVertical: 'top' }} value={description} onChangeText={setDescription} placeholder="Trip notes..." placeholderTextColor="#6B7280" multiline />
                </View>
              </ScrollView>
              <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 12 }}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: '#374151', borderRadius: 12, padding: 16, alignItems: 'center' }} onPress={onClose} disabled={saving}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#D1D5DB' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, backgroundColor: '#3B82F6', borderRadius: 12, padding: 16, alignItems: 'center' }} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
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
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tripInfo: {
    flex: 1,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  tripDestination: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  dateBadge: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  dateText: {
    fontSize: 12,
    color: '#93C5FD',
    fontWeight: '600',
  },
  tripDescription: {
    fontSize: 14,
    color: '#D1D5DB',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  vaultText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editTripButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  aiButtonText: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
