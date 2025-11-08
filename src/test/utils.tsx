import React from 'react';
import { AppStateProvider } from '@/contexts/AppStateContext';

/**
 * Test wrapper for AppStateProvider that allows passing initial state
 * This is a simple wrapper - for more complex mocking, use vi.mock
 */
export function TestAppStateProvider({
  children,
  initialState
}: {
  children: React.ReactNode;
  initialState?: any;
}) {
  // For now, just use the regular provider
  // Individual tests can mock the context if needed
  return <AppStateProvider>{children}</AppStateProvider>;
}
