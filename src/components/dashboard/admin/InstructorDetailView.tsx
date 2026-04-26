import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Eye, Users, BookOpen, DollarSign, MessageSquare, LayoutDashboard, Loader2, FlaskConical, Calendar, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { InstructorStats } from '@/components/dashboard/instructor/InstructorStats';
import { InstructorCourses } from '@/components/dashboard/instructor/InstructorCourses';
import { InstructorStudents } from '@/components/dashboard/instructor/InstructorStudents';
import { InstructorEarnings } from '@/components/dashboard/instructor/InstructorEarnings';
import { InstructorMessages } from '@/components/dashboard/instructor/InstructorMessages';

export const InstructorDetailView = () => {
  const { dir } = useLanguage();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState<any>(null);

  const { data: instructors, isLoading } = useQuery({
    queryKey: ['admin-instructors-list'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');

      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      // Get course counts for each instructor
      const enriched = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { count: courseCount } = await supabase
            .from('courses')
            .select('id', { count: 'exact', head: true })
            .eq('instructor_id', profile.id);

          return { ...profile, courseCount: courseCount || 0 };
        })
      );

      return enriched;
    },
  });

  const filteredInstructors = instructors?.filter(i =>
    i.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const texts = {
    ar: {
      title: 'المعلم بالتفصيل',
      subtitle: 'عرض لوحات تحكم المعلمين',
      search: 'ابحث عن معلم...',
      viewDashboard: 'عرض اللوحة',
      courses: 'كورس',
      noInstructors: 'لا يوجد معلمين',
      overview: 'نظرة عامة',
      myCourses: 'الكورسات',
      students: 'الطلاب',
      earnings: 'الأرباح',
      messages: 'الرسائل',
      dashboardOf: 'لوحة تحكم',
    },
    en: {
      title: 'Instructor Detail',
      subtitle: 'View instructor dashboards',
      search: 'Search for instructor...',
      viewDashboard: 'View Dashboard',
      courses: 'courses',
      noInstructors: 'No instructors found',
      overview: 'Overview',
      myCourses: 'Courses',
      students: 'Students',
      earnings: 'Earnings',
      messages: 'Messages',
      dashboardOf: 'Dashboard of',
    },
  };
  const t = texts[language];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t.title}</h2>
        <p className="text-muted-foreground mt-1">{t.subtitle}</p>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ps-10"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredInstructors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t.noInstructors}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredInstructors.map((instructor) => (
            <Card key={instructor.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={instructor.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-bold">
                    {instructor.full_name?.charAt(0) || 'M'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{instructor.full_name || instructor.email}</h3>
                  <p className="text-sm text-muted-foreground truncate">{instructor.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {instructor.teaching_year && (
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="w-3 h-3 me-1" />
                        {language === 'ar' ? getYearLabel(instructor.teaching_year, 'ar') : getYearLabel(instructor.teaching_year, 'en')}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        instructor.research_participation === true
                          ? 'border-primary/50 text-primary'
                          : instructor.research_participation === false
                          ? 'border-destructive/50 text-destructive'
                          : 'border-muted-foreground/50 text-muted-foreground'
                      }`}
                    >
                      {instructor.research_participation === true ? (
                        <><CheckCircle2 className="w-3 h-3 me-1" />{language === 'ar' ? 'يشارك بالبحوث' : 'Research: Yes'}</>
                      ) : instructor.research_participation === false ? (
                        <><XCircle className="w-3 h-3 me-1" />{language === 'ar' ? 'لا يشارك' : 'Research: No'}</>
                      ) : (
                        <><HelpCircle className="w-3 h-3 me-1" />{language === 'ar' ? 'لم يجب' : 'Research: N/A'}</>
                      )}
                    </Badge>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {instructor.courseCount} {t.courses}
                </Badge>
                <Button
                  size="sm"
                  onClick={() => setSelectedInstructor(instructor)}
                  className="bg-gradient-gold shrink-0"
                >
                  <Eye className="w-4 h-4 me-1" />
                  {t.viewDashboard}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Instructor Dashboard Preview Dialog */}
      <Dialog open={!!selectedInstructor} onOpenChange={() => setSelectedInstructor(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={selectedInstructor?.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-gold text-primary-foreground text-sm">
                  {selectedInstructor?.full_name?.charAt(0) || 'M'}
                </AvatarFallback>
              </Avatar>
              {t.dashboardOf}: {selectedInstructor?.full_name || selectedInstructor?.email}
            </DialogTitle>
          </DialogHeader>

          {selectedInstructor && (
            <InstructorDashboardPreview instructorId={selectedInstructor.id} language={language} texts={t} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const YEAR_LABELS: Record<string, Record<string, string>> = {
  first: { ar: 'السنة الأولى', en: 'First Year' },
  second: { ar: 'السنة الثانية', en: 'Second Year' },
  third: { ar: 'السنة الثالثة', en: 'Third Year' },
  fourth: { ar: 'السنة الرابعة', en: 'Fourth Year' },
  fifth: { ar: 'السنة الخامسة', en: 'Fifth Year' },
  masters: { ar: 'ماجستير', en: 'Masters' },
  phd: { ar: 'دكتوراه', en: 'PhD' },
};

const getYearLabel = (year: string, lang: string) => YEAR_LABELS[year]?.[lang] || year;

// Preview component that mimics the instructor dashboard
const InstructorDashboardPreview = ({ instructorId, language, texts }: { instructorId: string; language: string; texts: any }) => {
  const [activeTab, setActiveTab] = useState('overview');

  // We render the same components but they use useAuth internally
  // For a true preview, we'd need to modify each component to accept a userId override
  // For now, we show the instructor's data via direct queries
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
      <TabsList className="grid grid-cols-5 w-full">
        <TabsTrigger value="overview" className="text-xs sm:text-sm">
          <LayoutDashboard className="w-4 h-4 me-1 hidden sm:block" />
          {texts.overview}
        </TabsTrigger>
        <TabsTrigger value="courses" className="text-xs sm:text-sm">
          <BookOpen className="w-4 h-4 me-1 hidden sm:block" />
          {texts.myCourses}
        </TabsTrigger>
        <TabsTrigger value="students" className="text-xs sm:text-sm">
          <Users className="w-4 h-4 me-1 hidden sm:block" />
          {texts.students}
        </TabsTrigger>
        <TabsTrigger value="earnings" className="text-xs sm:text-sm">
          <DollarSign className="w-4 h-4 me-1 hidden sm:block" />
          {texts.earnings}
        </TabsTrigger>
        <TabsTrigger value="messages" className="text-xs sm:text-sm">
          <MessageSquare className="w-4 h-4 me-1 hidden sm:block" />
          {texts.messages}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6 space-y-6">
        <InstructorStatsPreview instructorId={instructorId} language={language} />
        <InstructorCoursesPreview instructorId={instructorId} language={language} />
      </TabsContent>
      <TabsContent value="courses" className="mt-6">
        <InstructorCoursesPreview instructorId={instructorId} language={language} />
      </TabsContent>
      <TabsContent value="students" className="mt-6">
        <InstructorStudentsPreview instructorId={instructorId} language={language} />
      </TabsContent>
      <TabsContent value="earnings" className="mt-6">
        <InstructorEarningsPreview instructorId={instructorId} language={language} />
      </TabsContent>
      <TabsContent value="messages" className="mt-6">
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{language === 'ar' ? 'الرسائل خاصة بالمعلم' : 'Messages are private to the instructor'}</p>
        </div>
      </TabsContent>
    </Tabs>
  );
};

// Stats preview for a specific instructor
const InstructorStatsPreview = ({ instructorId, language }: { instructorId: string; language: string }) => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-instructor-stats', instructorId],
    queryFn: async () => {
      const { count: coursesCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('instructor_id', instructorId);

      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('instructor_id', instructorId);

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
        .eq('instructor_id', instructorId);

      const totalEarnings = earnings?.filter(e => e.status === 'paid').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const pendingEarnings = earnings?.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      return { totalCourses: coursesCount || 0, totalStudents: studentsCount, totalEarnings, pendingEarnings };
    },
  });

  const statCards = [
    { title: language === 'ar' ? 'الكورسات' : 'Courses', value: stats?.totalCourses || 0, icon: BookOpen, gradient: 'from-primary to-primary/80' },
    { title: language === 'ar' ? 'الطلاب' : 'Students', value: stats?.totalStudents || 0, icon: Users, gradient: 'from-secondary to-secondary/80' },
    { title: language === 'ar' ? 'الأرباح المحصلة' : 'Total Earnings', value: `${(stats?.totalEarnings || 0).toLocaleString()} ر.س`, icon: DollarSign, gradient: 'from-primary to-primary/80' },
    { title: language === 'ar' ? 'أرباح معلقة' : 'Pending', value: `${(stats?.pendingEarnings || 0).toLocaleString()} ر.س`, icon: DollarSign, gradient: 'from-accent to-accent/80' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm text-muted-foreground">{stat.title}</p>
            <p className="text-xl font-bold">{isLoading ? '...' : stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Courses preview for a specific instructor
const InstructorCoursesPreview = ({ instructorId, language }: { instructorId: string; language: string }) => {
  const { data: courses, isLoading } = useQuery({
    queryKey: ['admin-instructor-courses', instructorId],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('instructor_id', instructorId)
        .order('created_at', { ascending: false });
      
      return await Promise.all(
        (data || []).map(async (course) => {
          const { count } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id);
          return { ...course, enrollments_count: count || 0 };
        })
      );
    },
  });

  if (isLoading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{language === 'ar' ? 'الكورسات' : 'Courses'}</CardTitle>
      </CardHeader>
      <CardContent>
        {(!courses || courses.length === 0) ? (
          <p className="text-center py-4 text-muted-foreground">{language === 'ar' ? 'لا توجد كورسات' : 'No courses'}</p>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => (
              <div key={course.id} className="flex items-center gap-3 p-3 rounded-xl border">
                <div className="w-12 h-12 rounded-lg bg-gradient-gold flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{language === 'ar' ? course.title_ar : course.title}</h4>
                  <p className="text-sm text-muted-foreground">{course.enrollments_count} {language === 'ar' ? 'طالب' : 'students'}</p>
                </div>
                <Badge variant={course.is_active ? 'default' : 'secondary'}>
                  {course.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Students preview for a specific instructor
const InstructorStudentsPreview = ({ instructorId, language }: { instructorId: string; language: string }) => {
  const { data: students, isLoading } = useQuery({
    queryKey: ['admin-instructor-students', instructorId],
    queryFn: async () => {
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, title_ar')
        .eq('instructor_id', instructorId);

      if (!courses || courses.length === 0) return [];

      const courseIds = courses.map(c => c.id);
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('*')
        .in('course_id', courseIds);

      const studentData = [];
      for (const enrollment of enrollments || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, avatar_url')
          .eq('id', enrollment.user_id)
          .single();

        const course = courses.find(c => c.id === enrollment.course_id);
        if (profile && course) {
          studentData.push({
            id: enrollment.id,
            full_name: profile.full_name || profile.email || 'Unknown',
            email: profile.email || '',
            avatar_url: profile.avatar_url,
            course_title: language === 'ar' ? course.title_ar : course.title,
            progress: enrollment.progress || 0,
          });
        }
      }
      return studentData;
    },
  });

  if (isLoading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          {language === 'ar' ? 'الطلاب' : 'Students'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!students || students.length === 0) ? (
          <p className="text-center py-4 text-muted-foreground">{language === 'ar' ? 'لا يوجد طلاب' : 'No students'}</p>
        ) : (
          <div className="space-y-3">
            {students.map((student) => (
              <div key={student.id} className="flex items-center gap-3 p-3 rounded-xl border">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={student.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-gold text-primary-foreground text-sm">
                    {student.full_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{student.full_name}</h4>
                  <p className="text-xs text-muted-foreground truncate">{student.course_title}</p>
                </div>
                <span className="text-sm font-medium">{student.progress}%</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Earnings preview for a specific instructor
const InstructorEarningsPreview = ({ instructorId, language }: { instructorId: string; language: string }) => {
  const { data: earnings, isLoading } = useQuery({
    queryKey: ['admin-instructor-earnings', instructorId],
    queryFn: async () => {
      const { data } = await supabase
        .from('instructor_earnings')
        .select(`*, courses:course_id (title, title_ar)`)
        .eq('instructor_id', instructorId)
        .order('created_at', { ascending: false })
        .limit(10);

      return (data || []).map((e: any) => ({
        id: e.id,
        amount: e.amount,
        status: e.status,
        created_at: e.created_at,
        course_title: language === 'ar' ? (e.courses?.title_ar || '') : (e.courses?.title || ''),
      }));
    },
  });

  if (isLoading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{language === 'ar' ? 'الأرباح' : 'Earnings'}</CardTitle>
      </CardHeader>
      <CardContent>
        {(!earnings || earnings.length === 0) ? (
          <p className="text-center py-4 text-muted-foreground">{language === 'ar' ? 'لا توجد أرباح' : 'No earnings'}</p>
        ) : (
          <div className="space-y-3">
            {earnings.map((earning) => (
              <div key={earning.id} className="flex items-center gap-3 p-3 rounded-xl border">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{earning.course_title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {new Date(earning.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                  </p>
                </div>
                <span className="font-bold text-primary">+{earning.amount.toLocaleString()} ر.س</span>
                <Badge variant={earning.status === 'paid' ? 'default' : 'secondary'}>
                  {earning.status === 'paid' ? (language === 'ar' ? 'تم التحويل' : 'Paid') : (language === 'ar' ? 'معلق' : 'Pending')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
