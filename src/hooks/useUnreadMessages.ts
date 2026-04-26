import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const fetchUnreadCount = async () => {
      // Get user's requests first
      const { data: requests } = await supabase
        .from('custom_course_requests')
        .select('id')
        .eq('user_id', user.id);

      if (!requests || requests.length === 0) {
        setUnreadCount(0);
        return;
      }

      const requestIds = requests.map(r => r.id);

      // Count unread messages
      const { count } = await supabase
        .from('request_messages')
        .select('*', { count: 'exact', head: true })
        .in('request_id', requestIds)
        .eq('is_read', false)
        .neq('sender_id', user.id);

      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    // Subscribe to new messages
    const channel = supabase
      .channel('unread-messages-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'request_messages',
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return unreadCount;
};
