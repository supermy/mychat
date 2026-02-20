import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, Theme } from '@react-navigation/native';
import { useColorScheme, Platform, View, StyleSheet } from 'react-native';
import { ChatProvider } from './src/context/ChatContext';
import { MainNavigator } from './src/navigation/MainNavigator';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/theme';

export default function App() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const navigationTheme: Theme = {
    dark: colorScheme === 'dark',
    colors: {
      primary: theme.primary,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: theme.border,
      notification: theme.primary,
    },
    fonts: {
      regular: { fontFamily: 'system-ui', fontWeight: '400' },
      medium: { fontFamily: 'system-ui', fontWeight: '500' },
      bold: { fontFamily: 'system-ui', fontWeight: '700' },
      heavy: { fontFamily: 'system-ui', fontWeight: '900' },
    },
  };

  if (Platform.OS === 'web') {
    return (
      <ChatProvider>
        <View style={styles.webContainer}>
          <NavigationContainer theme={navigationTheme}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <AppNavigator />
          </NavigationContainer>
        </View>
      </ChatProvider>
    );
  }

  return (
    <ChatProvider>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <MainNavigator />
      </NavigationContainer>
    </ChatProvider>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
