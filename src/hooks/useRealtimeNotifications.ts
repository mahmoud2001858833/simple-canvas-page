import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

// Debounce utility for high-frequency updates
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

export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

  // Debounce notifications to prevent overwhelming users during high traffic
  const debouncedShowNotification = useDebounce(showNotification, 500);

  useEffect(() => {
    if (!user?.id) return;

    // Reuse existing channel if available
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Use a shared channel with client-side filtering
    const channel = supabase
      .channel('notifications-global')
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

          // Client-side filtering - only show notifications for current user
          if (notification.user_id === user.id) {
            debouncedShowNotification(notification);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, debouncedShowNotification]);
};
