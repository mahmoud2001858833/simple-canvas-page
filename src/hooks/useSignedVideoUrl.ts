import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseSignedVideoUrlOptions {
  lessonId: string | undefined;
  enabled?: boolean;
}

interface UseSignedVideoUrlResult {
  signedUrl: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isExternal: boolean;
}

export const useSignedVideoUrl = ({ 
  lessonId, 
  enabled = true 
}: UseSignedVideoUrlOptions): UseSignedVideoUrlResult => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExternal, setIsExternal] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  const fetchSignedUrl = useCallback(async () => {
    if (!lessonId || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-signed-video-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ lessonId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get video URL');
      }

      const data = await response.json();
      
      if (isMountedRef.current) {
        setSignedUrl(data.signedUrl);
        setIsExternal(data.isExternal || false);

        // Clear existing timeout
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }

        // Schedule refresh 30 seconds before expiry (if not external)
        if (!data.isExternal && data.expiresIn) {
          const refreshDelay = (data.expiresIn - 30) * 1000; // Refresh 30 seconds before expiry
          refreshTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              fetchSignedUrl();
            }
          }, Math.max(refreshDelay, 60000)); // At least 1 minute
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setSignedUrl(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [lessonId, enabled]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (lessonId && enabled) {
      fetchSignedUrl();
    }

    return () => {
      isMountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [lessonId, enabled, fetchSignedUrl]);

  return {
    signedUrl,
    isLoading,
    error,
    refresh: fetchSignedUrl,
    isExternal,
  };
};
