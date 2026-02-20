import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useChat } from '../context/ChatContext';
import { colors, spacing, typography } from '../theme';
import { ApiConfig } from '../types';
import { testApiConnection } from '../services/api';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export function SettingsScreen() {
  const { state, updateApiConfig } = useChat();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [config, setConfig] = useState<ApiConfig>(state.apiConfig);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setConfig(state.apiConfig);
  }, [state.apiConfig]);

  const handleSave = async () => {
    try {
      await updateApiConfig(config);
      showAlert('成功', '配置已保存');
    } catch (error) {
      showAlert('错误', '保存配置失败');
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const success = await testApiConnection(config);
      if (success) {
        setTestResult({ success: true, message: '连接成功!' });
      } else {
        setTestResult({ success: false, message: '连接失败，请检查配置' });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: '错误: ' + (error instanceof Error ? error.message : '未知错误') 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const updateField = <K extends keyof ApiConfig>(field: K, value: ApiConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>API 配置</Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>服务器地址</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.baseUrl}
            onChangeText={value => updateField('baseUrl', value)}
            placeholder="http://localhost:11434/v1"
            placeholderTextColor={theme.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>API Key</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.apiKey}
            onChangeText={value => updateField('apiKey', value)}
            placeholder="ollama"
            placeholderTextColor={theme.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>模型名称</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.model}
            onChangeText={value => updateField('model', value)}
            placeholder="qwen3:0.6b"
            placeholderTextColor={theme.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>生成参数</Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Temperature: {config.temperature.toFixed(1)}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.temperature.toString()}
            onChangeText={value => {
              const num = parseFloat(value);
              if (!isNaN(num) && num >= 0 && num <= 2) {
                updateField('temperature', num);
              }
            }}
            placeholder="0.7"
            placeholderTextColor={theme.placeholder}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>最大Token数</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.maxTokens.toString()}
            onChangeText={value => {
              const num = parseInt(value);
              if (!isNaN(num) && num > 0) {
                updateField('maxTokens', num);
              }
            }}
            placeholder="2048"
            placeholderTextColor={theme.placeholder}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>系统提示词</Text>

        <View style={styles.field}>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            value={config.systemPrompt}
            onChangeText={value => updateField('systemPrompt', value)}
            placeholder="你是一个有帮助的AI助手。"
            placeholderTextColor={theme.placeholder}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </View>

      {testResult && (
        <View style={[
          styles.resultBox,
          { backgroundColor: testResult.success ? '#D4EDDA' : '#F8D7DA' }
        ]}>
          <Text style={[
            styles.resultText,
            { color: testResult.success ? '#155724' : '#721C24' }
          ]}>
            {testResult.message}
          </Text>
        </View>
      )}

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.testButton, { borderColor: theme.primary }]}
          onPress={handleTest}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.primary }]}>测试连接</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={handleSave}
        >
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>保存配置</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          MyChat v1.0.0
        </Text>
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          支持 OpenAI 兼容 API (Ollama, llama.cpp 等)
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    ...typography.subtitle,
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textArea: {
    ...typography.body,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 100,
  },
  resultBox: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
  },
  resultText: {
    ...typography.body,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  button: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  testButton: {
    borderWidth: 1,
  },
  saveButton: {},
  buttonText: {
    ...typography.subtitle,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
});
