import { useUnifiedRealtime } from '@/hooks/useUnifiedRealtime';

/**
 * Unified Realtime Provider
 * Replaces multiple separate realtime providers with a single consolidated provider
 * Reduces connection overhead from ~6 channels per user to 2 channels
 */
export const UnifiedRealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  useUnifiedRealtime();
  return <>{children}</>;
};
