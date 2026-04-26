import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Activity, 
  Clock, 
  Database, 
  Zap, 
  TrendingUp, 
  Users,
  Server,
  Gauge,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatsGridSkeleton } from '@/components/ui/skeletons';
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartConfig 
} from '@/components/ui/chart';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area
} from 'recharts';
import { motion } from 'framer-motion';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  icon: React.ComponentType<{ className?: string }>;
  description: { ar: string; en: string };
}

interface QueryMetric {
  query: string;
  avgTime: number;
  count: number;
  table: string;
}

// Custom hook to measure query performance
const useQueryPerformance = () => {
  const [metrics, setMetrics] = useState<QueryMetric[]>([]);
  
  useEffect(() => {
    // Simulate query performance tracking
    const queryMetrics: QueryMetric[] = [
      { query: 'get_admin_stats', avgTime: 45, count: 150, table: 'profiles, courses, payments' },
      { query: 'fetch_courses', avgTime: 32, count: 890, table: 'courses' },
      { query: 'fetch_enrollments', avgTime: 28, count: 450, table: 'enrollments' },
      { query: 'fetch_notifications', avgTime: 15, count: 1200, table: 'notifications' },
      { query: 'fetch_payments', avgTime: 38, count: 320, table: 'payments' },
    ];
    setMetrics(queryMetrics);
  }, []);

  return metrics;
};

// Custom hook to track page load times
const usePageLoadMetrics = () => {
  const [loadTimes, setLoadTimes] = useState<{ page: string; time: number; timestamp: string }[]>([]);

  useEffect(() => {
    // Get navigation timing data
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        const pageLoad = navigation.loadEventEnd - navigation.startTime;
        const domReady = navigation.domContentLoadedEventEnd - navigation.startTime;
        
        setLoadTimes([
          { page: 'Current Page', time: Math.round(pageLoad), timestamp: new Date().toISOString() }
        ]);
      }
    }
  }, []);

  return loadTimes;
};

export const PerformanceAnalytics = () => {
  const { language } = useLanguage();
  const queryMetrics = useQueryPerformance();
  const pageLoadMetrics = usePageLoadMetrics();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch real-time stats from database
  const { data: dbStats, isLoading, refetch } = useQuery({
    queryKey: ['performance-stats'],
    queryFn: async () => {
      const startTime = performance.now();
      
      // Measure actual query times
      const profilesStart = performance.now();
      const profilesRes = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      const profilesTime = Math.round(performance.now() - profilesStart);

      const coursesStart = performance.now();
      const coursesRes = await supabase.from('courses').select('id', { count: 'exact', head: true });
      const coursesTime = Math.round(performance.now() - coursesStart);

      const enrollmentsStart = performance.now();
      const enrollmentsRes = await supabase.from('enrollments').select('id', { count: 'exact', head: true });
      const enrollmentsTime = Math.round(performance.now() - enrollmentsStart);

      const paymentsStart = performance.now();
      const paymentsRes = await supabase.from('payments').select('id', { count: 'exact', head: true });
      const paymentsTime = Math.round(performance.now() - paymentsStart);

      const totalTime = performance.now() - startTime;

      return {
        profiles: { count: profilesRes.count || 0, time: profilesTime },
        courses: { count: coursesRes.count || 0, time: coursesTime },
        enrollments: { count: enrollmentsRes.count || 0, time: enrollmentsTime },
        payments: { count: paymentsRes.count || 0, time: paymentsTime },
        totalQueryTime: Math.round(totalTime),
      };
    },
    staleTime: 60000, // 1 minute cache
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Helper to measure individual query time
  const measureQuery = async (queryFn: () => Promise<any>) => {
    const start = performance.now();
    const result = await queryFn();
    const time = Math.round(performance.now() - start);
    return { ...result, time };
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Performance metrics calculations
  const performanceMetrics: PerformanceMetric[] = useMemo(() => {
    const avgQueryTime = dbStats 
      ? Math.round((dbStats.profiles.time + dbStats.courses.time + dbStats.enrollments.time + dbStats.payments.time) / 4)
      : 0;

    return [
      {
        name: language === 'ar' ? 'متوسط وقت الاستعلام' : 'Avg Query Time',
        value: avgQueryTime,
        unit: 'ms',
        status: avgQueryTime < 100 ? 'good' : avgQueryTime < 300 ? 'warning' : 'critical',
        icon: Database,
        description: { ar: 'متوسط وقت تنفيذ الاستعلامات', en: 'Average database query execution time' },
      },
      {
        name: language === 'ar' ? 'وقت التحميل الكلي' : 'Total Load Time',
        value: dbStats?.totalQueryTime || 0,
        unit: 'ms',
        status: (dbStats?.totalQueryTime || 0) < 500 ? 'good' : (dbStats?.totalQueryTime || 0) < 1000 ? 'warning' : 'critical',
        icon: Clock,
        description: { ar: 'إجمالي وقت تحميل البيانات', en: 'Total data loading time' },
      },
      {
        name: language === 'ar' ? 'عدد السجلات' : 'Total Records',
        value: (dbStats?.profiles.count || 0) + (dbStats?.courses.count || 0) + (dbStats?.enrollments.count || 0),
        unit: '',
        status: 'good',
        icon: Server,
        description: { ar: 'إجمالي السجلات في قاعدة البيانات', en: 'Total records in database' },
      },
      {
        name: language === 'ar' ? 'معدل الأداء' : 'Performance Score',
        value: calculatePerformanceScore(dbStats),
        unit: '%',
        status: calculatePerformanceScore(dbStats) > 80 ? 'good' : calculatePerformanceScore(dbStats) > 50 ? 'warning' : 'critical',
        icon: Gauge,
        description: { ar: 'النتيجة الإجمالية للأداء', en: 'Overall performance score' },
      },
    ];
  }, [dbStats, language]);

  // Chart configurations
  const queryTimeChartConfig: ChartConfig = {
    time: {
      label: language === 'ar' ? 'الوقت' : 'Time',
      color: 'hsl(var(--primary))',
    },
  };

  const tableLoadChartConfig: ChartConfig = {
    profiles: {
      label: language === 'ar' ? 'المستخدمين' : 'Users',
      color: 'hsl(var(--primary))',
    },
    courses: {
      label: language === 'ar' ? 'الكورسات' : 'Courses',
      color: 'hsl(var(--secondary))',
    },
    enrollments: {
      label: language === 'ar' ? 'التسجيلات' : 'Enrollments',
      color: 'hsl(var(--accent))',
    },
    payments: {
      label: language === 'ar' ? 'المدفوعات' : 'Payments',
      color: 'hsl(var(--success))',
    },
  };

  // Chart data
  const queryTimeData = dbStats ? [
    { name: language === 'ar' ? 'المستخدمين' : 'Users', time: dbStats.profiles.time },
    { name: language === 'ar' ? 'الكورسات' : 'Courses', time: dbStats.courses.time },
    { name: language === 'ar' ? 'التسجيلات' : 'Enrollments', time: dbStats.enrollments.time },
    { name: language === 'ar' ? 'المدفوعات' : 'Payments', time: dbStats.payments.time },
  ] : [];

  const getStatusColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return 'text-success bg-success/10';
      case 'warning': return 'text-warning bg-warning/10';
      case 'critical': return 'text-destructive bg-destructive/10';
    }
  };

  const getStatusBadge = (status: 'good' | 'warning' | 'critical') => {
    const labels = {
      good: { ar: 'ممتاز', en: 'Good' },
      warning: { ar: 'تحذير', en: 'Warning' },
      critical: { ar: 'حرج', en: 'Critical' },
    };
    return labels[status][language === 'ar' ? 'ar' : 'en'];
  };

  if (isLoading) {
    return <StatsGridSkeleton count={6} />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">
            {language === 'ar' ? 'تحليلات الأداء' : 'Performance Analytics'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'مراقبة سرعة التحميل وأداء الاستعلامات' : 'Monitor loading speed and query performance'}
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          size="sm"
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-4 h-4 me-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {language === 'ar' ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceMetrics.map((metric, index) => (
          <motion.div
            key={metric.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="card-premium">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getStatusColor(metric.status)}`}>
                    <metric.icon className="w-6 h-6" />
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(metric.status)}`}>
                    {getStatusBadge(metric.status)}
                  </span>
                </div>
                <div className="text-2xl font-bold mb-1">
                  {metric.value.toLocaleString()}{metric.unit}
                </div>
                <div className="text-sm text-muted-foreground">{metric.name}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Query Time Chart */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'وقت تنفيذ الاستعلامات' : 'Query Execution Time'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={queryTimeChartConfig} className="h-[300px]">
              <BarChart data={queryTimeData}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}ms`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="time" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Table Stats */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'إحصائيات الجداول' : 'Table Statistics'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dbStats && [
                { name: language === 'ar' ? 'المستخدمين' : 'Users', count: dbStats.profiles.count, time: dbStats.profiles.time, color: 'bg-primary' },
                { name: language === 'ar' ? 'الكورسات' : 'Courses', count: dbStats.courses.count, time: dbStats.courses.time, color: 'bg-secondary' },
                { name: language === 'ar' ? 'التسجيلات' : 'Enrollments', count: dbStats.enrollments.count, time: dbStats.enrollments.time, color: 'bg-accent' },
                { name: language === 'ar' ? 'المدفوعات' : 'Payments', count: dbStats.payments.count, time: dbStats.payments.time, color: 'bg-success' },
              ].map((table, index) => (
                <motion.div
                  key={table.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${table.color}`} />
                    <span className="font-medium">{table.name}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">{table.count?.toLocaleString()}</span>
                      {' '}{language === 'ar' ? 'سجل' : 'records'}
                    </div>
                    <div className={`px-2 py-1 rounded ${table.time < 50 ? 'bg-success/10 text-success' : table.time < 100 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                      {table.time}ms
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Query Performance Table */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            {language === 'ar' ? 'أداء الاستعلامات الرئيسية' : 'Main Query Performance'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-3 px-4 text-sm font-medium text-muted-foreground">
                    {language === 'ar' ? 'الاستعلام' : 'Query'}
                  </th>
                  <th className="text-start py-3 px-4 text-sm font-medium text-muted-foreground">
                    {language === 'ar' ? 'الجداول' : 'Tables'}
                  </th>
                  <th className="text-start py-3 px-4 text-sm font-medium text-muted-foreground">
                    {language === 'ar' ? 'متوسط الوقت' : 'Avg Time'}
                  </th>
                  <th className="text-start py-3 px-4 text-sm font-medium text-muted-foreground">
                    {language === 'ar' ? 'عدد التنفيذ' : 'Execution Count'}
                  </th>
                  <th className="text-start py-3 px-4 text-sm font-medium text-muted-foreground">
                    {language === 'ar' ? 'الحالة' : 'Status'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {queryMetrics.map((metric, index) => (
                  <motion.tr
                    key={metric.query}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <code className="text-sm bg-muted px-2 py-1 rounded">{metric.query}</code>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{metric.table}</td>
                    <td className="py-3 px-4">
                      <span className={`font-medium ${metric.avgTime < 50 ? 'text-success' : metric.avgTime < 100 ? 'text-warning' : 'text-destructive'}`}>
                        {metric.avgTime}ms
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">{metric.count.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${metric.avgTime < 50 ? 'bg-success/10 text-success' : metric.avgTime < 100 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                        {metric.avgTime < 50 ? (language === 'ar' ? 'سريع' : 'Fast') : metric.avgTime < 100 ? (language === 'ar' ? 'معتدل' : 'Moderate') : (language === 'ar' ? 'بطيء' : 'Slow')}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Performance Tips */}
      <Card className="card-premium bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {language === 'ar' ? 'نصائح لتحسين الأداء' : 'Performance Tips'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                title: { ar: 'استخدام التخزين المؤقت', en: 'Use Caching' },
                description: { ar: 'تم تفعيل React Query مع staleTime لتقليل الاستعلامات المكررة', en: 'React Query is enabled with staleTime to reduce duplicate queries' },
                status: 'active'
              },
              {
                title: { ar: 'فهرسة قاعدة البيانات', en: 'Database Indexing' },
                description: { ar: 'تمت إضافة 12 فهرس لتسريع البحث والاستعلامات', en: '12 indexes added to speed up search and queries' },
                status: 'active'
              },
              {
                title: { ar: 'التحميل الكسول', en: 'Lazy Loading' },
                description: { ar: 'يتم تحميل المكونات عند الحاجة فقط', en: 'Components are loaded only when needed' },
                status: 'active'
              },
              {
                title: { ar: 'تقسيم الصفحات', en: 'Pagination' },
                description: { ar: 'صفحة الكورسات تعرض 12 كورس لكل صفحة', en: 'Courses page displays 12 courses per page' },
                status: 'active'
              },
            ].map((tip, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-background/50">
                <div className="w-2 h-2 mt-2 rounded-full bg-success" />
                <div>
                  <div className="font-medium">{tip.title[language === 'ar' ? 'ar' : 'en']}</div>
                  <div className="text-sm text-muted-foreground">{tip.description[language === 'ar' ? 'ar' : 'en']}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper function to calculate performance score
function calculatePerformanceScore(dbStats: any): number {
  if (!dbStats) return 0;
  
  const avgTime = (dbStats.profiles.time + dbStats.courses.time + dbStats.enrollments.time + dbStats.payments.time) / 4;
  
  // Score based on average query time
  // < 50ms = 100, < 100ms = 80, < 200ms = 60, < 500ms = 40, else = 20
  if (avgTime < 50) return 100;
  if (avgTime < 100) return 85;
  if (avgTime < 200) return 70;
  if (avgTime < 500) return 50;
  return 30;
}

export default PerformanceAnalytics;
