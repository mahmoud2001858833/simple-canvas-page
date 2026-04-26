import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, BookOpen, DollarSign, FileText, TrendingUp, GraduationCap } from 'lucide-react';
import { StatsGridSkeleton } from '@/components/ui/skeletons';

export const AdminStats = () => {
  const { language, dir } = useLanguage();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_stats');
      
      if (error) {
        const [usersRes, coursesRes, paymentsRes, requestsRes, enrollmentsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('payments').select('amount, status'),
          supabase.from('custom_course_requests').select('id, status'),
          supabase.from('enrollments').select('id', { count: 'exact', head: true }),
        ]);

        const totalRevenue = paymentsRes.data
          ?.filter((p: any) => p.status === 'paid')
          .reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0;

        const pendingRequests = requestsRes.data?.filter((r: any) => r.status === 'pending').length || 0;

        return {
          users: usersRes.count || 0,
          courses: coursesRes.count || 0,
          revenue: totalRevenue,
          pendingRequests,
          enrollments: enrollmentsRes.count || 0,
          totalPayments: paymentsRes.data?.length || 0,
        };
      }

      const statsData = data as {
        users: number;
        courses: number;
        revenue: number;
        pending_requests: number;
        enrollments: number;
        total_payments: number;
      };

      return {
        users: statsData.users || 0,
        courses: statsData.courses || 0,
        revenue: statsData.revenue || 0,
        pendingRequests: statsData.pending_requests || 0,
        enrollments: statsData.enrollments || 0,
        totalPayments: statsData.total_payments || 0,
      };
    },
    staleTime: 300000,
  });

  const statCards = [
    {
      label: language === 'ar' ? 'إجمالي المستخدمين' : 'Total Users',
      value: stats?.users || 0,
      icon: Users,
      gradient: 'from-primary to-primary/70',
      shadowClass: 'shadow-blue',
      change: '+12%',
    },
    {
      label: language === 'ar' ? 'الكورسات' : 'Courses',
      value: stats?.courses || 0,
      icon: BookOpen,
      gradient: 'from-secondary to-emerald',
      shadowClass: 'shadow-green',
      change: '+5%',
    },
    {
      label: language === 'ar' ? 'الإيرادات' : 'Revenue',
      value: `${stats?.revenue?.toLocaleString() || 0} ر.س`,
      icon: DollarSign,
      gradient: 'from-accent to-warning',
      shadowClass: 'shadow-gold',
      change: '+23%',
    },
    {
      label: language === 'ar' ? 'طلبات معلقة' : 'Pending Requests',
      value: stats?.pendingRequests || 0,
      icon: FileText,
      gradient: 'from-ocean to-teal',
      shadowClass: 'shadow-ocean',
      change: '',
    },
    {
      label: language === 'ar' ? 'التسجيلات' : 'Enrollments',
      value: stats?.enrollments || 0,
      icon: GraduationCap,
      gradient: 'from-info to-sky',
      shadowClass: 'shadow-blue',
      change: '+18%',
    },
    {
      label: language === 'ar' ? 'المعاملات' : 'Transactions',
      value: stats?.totalPayments || 0,
      icon: TrendingUp,
      gradient: 'from-secondary to-teal',
      shadowClass: 'shadow-green',
      change: '+8%',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">
          {language === 'ar' ? 'لوحة الإدارة' : 'Admin Dashboard'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'ar' ? 'نظرة عامة على المنصة' : 'Platform Overview'}
        </p>
      </div>

      {isLoading ? (
        <StatsGridSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Decorative gradient corner */}
              <div className={`absolute top-0 ${dir === 'rtl' ? 'left-0' : 'right-0'} w-24 h-24 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-bl-[3rem]`} />
              
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center ${stat.shadowClass}`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  {stat.change && (
                    <span className="text-xs text-success bg-success/10 px-2 py-1 rounded-full font-medium">
                      {stat.change}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
