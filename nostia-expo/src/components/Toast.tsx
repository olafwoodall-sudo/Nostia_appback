import Toast, { BaseToast, ErrorToast, InfoToast } from 'react-native-toast-message';

/**
 * Toast configuration for react-native-toast-message
 * Provides dark-themed, consistent toast notifications
 */

export const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#10B981',
        backgroundColor: '#1F2937',
        borderWidth: 1,
        borderColor: '#374151',
        height: 70,
      }}
      contentContainerStyle={{
        paddingHorizontal: 15,
      }}
      text1Style={{
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
      }}
      text2Style={{
        fontSize: 13,
        color: '#9CA3AF',
      }}
      text2NumberOfLines={2}
    />
  ),

  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: '#EF4444',
        backgroundColor: '#1F2937',
        borderWidth: 1,
        borderColor: '#374151',
        height: 70,
      }}
      contentContainerStyle={{
        paddingHorizontal: 15,
      }}
      text1Style={{
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
      }}
      text2Style={{
        fontSize: 13,
        color: '#9CA3AF',
      }}
      text2NumberOfLines={2}
    />
  ),

  info: (props: any) => (
    <InfoToast
      {...props}
      style={{
        borderLeftColor: '#3B82F6',
        backgroundColor: '#1F2937',
        borderWidth: 1,
        borderColor: '#374151',
        height: 70,
      }}
      contentContainerStyle={{
        paddingHorizontal: 15,
      }}
      text1Style={{
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
      }}
      text2Style={{
        fontSize: 13,
        color: '#9CA3AF',
      }}
      text2NumberOfLines={2}
    />
  ),
};

export default Toast;
