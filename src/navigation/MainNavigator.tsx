import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ChatScreen } from '../screens/ChatScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ModelsScreen } from '../screens/ModelsScreen';
import { ZeroclawScreen } from '../screens/ZeroclawScreen';
import { colors, typography } from '../theme';

const Tab = createBottomTabNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const icons: { [key: string]: string } = {
    Chat: '💬',
    Models: '📦',
    Zeroclaw: '🌐',
    Cloud: '☁️',
  };

  return (
    <View style={styles.iconContainer}>
      <Text style={styles.icon}>{icons[name]}</Text>
    </View>
  );
}

export function MainNavigator() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  return (
    <Tab.Navigator
      initialRouteName="Models"
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTitleStyle: {
          ...typography.title,
          color: theme.text,
        },
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: {
          ...typography.small,
        },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: '聊天', headerShown: false }}
      />
      <Tab.Screen
        name="Zeroclaw"
        component={ZeroclawScreen}
        options={{ title: 'zeroclaw' }}
      />
      <Tab.Screen
        name="Models"
        component={ModelsScreen}
        options={{ title: '本地模型' }}
      />
      <Tab.Screen
        name="Cloud"
        component={SettingsScreen}
        options={{ title: '云端模型' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
});
