import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { VideoWatermark } from './VideoWatermark';
import { AlertTriangle, Eye, EyeOff, Maximize, Minimize } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedVideoPlayerProps {
  src: string;
  poster?: string;
  protectionEnabled: boolean;
  lessonId?: string;
  onTimeUpdate?: () => void;
  onLoadedMetadata?: () => void;
  onWaiting?: () => void;
  onCanPlay?: () => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
}

export interface ProtectedVideoPlayerRef {
  video: HTMLVideoElement | null;
  isBlurred: boolean;
}

export const ProtectedVideoPlayer = forwardRef<ProtectedVideoPlayerRef, ProtectedVideoPlayerProps>(({
  src,
  poster,
  protectionEnabled,
  lessonId,
  onTimeUpdate,
  onLoadedMetadata,
  onWaiting,
  onCanPlay,
  onEnded,
  onPlay,
  onPause,
  onContextMenu,
  className,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [isBlurred, setIsBlurred] = useState(false);
  const [blurReason, setBlurReason] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wasPlayingRef = useRef(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoggedAttemptRef = useRef<number>(0);

  // Function to log capture attempts to database
  const logCaptureAttempt = useCallback(async (attemptType: string, details?: Record<string, any>) => {
    if (!user || !protectionEnabled) return;
    
    // Throttle logging - only log once per 10 seconds per type
    const now = Date.now();
    if (now - lastLoggedAttemptRef.current < 10000) return;
    lastLoggedAttemptRef.current = now;

    try {
      const { error } = await supabase.from('screen_capture_attempts').insert({
        user_id: user.id,
        user_email: profile?.email || user.email,
        user_name: profile?.full_name || profile?.full_name_ar,
        lesson_id: lessonId || null,
        attempt_type: attemptType,
        details: details || {},
        user_agent: navigator.userAgent,
      });

      if (error) {
        console.error('Failed to log capture attempt:', error);
      } else {
        console.log('Screen capture attempt logged:', attemptType);
      }
    } catch (err) {
      console.error('Error logging capture attempt:', err);
    }
  }, [user, profile, lessonId, protectionEnabled]);

  // Handle fullscreen toggle - use container instead of video for watermark visibility
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    get video() { return videoRef.current; },
    isBlurred,
    toggleFullscreen,
  }));

  useEffect(() => {
    if (!protectionEnabled) {
      setIsBlurred(false);
      return;
    }

    // Blur when window loses focus
    const handleBlur = () => {
      if (protectionEnabled) {
        console.log('Window lost focus - applying blur');
        wasPlayingRef.current = videoRef.current ? !videoRef.current.paused : false;
        setIsBlurred(true);
        setBlurReason(isRTL ? 'يرجى العودة للنافذة' : 'Please return to window');
        
        // Log the attempt
        logCaptureAttempt('window_blur', { action: 'window_lost_focus' });
        
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      }
    };

    const handleFocus = () => {
      // Add delay before removing blur to prevent quick alt-tab recording
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      blurTimeoutRef.current = setTimeout(() => {
        setIsBlurred(false);
        setBlurReason('');
        if (wasPlayingRef.current && videoRef.current) {
          videoRef.current.play().catch(console.error);
        }
      }, 1000);
    };

    // Visibility change detection
    const handleVisibilityChange = () => {
      if (document.hidden && protectionEnabled) {
        console.log('Document hidden - applying blur');
        wasPlayingRef.current = videoRef.current ? !videoRef.current.paused : false;
        setIsBlurred(true);
        setBlurReason(isRTL ? 'الفيديو محمي' : 'Video protected');
        
        // Log the attempt
        logCaptureAttempt('visibility_change', { action: 'document_hidden' });
        
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      } else if (!document.hidden) {
        blurTimeoutRef.current = setTimeout(() => {
          setIsBlurred(false);
          setBlurReason('');
        }, 500);
      }
    };

    // Picture-in-Picture detection
    const handlePiPEnter = () => {
      if (protectionEnabled) {
        console.log('PiP detected - applying blur');
        setIsBlurred(true);
        setBlurReason(isRTL ? 'صورة داخل صورة غير مسموح' : 'Picture-in-Picture not allowed');
        
        // Log the attempt
        logCaptureAttempt('pip_attempt', { action: 'picture_in_picture' });
        
        // Exit PiP
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture().catch(console.error);
        }
      }
    };

    // Prevent keyboard shortcuts for recording
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!protectionEnabled) return;

      const isRecordingShortcut = 
        // Windows Game Bar
        ((e.key === 'g' || e.key === 'G') && (e.metaKey || e.getModifierState('OS'))) ||
        // macOS Recording
        (e.key === '5' && e.metaKey && e.shiftKey) ||
        // Print Screen
        e.key === 'PrintScreen' ||
        // Windows Snipping
        (e.key === 's' && e.shiftKey && (e.metaKey || e.getModifierState('OS')));

      if (isRecordingShortcut) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Recording shortcut blocked');
        setIsBlurred(true);
        setBlurReason(isRTL ? 'التسجيل غير مسموح' : 'Recording not allowed');
        
        // Log the keyboard shortcut attempt
        logCaptureAttempt('keyboard_shortcut', { 
          key: e.key, 
          metaKey: e.metaKey, 
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey 
        });
        
        setTimeout(() => {
          setIsBlurred(false);
          setBlurReason('');
        }, 3000);
      }
    };

    // Disable PiP on video element
    if (videoRef.current) {
      (videoRef.current as any).disablePictureInPicture = true;
    }

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('enterpictureinpicture', handlePiPEnter);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('enterpictureinpicture', handlePiPEnter);
      document.removeEventListener('keydown', handleKeyDown, true);
      
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, [protectionEnabled, isRTL, logCaptureAttempt]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full bg-black ${isFullscreen ? 'fullscreen-container' : ''}`}
      style={{
        // CSS protection against some screen recorders
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className={`${className} ${isBlurred ? 'blur-xl' : ''} transition-all duration-300 ${isFullscreen ? 'w-full h-full object-contain' : ''}`}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onWaiting={onWaiting}
        onCanPlay={onCanPlay}
        onEnded={onEnded}
        onPlay={onPlay}
        onPause={onPause}
        onContextMenu={onContextMenu}
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        playsInline
        style={{
          // Additional protection styles
          WebkitTouchCallout: 'none',
        }}
        // Prevent native fullscreen on video element - use container instead
        onDoubleClick={(e) => {
          e.preventDefault();
          toggleFullscreen();
        }}
      />

      {/* Watermark overlay - ALWAYS visible including fullscreen */}
      <VideoWatermark enabled={protectionEnabled} />
      
      {/* Fullscreen button removed - handled by parent controls bar */}

      {/* Blur overlay with message */}
      {isBlurred && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
          <div className="text-center p-6 max-w-md">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <EyeOff className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {isRTL ? 'الفيديو محمي' : 'Video Protected'}
            </h3>
            <p className="text-muted-foreground">
              {blurReason || (isRTL ? 'يرجى العودة للنافذة لمتابعة المشاهدة' : 'Please return to the window to continue watching')}
            </p>
            
            <div className="mt-4 flex items-center justify-center gap-2 text-yellow-500 text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>
                {isRTL ? 'هذا المحتوى محمي بحقوق الملكية' : 'This content is protected by copyright'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ProtectedVideoPlayer.displayName = 'ProtectedVideoPlayer';
