import { StyleSheet } from 'react-native';

export const colors = {
  light: {
    primary: '#5B8C5A',
    primaryLight: '#7DA67C',
    primaryDark: '#4A7349',
    accent: '#E8B4A0',
    accentLight: '#F2D4C8',
    background: '#FAFAF8',
    surface: '#FFFFFF',
    surfaceAlt: '#F5F5F2',
    text: '#2D3436',
    textSecondary: '#636E72',
    textTertiary: '#B2BEC3',
    border: '#E8E8E4',
    borderLight: '#F0F0EC',
    userBubble: '#5B8C5A',
    assistantBubble: '#F5F5F2',
    userText: '#FFFFFF',
    assistantText: '#2D3436',
    inputBackground: '#FFFFFF',
    placeholder: '#B2BEC3',
    success: '#5B8C5A',
    warning: '#F4A261',
    error: '#E76F51',
    info: '#6BA3BE',
    cardShadow: 'rgba(0, 0, 0, 0.04)',
  },
  dark: {
    primary: '#7DA67C',
    primaryLight: '#9FBC9E',
    primaryDark: '#5B8C5A',
    accent: '#E8B4A0',
    accentLight: '#F2D4C8',
    background: '#1A1A1A',
    surface: '#242424',
    surfaceAlt: '#2D2D2D',
    text: '#F5F5F2',
    textSecondary: '#A0A0A0',
    textTertiary: '#636363',
    border: '#333333',
    borderLight: '#2A2A2A',
    userBubble: '#5B8C5A',
    assistantBubble: '#2D2D2D',
    userText: '#FFFFFF',
    assistantText: '#F5F5F2',
    inputBackground: '#242424',
    placeholder: '#636363',
    success: '#7DA67C',
    warning: '#F4A261',
    error: '#E76F51',
    info: '#6BA3BE',
    cardShadow: 'rgba(0, 0, 0, 0.3)',
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
    padding: 20,
  },
  paddingVertical: {
    paddingVertical: 12,
  },
  paddingHorizontal: {
    paddingHorizontal: 20,
  },
  borderRadius: {
    borderRadius: 16,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
});

export const typography = {
  title: {
    fontSize: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '500' as const,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  label: {
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};
