/**
 * Color palette for OctoGo
 * Modern dark theme with purple brand colors matching the logo (#4E49BE)
 */

export const colors = {
  // Brand colors - Purple to match the octopus logo
  brand: {
    primary: '#4E49BE', // Main purple (exact logo color)
    secondary: '#5D58C9', // Slightly lighter purple
    accent: '#7B77D1', // Light purple accent
    orange: '#F97316', // Warning/pending states
    dark: '#3D3999', // Darker purple for pressed states
    light: '#6E6AD4', // Lighter variant for highlights
  },
  
  // Alias for Octopus branding
  octopus: {
    primary: '#4E49BE',
    secondary: '#5D58C9',
    accent: '#7B77D1',
  },

  // Background colors (dark theme)
  background: {
    primary: '#0D1117', // Deep dark
    secondary: '#161B22', // Card backgrounds
    tertiary: '#21262D', // Elevated surfaces
    elevated: '#30363D', // Highest elevation
  },

  // Text colors
  text: {
    primary: '#F0F6FC', // Primary text
    secondary: '#8B949E', // Secondary/muted text
    muted: '#8B949E', // Alias for secondary
    tertiary: '#6E7681', // Disabled/hint text
    subtle: '#6E7681', // Alias for tertiary
    inverse: '#0D1117', // Text on light backgrounds
  },

  // Border colors
  border: {
    default: '#30363D',
    muted: '#21262D',
    subtle: '#1A1F26',
    emphasis: '#8B949E',
  },

  // Status colors
  status: {
    success: '#22C55E', // Fresh green
    successDim: '#1A4D2E',
    warning: '#F97316',
    warningDim: '#4D3319',
    error: '#EF4444', // Bright red
    errorDim: '#4D1F1F',
    info: '#4E49BE', // Uses brand purple
    infoDim: '#1E1D3D',
    pending: '#7B77D1', // Light purple
    pendingDim: '#2A2952',
  },

  // Task state colors
  taskState: {
    Success: '#22C55E',
    Failed: '#EF4444',
    Executing: '#4E49BE',
    Queued: '#7B77D1',
    Canceled: '#8B949E',
    Cancelling: '#F97316',
    TimedOut: '#F97316',
  },

  // Health status colors
  healthStatus: {
    Healthy: '#22C55E',
    HasWarnings: '#F97316',
    Unhealthy: '#EF4444',
    Unavailable: '#8B949E',
    Unknown: '#6E7681',
  },

  // Interactive states (using #4E49BE = rgb(78, 73, 190))
  interactive: {
    hover: 'rgba(78, 73, 190, 0.1)',
    pressed: 'rgba(78, 73, 190, 0.2)',
    focus: 'rgba(78, 73, 190, 0.3)',
  },

  // Utility
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type Colors = typeof colors;

