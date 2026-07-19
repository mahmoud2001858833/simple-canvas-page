import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { ProgressOverviewSkeleton } from '@/components/ui/skeletons';
import { TrendingUp, CheckCircle2 } from 'lucide-react';

interface ProgressOverviewProps {
  limit?: number;
}

export const ProgressOverview = ({ limit }: ProgressOverviewProps) => {
  const { language } = useLanguage();
  const { user } = useAuth();

  const { data: courseProgress, isLoading } = useQuery({
    queryKey: ['course-progress', user?.id, limit],
    queryFn: async () => {
      if (!user) return [];

      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          course:courses(id, title, title_ar, thumbnail_url)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('enrolled_at', { ascending: false });

      if (error) throw error;
      if (!enrollments) return [];

      // Get lesson count and progress for each course
      const progressData = await Promise.all(
        enrollments.slice(0, limit).map(async (enrollment: any) => {
          const { count: totalLessons } = await supabase
            .from('lessons')
            .select('id', { count: 'exact', head: true })
            .eq('course_id', enrollment.course_id);

          const { count: completedLessons } = await supabase
            .from('lesson_progress')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('completed', true)
            .in('lesson_id', (
              await supabase
                .from('lessons')
                .select('id')
                .eq('course_id', enrollment.course_id)
            ).data?.map(l => l.id) || []);

          const progress = totalLessons ? Math.round((completedLessons || 0) / totalLessons * 100) : 0;

          return {
            ...enrollment,
            totalLessons: totalLessons || 0,
            completedLessons: completedLessons || 0,
            calculatedProgress: progress,
          };
        })
      );

      return progressData;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return <ProgressOverviewSkeleton rows={limit || 4} />;
  }

  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          {language === 'ar' ? 'تقدمي في الدورات' : 'My Progress'}
        </h2>
      </div>

      {courseProgress && courseProgress.length > 0 ? (
        <div className="space-y-4">
          {courseProgress.map((item: any) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-border hover:border-primary/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">
                  {language === 'ar' ? item.course?.title_ar : item.course?.title}
                </h4>
                <span className="text-sm text-muted-foreground">
                  {item.completedLessons}/{item.totalLessons} {language === 'ar' ? 'دروس' : 'lessons'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Progress 
                  value={item.calculatedProgress} 
                  className="flex-1 h-3"
                />
                <span className={`text-sm font-bold ${item.calculatedProgress === 100 ? 'text-success' : 'text-primary'}`}>
                  {item.calculatedProgress}%
                </span>
                {item.calculatedProgress === 100 && (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {language === 'ar' ? 'ابدأ بدورة لتتبع تقدمك' : 'Start a course to track your progress'}
          </p>
        </div>
      )}
    </div>
  );
};
