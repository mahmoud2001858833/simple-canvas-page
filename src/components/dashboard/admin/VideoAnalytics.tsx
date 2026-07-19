import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/ui/skeletons';
import {
  Eye, Clock, TrendingUp, Play, Search, X, Download,
  BarChart3, Users, BookOpen, Video
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const VideoAnalytics = () => {
  const { language } = useLanguage();
  const [search, setSearch] = useState('');

  const t = {
    title: language === 'ar' ? 'إحصائيات الفيديوهات' : 'Video Analytics',
    desc: language === 'ar' ? 'تحليل أداء الفيديوهات ومشاهدات الدروس' : 'Analyze video performance and lesson views',
    totalViews: language === 'ar' ? 'إجمالي المشاهدات' : 'Total Views',
    uniqueViewers: language === 'ar' ? 'المشاهدون الفريدون' : 'Unique Viewers',
    avgCompletion: language === 'ar' ? 'متوسط الإكمال' : 'Avg. Completion',
    totalWatchTime: language === 'ar' ? 'وقت المشاهدة الكلي' : 'Total Watch Time',
    lesson: language === 'ar' ? 'الدرس' : 'Lesson',
    course: language === 'ar' ? 'الدورة' : 'Course',
    views: language === 'ar' ? 'المشاهدات' : 'Views',
    viewers: language === 'ar' ? 'المشاهدون' : 'Viewers',
    completion: language === 'ar' ? 'نسبة الإكمال' : 'Completion',
    watchTime: language === 'ar' ? 'وقت المشاهدة' : 'Watch Time',
    search: language === 'ar' ? 'ابحث عن درس أو دورة...' : 'Search lesson or course...',
    topLessons: language === 'ar' ? 'أكثر الدروس مشاهدة' : 'Most Viewed Lessons',
    viewsByDay: language === 'ar' ? 'المشاهدات حسب اليوم' : 'Views by Day',
    completionDist: language === 'ar' ? 'توزيع نسب الإكمال' : 'Completion Distribution',
    export: language === 'ar' ? 'تصدير CSV' : 'Export CSV',
    minutes: language === 'ar' ? 'دقيقة' : 'min',
    hours: language === 'ar' ? 'ساعة' : 'hours',
    noData: language === 'ar' ? 'لا توجد بيانات' : 'No data available',
  };

  // Fetch video access logs with lesson/course info
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['video-analytics'],
    queryFn: async () => {
      const [accessRes, progressRes, lessonsRes] = await Promise.all([
        supabase.from('video_access_logs').select('id, user_id, lesson_id, accessed_at'),
        supabase.from('lesson_progress').select('user_id, lesson_id, progress_percent, completed, last_position'),
        supabase.from('lessons').select('id, title, title_ar, duration_minutes, course_id, courses(title, title_ar)'),
      ]);

      const accessLogs = accessRes.data || [];
      const progressLogs = progressRes.data || [];
      const lessons = lessonsRes.data || [];

      // Build per-lesson analytics
      const lessonMap = new Map<string, {
        lessonId: string;
        title: string;
        courseTitle: string;
        durationMinutes: number;
        totalViews: number;
        uniqueViewers: Set<string>;
        avgCompletion: number;
        totalWatchMinutes: number;
        completions: number[];
      }>();

      for (const lesson of lessons) {
        lessonMap.set(lesson.id, {
          lessonId: lesson.id,
          title: language === 'ar' ? lesson.title_ar : lesson.title,
          courseTitle: language === 'ar' ? (lesson.courses as any)?.title_ar : (lesson.courses as any)?.title,
          durationMinutes: lesson.duration_minutes || 0,
          totalViews: 0,
          uniqueViewers: new Set(),
          avgCompletion: 0,
          totalWatchMinutes: 0,
          completions: [],
        });
      }

      // Count access logs
      for (const log of accessLogs) {
        const entry = lessonMap.get(log.lesson_id);
        if (entry) {
          entry.totalViews++;
          entry.uniqueViewers.add(log.user_id);
        }
      }

      // Add progress data
      for (const prog of progressLogs) {
        const entry = lessonMap.get(prog.lesson_id);
        if (entry) {
          entry.completions.push(prog.progress_percent || 0);
          // Estimate watch time from last_position (seconds)
          if (prog.last_position) {
            entry.totalWatchMinutes += Math.round(prog.last_position / 60);
          }
        }
      }

      // Compute averages
      const lessonStats = Array.from(lessonMap.values()).map(entry => ({
        lessonId: entry.lessonId,
        title: entry.title,
        courseTitle: entry.courseTitle,
        durationMinutes: entry.durationMinutes,
        totalViews: entry.totalViews,
        uniqueViewers: entry.uniqueViewers.size,
        avgCompletion: entry.completions.length > 0
          ? Math.round(entry.completions.reduce((a, b) => a + b, 0) / entry.completions.length)
          : 0,
        totalWatchMinutes: entry.totalWatchMinutes,
      }));

      // Daily views chart data (last 30 days)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const dailyViews: Record<string, number> = {};
      for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
        dailyViews[d.toISOString().split('T')[0]] = 0;
      }
      for (const log of accessLogs) {
        const day = new Date(log.accessed_at).toISOString().split('T')[0];
        if (dailyViews[day] !== undefined) dailyViews[day]++;
      }
      const dailyChart = Object.entries(dailyViews).map(([date, count]) => ({
        date: date.slice(5), // MM-DD
        views: count,
      }));

      // Completion distribution
      const allCompletions = progressLogs.map(p => p.progress_percent || 0);
      const completionBuckets = [
        { label: '0-25%', count: allCompletions.filter(c => c <= 25).length },
        { label: '26-50%', count: allCompletions.filter(c => c > 25 && c <= 50).length },
        { label: '51-75%', count: allCompletions.filter(c => c > 50 && c <= 75).length },
        { label: '76-100%', count: allCompletions.filter(c => c > 75).length },
      ];

      // Summary
      const totalViewsAll = lessonStats.reduce((s, l) => s + l.totalViews, 0);
      const allUniqueViewers = new Set(accessLogs.map(l => l.user_id)).size;
      const avgCompletionAll = allCompletions.length > 0
        ? Math.round(allCompletions.reduce((a, b) => a + b, 0) / allCompletions.length)
        : 0;
      const totalWatchHours = Math.round(lessonStats.reduce((s, l) => s + l.totalWatchMinutes, 0) / 60);

      return {
        lessonStats: lessonStats.sort((a, b) => b.totalViews - a.totalViews),
        dailyChart,
        completionBuckets,
        summary: { totalViews: totalViewsAll, uniqueViewers: allUniqueViewers, avgCompletion: avgCompletionAll, totalWatchHours },
      };
    },
  });

  const filteredLessons = useMemo(() => {
    if (!analyticsData?.lessonStats) return [];
    if (!search) return analyticsData.lessonStats;
    const q = search.toLowerCase();
    return analyticsData.lessonStats.filter(l =>
      l.title?.toLowerCase().includes(q) || l.courseTitle?.toLowerCase().includes(q)
    );
  }, [analyticsData?.lessonStats, search]);

  const exportCSV = () => {
    if (!analyticsData?.lessonStats?.length) return;
    const headers = ['Lesson', 'Course', 'Views', 'Unique Viewers', 'Avg Completion %', 'Watch Time (min)'];
    const rows = analyticsData.lessonStats.map(l => [
      `"${l.title || ''}"`, `"${l.courseTitle || ''}"`, l.totalViews, l.uniqueViewers, l.avgCompletion, l.totalWatchMinutes
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <ListSkeleton rows={8} />;

  const { summary, dailyChart, completionBuckets } = analyticsData || {
    summary: { totalViews: 0, uniqueViewers: 0, avgCompletion: 0, totalWatchHours: 0 },
    dailyChart: [],
    completionBuckets: [],
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted-foreground">{t.desc}</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!analyticsData?.lessonStats?.length}>
          <Download className="w-4 h-4 me-2" />
          {t.export}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t.totalViews, value: summary.totalViews.toLocaleString(), icon: Eye, color: 'bg-blue-500' },
          { label: t.uniqueViewers, value: summary.uniqueViewers.toLocaleString(), icon: Users, color: 'bg-green-500' },
          { label: t.avgCompletion, value: `${summary.avgCompletion}%`, icon: TrendingUp, color: 'bg-purple-500' },
          { label: t.totalWatchTime, value: `${summary.totalWatchHours} ${t.hours}`, icon: Clock, color: 'bg-orange-500' },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily Views Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              {t.viewsByDay}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" fontSize={10} tickLine={false} />
                  <YAxis fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">{t.noData}</div>
            )}
          </CardContent>
        </Card>

        {/* Completion Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t.completionDist}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completionBuckets.some(b => b.count > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={completionBuckets} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {completionBuckets.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">{t.noData}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lessons Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              {t.topLessons}
            </CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t.search}
                className="ps-9 pe-9"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute end-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t.lesson}</TableHead>
                <TableHead>{t.course}</TableHead>
                <TableHead>{t.views}</TableHead>
                <TableHead>{t.viewers}</TableHead>
                <TableHead>{t.completion}</TableHead>
                <TableHead>{t.watchTime}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLessons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {t.noData}
                  </TableCell>
                </TableRow>
              ) : filteredLessons.map((lesson, idx) => (
                <TableRow key={lesson.lessonId}>
                  <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-medium text-sm">{lesson.title || '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lesson.courseTitle || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-semibold">{lesson.totalViews}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{lesson.uniqueViewers}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Progress value={lesson.avgCompletion} className="h-2 flex-1" />
                      <span className="text-xs font-medium w-10 text-end">{lesson.avgCompletion}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{lesson.totalWatchMinutes} {t.minutes}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
