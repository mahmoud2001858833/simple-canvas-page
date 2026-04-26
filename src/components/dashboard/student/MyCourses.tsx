import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MyCoursesSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import LazyImage from '@/components/ui/LazyImage';
import { PlayCircle, Clock, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MyCoursesProps {
  limit?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

export const MyCourses = ({ limit, showViewAll, onViewAll }: MyCoursesProps) => {
  const { language, dir } = useLanguage();
  const { user } = useAuth();

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
          {language === 'ar' ? 'كورساتي' : 'My Courses'}
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
              <Link to={`/courses/${enrollment.course_id}`}>
                <Button size="sm" className="bg-gradient-gold text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {language === 'ar' ? 'متابعة' : 'Continue'}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title={language === 'ar' ? 'لا توجد كورسات بعد' : 'No courses yet'}
          description={language === 'ar' 
            ? 'ابدأ رحلتك التعليمية الآن واستكشف مجموعة واسعة من الكورسات المميزة' 
            : 'Start your learning journey now and explore our wide range of amazing courses'}
          actionLabel={language === 'ar' ? 'تصفح الكورسات' : 'Browse Courses'}
          actionLink="/courses"
          variant="card"
          illustration="courses"
        />
      )}
    </div>
  );
};
