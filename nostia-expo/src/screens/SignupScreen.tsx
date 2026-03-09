import { ms } from '../utils/scale';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  DeviceEventEmitter,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../services/api';
import ConsentModal from '../components/ConsentModal';

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentData, setConsentData] = useState<{
    locationConsent: boolean;
    dataCollectionConsent: boolean;
  } | null>(null);
  const navigation = useNavigation();

  const validateInputs = (): string | null => {
    const trimmedUsername = username.trim();
    const trimmedName = name.trim();

    if (!trimmedName || trimmedName.length > 100) {
      return 'Name is required (max 100 characters)';
    }
    if (!trimmedUsername || trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      return 'Username must be 3-30 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    if (!password || password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  const handleSignup = async () => {
    const validationError = validateInputs();
    if (validationError) {
      Alert.alert('Invalid Input', validationError);
      return;
    }

    // Show consent modal if not yet consented
    if (!consentData) {
      setShowConsent(true);
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.register(
        username,
        password,
        name,
        email,
        consentData.locationConsent,
        consentData.dataCollectionConsent
      );

      Alert.alert('Success!', `Welcome to Nostia, ${name}!`, [
        { text: 'OK', onPress: () => DeviceEventEmitter.emit('app-authenticated') },
      ]);
    } catch (error: any) {
      console.log('Signup error:', error.response?.data || error.message);

      if (error.response?.status === 400) {
        Alert.alert('Signup Failed', error.response.data.error || 'Username already exists');
      } else {
        Alert.alert('Signup Failed', 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConsent = (consent: { locationConsent: boolean; dataCollectionConsent: boolean }) => {
    setConsentData(consent);
    setShowConsent(false);
    // Auto-submit after consent is granted
    setTimeout(() => handleSignupWithConsent(consent), 100);
  };

  const handleSignupWithConsent = async (consent: { locationConsent: boolean; dataCollectionConsent: boolean }) => {
    if (validateInputs()) return;

    setLoading(true);
    try {
      const response = await authAPI.register(
        username,
        password,
        name,
        email,
        consent.locationConsent,
        consent.dataCollectionConsent
      );

      Alert.alert('Success!', `Welcome to Nostia, ${name}!`, [
        { text: 'OK', onPress: () => DeviceEventEmitter.emit('app-authenticated') },
      ]);
    } catch (error: any) {
      console.log('Signup error:', error.response?.data || error.message);
      if (error.response?.status === 400) {
        Alert.alert('Signup Failed', error.response.data.error || 'Username already exists');
      } else {
        Alert.alert('Signup Failed', 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineConsent = () => {
    setShowConsent(false);
    Alert.alert(
      'Consent Required',
      'You must agree to the location and data collection terms to create an account on Nostia.'
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <LinearGradient
          colors={['#3B82F6', '#8B5CF6']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="compass" size={64} color="#FFFFFF" />
          <Text style={styles.title}>Join Nostia</Text>
          <Text style={styles.subtitle}>Start your adventure today</Text>
        </LinearGradient>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor="#6B7280"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username *</Text>
            <TextInput
              style={styles.input}
              placeholder="Choose a username"
              placeholderTextColor="#6B7280"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor="#6B7280"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              placeholderTextColor="#6B7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {consentData && (
            <View style={styles.consentGrantedBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              <Text style={styles.consentGrantedText}>Consent granted</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.signupButtonContainer}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#3B82F6', '#8B5CF6']}
              style={styles.signupButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name={consentData ? "person-add" : "shield-checkmark"} size={20} color="#FFFFFF" />
                  <Text style={styles.signupButtonText}>
                    {consentData ? 'Create Account' : 'Continue to Consent'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login' as never)}
          >
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkBold}>Login</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConsentModal
        visible={showConsent}
        onConsent={handleConsent}
        onDecline={handleDeclineConsent}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    padding: 40,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: ms(32),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
  },
  subtitle: {
    fontSize: ms(16),
    color: '#E0E7FF',
    marginTop: 8,
  },
  form: {
    flex: 1,
    padding: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: ms(14),
    fontWeight: '600',
    color: '#D1D5DB',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    fontSize: ms(16),
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#374151',
  },
  signupButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  signupButton: {
    flexDirection: 'row',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signupButtonText: {
    fontSize: ms(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#374151',
  },
  dividerText: {
    fontSize: ms(14),
    color: '#6B7280',
    marginHorizontal: 16,
  },
  loginLink: {
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: ms(14),
    color: '#9CA3AF',
  },
  loginLinkBold: {
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  consentGrantedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#064E3B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  consentGrantedText: {
    fontSize: ms(14),
    color: '#10B981',
    fontWeight: '600',
  },
});
