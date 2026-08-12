import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MyCoursesSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import LazyImage from '@/components/ui/LazyImage';
import { PlayCircle, Clock, ChevronLeft, ChevronRight, GraduationCap, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface MyCoursesProps {
  limit?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

export const MyCourses = ({ limit, showViewAll, onViewAll }: MyCoursesProps) => {
  const { language, dir } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const WITHDRAW_WINDOW_DAYS = 2;

  const canWithdraw = (enrolledAt?: string | null) => {
    if (!enrolledAt) return false;
    const diffDays = (Date.now() - new Date(enrolledAt).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= WITHDRAW_WINDOW_DAYS;
  };

  const daysLeft = (enrolledAt?: string | null) => {
    if (!enrolledAt) return 0;
    const diffDays = (Date.now() - new Date(enrolledAt).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(WITHDRAW_WINDOW_DAYS - diffDays));
  };

  const handleWithdraw = async (enrollmentId: string) => {
    const { error } = await supabase
      .from('enrollments')
      .update({ status: 'cancelled' })
      .eq('id', enrollmentId);

    if (error) {
      const expired = (error.message || '').includes('WITHDRAW_WINDOW_EXPIRED');
      toast.error(
        expired
          ? language === 'ar'
            ? 'انتهت مهلة الانسحاب (يومان من تاريخ الشراء)'
            : 'The withdrawal window (2 days after purchase) has expired'
          : language === 'ar'
            ? 'تعذر إلغاء التسجيل'
            : 'Could not cancel enrollment'
      );
      return;
    }

    toast.success(
      language === 'ar'
        ? 'تم الانسحاب من الدورة، وسُجّل مبلغ الاسترداد لدى الإدارة لتحويله إليك، وتم تحديث السجلات المالية'
        : 'You withdrew from the course. The payment is refunded and financial records updated'
    );
    queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
  };

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['my-enrollments', user?.id, limit],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('enrollments')
        .select(`
          *,
          course:courses(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('enrolled_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return <MyCoursesSkeleton rows={limit || 3} />;
  }

  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">
          {language === 'ar' ? 'دوراتي' : 'My Courses'}
        </h2>
        {showViewAll && onViewAll && (
          <Button variant="ghost" onClick={onViewAll} className="text-primary">
            {language === 'ar' ? 'عرض الكل' : 'View All'}
            {dir === 'rtl' ? <ChevronLeft className="w-4 h-4 ms-1" /> : <ChevronRight className="w-4 h-4 ms-1" />}
          </Button>
        )}
      </div>

      {enrollments && enrollments.length > 0 ? (
        <div className="space-y-4">
          {enrollments.map((enrollment: any) => (
            <div
              key={enrollment.id}
              className="flex gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all group"
            >
              {/* Thumbnail with Lazy Loading */}
              <div className="w-24 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                {enrollment.course?.thumbnail_url ? (
                  <LazyImage
                    src={enrollment.course.thumbnail_url}
                    alt={enrollment.course.title_ar}
                    className="w-full h-full object-cover"
                    containerClassName="w-full h-full"
                    blurAmount={10}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-gold flex items-center justify-center">
                    <PlayCircle className="w-8 h-8 text-primary-foreground" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold mb-1 truncate">
                  {language === 'ar' ? enrollment.course?.title_ar : enrollment.course?.title}
                </h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {enrollment.course?.duration_hours || 0} {language === 'ar' ? 'ساعة' : 'hours'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={enrollment.progress || 0} className="flex-1 h-2" />
                  <span className="text-sm font-medium">{enrollment.progress || 0}%</span>
                </div>
              </div>

              {/* Action */}
              <div className="flex items-center gap-2">
                <Link to={`/courses/${enrollment.course_id}`}>
                  <Button size="sm" className="bg-gradient-gold text-primary-foreground">
                    {language === 'ar' ? 'متابعة' : 'Continue'}
                  </Button>
                </Link>
                {canWithdraw(enrollment.enrolled_at) ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                      <LogOut className="w-4 h-4 me-1" />
                      {language === 'ar' ? 'انسحاب' : 'Withdraw'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir={dir}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {language === 'ar' ? 'الانسحاب من الدورة' : 'Withdraw from course'}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {language === 'ar'
                          ? `سيتم إلغاء تسجيلك في الدورة، وتسجيل مبلغ الاسترداد لتحويله إليك، وخصم أرباح المعلم المرتبطة بها، وتحديث السجلات المالية. (متبقٍ ${daysLeft(enrollment.enrolled_at)} يوم على انتهاء مهلة الانسحاب)`
                          : 'Your enrollment will be cancelled, the payment refunded, the instructor earnings reversed and the financial records updated.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{language === 'ar' ? 'تراجع' : 'Cancel'}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleWithdraw(enrollment.id)}>
                        {language === 'ar' ? 'تأكيد الانسحاب' : 'Confirm withdrawal'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                ) : (
                  <span className="text-xs text-muted-foreground max-w-[120px] text-center">
                    {language === 'ar' ? 'انتهت مهلة الانسحاب' : 'Withdrawal window closed'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title={language === 'ar' ? 'لا توجد دورات بعد' : 'No courses yet'}
          description={language === 'ar' 
            ? 'ابدأ رحلتك التعليمية الآن واستكشف مجموعة واسعة من الدورات المميزة' 
            : 'Start your learning journey now and explore our wide range of amazing courses'}
          actionLabel={language === 'ar' ? 'تصفح الدورات' : 'Browse Courses'}
          actionLink="/courses"
          variant="card"
          illustration="courses"
        />
      )}
    </div>
  );
};
