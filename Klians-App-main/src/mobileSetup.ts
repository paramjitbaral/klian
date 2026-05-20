import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';

export const initMobileFeatures = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Allow status bar overlay so that the status bar floats beautifully over the background of our app
    await StatusBar.setOverlaysWebView({ overlay: true });
    
    // Set dynamic style depending on the current HTML theme class
    const isDark = window.document.documentElement.classList.contains('dark');
    await StatusBar.setStyle({
      style: isDark ? Style.Dark : Style.Light
    });

    // Native Keyboard settings to handle layout pushes perfectly
    await Keyboard.setScroll({ isDisabled: false });
  } catch (error) {
    console.error('Failed to initialize Capacitor mobile features:', error);
  }
};

export const updateMobileTheme = async (theme: 'light' | 'dark') => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({
      style: theme === 'dark' ? Style.Dark : Style.Light
    });
  } catch (error) {
    console.error('Failed to update Capacitor mobile theme:', error);
  }
};
