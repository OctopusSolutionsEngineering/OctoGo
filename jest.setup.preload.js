// This file runs BEFORE any other modules load
// It mocks the Expo SDK 54 runtime to prevent import errors

// Mock the global __ExpoImportMetaRegistry
global.__ExpoImportMetaRegistry = new Map();

// Mock import.meta if it doesn't exist
if (typeof global.import === 'undefined') {
  global.import = {
    meta: {
      url: 'file://',
    },
  };
}

// Mock structuredClone if not available (for older Node versions)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

