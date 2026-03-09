import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StyleSheet, DeviceEventEmitter } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Toast, { toastConfig } from './src/components/Toast';

import { StripeProvider } from '@stripe/stripe-react-native';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import VaultScreen from './src/screens/VaultScreen';
import ChatScreen from './src/screens/ChatScreen';
import MainNavigator from './src/navigation/MainNavigator';

const Stack = createStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
    const loginSub = DeviceEventEmitter.addListener('app-authenticated', () => setIsAuthenticated(true));
    const logoutSub = DeviceEventEmitter.addListener('app-unauthenticated', () => setIsAuthenticated(false));
    return () => {
      loginSub.remove();
      logoutSub.remove();
    };
  }, []);

  const checkAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync('jwt_token');
      setIsAuthenticated(!!token);
    } catch (error) {
      console.log('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.nostia">
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName={isAuthenticated ? 'Main' : 'Login'}
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1F2937',
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          {!isAuthenticated ? (
            <>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Signup"
                component={SignupScreen}
                options={{ headerShown: false }}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Main"
                component={MainNavigator}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Vault"
                component={VaultScreen}
                options={({ route }: any) => ({
                  title: route.params?.tripTitle || 'Vault',
                })}
              />
              <Stack.Screen
                name="Chat"
                component={ChatScreen}
                options={({ route }: any) => ({
                  title: route.params?.friendName || 'Chat',
                })}
              />
            </>
          )}
        </Stack.Navigator>
        <Toast config={toastConfig} />
      </NavigationContainer>
    </SafeAreaProvider>
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
  },
});
