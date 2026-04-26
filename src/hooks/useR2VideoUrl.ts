import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// R2 Video API - supports both upload (PUT) and read (GET)
const R2_VIDEO_API = 'https://ancient-king-9e42.mhawish-alaa.workers.dev';

export type VideoQuality = 'auto' | '480p' | '720p' | '1080p';

interface UseR2VideoUrlOptions {
  lessonId: string | undefined;
  enabled?: boolean;
  preferredQuality?: VideoQuality;
}

interface VideoUrls {
  default: string | null;
  '480p': string | null;
  '720p': string | null;
  '1080p': string | null;
}

interface UseR2VideoUrlResult {
  videoUrl: string | null;
  availableQualities: VideoQuality[];
  currentQuality: VideoQuality;
  setQuality: (quality: VideoQuality) => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isR2Video: boolean;
}

export const useR2VideoUrl = ({ 
  lessonId, 
  enabled = true,
  preferredQuality = 'auto'
}: UseR2VideoUrlOptions): UseR2VideoUrlResult => {
  const [videoUrls, setVideoUrls] = useState<VideoUrls>({
    default: null,
    '480p': null,
    '720p': null,
    '1080p': null,
  });
  const [currentQuality, setCurrentQuality] = useState<VideoQuality>(preferredQuality);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isR2Video, setIsR2Video] = useState(false);
  const isMountedRef = useRef(true);

  const buildR2Url = (path: string): string => {
    return `${R2_VIDEO_API}?key=${encodeURIComponent(path)}`;
  };

  const fetchVideoUrl = useCallback(async () => {
    if (!lessonId || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch lesson details to get video_url and quality variants
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('video_url, video_url_480p, video_url_720p, video_url_1080p, is_preview, course_id')
        .eq('id', lessonId)
        .single();

      if (lessonError) {
        console.error('[useR2VideoUrl] Lesson fetch error:', lessonError);
        throw new Error('Failed to fetch lesson');
      }
      
      console.log('[useR2VideoUrl] Lesson data:', lesson);
      
      const urls: VideoUrls = {
        default: null,
        '480p': null,
        '720p': null,
        '1080p': null,
      };

      // Process each quality variant
      const processUrl = (url: string | null | undefined): string | null => {
        if (!url || url.trim() === '') return null;
        // If already a full URL, return as-is
        if (url.startsWith('http')) return url;
        // Build R2 URL
        const r2Url = buildR2Url(url);
        console.log('[useR2VideoUrl] Built R2 URL:', r2Url, 'from path:', url);
        return r2Url;
      };

      urls.default = processUrl(lesson?.video_url);
      urls['480p'] = processUrl(lesson?.video_url_480p);
      urls['720p'] = processUrl(lesson?.video_url_720p);
      urls['1080p'] = processUrl(lesson?.video_url_1080p);

      console.log('[useR2VideoUrl] Processed URLs:', urls);

      // Determine if it's R2 video
      const hasR2 = lesson?.video_url && !lesson.video_url.startsWith('http');
      
      if (isMountedRef.current) {
        setVideoUrls(urls);
        setIsR2Video(hasR2 || false);
      }
    } catch (err) {
      console.error('[useR2VideoUrl] Error:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setVideoUrls({ default: null, '480p': null, '720p': null, '1080p': null });
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
      fetchVideoUrl();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [lessonId, enabled, fetchVideoUrl]);

  // Determine available qualities
  const availableQualities: VideoQuality[] = ['auto'];
  if (videoUrls['480p']) availableQualities.push('480p');
  if (videoUrls['720p']) availableQualities.push('720p');
  if (videoUrls['1080p']) availableQualities.push('1080p');

  // Get the current video URL based on selected quality
  const getVideoUrl = (): string | null => {
    if (currentQuality === 'auto' || currentQuality === '1080p') {
      // Auto: prefer highest quality available
      return videoUrls['1080p'] || videoUrls['720p'] || videoUrls['480p'] || videoUrls.default;
    }
    if (currentQuality === '720p') {
      return videoUrls['720p'] || videoUrls['480p'] || videoUrls.default;
    }
    if (currentQuality === '480p') {
      return videoUrls['480p'] || videoUrls.default;
    }
    return videoUrls.default;
  };

  return {
    videoUrl: getVideoUrl(),
    availableQualities,
    currentQuality,
    setQuality: setCurrentQuality,
    isLoading,
    error,
    refresh: fetchVideoUrl,
    isR2Video,
  };
};
