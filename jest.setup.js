// Mock the Expo import.meta before anything else
global.__ExpoImportMetaRegistry = new Map();

// Mock expo modules
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when_unlocked_this_device_only',
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
    name: 'OctoGo',
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  Stack: {
    Screen: () => null,
  },
  Tabs: {
    Screen: () => null,
  },
  Link: ({ children }) => children,
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    default: {
      call: () => {},
      createAnimatedComponent: (component) => component,
      Value: jest.fn(),
      event: jest.fn(),
      add: jest.fn(),
      eq: jest.fn(),
      set: jest.fn(),
      cond: jest.fn(),
      interpolate: jest.fn(),
      View,
      Extrapolate: { CLAMP: 'clamp' },
      Transition: {
        Together: 'together',
        Out: 'out',
        In: 'in',
      },
      Easing: {
        linear: jest.fn(),
        ease: jest.fn(),
        bezier: () => jest.fn(),
      },
    },
    useAnimatedStyle: () => ({}),
    useSharedValue: (val) => ({ value: val }),
    withTiming: (val) => val,
    withSpring: (val) => val,
    useAnimatedScrollHandler: () => jest.fn(),
  };
});

// Silence console warnings in tests
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Animated') || 
     args[0].includes('useNativeDriver') ||
     args[0].includes('NativeEventEmitter'))
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Global test timeout
jest.setTimeout(10000);
