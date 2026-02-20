import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { colors, typography, spacing } from '../theme';

interface ConversationItemProps {
  title: string;
  updatedAt: number;
  isActive: boolean;
  onPress: () => void;
  onDelete: () => void;
}

export function ConversationItem({ title, updatedAt, isActive, onPress, onDelete }: ConversationItemProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const timeAgo = getTimeAgo(updatedAt);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isActive ? theme.surface : 'transparent',
          borderBottomColor: theme.border,
        },
      ]}
      onPress={onPress}
      onLongPress={onDelete}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{timeAgo}</Text>
      </View>
    </TouchableOpacity>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) {
    return '刚刚';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}分钟前`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}小时前`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}天前`;
  }

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
  },
});
