import { QueryClient } from '@tanstack/react-query';

export const createOptimizedQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: { retry: 1 },
    },
  });
};

export const QUERY_KEYS = {
  notifications: ['notifications'],
  enrollments: ['enrollments'],
  myCourses: ['my-courses'],
  lessonProgress: ['lesson-progress'],
  courseProgress: ['course-progress'],
  unreadMessages: ['unread-messages'],
  courses: ['courses'],
  universities: ['universities'],
  colleges: ['colleges'],
  majors: ['majors'],
  lessons: ['lessons'],
  enrollmentCounts: ['enrollment-counts'],
} as const;

export const STALE_TIMES = {
  userSpecific: 2 * 60 * 1000,
  courses: 5 * 60 * 1000,
  universities: 30 * 60 * 1000,
  colleges: 30 * 60 * 1000,
  majors: 30 * 60 * 1000,
  counts: 1 * 60 * 1000,
} as const;
