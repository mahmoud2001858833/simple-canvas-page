import { useCallback } from 'react';

interface SmoothScrollOptions {
  offset?: number;
  duration?: number;
  easing?: 'easeInOut' | 'easeOut' | 'easeIn' | 'linear';
}

// Custom easing functions
const easingFunctions = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
};

export const useSmoothScroll = () => {
  const scrollToElement = useCallback((
    elementId: string,
    options: SmoothScrollOptions = {}
  ) => {
    const { offset = -80, duration = 800, easing = 'easeInOut' } = options;
    const element = document.getElementById(elementId);
    
    if (!element) return;

    const start = window.scrollY;
    const targetPosition = element.getBoundingClientRect().top + window.scrollY + offset;
    const distance = targetPosition - start;
    const startTime = performance.now();
    const easingFunc = easingFunctions[easing];

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easingFunc(progress);

      window.scrollTo(0, start + distance * easedProgress);

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  }, []);

  const scrollToTop = useCallback((options: SmoothScrollOptions = {}) => {
    const { duration = 600, easing = 'easeOut' } = options;
    const start = window.scrollY;
    const startTime = performance.now();
    const easingFunc = easingFunctions[easing];

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easingFunc(progress);

      window.scrollTo(0, start * (1 - easedProgress));

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  }, []);

  return { scrollToElement, scrollToTop };
};

export default useSmoothScroll;
