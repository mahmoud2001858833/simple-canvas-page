import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ListSkeleton } from '@/components/ui/skeletons';
import {
  Users, TrendingUp, Clock, BookOpen, Award, Eye, Activity, Target
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export const StudentEngagementAnalytics = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === 'ar';

  const t = {
    title: isAr ? 'تحليلات تفاعل الطلاب' : 'Student Engagement Analytics',
    desc: isAr ? 'تتبع نشاط وتفاعل طلابك مع المحتوى' : 'Track student activity and content engagement',
    totalStudents: isAr ? 'إجمالي الطلاب' : 'Total Students',
    activeStudents: isAr ? 'طلاب نشطون' : 'Active Students',
    avgCompletion: isAr ? 'متوسط الإكمال' : 'Avg Completion',
    avgScore: isAr ? 'متوسط الدرجات' : 'Avg Score',
    courseEngagement: isAr ? 'تفاعل الدورات' : 'Course Engagement',
    weeklyActivity: isAr ? 'النشاط الأسبوعي' : 'Weekly Activity',
    topStudents: isAr ? 'أفضل الطلاب' : 'Top Students',
    student: isAr ? 'الطالب' : 'Student',
    course: isAr ? 'الدورة' : 'Course',
    progress: isAr ? 'التقدم' : 'Progress',
    lessonsCompleted: isAr ? 'الدروس المكتملة' : 'Lessons Completed',
    quizScore: isAr ? 'درجة الاختبار' : 'Quiz Score',
    lastActive: isAr ? 'آخر نشاط' : 'Last Active',
    enrolled: isAr ? 'مسجلون' : 'Enrolled',
    completed: isAr ? 'مكتملون' : 'Completed',
    noData: isAr ? 'لا توجد بيانات' : 'No data',
  };

  const { data, isLoading } = useQuery({
    queryKey: ['student-engagement', user?.id],
    queryFn: async () => {
      // Get instructor's courses
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, title_ar')
        .eq('instructor_id', user!.id);
      
      if (!courses?.length) return null;
      const courseIds = courses.map(c => c.id);

      // Fetch enrollments, progress, quiz attempts in parallel
      const [enrollRes, progressRes, quizRes, lessonRes] = await Promise.all([
        supabase.from('enrollments').select('user_id, course_id, progress, status, enrolled_at, completed_at, profiles(full_name, full_name_ar, email)').in('course_id', courseIds),
        supabase.from('lesson_progress').select('user_id, lesson_id, progress_percent, completed, updated_at, lessons!inner(course_id)').in('lessons.course_id', courseIds),
        supabase.from('quiz_attempts').select('user_id, quiz_id, score, total_questions, completed_at, quizzes!inner(course_id)').in('quizzes.course_id', courseIds),
        supabase.from('lessons').select('id, course_id').in('course_id', courseIds),
      ]);

      const enrollments = enrollRes.data || [];
      const progressData = progressRes.data || [];
      const quizData = quizRes.data || [];
      const lessons = lessonRes.data || [];

      // Count unique students
      const allStudentIds = new Set(enrollments.map(e => e.user_id));
      const totalStudents = allStudentIds.size;

      // Active in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const activeStudentIds = new Set(
        progressData.filter(p => p.updated_at && p.updated_at > sevenDaysAgo).map(p => p.user_id)
      );
      const activeStudents = activeStudentIds.size;

      // Avg completion across enrollments
      const completions = enrollments.map(e => e.progress || 0);
      const avgCompletion = completions.length > 0 ? Math.round(completions.reduce((a, b) => a + b, 0) / completions.length) : 0;

      // Avg quiz score
      const scores = quizData.filter(q => q.total_questions > 0).map(q => Math.round((q.score / q.total_questions) * 100));
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      // Course engagement breakdown
      const courseEngagement = courses.map(course => {
        const courseEnrollments = enrollments.filter(e => e.course_id === course.id);
        const courseLessons = lessons.filter(l => l.course_id === course.id);
        const courseCompleted = courseEnrollments.filter(e => e.status === 'completed' || e.progress === 100);
        return {
          name: isAr ? course.title_ar : course.title,
          enrolled: courseEnrollments.length,
          completed: courseCompleted.length,
          totalLessons: courseLessons.length,
        };
      });

      // Weekly activity (last 4 weeks)
      const weeklyActivity = [];
      for (let w = 3; w >= 0; w--) {
        const start = new Date(Date.now() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
        const end = new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000);
        const weekProgress = progressData.filter(p => {
          const d = new Date(p.updated_at || '');
          return d >= start && d < end;
        });
        weeklyActivity.push({
          week: isAr ? `الأسبوع ${4 - w}` : `Week ${4 - w}`,
          activities: weekProgress.length,
          completions: weekProgress.filter(p => p.completed).length,
        });
      }

      // Top students (by completed lessons)
      const studentLessonMap = new Map<string, { completed: number; total: number; name: string; lastActive: string }>();
      for (const e of enrollments) {
        const profile = e.profiles as any;
        const name = isAr ? profile?.full_name_ar || profile?.full_name || profile?.email : profile?.full_name || profile?.email;
        if (!studentLessonMap.has(e.user_id)) {
          studentLessonMap.set(e.user_id, { completed: 0, total: 0, name: name || '—', lastActive: '' });
        }
      }
      for (const p of progressData) {
        const entry = studentLessonMap.get(p.user_id);
        if (entry) {
          entry.total++;
          if (p.completed) entry.completed++;
          if (!entry.lastActive || (p.updated_at && p.updated_at > entry.lastActive)) {
            entry.lastActive = p.updated_at || '';
          }
        }
      }
      const topStudents = Array.from(studentLessonMap.values())
        .sort((a, b) => b.completed - a.completed)
        .slice(0, 10);

      return {
        summary: { totalStudents, activeStudents, avgCompletion, avgScore },
        courseEngagement,
        weeklyActivity,
        topStudents,
      };
    },
    enabled: !!user,
  });

  if (isLoading) return <ListSkeleton rows={6} />;
  if (!data) return <div className="text-center text-muted-foreground py-12">{t.noData}</div>;

  const { summary, courseEngagement, weeklyActivity, topStudents } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-muted-foreground">{t.desc}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t.totalStudents, value: summary.totalStudents, icon: Users, color: 'bg-blue-500' },
          { label: t.activeStudents, value: summary.activeStudents, icon: Activity, color: 'bg-green-500' },
          { label: t.avgCompletion, value: `${summary.avgCompletion}%`, icon: Target, color: 'bg-purple-500' },
          { label: t.avgScore, value: `${summary.avgScore}%`, icon: Award, color: 'bg-orange-500' },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {t.courseEngagement}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {courseEngagement.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={courseEngagement}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} />
                  <YAxis fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Bar dataKey="enrolled" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t.enrolled} />
                  <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} name={t.completed} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">{t.noData}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t.weeklyActivity}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={weeklyActivity}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="week" fontSize={10} tickLine={false} />
                  <YAxis fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="activities" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="completions" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">{t.noData}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Students */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            {t.topStudents}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t.student}</TableHead>
                <TableHead>{t.lessonsCompleted}</TableHead>
                <TableHead>{t.lastActive}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t.noData}</TableCell>
                </TableRow>
              ) : topStudents.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{s.completed} / {s.total}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.lastActive ? new Date(s.lastActive).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : '—'}
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
