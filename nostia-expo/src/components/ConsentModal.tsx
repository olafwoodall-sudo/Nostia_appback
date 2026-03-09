import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface ConsentModalProps {
  visible: boolean;
  onConsent: (consent: { locationConsent: boolean; dataCollectionConsent: boolean }) => void;
  onDecline: () => void;
}

export default function ConsentModal({ visible, onConsent, onDecline }: ConsentModalProps) {
  const [locationConsent, setLocationConsent] = useState(false);
  const [dataCollectionConsent, setDataCollectionConsent] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  const canProceed = locationConsent && dataCollectionConsent;

  if (showPolicy) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.policyContainer}>
            <View style={styles.policyHeader}>
              <Text style={styles.policyTitle}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setShowPolicy(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.policyScroll}>
              <View style={styles.policySection}>
                <Text style={styles.policySectionTitle}>Data We Collect</Text>
                <Text style={styles.policySectionContent}>
                  Nostia collects GPS coordinates during active sessions, feature interaction events
                  (clicks, duration), session metrics (length, frequency), conversion funnel
                  milestones, error and performance metrics, and regional trend data aggregated by
                  city or region.
                </Text>
              </View>

              <View style={styles.policySection}>
                <Text style={styles.policySectionTitle}>How We Use Your Data</Text>
                <Text style={styles.policySectionContent}>
                  Your data powers core location-based features and is used to generate anonymized,
                  aggregated insights such as trends and heatmaps. Raw data is never shared directly.
                  All monetizable outputs are derived from aggregated and anonymized datasets.
                </Text>
              </View>

              <View style={styles.policySection}>
                <Text style={styles.policySectionTitle}>Data Anonymization</Text>
                <Text style={styles.policySectionContent}>
                  GPS data is rounded or bucketed by region. User identifiers are removed prior to
                  analysis. Metrics are aggregated over time windows. No personally identifiable
                  information is included in analytical outputs.
                </Text>
              </View>

              <View style={styles.policySection}>
                <Text style={styles.policySectionTitle}>Location Access</Text>
                <Text style={styles.policySectionContent}>
                  Location sharing is a mandatory requirement to use Nostia. If you decline or revoke
                  location access, your account access will be restricted until permission is
                  restored.
                </Text>
              </View>

              <View style={styles.policySection}>
                <Text style={styles.policySectionTitle}>Data Retention</Text>
                <Text style={styles.policySectionContent}>
                  Raw location data is retained for a limited period (90 days by default). After this
                  period, raw data is purged while anonymized aggregates are preserved.
                </Text>
              </View>

              <View style={styles.policySection}>
                <Text style={styles.policySectionTitle}>Your Rights</Text>
                <Text style={styles.policySectionContent}>
                  You have the right to request export of your data, request deletion of your data,
                  revoke consent at any time, and opt out of data collection. These rights are
                  supported under GDPR and CCPA regulations.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setShowPolicy(false)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3B82F6', '#8B5CF6']}
                style={styles.backButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.backButtonText}>Back to Consent</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView>
            {/* Header */}
            <View style={styles.header}>
              <LinearGradient
                colors={['#3B82F6', '#8B5CF6']}
                style={styles.iconContainer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.headerText}>
                <Text style={styles.title}>Before You Continue</Text>
                <Text style={styles.subtitle}>Consent required to use Nostia</Text>
              </View>
            </View>

            {/* Description */}
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>
                Nostia is a location-powered application. To provide our core features and generate
                anonymized insights, we need your explicit consent for the following:
              </Text>
            </View>

            {/* Location Consent */}
            <TouchableOpacity
              style={styles.consentItem}
              onPress={() => setLocationConsent(!locationConsent)}
              activeOpacity={0.7}
            >
              <View style={styles.consentContent}>
                <View style={styles.consentHeader}>
                  <Ionicons name="location" size={18} color="#3B82F6" />
                  <Text style={styles.consentLabel}>Location Access</Text>
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredText}>Required</Text>
                  </View>
                </View>
                <Text style={styles.consentDescription}>
                  I grant Nostia permission to access my GPS location during active sessions.
                  Location data is used for core features and anonymized regional analytics.
                </Text>
              </View>
              <Switch
                value={locationConsent}
                onValueChange={setLocationConsent}
                trackColor={{ false: '#374151', true: '#3B82F6' }}
                thumbColor={locationConsent ? '#FFFFFF' : '#9CA3AF'}
              />
            </TouchableOpacity>

            {/* Data Collection Consent */}
            <TouchableOpacity
              style={styles.consentItem}
              onPress={() => setDataCollectionConsent(!dataCollectionConsent)}
              activeOpacity={0.7}
            >
              <View style={styles.consentContent}>
                <View style={styles.consentHeader}>
                  <Ionicons name="server" size={18} color="#8B5CF6" />
                  <Text style={styles.consentLabel}>Usage Data Collection</Text>
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredText}>Required</Text>
                  </View>
                </View>
                <Text style={styles.consentDescription}>
                  I agree to the collection of usage data including feature interactions, session
                  metrics, and performance data. All data is anonymized before analysis.
                </Text>
              </View>
              <Switch
                value={dataCollectionConsent}
                onValueChange={setDataCollectionConsent}
                trackColor={{ false: '#374151', true: '#8B5CF6' }}
                thumbColor={dataCollectionConsent ? '#FFFFFF' : '#9CA3AF'}
              />
            </TouchableOpacity>

            {/* Privacy Policy Link */}
            <TouchableOpacity
              style={styles.policyLink}
              onPress={() => setShowPolicy(true)}
            >
              <Ionicons name="document-text" size={16} color="#3B82F6" />
              <Text style={styles.policyLinkText}>View Privacy Policy</Text>
            </TouchableOpacity>

            {/* Action Buttons */}
            <TouchableOpacity
              style={[styles.agreeButtonContainer, !canProceed && styles.disabledButton]}
              onPress={() => canProceed && onConsent({ locationConsent, dataCollectionConsent })}
              disabled={!canProceed}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={canProceed ? ['#3B82F6', '#8B5CF6'] : ['#374151', '#374151']}
                style={styles.agreeButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.agreeButtonText, !canProceed && styles.disabledText]}>
                  Agree & Continue
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>

            {!canProceed && (
              <Text style={styles.requirementNote}>
                Both consents are required to create an account
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  descriptionBox: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  consentContent: {
    flex: 1,
    marginRight: 12,
  },
  consentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  consentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  requiredBadge: {
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FCA5A5',
  },
  consentDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  policyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    paddingVertical: 4,
  },
  policyLinkText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  agreeButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  agreeButton: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledText: {
    color: '#6B7280',
  },
  declineButton: {
    padding: 14,
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  requirementNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  // Policy view styles
  policyContainer: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    maxHeight: '90%',
  },
  policyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  policyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  policyScroll: {
    marginBottom: 16,
  },
  policySection: {
    marginBottom: 16,
  },
  policySectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  policySectionContent: {
    fontSize: 13,
    color: '#D1D5DB',
    lineHeight: 20,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
