import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Award, FileText, Play, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface Activity {
  id: string;
  type: 'lesson' | 'certificate' | 'request' | 'enrollment';
  title: string;
  date: string;
  icon: any;
  color: string;
}

export const RecentActivity = () => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';

  const { data: activities, isLoading } = useQuery({
    queryKey: ['student-recent-activity', user?.id],
    queryFn: async () => {
      const result: Activity[] = [];

      // Fetch recent lesson progress
      const { data: lessonProgress } = await supabase
        .from('lesson_progress')
        .select('id, updated_at, lesson:lessons(title, title_ar)')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      lessonProgress?.forEach((lp: any) => {
        result.push({
          id: `lp-${lp.id}`,
          type: 'lesson',
          title: language === 'ar'
            ? `شاهدت درس: ${lp.lesson?.title_ar || ''}`
            : `Watched: ${lp.lesson?.title || ''}`,
          date: lp.updated_at,
          icon: Play,
          color: 'from-blue-500 to-blue-600',
        });
      });

      // Fetch recent certificates
      const { data: certificates } = await supabase
        .from('certificates')
        .select('id, issued_at, course:courses(title, title_ar)')
        .eq('user_id', user!.id)
        .order('issued_at', { ascending: false })
        .limit(3);

      certificates?.forEach((cert: any) => {
        result.push({
          id: `cert-${cert.id}`,
          type: 'certificate',
          title: language === 'ar'
            ? `حصلت على شهادة: ${cert.course?.title_ar || ''}`
            : `Earned certificate: ${cert.course?.title || ''}`,
          date: cert.issued_at,
          icon: Award,
          color: 'from-amber-500 to-amber-600',
        });
      });

      // Fetch recent requests
      const { data: requests } = await supabase
        .from('custom_course_requests')
        .select('id, created_at, title')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(3);

      requests?.forEach((req: any) => {
        result.push({
          id: `req-${req.id}`,
          type: 'request',
          title: language === 'ar'
            ? `أرسلت طلب: ${req.title}`
            : `Submitted request: ${req.title}`,
          date: req.created_at,
          icon: FileText,
          color: 'from-purple-500 to-purple-600',
        });
      });

      // Fetch recent enrollments
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('id, enrolled_at, course:courses(title, title_ar)')
        .eq('user_id', user!.id)
        .order('enrolled_at', { ascending: false })
        .limit(3);

      enrollments?.forEach((enr: any) => {
        result.push({
          id: `enr-${enr.id}`,
          type: 'enrollment',
          title: language === 'ar'
            ? `اشتركت في: ${enr.course?.title_ar || ''}`
            : `Enrolled in: ${enr.course?.title || ''}`,
          date: enr.enrolled_at,
          icon: BookOpen,
          color: 'from-green-500 to-green-600',
        });
      });

      // Sort by date and take top 8
      return result
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8);
    },
    enabled: !!user,
  });

  const texts = {
    ar: { title: 'النشاط الأخير', noActivity: 'لا يوجد نشاط بعد' },
    en: { title: 'Recent Activity', noActivity: 'No activity yet' },
  };
  const t = texts[language];

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!activities || activities.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">{t.noActivity}</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${activity.color} flex items-center justify-center flex-shrink-0`}>
                  <activity.icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(activity.date), 'PPp', { locale: language === 'ar' ? ar : enUS })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
