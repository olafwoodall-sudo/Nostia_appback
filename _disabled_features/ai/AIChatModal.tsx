import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { aiAPI } from '../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TripContext {
  title?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  participants?: { id: number; name: string }[];
}

interface AIChatModalProps {
  visible: boolean;
  onClose: () => void;
  tripContext?: TripContext | null;
  onGenerateItinerary?: (itinerary: string) => void;
}

export default function AIChatModal({
  visible,
  onClose,
  tripContext = null,
  onGenerateItinerary,
}: AIChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const { height } = useWindowDimensions();

  // Initialize with welcome message when modal opens
  useEffect(() => {
    if (visible && messages.length === 0) {
      const welcomeMessage = tripContext?.destination
        ? `Hi! I'm Nostia AI, your travel planning assistant. I see you're planning a trip to **${tripContext.destination}**! How can I help you today?\n\nI can help with:\n- Creating detailed itineraries\n- Activity recommendations\n- Budget tips\n- Packing suggestions`
        : `Hi! I'm Nostia AI, your travel planning assistant. How can I help you plan your next adventure?\n\nI can help with:\n- Destination recommendations\n- Creating detailed itineraries\n- Budget planning\n- Packing suggestions`;

      setMessages([{ role: 'assistant', content: welcomeMessage }]);
    }
  }, [visible]);

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const context = tripContext
        ? {
            tripTitle: tripContext.title,
            destination: tripContext.destination,
            startDate: tripContext.startDate,
            endDate: tripContext.endDate,
            participants: tripContext.participants?.length,
          }
        : {};

      const response = await aiAPI.chat(userMessage, context);
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to get AI response');
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "I'm sorry, I couldn't process that request. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    if (isLoading) return;

    let message = '';
    switch (action) {
      case 'itinerary':
        message = tripContext?.destination
          ? `Create a detailed day-by-day itinerary for my trip to ${tripContext.destination}`
          : 'Help me create a travel itinerary';
        break;
      case 'activities':
        message = tripContext?.destination
          ? `What are the best activities and things to do in ${tripContext.destination}?`
          : 'Recommend some fun travel activities';
        break;
      case 'budget':
        message = tripContext?.destination
          ? `What's a reasonable budget for a trip to ${tripContext.destination}?`
          : 'Give me budget tips for traveling';
        break;
      case 'packing':
        message = tripContext?.destination
          ? `What should I pack for my trip to ${tripContext.destination}?`
          : 'Help me create a packing list';
        break;
      default:
        return;
    }

    setInputValue(message);
    // Auto-send
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsLoading(true);

    try {
      const context = tripContext
        ? {
            tripTitle: tripContext.title,
            destination: tripContext.destination,
            startDate: tripContext.startDate,
            endDate: tripContext.endDate,
            participants: tripContext.participants?.length,
          }
        : {};

      const response = await aiAPI.chat(message, context);
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to get AI response');
    } finally {
      setIsLoading(false);
      setInputValue('');
    }
  };

  const handleGenerateItinerary = async () => {
    if (!tripContext || !onGenerateItinerary || isLoading) return;

    setIsLoading(true);
    setMessages(prev => [
      ...prev,
      {
        role: 'user',
        content: `Generate a full itinerary for my trip to ${tripContext.destination}`,
      },
    ]);

    try {
      const response = await aiAPI.generate('itinerary', {
        destination: tripContext.destination,
        startDate: tripContext.startDate,
        endDate: tripContext.endDate,
        participants: tripContext.participants?.length,
      });

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: response.generatedText },
      ]);

      onGenerateItinerary(response.generatedText);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to generate itinerary');
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "I couldn't generate the itinerary. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessage = (content: string) => {
    // Simple formatting for bold and lists
    return content.split('\n').map((line, i) => {
      // Bold text **text**
      const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '$1');

      // Headers #
      if (line.startsWith('# ')) {
        return (
          <Text key={i} style={styles.messageHeader}>
            {line.slice(2)}
          </Text>
        );
      }
      // List items
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return (
          <Text key={i} style={styles.messageListItem}>
            {'  • ' + formattedLine.slice(2)}
          </Text>
        );
      }
      // Numbered list
      if (/^\d+\.\s/.test(line)) {
        return (
          <Text key={i} style={styles.messageListItem}>
            {'  ' + formattedLine}
          </Text>
        );
      }
      // Empty lines
      if (!line.trim()) {
        return <Text key={i}>{'\n'}</Text>;
      }
      // Regular text
      return (
        <Text key={i} style={styles.messageText}>
          {formattedLine}
        </Text>
      );
    });
  };

  const handleClose = () => {
    setMessages([]);
    setInputValue('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <LinearGradient
                colors={['#8B5CF6', '#3B82F6']}
                style={styles.avatarGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View>
                <Text style={styles.headerTitle}>Nostia AI</Text>
                <Text style={styles.headerSubtitle}>Travel Assistant</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Trip Context Banner */}
          {tripContext && (
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.2)', 'rgba(59, 130, 246, 0.2)']}
              style={styles.contextBanner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.contextItem}>
                <Ionicons name="location" size={14} color="#A78BFA" />
                <Text style={styles.contextText}>
                  {tripContext.destination || 'No destination'}
                </Text>
              </View>
              {tripContext.startDate && (
                <View style={styles.contextItem}>
                  <Ionicons name="calendar" size={14} color="#60A5FA" />
                  <Text style={styles.contextText}>
                    {tripContext.startDate} - {tripContext.endDate}
                  </Text>
                </View>
              )}
            </LinearGradient>
          )}

          {/* Quick Actions */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickActionsContainer}
            contentContainerStyle={styles.quickActionsContent}
          >
            <TouchableOpacity
              style={[styles.quickAction, styles.quickActionPurple]}
              onPress={() => handleQuickAction('itinerary')}
              disabled={isLoading}
            >
              <Ionicons name="list" size={14} color="#A78BFA" />
              <Text style={styles.quickActionTextPurple}>Create Itinerary</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, styles.quickActionBlue]}
              onPress={() => handleQuickAction('activities')}
              disabled={isLoading}
            >
              <Ionicons name="sparkles" size={14} color="#60A5FA" />
              <Text style={styles.quickActionTextBlue}>Activities</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, styles.quickActionGreen]}
              onPress={() => handleQuickAction('budget')}
              disabled={isLoading}
            >
              <Ionicons name="cash" size={14} color="#34D399" />
              <Text style={styles.quickActionTextGreen}>Budget Tips</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAction, styles.quickActionOrange]}
              onPress={() => handleQuickAction('packing')}
              disabled={isLoading}
            >
              <Ionicons name="briefcase" size={14} color="#FB923C" />
              <Text style={styles.quickActionTextOrange}>Packing List</Text>
            </TouchableOpacity>
            {tripContext && onGenerateItinerary && (
              <TouchableOpacity
                onPress={handleGenerateItinerary}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#3B82F6']}
                  style={styles.quickActionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="flash" size={14} color="#FFFFFF" />
                  <Text style={styles.quickActionTextWhite}>Full Itinerary</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.messageRow,
                  msg.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant,
                ]}
              >
                {msg.role === 'assistant' && (
                  <LinearGradient
                    colors={['#8B5CF6', '#3B82F6']}
                    style={styles.messageAvatar}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                  </LinearGradient>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  {formatMessage(msg.content)}
                </View>
                {msg.role === 'user' && (
                  <View style={styles.userAvatar}>
                    <Ionicons name="person" size={14} color="#FFFFFF" />
                  </View>
                )}
              </View>
            ))}

            {isLoading && (
              <View style={[styles.messageRow, styles.messageRowAssistant]}>
                <LinearGradient
                  colors={['#8B5CF6', '#3B82F6']}
                  style={styles.messageAvatar}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.assistantBubble}>
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#A78BFA" />
                    <Text style={styles.loadingText}>Thinking...</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ask me anything about your trip..."
              placeholderTextColor="#6B7280"
              value={inputValue}
              onChangeText={setInputValue}
              onSubmitEditing={handleSend}
              editable={!isLoading}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputValue.trim() || isLoading) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputValue.trim() || isLoading}
            >
              <Ionicons
                name="send"
                size={20}
                color={!inputValue.trim() || isLoading ? '#6B7280' : '#FFFFFF'}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  closeButton: {
    padding: 8,
  },
  contextBanner: {
    flexDirection: 'row',
    padding: 12,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  contextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contextText: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  quickActionsContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  quickActionsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  quickActionPurple: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  quickActionBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  quickActionGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  quickActionOrange: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  quickActionTextPurple: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '600',
  },
  quickActionTextBlue: {
    fontSize: 12,
    color: '#60A5FA',
    fontWeight: '600',
  },
  quickActionTextGreen: {
    fontSize: 12,
    color: '#34D399',
    fontWeight: '600',
  },
  quickActionTextOrange: {
    fontSize: 12,
    color: '#FB923C',
    fontWeight: '600',
  },
  quickActionTextWhite: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#1F2937',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#F3F4F6',
    lineHeight: 20,
  },
  messageHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 4,
  },
  messageListItem: {
    fontSize: 14,
    color: '#F3F4F6',
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    backgroundColor: '#111827',
  },
  input: {
    flex: 1,
    backgroundColor: '#1F2937',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
  },
});
