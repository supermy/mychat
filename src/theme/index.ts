import { StyleSheet } from 'react-native';

export const colors = {
  light: {
    primary: '#007AFF',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E0E0E0',
    userBubble: '#007AFF',
    assistantBubble: '#F0F0F0',
    userText: '#FFFFFF',
    assistantText: '#000000',
    inputBackground: '#FFFFFF',
    placeholder: '#999999',
  },
  dark: {
    primary: '#0A84FF',
    background: '#000000',
    surface: '#1C1C1E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
    userBubble: '#0A84FF',
    assistantBubble: '#2C2C2E',
    userText: '#FFFFFF',
    assistantText: '#FFFFFF',
    inputBackground: '#1C1C1E',
    placeholder: '#636366',
  },
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  padding: {
    padding: 16,
  },
  paddingVertical: {
    paddingVertical: 8,
  },
  paddingHorizontal: {
    paddingHorizontal: 16,
  },
  borderRadius: {
    borderRadius: 12,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export const typography = {
  title: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
