import { useState, useRef, useEffect, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholderSrc?: string;
  blurAmount?: number;
  threshold?: number;
  rootMargin?: string;
  aspectRatio?: string;
  containerClassName?: string;
  onLoadComplete?: () => void;
}

const LazyImage = ({
  src,
  alt,
  placeholderSrc,
  blurAmount = 20,
  threshold = 0.1,
  rootMargin = '100px',
  aspectRatio,
  containerClassName,
  className,
  onLoadComplete,
  ...props
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc || '');
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate a simple color placeholder based on the image URL
  const generatePlaceholderColor = () => {
    const colors = [
      'hsl(210, 20%, 90%)',
      'hsl(210, 15%, 88%)',
      'hsl(200, 20%, 92%)',
      'hsl(220, 15%, 90%)',
    ];
    const index = src.length % colors.length;
    return colors[index];
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  useEffect(() => {
    if (isInView && src) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setCurrentSrc(src);
        setIsLoaded(true);
        onLoadComplete?.();
      };
      img.onerror = () => {
        // Keep placeholder on error
        console.warn(`Failed to load image: ${src}`);
      };
    }
  }, [isInView, src, onLoadComplete]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden',
        aspectRatio && `aspect-[${aspectRatio}]`,
        containerClassName
      )}
      style={{
        backgroundColor: !currentSrc ? generatePlaceholderColor() : undefined,
      }}
    >
      {/* Shimmer animation while loading */}
      {!isLoaded && (
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      )}

      {/* Placeholder or actual image */}
      {(currentSrc || isInView) && (
        <img
          ref={imgRef}
          src={currentSrc || src}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-all duration-500',
            !isLoaded && 'scale-105',
            isLoaded ? 'blur-0 opacity-100' : `blur-[${blurAmount}px] opacity-70`,
            className
          )}
          style={{
            filter: !isLoaded ? `blur(${blurAmount}px)` : 'blur(0)',
            transform: !isLoaded ? 'scale(1.05)' : 'scale(1)',
          }}
          loading="lazy"
          decoding="async"
          {...props}
        />
      )}

      {/* Loading indicator */}
      {isInView && !isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

// Skeleton placeholder component for images
export const ImageSkeleton = ({ 
  className,
  aspectRatio = '16/9',
}: { 
  className?: string;
  aspectRatio?: string;
}) => (
  <div 
    className={cn(
      'relative overflow-hidden bg-muted rounded-lg animate-pulse',
      className
    )}
    style={{ aspectRatio }}
  >
    <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  </div>
);

// Progressive image component with LQIP (Low Quality Image Placeholder)
export const ProgressiveImage = ({
  src,
  lowQualitySrc,
  alt,
  className,
  containerClassName,
  ...props
}: {
  src: string;
  lowQualitySrc?: string;
  alt: string;
  className?: string;
  containerClassName?: string;
} & ImgHTMLAttributes<HTMLImageElement>) => {
  const [highResLoaded, setHighResLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isInView) {
      const img = new Image();
      img.src = src;
      img.onload = () => setHighResLoaded(true);
    }
  }, [isInView, src]);

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', containerClassName)}>
      {/* Low quality placeholder */}
      {lowQualitySrc && (
        <img
          src={lowQualitySrc}
          alt={alt}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
            highResLoaded ? 'opacity-0' : 'opacity-100 blur-lg scale-105',
            className
          )}
          loading="eager"
          {...props}
        />
      )}

      {/* High quality image */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-500',
            highResLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          loading="lazy"
          decoding="async"
          {...props}
        />
      )}

      {/* Loading state */}
      {isInView && !highResLoaded && !lowQualitySrc && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default LazyImage;
