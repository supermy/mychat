import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChatScreen } from '../screens/ChatScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MainNavigator } from './MainNavigator';
import { colors, typography, spacing } from '../theme';
import { useResponsive } from '../utils/responsive';
import { useChat } from '../context/ChatContext';

const Stack = createNativeStackNavigator();

function DesktopLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const { state, createConversation, selectConversation } = useChat();
  const { layout } = useResponsive();
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');

  return (
    <View style={[styles.desktopContainer, { backgroundColor: theme.background }]}>
      <View style={[
        styles.desktopSidebar,
        {
          backgroundColor: theme.surface,
          borderRightColor: theme.border,
          width: layout.sidebarWidth,
        }
      ]}>
        <View style={styles.sidebarHeader}>
          <Text style={[styles.appTitle, { color: theme.text }]}>MyChat</Text>
          <TouchableOpacity
            style={[styles.newChatBtn, { backgroundColor: theme.primary }]}
            onPress={() => {
              createConversation();
              setActiveTab('chat');
            }}
          >
            <Text style={styles.newChatBtnText}>+ 新对话</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.conversationList}>
          {state.conversations.map((conv) => (
            <TouchableOpacity
              key={conv.id}
              style={[
                styles.convItem,
                state.currentConversationId === conv.id && { backgroundColor: theme.background }
              ]}
              onPress={() => {
                selectConversation(conv.id);
                setActiveTab('chat');
              }}
            >
              <Text style={[styles.convTitle, { color: theme.text }]} numberOfLines={1}>
                {conv.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sidebarFooter}>
          <TouchableOpacity
            style={[
              styles.footerBtn,
              activeTab === 'chat' && { backgroundColor: theme.background }
            ]}
            onPress={() => setActiveTab('chat')}
          >
            <Text style={styles.footerIcon}>💬</Text>
            <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>聊天</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.footerBtn,
              activeTab === 'settings' && { backgroundColor: theme.background }
            ]}
            onPress={() => setActiveTab('settings')}
          >
            <Text style={styles.footerIcon}>⚙️</Text>
            <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>设置</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.desktopContent}>
        {activeTab === 'settings' ? <SettingsScreen /> : <ChatScreen />}
      </View>
    </View>
  );
}

export function AppNavigator() {
  const { isLargeScreen } = useResponsive();

  if (isLargeScreen) {
    return <DesktopLayout />;
  }

  return <MainNavigator />;
}

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopSidebar: {
    borderRightWidth: 1,
    paddingTop: spacing.lg,
  },
  sidebarHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  appTitle: {
    ...typography.title,
    marginBottom: spacing.md,
  },
  newChatBtn: {
    padding: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  newChatBtnText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  conversationList: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  convItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 8,
    marginHorizontal: spacing.sm,
    marginVertical: 2,
  },
  convTitle: {
    ...typography.body,
  },
  sidebarFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 8,
  },
  footerIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  footerLabel: {
    ...typography.body,
  },
  desktopContent: {
    flex: 1,
  },
});
