import { ExpoConfig, ConfigContext } from 'expo/config';

export default function config({ config }: ConfigContext): ExpoConfig {
  return {
    ...config,
    name: 'MyChat',
    slug: 'mychat',
    version: '1.0.0',
    orientation: 'default',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.mychat.app',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.mychat.app',
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
      output: 'single',
      name: 'MyChat',
      shortName: 'MyChat',
      description: 'AI聊天应用 - 支持本地llama.cpp推理',
      themeColor: '#007AFF',
      backgroundColor: '#ffffff',
      display: 'standalone',
      orientation: 'any',
      startUrl: '/',
      lang: 'zh-CN',
    },
    plugins: [],
  };
}
