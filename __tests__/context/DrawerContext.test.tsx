/**
 * Tests for DrawerContext
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { DrawerProvider, useDrawer } from '../../src/context/DrawerContext';

describe('DrawerContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DrawerProvider>{children}</DrawerProvider>
  );

  describe('useDrawer hook', () => {
    it('should throw if used outside DrawerProvider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useDrawer());
      }).toThrow('useDrawer must be used within a DrawerProvider');

      consoleSpy.mockRestore();
    });
  });

  it('should start with drawer closed', () => {
    const { result } = renderHook(() => useDrawer(), { wrapper });

    expect(result.current.isDrawerOpen).toBe(false);
  });

  it('should open the drawer', () => {
    const { result } = renderHook(() => useDrawer(), { wrapper });

    act(() => {
      result.current.openDrawer();
    });

    expect(result.current.isDrawerOpen).toBe(true);
  });

  it('should close the drawer', () => {
    const { result } = renderHook(() => useDrawer(), { wrapper });

    act(() => {
      result.current.openDrawer();
    });
    expect(result.current.isDrawerOpen).toBe(true);

    act(() => {
      result.current.closeDrawer();
    });

    expect(result.current.isDrawerOpen).toBe(false);
  });

  it('should stay closed when closeDrawer called while already closed', () => {
    const { result } = renderHook(() => useDrawer(), { wrapper });

    act(() => {
      result.current.closeDrawer();
    });

    expect(result.current.isDrawerOpen).toBe(false);
  });
});
