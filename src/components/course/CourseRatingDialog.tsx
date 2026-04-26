import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CourseRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  isRTL: boolean;
}

const ratingLabels = {
  ar: ['', 'سيء جداً', 'سيء', 'سيء', 'سيء', 'مقبول', 'مقبول', 'جيد', 'جيد', 'ممتاز', 'ممتاز'],
  en: ['', 'Very Bad', 'Bad', 'Bad', 'Bad', 'Acceptable', 'Acceptable', 'Good', 'Good', 'Excellent', 'Excellent'],
};

const ratingColors: Record<string, string> = {
  'سيء جداً': 'text-red-500',
  'سيء': 'text-red-400',
  'مقبول': 'text-yellow-500',
  'جيد': 'text-blue-500',
  'ممتاز': 'text-green-500',
  'Very Bad': 'text-red-500',
  'Bad': 'text-red-400',
  'Acceptable': 'text-yellow-500',
  'Good': 'text-blue-500',
  'Excellent': 'text-green-500',
};

export const CourseRatingDialog = ({ open, onOpenChange, courseId, isRTL }: CourseRatingDialogProps) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const lang = isRTL ? 'ar' : 'en';
  const activeRating = hoverRating || rating;
  const label = activeRating > 0 ? ratingLabels[lang][activeRating] : '';

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSubmitting(true);

    try {
      // Ensure enrollment progress is 100 before submitting review
      await supabase
        .from('enrollments')
        .update({ progress: 100 })
        .eq('course_id', courseId)
        .eq('user_id', user.id);

      // Convert 0-10 scale to 1-5 stars for DB compatibility
      const starsRating = Math.max(1, Math.round(rating / 2));

      // Check if review already exists
      const { data: existing } = await supabase
        .from('course_reviews')
        .select('id')
        .eq('course_id', courseId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('course_reviews')
          .update({ rating: starsRating, comment: comment.trim() || null })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('course_reviews').insert({
          course_id: courseId,
          user_id: user.id,
          rating: starsRating,
          comment: comment.trim() || null,
        });
        if (error) throw error;
      }

      toast.success(isRTL ? 'شكراً لتقييمك!' : 'Thank you for your rating!');
      onOpenChange(false);
    } catch (error) {
      console.error('Rating error:', error);
      toast.error(isRTL ? 'فشل حفظ التقييم' : 'Failed to save rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {isRTL ? '🎉 مبارك! أكملت الدورة' : '🎉 Congratulations! Course Completed'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isRTL ? 'كيف تقيّم تجربتك مع هذه الدورة؟' : 'How would you rate your experience with this course?'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Rating Scale 1-10 */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                <button
                  key={value}
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(value)}
                  className={cn(
                    'w-9 h-9 rounded-lg border-2 text-sm font-bold transition-all duration-150',
                    value <= activeRating
                      ? value >= 9 ? 'bg-green-500 border-green-500 text-white scale-110'
                        : value >= 7 ? 'bg-blue-500 border-blue-500 text-white scale-105'
                        : value >= 5 ? 'bg-yellow-500 border-yellow-500 text-white'
                        : 'bg-red-500 border-red-500 text-white'
                      : 'border-muted-foreground/30 hover:border-primary/50 text-muted-foreground'
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            {label && (
              <span className={cn('text-lg font-semibold', ratingColors[label])}>
                {label}
              </span>
            )}
            <div className="flex justify-between w-full text-xs text-muted-foreground px-1">
              <span>{isRTL ? 'سيء' : 'Poor'}</span>
              <span>{isRTL ? 'ممتاز' : 'Excellent'}</span>
            </div>
          </div>

          {/* Comment */}
          <Textarea
            placeholder={isRTL ? 'أضف تعليقاً (اختياري)...' : 'Add a comment (optional)...'}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[80px] resize-none"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {isRTL ? 'لاحقاً' : 'Later'}
          </Button>
          <Button onClick={handleSubmit} disabled={rating === 0 || submitting}>
            <Star className="h-4 w-4 me-2" />
            {submitting ? (isRTL ? 'جاري الإرسال...' : 'Submitting...') : (isRTL ? 'إرسال التقييم' : 'Submit Rating')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
