import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { feedAPI } from '../services/api';
import CameraModal from './CameraModal';

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export default function CreatePostModal({ visible, onClose, onPostCreated }: CreatePostModalProps) {
  const [caption, setCaption] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted && (permissionResult as any).accessPrivileges !== 'limited') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
      exif: false,
    });
    if (!result.canceled && result.assets[0].base64) {
      setImageData(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = () => setShowCamera(true);

  const handleSubmit = async () => {
    if (!imageData && !caption.trim()) {
      Alert.alert('Error', 'Please add a photo or caption');
      return;
    }
    try {
      setLoading(true);
      await feedAPI.createPost({ content: caption.trim(), imageData: imageData || undefined });
      setCaption('');
      setImageData(null);
      onPostCreated();
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to create post';
      Alert.alert('Error', msg, [{ text: 'OK', onPress: handleClose }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCaption('');
    setImageData(null);
    onClose();
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.inner}>
              <View style={styles.header}>
                <TouchableOpacity onPress={handleClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Post</Text>
                <TouchableOpacity onPress={handleSubmit} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <Text style={[styles.shareText, (!imageData && !caption.trim()) && styles.shareTextDisabled]}>Share</Text>
                  )}
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.content}>
                {imageData ? (
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: imageData }} style={styles.previewImage} />
                    <TouchableOpacity style={styles.removeImageButton} onPress={() => setImageData(null)}>
                      <Ionicons name="close-circle" size={28} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imagePickerContainer}>
                    <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                      <Ionicons name="images-outline" size={40} color="#9CA3AF" />
                      <Text style={styles.imagePickerText}>Choose from Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imagePickerButton} onPress={takePhoto}>
                      <Ionicons name="camera-outline" size={40} color="#9CA3AF" />
                      <Text style={styles.imagePickerText}>Take a Photo</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TextInput
                  style={styles.captionInput}
                  placeholder="Write a caption..."
                  placeholderTextColor="#6B7280"
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={500}
                />
                <Text style={styles.characterCount}>{caption.length}/500</Text>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
      <CameraModal
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onPhotoTaken={(b64) => { setImageData(b64); setShowCamera(false); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  inner: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#374151' },
  cancelText: { fontSize: 16, color: '#9CA3AF' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  shareText: { fontSize: 16, fontWeight: 'bold', color: '#3B82F6' },
  shareTextDisabled: { color: '#4B5563' },
  content: { flex: 1, padding: 16 },
  imageContainer: { position: 'relative', marginBottom: 16 },
  previewImage: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  removeImageButton: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14 },
  imagePickerContainer: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  imagePickerButton: { flex: 1, backgroundColor: '#1F2937', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: '#374151', borderStyle: 'dashed' },
  imagePickerText: { marginTop: 8, fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  captionInput: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, color: '#FFFFFF', fontSize: 16, minHeight: 100, textAlignVertical: 'top' },
  characterCount: { fontSize: 12, color: '#6B7280', textAlign: 'right', marginTop: 8 },
});
