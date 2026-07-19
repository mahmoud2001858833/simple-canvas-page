import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Clock, Award, TrendingUp } from 'lucide-react';
import { StudentStatsSkeleton } from '@/components/ui/skeletons';

export const DashboardStats = () => {
  const { language } = useLanguage();
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['student-stats', user?.id],
    queryFn: async () => {
      if (!user) return { enrollments: 0, completedLessons: 0, certificates: 0, progress: 0 };

      const [enrollmentsRes, progressRes, certificatesRes] = await Promise.all([
        supabase.from('enrollments').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('lesson_progress').select('completed').eq('user_id', user.id),
        supabase.from('certificates').select('id', { count: 'exact' }).eq('user_id', user.id),
      ]);

      const completedLessons = progressRes.data?.filter(p => p.completed).length || 0;
      const totalLessons = progressRes.data?.length || 1;
      const avgProgress = Math.round((completedLessons / totalLessons) * 100);

      return {
        enrollments: enrollmentsRes.count || 0,
        completedLessons,
        certificates: certificatesRes.count || 0,
        progress: avgProgress,
      };
    },
    enabled: !!user,
  });

  const statCards = [
    {
      label: language === 'ar' ? 'دوراتي' : 'My Courses',
      value: stats?.enrollments || 0,
      icon: BookOpen,
      gradient: 'from-primary to-primary/70',
      shadowClass: 'shadow-blue',
      bgAccent: 'bg-primary/8',
    },
    {
      label: language === 'ar' ? 'ساعات التعلم' : 'Learning Hours',
      value: `${(stats?.completedLessons || 0) * 0.5}`,
      icon: Clock,
      gradient: 'from-ocean to-teal',
      shadowClass: 'shadow-ocean',
      bgAccent: 'bg-ocean/8',
    },
    {
      label: language === 'ar' ? 'الشهادات' : 'Certificates',
      value: stats?.certificates || 0,
      icon: Award,
      gradient: 'from-accent to-warning',
      shadowClass: 'shadow-gold',
      bgAccent: 'bg-accent/8',
    },
    {
      label: language === 'ar' ? 'معدل التقدم' : 'Avg Progress',
      value: `${stats?.progress || 0}%`,
      icon: TrendingUp,
      gradient: 'from-secondary to-emerald',
      shadowClass: 'shadow-green',
      bgAccent: 'bg-secondary/8',
    },
  ];

  if (isLoading) {
    return <StudentStatsSkeleton />;
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <div
          key={index}
          className={`relative overflow-hidden rounded-xl border border-border/50 bg-card p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-fade-in-up`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {/* Decorative gradient corner */}
          <div className={`absolute top-0 end-0 w-24 h-24 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-bl-[3rem]`} />
          
          <div className="relative">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-4 ${stat.shadowClass}`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold mb-1">{stat.value}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
