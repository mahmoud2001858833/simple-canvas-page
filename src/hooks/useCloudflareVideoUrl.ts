import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getProtectedStreamUrl } from '@/lib/videoStreamUrl';

interface UseCloudflareVideoUrlOptions {
  lessonId: string | undefined;
  enabled?: boolean;
}

interface UseCloudflareVideoUrlResult {
  videoUrl: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook to get video URL from Cloudflare Worker for a lesson
 * The video is served via streaming from Cloudflare R2 with Range Request support
 */
export const useCloudflareVideoUrl = ({
  lessonId,
  enabled = true,
}: UseCloudflareVideoUrlOptions): UseCloudflareVideoUrlResult => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideoUrl = useCallback(async () => {
    if (!lessonId || !enabled) {
      setVideoUrl(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch the lesson to get the video_key (stored in video_url field)
      const { data: lesson, error: fetchError } = await supabase
        .from('lessons')
        .select('video_url')
        .eq('id', lessonId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch lesson: ${fetchError.message}`);
      }

      if (!lesson?.video_url) {
        console.log('[useCloudflareVideoUrl] No video_url found for lesson:', lessonId);
        setVideoUrl(null);
        setIsLoading(false);
        return;
      }

      const videoKey = lesson.video_url;
      console.log('[useCloudflareVideoUrl] Video key from database:', videoKey);

      const finalUrl = getProtectedStreamUrl(videoKey);

      console.log('[useCloudflareVideoUrl] Protected stream URL generated:', finalUrl);
      setVideoUrl(finalUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useCloudflareVideoUrl] Error:', errorMessage);
      setError(errorMessage);
      setVideoUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, enabled]);

  useEffect(() => {
    fetchVideoUrl();
  }, [fetchVideoUrl]);

  const refresh = useCallback(() => {
    fetchVideoUrl();
  }, [fetchVideoUrl]);

  return {
    videoUrl,
    isLoading,
    error,
    refresh,
  };
};

export default useCloudflareVideoUrl;
