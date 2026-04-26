import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

export const useWishlist = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const isRTL = language === 'ar';

  const { data: wishlistIds = [] } = useQuery({
    queryKey: ['wishlist', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('wishlist' as any)
        .select('course_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data || []).map((w: any) => w.course_id as string);
    },
    enabled: !!user,
  });

  const toggleWishlist = useMutation({
    mutationFn: async (courseId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const isInWishlist = wishlistIds.includes(courseId);
      
      if (isInWishlist) {
        const { error } = await supabase
          .from('wishlist' as any)
          .delete()
          .eq('user_id', user.id)
          .eq('course_id', courseId);
        if (error) throw error;
        return { action: 'removed' };
      } else {
        const { error } = await supabase
          .from('wishlist' as any)
          .insert({ user_id: user.id, course_id: courseId } as any);
        if (error) throw error;
        return { action: 'added' };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast.success(
        result.action === 'added'
          ? (isRTL ? 'تمت الإضافة للمفضلة' : 'Added to wishlist')
          : (isRTL ? 'تمت الإزالة من المفضلة' : 'Removed from wishlist')
      );
    },
    onError: () => {
      toast.error(isRTL ? 'حدث خطأ' : 'An error occurred');
    },
  });

  const isInWishlist = (courseId: string) => wishlistIds.includes(courseId);

  return { wishlistIds, toggleWishlist, isInWishlist };
};
