import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Animated, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import TripsScreen from '../screens/TripsScreen';
import AdventuresScreen from '../screens/AdventuresScreen';
import FriendsScreen from '../screens/FriendsScreen';
import FriendsMapScreen from '../screens/FriendsMapScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import { notificationsAPI, authAPI } from '../services/api';

const Tab = createBottomTabNavigator();

export default function MainNavigator() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [userRole, setUserRole] = useState<string>('user');

  useEffect(() => {
    loadUnreadCount();
    loadUserRole();
    // Poll for unread count every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUserRole = async () => {
    try {
      const user = await authAPI.getMe();
      setUserRole(user.role || 'user');
    } catch (error) {
      // Silently fail
    }
  };

  const loadUnreadCount = async () => {
    try {
      const data = await notificationsAPI.getUnreadCount();
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      // Silently fail
    }
  };

  const HeaderRight = ({ navigation }: { navigation: any }) => (
    <View style={styles.headerRight}>
      <TouchableOpacity
        style={styles.headerIconButton}
        onPress={() => navigation.navigate('NotificationsTab')}
      >
        <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.headerIconButton}
        onPress={() => navigation.navigate('SettingsTab')}
      >
        <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'TripsTab') {
            iconName = focused ? 'airplane' : 'airplane-outline';
          } else if (route.name === 'DiscoverTab') {
            iconName = focused ? 'compass' : 'compass-outline';
          } else if (route.name === 'FriendsTab') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'MapTab') {
            iconName = focused ? 'map' : 'map-outline';
          } else {
            iconName = 'help-outline';
          }

          // Animated icon with scale and opacity transitions
          const scale = new Animated.Value(focused ? 1.1 : 1);
          const opacity = new Animated.Value(focused ? 1 : 0.6);

          return (
            <Animated.View style={{ transform: [{ scale }], opacity }}>
              <Ionicons name={iconName} size={size} color={color} />
            </Animated.View>
          );
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#1F2937',
          borderTopColor: '#374151',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        headerStyle: {
          backgroundColor: '#1F2937',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerRight: () => <HeaderRight navigation={navigation} />,
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ headerTitle: 'Nostia' }}
      />
      <Tab.Screen
        name="TripsTab"
        component={TripsScreen}
        options={{ headerTitle: 'My Trips' }}
      />
      <Tab.Screen
        name="DiscoverTab"
        component={AdventuresScreen}
        options={{ headerTitle: 'Discover Adventures' }}
      />
      <Tab.Screen
        name="FriendsTab"
        component={FriendsScreen}
        options={{ headerTitle: 'My Friends' }}
      />
      <Tab.Screen
        name="MapTab"
        component={FriendsMapScreen}
        options={{ headerTitle: 'Friends Map' }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{
          headerTitle: 'Notifications',
          tabBarButton: () => null,
        }}
        listeners={{
          tabPress: () => {
            setTimeout(loadUnreadCount, 500);
          },
        }}
      />
      {userRole === 'admin' && (
        <Tab.Screen
          name="AnalyticsTab"
          component={AnalyticsScreen}
          options={{
            headerTitle: 'Analytics Dashboard',
            tabBarButton: () => null,
          }}
        />
      )}
      <Tab.Screen
        name="SettingsTab"
        component={PrivacyScreen}
        options={{
          headerTitle: 'Settings',
          tabBarButton: () => null,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    gap: 4,
  },
  headerIconButton: {
    padding: 6,
  },
  badge: {
    position: 'absolute',
    right: 2,
    top: 2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
