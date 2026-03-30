import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { tripsAPI } from '../services/api';

interface CreateTripModalProps {
  visible: boolean;
  onClose: () => void;
  onTripCreated: () => void;
}

// Auto-format numeric input into YYYY-MM-DD as the user types
function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

export default function CreateTripModal({ visible, onClose, onTripCreated }: CreateTripModalProps) {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !destination.trim() || !startDate || !endDate) {
      Alert.alert('Missing Info', 'Please fill in all required fields');
      return;
    }
    if (!isValidDate(startDate)) {
      Alert.alert('Invalid Date', 'Start date is not a valid date. Use YYYY-MM-DD.');
      return;
    }
    if (!isValidDate(endDate)) {
      Alert.alert('Invalid Date', 'End date is not a valid date. Use YYYY-MM-DD.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      Alert.alert('Invalid Date', 'End date must be on or after the start date.');
      return;
    }

    try {
      setLoading(true);
      await tripsAPI.create({
        title: title.trim(),
        destination: destination.trim(),
        description: description.trim(),
        startDate,
        endDate,
        itinerary: description.trim() || undefined,
      });
      Alert.alert('Success', 'Trip created successfully!');
      resetForm();
      onTripCreated();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDestination('');
    setDescription('');
    setStartDate('');
    setEndDate('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create New Trip</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.contentContainer}
          >
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Summer Adventure 2025"
                placeholderTextColor="#6B7280"
                value={title}
                onChangeText={setTitle}
                returnKeyType="next"
              />
            </View>

            {/* Destination */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Destination *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Rocky Mountains, Colorado"
                placeholderTextColor="#6B7280"
                value={destination}
                onChangeText={setDestination}
                returnKeyType="next"
              />
            </View>

            {/* Date Inputs */}
            <View style={styles.dateRow}>
              <View style={[styles.inputGroup, styles.dateInput]}>
                <Text style={styles.label}>Start Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#6B7280"
                  value={startDate}
                  onChangeText={(t) => setStartDate(formatDateInput(t))}
                  keyboardType="numeric"
                  maxLength={10}
                  returnKeyType="next"
                />
              </View>
              <View style={[styles.inputGroup, styles.dateInput]}>
                <Text style={styles.label}>End Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#6B7280"
                  value={endDate}
                  onChangeText={(t) => setEndDate(formatDateInput(t))}
                  keyboardType="numeric"
                  maxLength={10}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description / Itinerary</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add trip details, plans, or notes..."
                placeholderTextColor="#6B7280"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createButtonContainer}
              onPress={handleCreate}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3B82F6', '#8B5CF6']}
                style={styles.createButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    <Text style={styles.createButtonText}>Create Trip</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flexGrow: 0,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D1D5DB',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInput: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  createButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  createButton: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
