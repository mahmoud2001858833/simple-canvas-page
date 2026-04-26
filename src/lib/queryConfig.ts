import { QueryClient } from '@tanstack/react-query';

/**
 * Optimized Query Client Configuration
 * Designed to handle 1000+ concurrent users efficiently
 */
export const createOptimizedQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Increase stale time to reduce refetches (10 minutes for static data)
        staleTime: 10 * 60 * 1000,
        // Cache time - keep data in cache for 30 minutes
        gcTime: 30 * 60 * 1000,
        // Retry configuration
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Don't refetch on window focus for performance
        refetchOnWindowFocus: false,
        // Refetch on reconnect
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  });
};

/**
 * Query key constants for consistent cache management
 */
export const QUERY_KEYS = {
  // User-specific (shorter cache)
  notifications: ['notifications'],
  enrollments: ['enrollments'],
  myCourses: ['my-courses'],
  lessonProgress: ['lesson-progress'],
  courseProgress: ['course-progress'],
  unreadMessages: ['unread-messages'],
  
  // Public data (longer cache)
  courses: ['courses'],
  universities: ['universities'],
  colleges: ['colleges'],
  majors: ['majors'],
  lessons: ['lessons'],
  enrollmentCounts: ['enrollment-counts'],
} as const;

/**
 * Stale time configurations by data type
 */
export const STALE_TIMES = {
  // User data - refresh more frequently
  userSpecific: 2 * 60 * 1000, // 2 minutes
  
  // Semi-static data
  courses: 5 * 60 * 1000, // 5 minutes
  
  // Static reference data
  universities: 30 * 60 * 1000, // 30 minutes
  colleges: 30 * 60 * 1000,
  majors: 30 * 60 * 1000,
  
  // Aggregated counts
  counts: 1 * 60 * 1000, // 1 minute
} as const;
