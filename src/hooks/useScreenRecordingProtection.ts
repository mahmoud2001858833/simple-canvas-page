import { useState, useEffect, useCallback, useRef } from 'react';

interface ScreenRecordingProtectionResult {
  isRecording: boolean;
  isBlocked: boolean;
}

export const useScreenRecordingProtection = (enabled: boolean): ScreenRecordingProtectionResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameDropCountRef = useRef<number>(0);

  // Method 1: Detect using canvas fingerprinting timing
  // Screen recording software causes measurable performance drops
  const detectUsingCanvasTiming = useCallback(() => {
    if (!enabled) return false;
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      const startTime = performance.now();
      
      // Perform drawing operations that are slow when screen is being captured
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgb(${i * 5}, ${i * 5}, ${i * 5})`;
        ctx.fillRect(0, 0, 200, 200);
        ctx.getImageData(0, 0, 200, 200);
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // If execution takes unusually long, might indicate screen capture
      // Normal: 10-50ms, With recording: 100-500ms+
      if (executionTime > 150) {
        console.log('Possible screen recording detected via canvas timing:', executionTime);
        return true;
      }
      
      return false;
    } catch (e) {
      return false;
    }
  }, [enabled]);

  // Method 2: Frame rate monitoring - screen recording often causes frame drops
  const setupFrameRateMonitoring = useCallback(() => {
    if (!enabled) return;

    let frameCount = 0;
    let lastCheck = performance.now();

    const checkFrameRate = (timestamp: number) => {
      frameCount++;
      
      const elapsed = timestamp - lastCheck;
      
      if (elapsed >= 1000) {
        const fps = (frameCount * 1000) / elapsed;
        
        // Low FPS can indicate screen recording (normal is 60, recording might drop to 30 or lower)
        if (fps < 25 && fps > 0) {
          frameDropCountRef.current++;
          // Require multiple consecutive low FPS readings to avoid false positives
          if (frameDropCountRef.current >= 3) {
            console.log('Low FPS detected, possible screen recording:', fps);
            setIsRecording(true);
            setIsBlocked(true);
          }
        } else {
          frameDropCountRef.current = 0;
        }
        
        frameCount = 0;
        lastCheck = timestamp;
      }
      
      rafIdRef.current = requestAnimationFrame(checkFrameRate);
    };

    rafIdRef.current = requestAnimationFrame(checkFrameRate);
  }, [enabled]);

  // Method 3: Detect browser-level capture (works for browser-initiated captures)
  const detectBrowserCapture = useCallback(() => {
    if (!enabled) return;

    // Check if getDisplayMedia has active streams
    if (navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) {
      // Monitor for active display captures by checking if there are active video tracks
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const hasDisplayCapture = devices.some(device => 
          device.kind === 'videoinput' && 
          (device.label.toLowerCase().includes('screen') ||
           device.label.toLowerCase().includes('window') ||
           device.label.toLowerCase().includes('monitor') ||
           device.label.toLowerCase().includes('display') ||
           device.label.toLowerCase().includes('capture'))
        );
        
        if (hasDisplayCapture) {
          console.log('Display capture device detected');
          setIsRecording(true);
          setIsBlocked(true);
        }
      }).catch(() => {});
    }
  }, [enabled]);

  // Method 4: Check for Picture-in-Picture
  const checkPictureInPicture = useCallback(() => {
    if (!enabled) return false;
    if (document.pictureInPictureElement !== null) {
      console.log('Picture-in-Picture detected');
      return true;
    }
    return false;
  }, [enabled]);

  // Method 5: Detect DevTools (often used with recording)
  const detectDevTools = useCallback(() => {
    if (!enabled) return false;
    
    const threshold = 160;
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    // DevTools detection can be a sign of inspection/recording
    return widthThreshold || heightThreshold;
  }, [enabled]);

  // Method 6: Visibility API to detect when page loses focus
  const setupVisibilityMonitoring = useCallback(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      // If recording software takes focus, page might become hidden
      if (document.hidden) {
        // Store state - might be recording
        console.log('Page visibility changed - possible recording software interaction');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled]);

  // Method 7: MediaRecorder API hook - detect if any MediaRecorder is active
  const setupMediaRecorderHook = useCallback(() => {
    if (!enabled) return;

    // Override MediaRecorder to detect when it's used
    const OriginalMediaRecorder = window.MediaRecorder;
    if (OriginalMediaRecorder) {
      (window as any).__originalMediaRecorder = OriginalMediaRecorder;
      
      (window as any).MediaRecorder = class extends OriginalMediaRecorder {
        constructor(stream: MediaStream, options?: MediaRecorderOptions) {
          super(stream, options);
          
          // Check if this is capturing video (screen recording)
          const videoTracks = stream.getVideoTracks();
          if (videoTracks.length > 0) {
            console.log('MediaRecorder detected with video tracks');
            setIsRecording(true);
            setIsBlocked(true);
          }
        }
      };
    }
  }, [enabled]);

  // Main effect
  useEffect(() => {
    if (!enabled) {
      setIsRecording(false);
      setIsBlocked(false);
      return;
    }

    // Comprehensive check function
    const runDetection = () => {
      // Check PiP
      if (checkPictureInPicture()) {
        setIsRecording(true);
        setIsBlocked(true);
        return;
      }

      // Check canvas timing
      if (detectUsingCanvasTiming()) {
        setIsRecording(true);
        setIsBlocked(true);
        return;
      }

      // Check browser capture
      detectBrowserCapture();
    };

    // Initial check
    runDetection();

    // Setup frame rate monitoring
    setupFrameRateMonitoring();

    // Setup visibility monitoring
    const cleanupVisibility = setupVisibilityMonitoring();

    // Setup MediaRecorder hook
    setupMediaRecorderHook();

    // Periodic checks
    checkIntervalRef.current = setInterval(runDetection, 1500);

    // Listen for Picture-in-Picture events
    const handlePiPEnter = () => {
      if (enabled) {
        console.log('Picture-in-Picture entered');
        setIsRecording(true);
        setIsBlocked(true);
      }
    };

    const handlePiPLeave = () => {
      // Don't automatically unblock - require user acknowledgment
    };

    document.addEventListener('enterpictureinpicture', handlePiPEnter);
    document.addEventListener('leavepictureinpicture', handlePiPLeave);

    // Keyboard shortcuts detection
    const handleKeyDown = (e: KeyboardEvent) => {
      // Windows Game Bar (Win + G)
      if ((e.key === 'g' || e.key === 'G') && (e.metaKey || e.getModifierState('OS'))) {
        e.preventDefault();
        console.log('Windows Game Bar shortcut detected');
        setIsRecording(true);
        setIsBlocked(true);
      }
      
      // macOS Screen Recording (Cmd + Shift + 5)
      if (e.key === '5' && e.metaKey && e.shiftKey) {
        e.preventDefault();
        console.log('macOS screen recording shortcut detected');
        setIsRecording(true);
        setIsBlocked(true);
      }
      
      // Print Screen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        console.log('Print Screen detected');
        setIsRecording(true);
        setIsBlocked(true);
      }

      // Windows Screen Snipping (Win + Shift + S)
      if (e.key === 's' && e.shiftKey && (e.metaKey || e.getModifierState('OS'))) {
        e.preventDefault();
        console.log('Windows Snipping Tool shortcut detected');
        setIsRecording(true);
        setIsBlocked(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    // Cleanup
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      document.removeEventListener('enterpictureinpicture', handlePiPEnter);
      document.removeEventListener('leavepictureinpicture', handlePiPLeave);
      document.removeEventListener('keydown', handleKeyDown, true);
      if (cleanupVisibility) cleanupVisibility();
      
      // Restore original MediaRecorder
      if ((window as any).__originalMediaRecorder) {
        window.MediaRecorder = (window as any).__originalMediaRecorder;
      }
    };
  }, [
    enabled,
    checkPictureInPicture,
    detectUsingCanvasTiming,
    detectBrowserCapture,
    setupFrameRateMonitoring,
    setupVisibilityMonitoring,
    setupMediaRecorderHook
  ]);

  return { isRecording, isBlocked };
};

// Hook to get the video protection setting from platform_settings
export const useVideoProtectionSetting = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'video_recording_protection')
          .maybeSingle();
        
        if (!error && data) {
          setIsEnabled(data.value === 'true');
        }
      } catch (error) {
        console.error('Error fetching video protection setting:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSetting();
  }, []);

  return { isEnabled, isLoading };
};
