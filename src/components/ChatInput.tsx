import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Platform,
  Keyboard,
} from 'react-native';
import { colors, spacing } from '../theme';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<TextInput>(null);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: any) => {
    if (Platform.OS === 'web') {
      const event = e.nativeEvent as KeyboardEvent;
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
      <View style={[styles.inputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: theme.text }]}
          placeholder="输入消息... (Ctrl+Enter 发送)"
          placeholderTextColor={theme.placeholder}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={4000}
          editable={!isLoading}
          onKeyPress={handleKeyDown}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: message.trim() ? theme.primary : theme.border },
          ]}
          onPress={handleSend}
          disabled={!message.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.userText} />
          ) : (
            <View style={styles.sendIcon}>
              <View style={[styles.sendIconArrow, { borderBottomColor: theme.userText }]} />
              <View style={[styles.sendIconLine, { backgroundColor: theme.userText }]} />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 24,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  sendIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIconArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '90deg' }],
  },
  sendIconLine: {
    width: 2,
    height: 8,
    marginTop: -2,
  },
});
