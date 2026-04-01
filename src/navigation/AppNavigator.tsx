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
import { ModelsScreen } from '../screens/ModelsScreen';
import { ZeroclawScreen } from '../screens/ZeroclawScreen';
import { CodexScreen } from '../screens/CodexScreen';
import { MainNavigator } from './MainNavigator';
import { colors, typography, spacing } from '../theme';
import { useResponsive } from '../utils/responsive';
import { useChat } from '../context/ChatContext';

const Stack = createNativeStackNavigator();

type TabType = 'chat' | 'models' | 'zeroclaw' | 'codex' | 'cloud';

function DesktopLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const { state, createConversation, selectConversation } = useChat();
  const { layout } = useResponsive();
  const [activeTab, setActiveTab] = useState<TabType>('models');

  const renderContent = () => {
    switch (activeTab) {
      case 'models':
        return <ModelsScreen />;
      case 'zeroclaw':
        return <ZeroclawScreen />;
      case 'codex':
        return <CodexScreen />;
      case 'cloud':
        return <SettingsScreen />;
      default:
        return <ChatScreen />;
    }
  };

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
              activeTab === 'models' && { backgroundColor: theme.background }
            ]}
            onPress={() => setActiveTab('models')}
          >
            <Text style={styles.footerIcon}>📦</Text>
            <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>本地模型</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.footerBtn,
              activeTab === 'zeroclaw' && { backgroundColor: theme.background }
            ]}
            onPress={() => setActiveTab('zeroclaw')}
          >
            <Text style={styles.footerIcon}>🌐</Text>
            <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>zeroclaw</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.footerBtn,
              activeTab === 'codex' && { backgroundColor: theme.background }
            ]}
            onPress={() => setActiveTab('codex')}
          >
            <Text style={styles.footerIcon}>🤖</Text>
            <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>codex</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.footerBtn,
              activeTab === 'cloud' && { backgroundColor: theme.background }
            ]}
            onPress={() => setActiveTab('cloud')}
          >
            <Text style={styles.footerIcon}>☁️</Text>
            <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>云端模型</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.desktopContent}>
        {renderContent()}
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
    borderRightWidth: 0,
    paddingTop: spacing.lg,
  },
  sidebarHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 0,
  },
  appTitle: {
    ...typography.title,
    marginBottom: spacing.lg,
  },
  newChatBtn: {
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  newChatBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  conversationList: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  convItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginHorizontal: spacing.sm,
    marginVertical: 4,
  },
  convTitle: {
    ...typography.body,
  },
  sidebarFooter: {
    padding: spacing.lg,
    borderTopWidth: 0,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    marginVertical: 4,
  },
  footerIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  footerLabel: {
    ...typography.body,
    fontWeight: '500',
  },
  desktopContent: {
    flex: 1,
  },
});
