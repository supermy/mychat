import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { colors, typography } from '../theme';

interface MessageBubbleProps {
  content: string;
  isUser: boolean;
  isStreaming?: boolean;
}

export function MessageBubble({ content, isUser, isStreaming }: MessageBubbleProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? theme.userBubble : theme.assistantBubble,
          },
        ]}
      >
        <Text
          style={[
            styles.text,
            {
              color: isUser ? theme.userText : theme.assistantText,
            },
          ]}
        >
          {content}
          {isStreaming && <Text style={styles.cursor}>▌</Text>}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    marginHorizontal: 16,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  text: {
    ...typography.body,
    lineHeight: 24,
  },
  cursor: {
    fontWeight: '300',
  },
});
