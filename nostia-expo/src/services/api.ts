import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Alert } from 'react-native';

// Use EXPO_PUBLIC_API_URL env var, then Expo config, then fallback for local dev
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://king-prawn-app-44tki.ondigitalocean.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to requests
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for rate limiting and consent-required
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      Alert.alert(
        'Too Many Requests',
        'Please wait a moment and try again.'
      );
    }
    if (
      error.response?.status === 403 &&
      error.response?.data?.consentRequired
    ) {
      // Emit a global event so navigation can redirect to consent screen
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.emit('consent-required', error.response.data);
    }
    return Promise.reject(error);
  }
);

// ===== Authentication API =====
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    if (response.data.token) {
      await SecureStore.setItemAsync('jwt_token', response.data.token);
    }
    return response.data;
  },

  register: async (
    username: string,
    password: string,
    name: string,
    email?: string,
    locationConsent?: boolean,
    dataCollectionConsent?: boolean
  ) => {
    const response = await api.post('/auth/register', {
      username,
      password,
      name,
      email,
      locationConsent,
      dataCollectionConsent,
    });
    if (response.data.token) {
      await SecureStore.setItemAsync('jwt_token', response.data.token);
    }
    return response.data;
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('jwt_token');
  },

  getMe: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },

  updateMe: async (updates: any) => {
    const response = await api.put('/users/me', updates);
    return response.data;
  },

  getUserById: async (id: number) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
};

// ===== Trips API =====
export const tripsAPI = {
  getAll: async () => {
    const response = await api.get('/trips');
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/trips/${id}`);
    return response.data;
  },

  create: async (tripData: any) => {
    const response = await api.post('/trips', tripData);
    return response.data;
  },

  update: async (id: number, updates: any) => {
    const response = await api.put(`/trips/${id}`, updates);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/trips/${id}`);
    return response.data;
  },

  addParticipant: async (tripId: number, userId: number) => {
    const response = await api.post(`/trips/${tripId}/participants`, { userId });
    return response.data;
  },

  removeParticipant: async (tripId: number, userId: number) => {
    const response = await api.delete(`/trips/${tripId}/participants/${userId}`);
    return response.data;
  },
};

// ===== Friends API =====
export const friendsAPI = {
  getAll: async () => {
    const response = await api.get('/friends');
    return response.data;
  },

  getRequests: async () => {
    const response = await api.get('/friends/requests');
    return response.data;
  },

  sendRequest: async (friendId: number) => {
    const response = await api.post('/friends/request', { friendId });
    return response.data;
  },

  acceptRequest: async (requestId: number) => {
    const response = await api.post(`/friends/accept/${requestId}`);
    return response.data;
  },

  rejectRequest: async (requestId: number) => {
    const response = await api.delete(`/friends/reject/${requestId}`);
    return response.data;
  },

  removeFriend: async (friendId: number) => {
    const response = await api.delete(`/friends/${friendId}`);
    return response.data;
  },

  getLocations: async () => {
    const response = await api.get('/friends/locations');
    return response.data;
  },

  searchUsers: async (query: string) => {
    const response = await api.get(`/users/search?query=${encodeURIComponent(query)}`);
    return response.data;
  },
};

// ===== Vault API =====
export const vaultAPI = {
  getTripSummary: async (tripId: number) => {
    const response = await api.get(`/vault/trip/${tripId}`);
    return response.data;
  },

  createEntry: async (entryData: any) => {
    const response = await api.post('/vault', entryData);
    return response.data;
  },

  markSplitPaid: async (splitId: number) => {
    const response = await api.put(`/vault/splits/${splitId}/paid`);
    return response.data;
  },

  createSplitPaymentIntent: async (splitId: number) => {
    const response = await api.post(`/vault/splits/${splitId}/payment-intent`);
    return response.data;
  },

  deleteEntry: async (id: number) => {
    const response = await api.delete(`/vault/${id}`);
    return response.data;
  },
};

// ===== Adventures API =====
export const adventuresAPI = {
  getAll: async () => {
    const response = await api.get('/adventures');
    return response.data;
  },

  search: async (query: string) => {
    const response = await api.get(`/adventures?search=${encodeURIComponent(query)}`);
    return response.data;
  },

  getByCategory: async (category: string) => {
    const response = await api.get(`/adventures?category=${category}`);
    return response.data;
  },

  getByDifficulty: async (difficulty: string) => {
    const response = await api.get(`/adventures?difficulty=${difficulty}`);
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/adventures/${id}`);
    return response.data;
  },

  create: async (adventureData: any) => {
    const response = await api.post('/adventures', adventureData);
    return response.data;
  },
};

// ===== Feed API =====
export const feedAPI = {
  getUserFeed: async (limit: number = 50) => {
    const response = await api.get(`/feed?limit=${limit}`);
    return response.data;
  },

  getPublicFeed: async (limit: number = 50) => {
    const response = await api.get(`/feed/public?limit=${limit}`);
    return response.data;
  },

  createPost: async (postData: { content?: string; imageData?: string; relatedTripId?: number; relatedEventId?: number }) => {
    const response = await api.post('/feed', postData);
    return response.data;
  },

  deletePost: async (id: number) => {
    const response = await api.delete(`/feed/${id}`);
    return response.data;
  },

  likePost: async (id: number) => {
    const response = await api.post(`/feed/${id}/like`);
    return response.data;
  },

  unlikePost: async (id: number) => {
    const response = await api.delete(`/feed/${id}/like`);
    return response.data;
  },

  getComments: async (postId: number) => {
    const response = await api.get(`/feed/${postId}/comments`);
    return response.data;
  },

  addComment: async (postId: number, content: string) => {
    const response = await api.post(`/feed/${postId}/comments`, { content });
    return response.data;
  },

  deleteComment: async (commentId: number) => {
    const response = await api.delete(`/feed/comments/${commentId}`);
    return response.data;
  },
};

// ===== Events API =====
export const eventsAPI = {
  getAll: async () => {
    const response = await api.get('/events');
    return response.data;
  },

  getUpcoming: async (limit: number = 10) => {
    const response = await api.get(`/events/upcoming?limit=${limit}`);
    return response.data;
  },

  getNearby: async (lat: number, lng: number, radiusKm: number = 50) => {
    const response = await api.get(`/events/nearby?lat=${lat}&lng=${lng}&radius=${radiusKm}`);
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },

  create: async (eventData: any) => {
    const response = await api.post('/events', eventData);
    return response.data;
  },

  update: async (id: number, updates: any) => {
    const response = await api.put(`/events/${id}`, updates);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  },
};

// ===== Notifications API =====
export const notificationsAPI = {
  getAll: async (limit: number = 50) => {
    const response = await api.get(`/notifications?limit=${limit}`);
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (notificationId: number) => {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.put('/notifications/read-all');
    return response.data;
  },

  savePushToken: async (token: string, platform: string) => {
    const response = await api.post('/push-token', { token, platform });
    return response.data;
  },

  removePushToken: async () => {
    const response = await api.delete('/push-token');
    return response.data;
  },
};

// ===== Messaging API =====
export const messagesAPI = {
  getConversations: async () => {
    const response = await api.get('/conversations');
    return response.data;
  },

  getOrCreateConversation: async (userId: number) => {
    const response = await api.post('/conversations', { userId });
    return response.data;
  },

  getMessages: async (conversationId: number, limit: number = 50, offset: number = 0) => {
    const response = await api.get(`/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`);
    return response.data;
  },

  sendMessage: async (conversationId: number, content: string) => {
    const response = await api.post(`/conversations/${conversationId}/messages`, { content });
    return response.data;
  },

  markAsRead: async (conversationId: number) => {
    const response = await api.put(`/conversations/${conversationId}/read`);
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/messages/unread-count');
    return response.data;
  },
};

// ===== Consent API =====
export const consentAPI = {
  grant: async (consentData: { locationConsent: boolean; dataCollectionConsent: boolean }) => {
    const response = await api.post('/consent', consentData);
    return response.data;
  },

  getStatus: async () => {
    const response = await api.get('/consent');
    return response.data;
  },

  revoke: async () => {
    const response = await api.post('/consent/revoke');
    return response.data;
  },

  getHistory: async () => {
    const response = await api.get('/consent/history');
    return response.data;
  },

  getCurrentVersion: async () => {
    const response = await api.get('/consent/current-version');
    return response.data;
  },
};

// ===== Analytics API =====
export const analyticsAPI = {
  getDashboard: async (params: { startDate: string; endDate: string }) => {
    const response = await api.get('/analytics/dashboard', { params });
    return response.data;
  },

  getHeatmap: async (params: { startDate: string; endDate: string }) => {
    const response = await api.get('/analytics/heatmap', { params });
    return response.data;
  },

  getFeatureUsage: async (params: { startDate: string; endDate: string }) => {
    const response = await api.get('/analytics/feature-usage', { params });
    return response.data;
  },

  getRetention: async (params: { startDate: string; endDate: string }) => {
    const response = await api.get('/analytics/retention', { params });
    return response.data;
  },

  getFunnels: async (params: { startDate: string; endDate: string }) => {
    const response = await api.get('/analytics/funnels', { params });
    return response.data;
  },

  getSessions: async (params: { startDate: string; endDate: string }) => {
    const response = await api.get('/analytics/sessions', { params });
    return response.data;
  },

  getSubscription: async () => {
    const response = await api.get('/analytics/subscription');
    return response.data;
  },

  subscribe: async (plan: string) => {
    const response = await api.post('/analytics/subscribe', { plan });
    return response.data;
  },

  cancelSubscription: async () => {
    const response = await api.post('/analytics/subscription/cancel');
    return response.data;
  },

  purchaseReport: async (reportData: { reportType: string; startDate: string; endDate: string }) => {
    const response = await api.post('/analytics/reports/purchase', reportData);
    return response.data;
  },
};

// ===== Payments API (Stripe Connect) =====
export const paymentsAPI = {
  startOnboarding: async () => {
    const response = await api.post('/stripe/onboard');
    return response.data;
  },

  getOnboardingStatus: async () => {
    const response = await api.get('/stripe/onboard/status');
    return response.data;
  },

  createVault: async (totalAmount: number, members: number[]) => {
    const response = await api.post('/vault/create', { totalAmount, members });
    return response.data;
  },

  getVault: async (vaultId: number) => {
    const response = await api.get(`/vault/${vaultId}`);
    return response.data;
  },

  payVaultSplit: async (vaultId: number, memberId: number) => {
    const response = await api.post('/vault/pay', { vaultId, memberId });
    return response.data;
  },

  getPaymentMethods: async () => {
    const response = await api.get('/payment-methods');
    return response.data;
  },

  addPaymentMethod: async (details: {
    stripePaymentMethodId: string;
    type?: string;
    brand?: string;
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault?: boolean;
  }) => {
    const response = await api.post('/payment-methods', details);
    return response.data;
  },

  setDefaultPaymentMethod: async (id: number) => {
    const response = await api.put(`/payment-methods/${id}/default`);
    return response.data;
  },

  deletePaymentMethod: async (id: number) => {
    const response = await api.delete(`/payment-methods/${id}`);
    return response.data;
  },
};

// ===== Privacy API =====
export const privacyAPI = {
  getPolicy: async () => {
    const response = await api.get('/privacy/policy');
    return response.data;
  },

  requestDataExport: async () => {
    const response = await api.post('/privacy/data-request');
    return response.data;
  },

  downloadExport: async (exportId: number) => {
    const response = await api.get(`/privacy/data-export/${exportId}`);
    return response.data;
  },

  requestDataDeletion: async () => {
    const response = await api.post('/privacy/delete-data');
    return response.data;
  },
};

export default api;
