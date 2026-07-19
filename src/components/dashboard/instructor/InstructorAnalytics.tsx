import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Eye, CheckCircle, Star, DollarSign, TrendingUp, BookOpen, Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface CourseAnalytics {
  id: string;
  title: string;
  title_ar: string;
  thumbnail_url: string | null;
  totalViews: number;
  totalEnrollments: number;
  completionRate: number;
  completedCount: number;
  averageRating: number;
  reviewsCount: number;
  totalRevenue: number;
  isActive: boolean;
}

export const InstructorAnalytics = () => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const [analytics, setAnalytics] = useState<CourseAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  const texts = {
    ar: {
      title: 'تحليلات الدورات',
      views: 'المشاهدات',
      completionRate: 'معدل الإكمال',
      avgRating: 'متوسط التقييم',
      revenue: 'الإيرادات',
      enrollments: 'التسجيلات',
      completed: 'أكمل',
      reviews: 'تقييم',
      noData: 'لا توجد بيانات بعد',
      noCourses: 'لا توجد دورات بعد',
      overallStats: 'الإحصائيات العامة',
      totalViews: 'إجمالي المشاهدات',
      totalRevenue: 'إجمالي الإيرادات',
      avgCompletion: 'متوسط معدل الإكمال',
      avgRatingAll: 'متوسط التقييم العام',
      revenueChart: 'الإيرادات حسب الدورة',
      courseDetails: 'تفاصيل كل دورة',
      sar: 'ر.س',
      active: 'نشط',
      inactive: 'غير نشط',
    },
    en: {
      title: 'Course Analytics',
      views: 'Views',
      completionRate: 'Completion Rate',
      avgRating: 'Avg Rating',
      revenue: 'Revenue',
      enrollments: 'Enrollments',
      completed: 'Completed',
      reviews: 'reviews',
      noData: 'No data yet',
      noCourses: 'No courses yet',
      overallStats: 'Overall Statistics',
      totalViews: 'Total Views',
      totalRevenue: 'Total Revenue',
      avgCompletion: 'Avg Completion Rate',
      avgRatingAll: 'Overall Avg Rating',
      revenueChart: 'Revenue by Course',
      courseDetails: 'Course Details',
      sar: 'SAR',
      active: 'Active',
      inactive: 'Inactive',
    },
  };

  const t = texts[language];

  useEffect(() => {
    if (user) fetchAnalytics();
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      // 1. Get instructor's courses
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title, title_ar, thumbnail_url, is_active')
        .eq('instructor_id', user!.id);

      if (coursesError) throw coursesError;
      if (!courses || courses.length === 0) {
        setAnalytics([]);
        setLoading(false);
        return;
      }

      const courseIds = courses.map(c => c.id);

      // 2. Fetch all data in parallel
      const [enrollmentsRes, viewsRes, reviewsRes, earningsRes, lessonsRes, progressRes] = await Promise.all([
        supabase.from('enrollments').select('course_id, progress, completed_at').in('course_id', courseIds),
        supabase.from('video_access_logs').select('lesson_id').in('lesson_id',
          // We need lesson IDs for these courses - fetch separately
          [] // placeholder
        ),
        supabase.from('course_reviews').select('course_id, rating').in('course_id', courseIds),
        supabase.from('instructor_earnings').select('course_id, amount').eq('instructor_id', user!.id),
        supabase.from('lessons').select('id, course_id').in('course_id', courseIds),
        // We'll handle progress differently
        Promise.resolve({ data: null }),
      ]);

      // Get lesson IDs to fetch views
      const lessonMap: Record<string, string> = {}; // lesson_id -> course_id
      (lessonsRes.data || []).forEach(l => { lessonMap[l.id] = l.course_id; });
      const lessonIds = Object.keys(lessonMap);

      let viewsByLessonCourse: Record<string, number> = {};
      if (lessonIds.length > 0) {
        // Fetch views in batches if needed
        const { data: viewsData } = await supabase
          .from('video_access_logs')
          .select('lesson_id')
          .in('lesson_id', lessonIds);

        (viewsData || []).forEach(v => {
          const courseId = lessonMap[v.lesson_id];
          if (courseId) {
            viewsByLessonCourse[courseId] = (viewsByLessonCourse[courseId] || 0) + 1;
          }
        });
      }

      // Aggregate data per course
      const analyticsData: CourseAnalytics[] = courses.map(course => {
        const courseEnrollments = (enrollmentsRes.data || []).filter(e => e.course_id === course.id);
        const completedEnrollments = courseEnrollments.filter(e => e.completed_at !== null);
        const courseReviews = (reviewsRes.data || []).filter(r => r.course_id === course.id);
        const courseEarnings = (earningsRes.data || []).filter(e => e.course_id === course.id);

        const avgRating = courseReviews.length > 0
          ? courseReviews.reduce((sum, r) => sum + r.rating, 0) / courseReviews.length
          : 0;

        const totalRevenue = courseEarnings.reduce((sum, e) => sum + Number(e.amount), 0);
        const completionRate = courseEnrollments.length > 0
          ? (completedEnrollments.length / courseEnrollments.length) * 100
          : 0;

        return {
          id: course.id,
          title: course.title,
          title_ar: course.title_ar,
          thumbnail_url: course.thumbnail_url,
          totalViews: viewsByLessonCourse[course.id] || 0,
          totalEnrollments: courseEnrollments.length,
          completionRate: Math.round(completionRate),
          completedCount: completedEnrollments.length,
          averageRating: Math.round(avgRating * 10) / 10,
          reviewsCount: courseReviews.length,
          totalRevenue,
          isActive: course.is_active ?? false,
        };
      });

      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (analytics.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t.noCourses}</p>
        </CardContent>
      </Card>
    );
  }

  // Overall stats
  const totalViews = analytics.reduce((s, a) => s + a.totalViews, 0);
  const totalRevenue = analytics.reduce((s, a) => s + a.totalRevenue, 0);
  const avgCompletion = analytics.length > 0
    ? Math.round(analytics.reduce((s, a) => s + a.completionRate, 0) / analytics.length)
    : 0;
  const ratedCourses = analytics.filter(a => a.averageRating > 0);
  const avgRating = ratedCourses.length > 0
    ? Math.round(ratedCourses.reduce((s, a) => s + a.averageRating, 0) / ratedCourses.length * 10) / 10
    : 0;

  const overallCards = [
    { label: t.totalViews, value: totalViews.toLocaleString(), icon: Eye, gradient: 'from-blue-500 to-blue-600' },
    { label: t.totalRevenue, value: `${totalRevenue.toLocaleString()} ${t.sar}`, icon: DollarSign, gradient: 'from-primary to-primary/80' },
    { label: t.avgCompletion, value: `${avgCompletion}%`, icon: TrendingUp, gradient: 'from-green-500 to-green-600' },
    { label: t.avgRatingAll, value: avgRating > 0 ? `${avgRating} ⭐` : '-', icon: Star, gradient: 'from-amber-500 to-amber-600' },
  ];

  // Chart data
  const revenueChartData = analytics
    .filter(a => a.totalRevenue > 0)
    .map(a => ({
      name: language === 'ar' ? a.title_ar : a.title,
      revenue: a.totalRevenue,
    }))
    .slice(0, 10);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {overallCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="relative overflow-hidden">
              <CardContent className="p-5">
                <div className={`absolute top-0 ${dir === 'rtl' ? 'left-0' : 'right-0'} w-16 h-16 bg-gradient-to-br ${card.gradient} opacity-10 rounded-bl-full`} />
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-3`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-xl font-bold mt-1">{card.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Revenue Chart */}
      {revenueChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.revenueChart}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(val) => val.length > 15 ? val.slice(0, 15) + '...' : val}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => [`${value.toLocaleString()} ${t.sar}`, t.revenue]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-Course Details */}
      <div>
        <h3 className="text-lg font-semibold mb-4">{t.courseDetails}</h3>
        <div className="space-y-4">
          {analytics.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, x: dir === 'rtl' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Thumbnail */}
                    {course.thumbnail_url && (
                      <img
                        src={course.thumbnail_url}
                        alt={language === 'ar' ? course.title_ar : course.title}
                        className="w-full md:w-32 h-20 object-cover rounded-lg flex-shrink-0"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Title & Status */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h4 className="font-semibold truncate">
                          {language === 'ar' ? course.title_ar : course.title}
                        </h4>
                        <Badge variant={course.isActive ? 'default' : 'secondary'} className="flex-shrink-0">
                          {course.isActive ? t.active : t.inactive}
                        </Badge>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Views */}
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Eye className="w-4 h-4 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t.views}</p>
                            <p className="font-semibold text-sm">{course.totalViews.toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Completion Rate */}
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t.completionRate}</p>
                            <p className="font-semibold text-sm">{course.completionRate}%</p>
                          </div>
                        </div>

                        {/* Average Rating */}
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <Star className="w-4 h-4 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t.avgRating}</p>
                            <p className="font-semibold text-sm">
                              {course.averageRating > 0 ? `${course.averageRating} (${course.reviewsCount})` : '-'}
                            </p>
                          </div>
                        </div>

                        {/* Revenue */}
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <DollarSign className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t.revenue}</p>
                            <p className="font-semibold text-sm">{course.totalRevenue.toLocaleString()} {t.sar}</p>
                          </div>
                        </div>
                      </div>

                      {/* Completion Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{t.enrollments}: {course.totalEnrollments}</span>
                          <span>{t.completed}: {course.completedCount}</span>
                        </div>
                        <Progress value={course.completionRate} className="h-2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
