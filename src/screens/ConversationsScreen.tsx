import React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useChat } from '../context/ChatContext';
import { ConversationItem } from '../components/ConversationItem';
import { colors, spacing, typography } from '../theme';

function showAlert(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(
      title,
      message,
      [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: onConfirm },
      ]
    );
  }
}

export function ConversationsScreen() {
  const { state, createConversation, selectConversation, deleteConversation } = useChat();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const handleCreateConversation = () => {
    createConversation();
    (navigation as any).navigate('Chat');
  };

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    (navigation as any).navigate('Chat');
  };

  const handleDelete = (id: string, title: string) => {
    showAlert(
      '删除对话',
      `确定要删除"${title}"吗？`,
      () => deleteConversation(id)
    );
  };

  const renderItem = ({ item }: { item: typeof state.conversations[0] }) => (
    <ConversationItem
      title={item.title}
      updatedAt={item.updatedAt}
      isActive={item.id === state.currentConversationId}
      onPress={() => handleSelectConversation(item.id)}
      onDelete={() => handleDelete(item.id, item.title)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity
        style={[styles.newChatButton, { backgroundColor: theme.primary }]}
        onPress={handleCreateConversation}
      >
        <Text style={styles.newChatText}>+ 新对话</Text>
      </TouchableOpacity>

      <FlatList
        data={state.conversations}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              还没有对话
            </Text>
            <Text style={[styles.emptyHint, { color: theme.textSecondary }]}>
              点击上方按钮开始新对话
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  newChatButton: {
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  newChatText: {
    ...typography.subtitle,
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: spacing.xl * 3,
  },
  emptyText: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
  },
  emptyHint: {
    ...typography.caption,
  },
});
