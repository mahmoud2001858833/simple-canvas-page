import { useRef, useEffect, useState } from 'react';
import { useScroll, useTransform, useSpring, MotionValue } from 'framer-motion';

interface UseParallaxOptions {
  offset?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  speed?: number;
  smoothness?: number;
}

export const useParallax = (
  distance: number = 100,
  options: UseParallaxOptions = {}
) => {
  const ref = useRef<HTMLDivElement>(null);
  const { direction = 'up', speed = 1, smoothness = 50 } = options;

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: [`start end`, `end start`],
  });

  // Apply smoothing to scroll progress
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: smoothness,
    damping: 20,
    mass: 0.5,
  });

  const adjustedDistance = distance * speed;

  const y = direction === 'up' || direction === 'down' 
    ? useTransform(
        smoothProgress, 
        [0, 1], 
        direction === 'up' ? [adjustedDistance, -adjustedDistance] : [-adjustedDistance, adjustedDistance]
      )
    : useTransform(smoothProgress, [0, 1], [0, 0]);

  const x = direction === 'left' || direction === 'right'
    ? useTransform(
        smoothProgress, 
        [0, 1], 
        direction === 'left' ? [adjustedDistance, -adjustedDistance] : [-adjustedDistance, adjustedDistance]
      )
    : useTransform(smoothProgress, [0, 1], [0, 0]);

  const opacity = useTransform(smoothProgress, [0, 0.15, 0.85, 1], [0.3, 1, 1, 0.3]);
  const scale = useTransform(smoothProgress, [0, 0.15, 0.85, 1], [0.95, 1, 1, 0.95]);
  const rotate = useTransform(smoothProgress, [0, 1], [-adjustedDistance / 20, adjustedDistance / 20]);

  return {
    ref,
    y,
    x,
    opacity,
    scale,
    rotate,
    scrollYProgress: smoothProgress,
  };
};

// Enhanced parallax layers with spring physics
export const useParallaxLayers = (smoothness: number = 80) => {
  const { scrollY } = useScroll();
  
  // Smooth scroll value
  const smoothScrollY = useSpring(scrollY, {
    stiffness: smoothness,
    damping: 25,
    mass: 0.5,
  });
  
  // Multiple layers with different speeds
  const layer1Y = useTransform(smoothScrollY, [0, 1000], [0, -200]);
  const layer2Y = useTransform(smoothScrollY, [0, 1000], [0, -120]);
  const layer3Y = useTransform(smoothScrollY, [0, 1000], [0, -60]);
  const layer4Y = useTransform(smoothScrollY, [0, 1000], [0, -30]);
  
  // Opacity layers
  const layer1Opacity = useTransform(smoothScrollY, [0, 400], [1, 0]);
  const layer2Opacity = useTransform(smoothScrollY, [0, 600], [1, 0.3]);
  const layer3Opacity = useTransform(smoothScrollY, [0, 800], [1, 0.5]);
  
  // Scale layers
  const layer1Scale = useTransform(smoothScrollY, [0, 500], [1, 0.9]);
  const layer2Scale = useTransform(smoothScrollY, [0, 500], [1, 0.95]);

  // Rotation for decorative elements
  const decorRotate = useTransform(smoothScrollY, [0, 2000], [0, 360]);
  
  return {
    scrollY: smoothScrollY,
    layer1Y,
    layer2Y,
    layer3Y,
    layer4Y,
    layer1Opacity,
    layer2Opacity,
    layer3Opacity,
    layer1Scale,
    layer2Scale,
    decorRotate,
  };
};

// Hook for scroll-based reveal animations
export const useScrollReveal = (threshold: number = 0.2) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold]);

  return { ref, isVisible };
};

// Hook for mouse parallax effect
export const useMouseParallax = (intensity: number = 20) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX - innerWidth / 2) / innerWidth * intensity;
      const y = (e.clientY - innerHeight / 2) / innerHeight * intensity;
      setMousePosition({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [intensity]);

  return mousePosition;
};

export default useParallax;
