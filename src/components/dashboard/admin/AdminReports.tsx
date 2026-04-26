import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Users, BookOpen, DollarSign, Calendar } from 'lucide-react';
import { StatsGridSkeleton } from '@/components/ui/skeletons';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';

export const AdminReports = () => {
  const { language, dir } = useLanguage();

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: async () => {
      const today = new Date();
      const thirtyDaysAgo = subDays(today, 30);
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      const [
        monthlyPayments,
        monthlyEnrollments,
        monthlyRequests,
        topCourses,
        recentUsers,
      ] = await Promise.all([
        supabase
          .from('payments')
          .select('amount, status, created_at')
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
        supabase
          .from('enrollments')
          .select('id, created_at:enrolled_at')
          .gte('enrolled_at', monthStart.toISOString()),
        supabase
          .from('custom_course_requests')
          .select('id, status, created_at')
          .gte('created_at', thirtyDaysAgo.toISOString()),
        supabase
          .from('enrollments')
          .select('course_id, courses(title, title_ar)')
          .limit(100),
        supabase
          .from('profiles')
          .select('id, created_at')
          .gte('created_at', thirtyDaysAgo.toISOString()),
      ]);

      // Calculate monthly revenue
      const monthlyRevenue = monthlyPayments.data
        ?.filter((p: any) => p.status === 'paid')
        .reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0;

      // Count enrollments by course
      const courseEnrollments: Record<string, { count: number; title: string; title_ar: string }> = {};
      topCourses.data?.forEach((e: any) => {
        const courseId = e.course_id;
        if (!courseEnrollments[courseId]) {
          courseEnrollments[courseId] = {
            count: 0,
            title: e.courses?.title || 'Unknown',
            title_ar: e.courses?.title_ar || 'غير معروف',
          };
        }
        courseEnrollments[courseId].count++;
      });

      const topCoursesArray = Object.entries(courseEnrollments)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        monthlyRevenue,
        monthlyEnrollments: monthlyEnrollments.data?.length || 0,
        monthlyRequests: monthlyRequests.data?.length || 0,
        pendingRequests: monthlyRequests.data?.filter((r: any) => r.status === 'pending').length || 0,
        completedRequests: monthlyRequests.data?.filter((r: any) => r.status === 'completed').length || 0,
        newUsers: recentUsers.data?.length || 0,
        topCourses: topCoursesArray,
        totalPayments: monthlyPayments.data?.length || 0,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const summaryCards = [
    {
      label: language === 'ar' ? 'إيرادات الشهر' : 'Monthly Revenue',
      value: `${reportData?.monthlyRevenue?.toLocaleString() || 0} ر.س`,
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: language === 'ar' ? 'تسجيلات الشهر' : 'Monthly Enrollments',
      value: reportData?.monthlyEnrollments || 0,
      icon: BookOpen,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: language === 'ar' ? 'مستخدمين جدد' : 'New Users',
      value: reportData?.newUsers || 0,
      icon: Users,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      label: language === 'ar' ? 'طلبات الشهر' : 'Monthly Requests',
      value: reportData?.monthlyRequests || 0,
      icon: Calendar,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">
            {language === 'ar' ? 'التقارير' : 'Reports'}
          </h1>
        </div>
        <StatsGridSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold mb-2">
          {language === 'ar' ? 'التقارير والإحصائيات' : 'Reports & Analytics'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'ar' ? 'تقارير شهرية مفصلة عن أداء المنصة' : 'Detailed monthly reports on platform performance'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => (
          <Card key={index} className="card-premium">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${card.bgColor} flex items-center justify-center`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Courses */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'أكثر الكورسات تسجيلاً' : 'Top Enrolled Courses'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'الكورسات الأكثر شعبية' : 'Most popular courses'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportData?.topCourses?.length ? (
                reportData.topCourses.map((course, index) => (
                  <div key={course.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium">
                        {language === 'ar' ? course.title_ar : course.title}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {course.count} {language === 'ar' ? 'تسجيل' : 'enrollments'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {language === 'ar' ? 'لا توجد بيانات' : 'No data available'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Requests Summary */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'ملخص الطلبات' : 'Requests Summary'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'حالة طلبات آخر 30 يوم' : 'Last 30 days request status'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-warning/10 text-center">
                  <p className="text-3xl font-bold text-warning">{reportData?.pendingRequests || 0}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'ar' ? 'طلبات معلقة' : 'Pending'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-success/10 text-center">
                  <p className="text-3xl font-bold text-success">{reportData?.completedRequests || 0}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'ar' ? 'طلبات مكتملة' : 'Completed'}
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'معدل الإنجاز' : 'Completion Rate'}
                  </span>
                  <span className="font-bold">
                    {reportData?.monthlyRequests 
                      ? Math.round((reportData.completedRequests / reportData.monthlyRequests) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-gold rounded-full transition-all duration-500"
                    style={{ 
                      width: `${reportData?.monthlyRequests 
                        ? (reportData.completedRequests / reportData.monthlyRequests) * 100 
                        : 0}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
