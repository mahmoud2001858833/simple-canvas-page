import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Users, DollarSign, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface Stats {
  totalCourses: number;
  totalStudents: number;
  totalEarnings: number;
  pendingEarnings: number;
}

export const InstructorStats = () => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const [stats, setStats] = useState<Stats>({
    totalCourses: 0,
    totalStudents: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      const { count: coursesCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('instructor_id', user?.id);

      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('instructor_id', user?.id);

      let studentsCount = 0;
      if (courses && courses.length > 0) {
        const courseIds = courses.map(c => c.id);
        const { count } = await supabase
          .from('enrollments')
          .select('user_id', { count: 'exact', head: true })
          .in('course_id', courseIds);
        studentsCount = count || 0;
      }

      const { data: earnings } = await supabase
        .from('instructor_earnings')
        .select('amount, status')
        .eq('instructor_id', user?.id);

      const totalEarnings = earnings?.filter(e => e.status === 'paid')
        .reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const pendingEarnings = earnings?.filter(e => e.status === 'pending')
        .reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      setStats({
        totalCourses: coursesCount || 0,
        totalStudents: studentsCount,
        totalEarnings,
        pendingEarnings,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: { ar: 'كورساتي', en: 'My Courses' },
      value: stats.totalCourses,
      icon: BookOpen,
      gradient: 'from-primary to-primary/70',
      shadowClass: 'shadow-blue',
    },
    {
      title: { ar: 'طلابي', en: 'My Students' },
      value: stats.totalStudents,
      icon: Users,
      gradient: 'from-secondary to-emerald',
      shadowClass: 'shadow-green',
    },
    {
      title: { ar: 'الأرباح المحصلة', en: 'Total Earnings' },
      value: `${stats.totalEarnings.toLocaleString()} ر.س`,
      icon: DollarSign,
      gradient: 'from-accent to-warning',
      shadowClass: 'shadow-gold',
    },
    {
      title: { ar: 'أرباح معلقة', en: 'Pending Earnings' },
      value: `${stats.pendingEarnings.toLocaleString()} ر.س`,
      icon: TrendingUp,
      gradient: 'from-ocean to-teal',
      shadowClass: 'shadow-ocean',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <motion.div
          key={stat.title.en}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            {/* Decorative gradient corner */}
            <div className={`absolute top-0 ${dir === 'rtl' ? 'left-0' : 'right-0'} w-24 h-24 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-bl-[3rem]`} />
            
            <div className="relative">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-4 ${stat.shadowClass}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm text-muted-foreground">{stat.title[language]}</p>
              <p className="text-2xl font-bold mt-1">{loading ? '...' : stat.value}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
