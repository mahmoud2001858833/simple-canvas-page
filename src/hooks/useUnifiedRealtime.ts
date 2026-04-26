import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Unified Realtime Hook
 * Consolidates 6 separate realtime channels into 2 unified channels
 * to reduce connection overhead from 6000 to 2000 for 1000 users
 */

// Debounce utility
const useDebounce = (callback: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

export function useUnifiedRealtime() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  // Notification handler
  const showNotification = useCallback((notification: {
    title: string;
    title_ar: string | null;
    message: string;
    message_ar: string | null;
    type: string | null;
  }) => {
    const title = language === 'ar' 
      ? (notification.title_ar || notification.title) 
      : notification.title;
    const message = language === 'ar' 
      ? (notification.message_ar || notification.message) 
      : notification.message;

    const toastType = notification.type || 'info';
    
    if (toastType === 'success') {
      toast.success(title, { description: message });
    } else if (toastType === 'error') {
      toast.error(title, { description: message });
    } else if (toastType === 'warning') {
      toast.warning(title, { description: message });
    } else {
      toast.info(title, { description: message });
    }
  }, [language]);

  const debouncedShowNotification = useDebounce(showNotification, 500);

  // Debounced query invalidation to prevent excessive refetches
  const debouncedInvalidate = useDebounce((queryKeys: string[][]) => {
    queryKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  }, 300);

  useEffect(() => {
    // Cleanup existing channels
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];

    // Channel 1: User-specific data (notifications, messages, enrollments)
    // Only subscribe if user is logged in
    if (user?.id) {
      const userChannel = supabase
        .channel('unified-user-channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
          },
          (payload) => {
            const notification = payload.new as {
              user_id: string;
              title: string;
              title_ar: string | null;
              message: string;
              message_ar: string | null;
              type: string | null;
            };
            // Client-side filter for current user
            if (notification.user_id === user.id) {
              debouncedShowNotification(notification);
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'request_messages',
          },
          () => {
            // Batch invalidate related queries
            debouncedInvalidate([
              ['unread-messages'],
              ['request-messages']
            ]);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'enrollments',
          },
          () => {
            debouncedInvalidate([
              ['enrollments'],
              ['enrollment-counts'],
              ['my-courses']
            ]);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lesson_progress',
          },
          () => {
            debouncedInvalidate([
              ['lesson-progress'],
              ['course-progress']
            ]);
          }
        )
        .subscribe();

      channelsRef.current.push(userChannel);
    }

    // Channel 2: Public data (courses, lessons) - shared by all users
    const publicChannel = supabase
      .channel('unified-public-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'courses',
        },
        () => {
          debouncedInvalidate([['courses']]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lessons',
        },
        () => {
          debouncedInvalidate([['lessons']]);
        }
      )
      .subscribe();

    channelsRef.current.push(publicChannel);

    return () => {
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [user?.id, debouncedShowNotification, debouncedInvalidate, queryClient]);
}
