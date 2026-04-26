import { useCallback, useEffect, useState } from 'react';

/**
 * Hook to generate and manage a unique device fingerprint.
 * Uses a combination of browser attributes to create a stable identifier.
 */
export const useDeviceFingerprint = () => {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  const generateFingerprint = useCallback(async (): Promise<string> => {
    const components: string[] = [];

    // User Agent
    components.push(navigator.userAgent);

    // Screen dimensions
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

    // Timezone
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Language
    components.push(navigator.language);

    // Platform
    components.push(navigator.platform);

    // Hardware concurrency
    components.push(String(navigator.hardwareConcurrency || 'unknown'));

    // Device memory (if available)
    const nav = navigator as any;
    if (nav.deviceMemory) {
      components.push(String(nav.deviceMemory));
    }

    // Canvas fingerprint
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 200;
        canvas.height = 50;
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('XBuild Device', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('XBuild Device', 4, 17);
        components.push(canvas.toDataURL());
      }
    } catch (e) {
      components.push('canvas-not-supported');
    }

    // WebGL info
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl && gl instanceof WebGLRenderingContext) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
          components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
        }
      }
    } catch (e) {
      components.push('webgl-not-supported');
    }

    // Generate hash using crypto.subtle
    const data = components.join('|||');
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (e) {
      // Fallback for environments without crypto.subtle
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16);
    }
  }, []);

  const getDeviceInfo = useCallback((): Record<string, any> => {
    const nav = navigator as any;
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
      deviceMemory: nav.deviceMemory || 'unknown',
      touchSupport: 'ontouchstart' in window,
      cookiesEnabled: navigator.cookieEnabled,
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      
      // Check for stored fingerprint first
      let storedFingerprint = localStorage.getItem('xbuild-device-fingerprint');
      
      if (!storedFingerprint) {
        // Generate new fingerprint
        storedFingerprint = await generateFingerprint();
        localStorage.setItem('xbuild-device-fingerprint', storedFingerprint);
      }
      
      setFingerprint(storedFingerprint);
      setDeviceInfo(getDeviceInfo());
      setIsLoading(false);
    };

    init();
  }, [generateFingerprint, getDeviceInfo]);

  const regenerateFingerprint = useCallback(async () => {
    const newFingerprint = await generateFingerprint();
    localStorage.setItem('xbuild-device-fingerprint', newFingerprint);
    setFingerprint(newFingerprint);
    return newFingerprint;
  }, [generateFingerprint]);

  return {
    fingerprint,
    deviceInfo,
    isLoading,
    regenerateFingerprint,
  };
};
