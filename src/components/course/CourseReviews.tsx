import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CourseReviewsProps {
  courseId: string;
  isRTL: boolean;
}

const ratingLabels = {
  ar: ['', 'سيء جداً', 'سيء', 'سيء', 'سيء', 'مقبول', 'مقبول', 'جيد', 'جيد', 'ممتاز', 'ممتاز'],
  en: ['', 'Very Bad', 'Bad', 'Bad', 'Bad', 'Acceptable', 'Acceptable', 'Good', 'Good', 'Excellent', 'Excellent'],
};

const ratingColors: Record<string, string> = {
  'سيء جداً': 'text-red-500', 'سيء': 'text-red-400', 'مقبول': 'text-yellow-500', 'جيد': 'text-blue-500', 'ممتاز': 'text-green-500',
  'Very Bad': 'text-red-500', 'Bad': 'text-red-400', 'Acceptable': 'text-yellow-500', 'Good': 'text-blue-500', 'Excellent': 'text-green-500',
};

const ScaleRating = ({ rating, onRate, interactive = false, size = 'md' }: {
  rating: number;
  onRate?: (r: number) => void;
  interactive?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const [hover, setHover] = useState(0);
  const activeRating = hover || rating;
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : size === 'lg' ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs';

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
        <button
          key={value}
          type="button"
          disabled={!interactive}
          className={cn(
            'rounded-md border font-bold transition-all duration-150',
            sizeClass,
            interactive ? 'cursor-pointer' : 'cursor-default',
            value <= activeRating
              ? value >= 9 ? 'bg-green-500 border-green-500 text-white'
                : value >= 7 ? 'bg-blue-500 border-blue-500 text-white'
                : value >= 5 ? 'bg-yellow-500 border-yellow-500 text-white'
                : 'bg-red-500 border-red-500 text-white'
              : 'border-muted-foreground/30 text-muted-foreground'
          )}
          onClick={() => onRate?.(value)}
          onMouseEnter={() => interactive && setHover(value)}
          onMouseLeave={() => interactive && setHover(0)}
        >
          {value}
        </button>
      ))}
    </div>
  );
};

// Convert DB 1-5 star rating to 1-10 display scale
const starsToScale = (stars: number) => Math.min(10, Math.max(1, stars * 2));
// Convert 1-10 scale to 1-5 stars for DB
const scaleToStars = (scale: number) => Math.max(1, Math.round(scale / 2));

export const CourseReviews = ({ courseId, isRTL }: CourseReviewsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState('');
  const locale = isRTL ? ar : enUS;
  const lang = isRTL ? 'ar' : 'en';

  const t = {
    title: isRTL ? 'التقييمات والمراجعات' : 'Ratings & Reviews',
    totalReviews: isRTL ? 'تقييم' : 'reviews',
    writeReview: isRTL ? 'اكتب تقييمك' : 'Write a Review',
    yourRating: isRTL ? 'تقييمك' : 'Your Rating',
    comment: isRTL ? 'تعليقك (اختياري)' : 'Your Comment (optional)',
    submit: isRTL ? 'إرسال التقييم' : 'Submit Review',
    update: isRTL ? 'تحديث التقييم' : 'Update Review',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    noReviews: isRTL ? 'لا توجد تقييمات بعد. كن أول من يقيّم!' : 'No reviews yet. Be the first to review!',
    mustComplete: isRTL ? 'يجب إكمال الكورس بنسبة 100% لتتمكن من التقييم' : 'You must complete 100% of the course to leave a review',
    loginToReview: isRTL ? 'سجل دخولك لتتمكن من التقييم' : 'Log in to write a review',
    selectRating: isRTL ? 'يرجى اختيار تقييم' : 'Please select a rating',
    success: isRTL ? 'تم إرسال تقييمك بنجاح' : 'Review submitted successfully',
    updated: isRTL ? 'تم تحديث تقييمك' : 'Review updated',
    deleted: isRTL ? 'تم حذف تقييمك' : 'Review deleted',
  };

  const { data: reviews = [] } = useQuery({
    queryKey: ['course-reviews', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_reviews')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, full_name_ar, avatar_url')
        .in('id', userIds);

      return data.map(review => ({
        ...review,
        profile: profiles?.find(p => p.id === review.user_id),
      }));
    },
  });

  const { data: canReview } = useQuery({
    queryKey: ['can-review', courseId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('enrollments')
        .select('progress')
        .eq('course_id', courseId)
        .eq('user_id', user.id)
        .maybeSingle();
      return (data?.progress ?? 0) >= 100;
    },
    enabled: !!user,
  });

  const myReview = reviews.find(r => r.user_id === user?.id);

  // Average on 10-scale
  const avgRating10 = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + starsToScale(r.rating), 0) / reviews.length
    : 0;

  // Distribution on 10-scale buckets
  const buckets = [
    { label: isRTL ? 'ممتاز' : 'Excellent', range: [9, 10], color: 'bg-green-500' },
    { label: isRTL ? 'جيد' : 'Good', range: [7, 8], color: 'bg-blue-500' },
    { label: isRTL ? 'مقبول' : 'Acceptable', range: [5, 6], color: 'bg-yellow-500' },
    { label: isRTL ? 'سيء' : 'Bad', range: [3, 4], color: 'bg-red-400' },
    { label: isRTL ? 'سيء جداً' : 'Very Bad', range: [1, 2], color: 'bg-red-500' },
  ].map(b => {
    const count = reviews.filter(r => {
      const s = starsToScale(r.rating);
      return s >= b.range[0] && s <= b.range[1];
    }).length;
    return { ...b, count, percent: reviews.length > 0 ? (count / reviews.length) * 100 : 0 };
  });

  const avgLabel = avgRating10 > 0 ? ratingLabels[lang][Math.round(avgRating10)] : '';
  const avgColor = avgLabel ? ratingColors[avgLabel] || '' : '';

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (newRating === 0) throw new Error(t.selectRating);
      const { error } = await supabase.from('course_reviews').insert({
        course_id: courseId,
        user_id: user!.id,
        rating: scaleToStars(newRating),
        comment: newComment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-reviews', courseId] });
      toast.success(t.success);
      setNewRating(0);
      setNewComment('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const { error } = await supabase.from('course_reviews')
        .update({ rating: scaleToStars(editRating), comment: editComment || null })
        .eq('id', editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-reviews', courseId] });
      toast.success(t.updated);
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_reviews').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-reviews', courseId] });
      toast.success(t.deleted);
    },
  });

  const startEdit = (review: any) => {
    setEditingId(review.id);
    setEditRating(starsToScale(review.rating));
    setEditComment(review.comment || '');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rating Summary */}
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          <div className="text-center min-w-[120px]">
            <div className={cn('text-5xl font-bold', avgColor || 'text-primary')}>
              {avgRating10.toFixed(1)}
            </div>
            {avgLabel && (
              <span className={cn('text-lg font-semibold', avgColor)}>{avgLabel}</span>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {reviews.length} {t.totalReviews}
            </p>
            <div className="flex justify-center gap-1 mt-1 text-xs text-muted-foreground">
              <span>{isRTL ? 'من' : 'out of'} 10</span>
            </div>
          </div>
          <div className="flex-1 space-y-1.5 w-full max-w-sm">
            {buckets.map(b => (
              <div key={b.label} className="flex items-center gap-2 text-sm">
                <span className="w-16 text-end text-muted-foreground truncate">{b.label}</span>
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', b.color)} style={{ width: `${b.percent}%` }} />
                </div>
                <span className="w-6 text-muted-foreground text-end">{b.count}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Write Review Form */}
        {!user ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t.loginToReview}</p>
        ) : myReview && editingId !== myReview.id ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{isRTL ? 'لقد قيّمت هذا الكورس بالفعل' : 'You already reviewed this course'}</span>
          </div>
        ) : !canReview ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t.mustComplete}</p>
        ) : !myReview ? (
          <div className="space-y-3 p-4 rounded-xl border bg-muted/30">
            <h4 className="font-medium">{t.writeReview}</h4>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">{t.yourRating}</label>
              <ScaleRating rating={newRating} onRate={setNewRating} interactive size="lg" />
              {newRating > 0 && (
                <span className={cn('text-sm font-semibold', ratingColors[ratingLabels[lang][newRating]] || '')}>
                  {ratingLabels[lang][newRating]}
                </span>
              )}
            </div>
            <Textarea placeholder={t.comment} value={newComment} onChange={e => setNewComment(e.target.value)} rows={3} />
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || newRating === 0}>
              {submitMutation.isPending ? '...' : t.submit}
            </Button>
          </div>
        ) : null}

        {/* Edit form */}
        {editingId && (
          <div className="space-y-3 p-4 rounded-xl border bg-muted/30">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">{t.yourRating}</label>
              <ScaleRating rating={editRating} onRate={setEditRating} interactive size="lg" />
              {editRating > 0 && (
                <span className={cn('text-sm font-semibold', ratingColors[ratingLabels[lang][editRating]] || '')}>
                  {ratingLabels[lang][editRating]}
                </span>
              )}
            </div>
            <Textarea value={editComment} onChange={e => setEditComment(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {t.update}
              </Button>
              <Button variant="outline" onClick={() => setEditingId(null)}>{t.cancel}</Button>
            </div>
          </div>
        )}

        <Separator />

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t.noReviews}</p>
        ) : (
          <AnimatePresence>
            <div className="space-y-4">
              {reviews.map((review: any, idx: number) => {
                const reviewScale = starsToScale(review.rating);
                const reviewLabel = ratingLabels[lang][reviewScale];
                return (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-3 p-4 rounded-xl border"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {review.profile?.avatar_url ? (
                        <img src={review.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-primary">
                          {(review.profile?.full_name || '?')[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {isRTL ? review.profile?.full_name_ar || review.profile?.full_name : review.profile?.full_name || 'Anonymous'}
                        </span>
                        <span className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full',
                          reviewScale >= 9 ? 'bg-green-500/15 text-green-600'
                            : reviewScale >= 7 ? 'bg-blue-500/15 text-blue-600'
                            : reviewScale >= 5 ? 'bg-yellow-500/15 text-yellow-600'
                            : 'bg-red-500/15 text-red-600'
                        )}>
                          {reviewScale}/10 · {reviewLabel}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(review.created_at), 'PP', { locale })}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground mt-1">{review.comment}</p>
                      )}
                    </div>
                    {review.user_id === user?.id && editingId !== review.id && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(review)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(review.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
};
