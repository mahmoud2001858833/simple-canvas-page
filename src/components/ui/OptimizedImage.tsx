import React from 'react';

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  webpSrc?: string;
  avifSrc?: string;
  alt: string;
  width: number | string;
  height: number | string;
  priority?: boolean;
  className?: string;
}

/**
 * OptimizedImage Component
 * Designed to satisfy Google PageSpeed Insights & Core Web Vitals:
 * - Eliminates Cumulative Layout Shift (CLS) with explicit width & height
 * - Enhances Largest Contentful Paint (LCP) with priority/fetchpriority="high"
 * - Supports modern image formats (AVIF -> WebP -> Fallback) via <picture>
 * - Offloads image decoding via decoding="async"
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  webpSrc,
  avifSrc,
  alt,
  width,
  height,
  priority = false,
  className = '',
  loading,
  decoding = 'async',
  ...rest
}) => {
  const computedLoading = priority ? 'eager' : (loading || 'lazy');
  const computedFetchPriority = priority ? 'high' : undefined;

  const aspectRatioStyle = (width && height) ? { aspectRatio: `${width} / ${height}` } : undefined;

  if (avifSrc || webpSrc) {
    return (
      <picture className="inline-block w-full h-full">
        {avifSrc && <source srcSet={avifSrc} type="image/avif" />}
        {webpSrc && <source srcSet={webpSrc} type="image/webp" />}
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={computedLoading}
          decoding={decoding}
          // @ts-expect-error React 18 / DOM fetchPriority attribute support
          fetchpriority={computedFetchPriority}
          className={className}
          style={{ ...aspectRatioStyle, ...rest.style }}
          {...rest}
        />
      </picture>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={computedLoading}
      decoding={decoding}
      // @ts-expect-error React 18 / DOM fetchPriority attribute support
      fetchpriority={computedFetchPriority}
      className={className}
      style={{ ...aspectRatioStyle, ...rest.style }}
      {...rest}
    />
  );
};

export default OptimizedImage;
