import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type VideoQuality = 'auto' | '480p' | '720p' | '1080p';

interface UseBunnyVideoUrlOptions {
  lessonId: string | undefined;
  enabled?: boolean;
  preferredQuality?: VideoQuality;
}

interface UseBunnyVideoUrlResult {
  videoUrl: string | null;
  availableQualities: VideoQuality[];
  currentQuality: VideoQuality;
  setQuality: (quality: VideoQuality) => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  expiresIn: number | null;
}

/**
 * Validates that a URL is a proper Bunny CDN URL with token authentication
 */
function isValidSecureUrl(url: string): boolean {
  // Must be from CDN, not storage
  if (url.includes('storage.bunnycdn.com')) {
    console.error('[useBunnyVideoUrl] REJECTED: Storage URL detected');
    return false;
  }
  
  // Must have token and expires
  if (!url.includes('token=') || !url.includes('expires=')) {
    console.error('[useBunnyVideoUrl] REJECTED: Missing token or expires');
    return false;
  }
  
  // Must be from the correct CDN
  if (!url.includes('.b-cdn.net') && !url.includes('b-cdn.net')) {
    console.error('[useBunnyVideoUrl] REJECTED: Not a CDN URL');
    return false;
  }
  
  return true;
}

export const useBunnyVideoUrl = ({
  lessonId,
  enabled = true,
  preferredQuality = 'auto',
}: UseBunnyVideoUrlOptions): UseBunnyVideoUrlResult => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [availableQualities, setAvailableQualities] = useState<VideoQuality[]>(['auto']);
  const [currentQuality, setCurrentQuality] = useState<VideoQuality>(preferredQuality);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const isMountedRef = useRef(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSecureUrl = useCallback(async (quality: VideoQuality = currentQuality) => {
    if (!lessonId || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('[useBunnyVideoUrl] =================================');
      console.log('[useBunnyVideoUrl] Fetching secure URL for lesson:', lessonId, 'quality:', quality);

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('get-bunny-video-url', {
        body: { lessonId, quality },
      });

      if (fnError) {
        console.error('[useBunnyVideoUrl] Edge function error:', fnError);
        throw new Error(fnError.message || 'Failed to get video URL');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Validate the returned URL
      if (!data?.secureUrl) {
        throw new Error('No video URL returned from server');
      }

      // Validate URL is proper CDN URL with token
      if (!isValidSecureUrl(data.secureUrl)) {
        throw new Error('Invalid video URL - must be a secure CDN URL');
      }

      console.log('[useBunnyVideoUrl] ✅ Received valid secure URL');
      console.log('[useBunnyVideoUrl] Quality:', data.quality);
      console.log('[useBunnyVideoUrl] Available qualities:', data.availableQualities);
      console.log('[useBunnyVideoUrl] Expires in:', data.expiresIn, 'seconds');
      console.log('[useBunnyVideoUrl] URL (masked):', data.secureUrl.replace(/token=[^&]+/, 'token=***'));

      if (isMountedRef.current) {
        setVideoUrl(data.secureUrl);
        setAvailableQualities(data.availableQualities || ['auto']);
        setCurrentQuality(data.quality || quality);
        setExpiresIn(data.expiresIn);

        // Schedule refresh before expiration (2 minutes before)
        if (data.expiresIn && data.expiresIn > 120) {
          const refreshDelay = (data.expiresIn - 120) * 1000;
          
          if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
          }
          
          refreshTimeoutRef.current = setTimeout(() => {
            console.log('[useBunnyVideoUrl] Auto-refreshing URL before expiration');
            fetchSecureUrl(quality);
          }, refreshDelay);
        }
      }

      console.log('[useBunnyVideoUrl] =================================');
    } catch (err) {
      console.error('[useBunnyVideoUrl] Error:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setVideoUrl(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [lessonId, enabled, currentQuality]);

  // Fetch on mount and when lessonId changes
  useEffect(() => {
    isMountedRef.current = true;

    if (lessonId && enabled) {
      fetchSecureUrl(preferredQuality);
    }

    return () => {
      isMountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [lessonId, enabled]);

  // Handle quality change
  const handleSetQuality = useCallback((quality: VideoQuality) => {
    setCurrentQuality(quality);
    fetchSecureUrl(quality);
  }, [fetchSecureUrl]);

  return {
    videoUrl,
    availableQualities,
    currentQuality,
    setQuality: handleSetQuality,
    isLoading,
    error,
    refresh: () => fetchSecureUrl(currentQuality),
    expiresIn,
  };
};
