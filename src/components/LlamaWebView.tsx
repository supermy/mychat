import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, typography } from '../theme';

interface LlamaWebViewProps {
  port: number;
  onClose: () => void;
}

export function LlamaWebView({ port, onClose }: LlamaWebViewProps) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webviewRef = useRef<any>(null);

  const url = `http://127.0.0.1:${port}`;

  useEffect(() => {
    // Set a timeout to hide loading after 3 seconds
    const timeout = setTimeout(() => {
      console.log('[WebView] Loading timeout, hiding loading screen');
      setLoading(false);
    }, 3000);

    // Test connection
    fetch(url)
      .then(response => {
        console.log('[WebView] Connection test successful:', response.status);
        clearTimeout(timeout);
        setLoading(false);
      })
      .catch(error => {
        console.error('[WebView] Connection test failed:', error);
        clearTimeout(timeout);
        setError(`无法连接到 ${url}`);
        setLoading(false);
      });

    return () => clearTimeout(timeout);
  }, [url]);

  const handleReload = () => {
    setError(null);
    setLoading(true);
    const webview = document.getElementById('llama-webview') as any;
    if (webview) {
      webview.src = url;
    }
    setTimeout(() => setLoading(false), 2000);
  };

  const handleGoBack = () => {
    const webview = document.getElementById('llama-webview') as any;
    if (webview && webview.canGoBack) {
      webview.goBack();
    }
  };

  const handleGoForward = () => {
    const webview = document.getElementById('llama-webview') as any;
    if (webview && webview.canGoForward) {
      webview.goForward();
    }
  };

  const handleOpenInBrowser = () => {
    require('electron').shell.openExternal(url);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>
          Llama.cpp Web UI - {url}
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleOpenInBrowser}
          >
            <Text style={[styles.headerButtonText, { color: theme.primary }]}>🌐</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleGoBack}
          >
            <Text style={[styles.headerButtonText, { color: theme.primary }]}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleGoForward}
          >
            <Text style={[styles.headerButtonText, { color: theme.primary }]}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleReload}
          >
            <Text style={[styles.headerButtonText, { color: theme.primary }]}>↻</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.closeButton, { color: theme.primary }]}>关闭</Text>
          </TouchableOpacity>
        </View>
      </View>

      <webview
        id="llama-webview"
        ref={webviewRef}
        style={{ 
          flex: 1, 
          display: error ? 'none' : 'flex',
          position: 'relative',
          zIndex: 0,
        }}
        src={url}
        allowpopups={true}
      />

      {loading && !error && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            加载中...
          </Text>
          <Text style={[styles.urlText, { color: theme.textSecondary }]}>
            {url}
          </Text>
          <Text style={[styles.hintText, { color: theme.textSecondary }]}>
            如果长时间未加载，请点击 🌈 在浏览器中打开
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.loadingContainer}>
          <View style={styles.errorContainer}>
            <Text style={[styles.errorTitle, { color: '#dc3545' }]}>
              ⚠️ 加载失败
            </Text>
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>
              {error}
            </Text>
            <Text style={[styles.urlText, { color: theme.textSecondary }]}>
              地址: {url}
            </Text>
            <Text style={[styles.hintText, { color: theme.textSecondary }]}>
              请确保模型服务已启动
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
              onPress={handleOpenInBrowser}
            >
              <Text style={styles.retryButtonText}>在浏览器中打开</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
  },
  title: {
    ...typography.subtitle,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    padding: spacing.xs,
    minWidth: 32,
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.sm,
  },
  urlText: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  hintText: {
    ...typography.caption,
    marginTop: spacing.sm,
    color: '#6c757d',
  },
  errorContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorTitle: {
    ...typography.subtitle,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
