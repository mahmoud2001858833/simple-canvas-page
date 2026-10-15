import Hls from 'hls.js';
import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { VideoWatermark } from './VideoWatermark';
import { VideoIntro } from './VideoIntro';
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
  /** عنوان الدرس الذي يُكتب تلقائياً على مقدمة الفيديو */
  introTitle?: string;
  introSubtitle?: string;
  /** اسم المعلم الذي يظهر على لوح المقدمة */
  introInstructor?: string;
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
  introTitle,
  introSubtitle,
  introInstructor,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [isBlurred, setIsBlurred] = useState(false);
  const [blurReason, setBlurReason] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const introPlayedRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoggedAttemptRef = useRef<number>(0);

  // Function to record video view accurately in video_access_logs
  const recordVideoView = useCallback(async () => {
    if (!user?.id || !lessonId) return;

    // Deduplicate within 15 minutes per lesson
    const sessionKey = `view_logged_${lessonId}`;
    const lastTime = sessionStorage.getItem(sessionKey);
    const now = Date.now();
    if (lastTime && now - parseInt(lastTime, 10) < 15 * 60 * 1000) {
      return;
    }

    try {
      sessionStorage.setItem(sessionKey, now.toString());
      await supabase.from('video_access_logs').insert({
        lesson_id: lessonId,
        user_id: user.id,
        user_agent: navigator.userAgent,
        accessed_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to record video view:', err);
    }
  }, [user?.id, lessonId]);

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

    // Prevent keyboard shortcuts for recording, saving, or inspecting
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
        ((e.key === 's' || e.key === 'S') && e.shiftKey && (e.metaKey || e.getModifierState('OS')));

      const isSaveOrInspectShortcut =
        // Ctrl+S / Cmd+S (Save page/video)
        ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey) && !e.shiftKey) ||
        // Ctrl+U / Cmd+U (View source)
        ((e.key === 'u' || e.key === 'U') && (e.ctrlKey || e.metaKey)) ||
        // F12 (DevTools)
        e.key === 'F12' ||
        // Ctrl+Shift+I / Cmd+Option+I (Inspect)
        ((e.key === 'i' || e.key === 'I') && (e.ctrlKey || e.metaKey) && (e.shiftKey || e.altKey)) ||
        // Ctrl+Shift+J / Cmd+Option+J (Console)
        ((e.key === 'j' || e.key === 'J') && (e.ctrlKey || e.metaKey) && (e.shiftKey || e.altKey)) ||
        // Ctrl+Shift+C / Cmd+Option+C (Element picker)
        ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey) && e.shiftKey);

      if (isRecordingShortcut || isSaveOrInspectShortcut) {
        e.preventDefault();
        e.stopPropagation();
        console.warn('Blocked unauthorized capture/download shortcut:', e.key);
        setIsBlurred(true);
        setBlurReason(
          isSaveOrInspectShortcut
            ? (isRTL ? 'حفظ الفيديو أو فحصه غير مسموح' : 'Saving or inspecting video is not allowed')
            : (isRTL ? 'التسجيل غير مسموح' : 'Recording not allowed')
        );
        
        // Log the shortcut attempt
        logCaptureAttempt(isSaveOrInspectShortcut ? 'save_or_inspect_attempt' : 'keyboard_shortcut', { 
          key: e.key, 
          metaKey: e.metaKey, 
          shiftKey: e.shiftKey, 
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
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

  const shadowHostRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  // 1. Closed Shadow DOM: completely hide the video element from browser extensions (IDM cannot find <video>)
  useEffect(() => {
    const host = shadowHostRef.current;
    if (!host) return;

    if (!shadowRootRef.current) {
      try {
        shadowRootRef.current = host.attachShadow({ mode: 'closed' });
      } catch {
        // Fallback or already attached
      }
    }

    const shadow = shadowRootRef.current;
    if (!shadow) return;

    let video = videoRef.current;
    if (!video) {
      const style = document.createElement('style');
      style.textContent = `
        :host { display: block; width: 100%; height: 100%; }
        video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          pointer-events: none;
          -webkit-user-select: none;
          user-select: none;
          transition: filter 0.3s ease;
        }
        video::-webkit-media-controls { display: none !important; }
        video::-webkit-media-controls-enclosure { display: none !important; }
        video::-internal-media-controls-download-button { display: none !important; }
      `;
      shadow.appendChild(style);

      video = document.createElement('video');
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('disablepictureinpicture', 'true');
      video.setAttribute('controlslist', 'nodownload noplaybackrate');
      (video as any).disablePictureInPicture = true;

      // Mask video.currentSrc getter so extension scrapers cannot read stream URL
      try {
        Object.defineProperty(video, 'currentSrc', { get: () => '', configurable: true });
      } catch {}

      try {
        const origGetAttr = video.getAttribute.bind(video);
        video.getAttribute = (name: string) => {
          if (name.toLowerCase() === 'src') return '';
          return origGetAttr(name);
        };
      } catch {}

      shadow.appendChild(video);
      videoRef.current = video;
    }

    if (poster && video.poster !== poster) {
      video.poster = poster;
    }
    if (!src) return;
    const isHls = src.includes(".m3u8") || src.includes("/hls/");
    if (isHls) {
      if (Hls.isSupported()) {
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(src);
        hls.attachMedia(video);
        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        if (video.src !== src) video.src = src;
      }
    } else {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (video.src !== src) video.src = src;
    }
    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [src, poster]);

  // 2. Sync blur state to video in shadow DOM
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.style.filter = isBlurred ? 'blur(20px)' : 'none';
    }
  }, [isBlurred]);

  // 3. Attach video event listeners to shadow DOM video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTime = () => onTimeUpdate?.();
    const handleMeta = () => onLoadedMetadata?.();
    const handleWait = () => onWaiting?.();
    const handleCan = () => onCanPlay?.();
    const handleEnd = () => onEnded?.();
    const handleP = () => onPause?.();
    const handlePl = () => {
      recordVideoView();
      if (introTitle && !introPlayedRef.current) {
        introPlayedRef.current = true;
        video.pause();
        setShowIntro(true);
        return;
      }
      onPlay?.();
    };

    video.addEventListener('timeupdate', handleTime);
    video.addEventListener('loadedmetadata', handleMeta);
    video.addEventListener('waiting', handleWait);
    video.addEventListener('canplay', handleCan);
    video.addEventListener('ended', handleEnd);
    video.addEventListener('pause', handleP);
    video.addEventListener('play', handlePl);

    return () => {
      video.removeEventListener('timeupdate', handleTime);
      video.removeEventListener('loadedmetadata', handleMeta);
      video.removeEventListener('waiting', handleWait);
      video.removeEventListener('canplay', handleCan);
      video.removeEventListener('ended', handleEnd);
      video.removeEventListener('pause', handleP);
      video.removeEventListener('play', handlePl);
    };
  }, [onTimeUpdate, onLoadedMetadata, onWaiting, onCanPlay, onEnded, onPause, onPlay, recordVideoView, introTitle]);

  // 4. Aggressive Anti-IDM Shield: CSS rule injection + Real-time DOM text & element purging
  useEffect(() => {
    const styleId = 'anti-idm-global-shield';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        [id*="idm" i],
        [class*="idm" i],
        [data-idm-version],
        [id*="IDM"],
        [class*="IDM"],
        div[style*="2147483647"],
        div[style*="z-index: 2147483647"],
        div[style*="z-index:2147483647"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          position: fixed !important;
          top: -99999px !important;
          left: -99999px !important;
          width: 0 !important;
          height: 0 !important;
          max-width: 0 !important;
          max-height: 0 !important;
          clip: rect(0, 0, 0, 0) !important;
          z-index: -99999 !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    const purgeIdmWidgets = () => {
      try {
        const allElements = document.querySelectorAll('*');
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i] as HTMLElement;
          if (!el || el === document.body || el === document.documentElement || el === containerRef.current) continue;
          if (containerRef.current?.contains(el)) continue;

          const text = (el.textContent || '').trim();
          const id = (el.id || '').toLowerCase();
          const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
          const zIndex = window.getComputedStyle(el).zIndex;

          const isIdmText = 
            text.includes('Download this video') || 
            text.includes('تحميل هذا الفيديو') || 
            (text.includes('IDM') && text.includes('MP4 file')) ||
            (text.includes('IDM') && text.includes('Download'));

          const isIdmAttribute = 
            id.includes('idm') || 
            cls.includes('idm') || 
            el.hasAttribute('data-idm-version');

          const isExtremeZIndex = zIndex && parseInt(zIndex, 10) >= 2000000000;

          if (isIdmText || isIdmAttribute || isExtremeZIndex) {
            console.warn('[Anti-IDM] Removed unauthorized download widget:', el);
            el.remove();
          }
        }
      } catch {}
    };

    const observer = new MutationObserver(() => {
      purgeIdmWidgets();
    });

    try {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch {}

    const interval = setInterval(purgeIdmWidgets, 150);
    purgeIdmWidgets();

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full bg-black select-none ${isFullscreen ? 'fullscreen-container' : ''}`}
      style={{
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        toggleFullscreen();
      }}
    >
      {/* Video Host with Closed Shadow DOM - 100% invisible to browser extension DOM queries */}
      <div 
        ref={shadowHostRef} 
        className={`w-full h-full ${className} ${isFullscreen ? 'w-full h-full' : ''}`}
        style={{ pointerEvents: 'none' }}
      />

      {/* المقدمة التلقائية مع عنوان الدرس */}
      {showIntro && introTitle && (
        <VideoIntro
          title={introTitle}
          subtitle={introSubtitle}
          instructor={introInstructor}
          onFinish={() => {
            setShowIntro(false);
            videoRef.current?.play().catch(() => {});
          }}
        />
      )}

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
