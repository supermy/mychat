import { useState, useEffect, useCallback } from 'react';
import { Dimensions, Platform, StyleSheet, DimensionValue } from 'react-native';

export function useResponsive() {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;
  const isDesktop = Platform.OS === 'web';
  const isTablet = width >= 768;
  const isLargeScreen = width >= 1024;
  const isSmallScreen = width < 600;

  const getResponsiveValue = useCallback(<T,>(values: {
    mobile?: T;
    tablet?: T;
    desktop?: T;
  }): T => {
    if (isLargeScreen && values.desktop !== undefined) {
      return values.desktop;
    }
    if (isTablet && values.tablet !== undefined) {
      return values.tablet;
    }
    return values.mobile as T;
  }, [isLargeScreen, isTablet]);

  const sidebarWidth = getResponsiveValue<number>({
    mobile: 0,
    tablet: 280,
    desktop: Math.min(320, width * 0.25),
  });

  const chatMaxWidth = getResponsiveValue<DimensionValue>({
    mobile: '100%',
    tablet: 600,
    desktop: Math.min(800, width - sidebarWidth - 100),
  });

  const messageMaxWidth = getResponsiveValue<DimensionValue>({
    mobile: '85%',
    tablet: '70%',
    desktop: '60%',
  });

  const layout = {
    maxWidth: 1200,
    sidebarWidth,
    chatMaxWidth,
    messageMaxWidth,
  };

  const layoutConfig = {
    showSidebar: isLargeScreen,
    useBottomTabs: !isLargeScreen,
    sidebarPosition: 'left' as const,
  };

  return {
    width,
    height,
    isDesktop,
    isTablet,
    isLargeScreen,
    isSmallScreen,
    getResponsiveValue,
    layout,
    layoutConfig,
  };
}

export const createResponsiveStyles = (layout: {
  maxWidth: number;
  sidebarWidth: number;
  chatMaxWidth: DimensionValue;
  messageMaxWidth: DimensionValue;
}) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      maxWidth: layout.maxWidth,
      width: '100%',
      alignSelf: 'center',
    },
    sidebarContainer: {
      width: layout.sidebarWidth,
      borderRightWidth: 1,
    },
    chatContainer: {
      flex: 1,
      maxWidth: layout.chatMaxWidth,
      alignSelf: 'center',
    },
    messageBubble: {
      maxWidth: layout.messageMaxWidth,
    },
  });
};
