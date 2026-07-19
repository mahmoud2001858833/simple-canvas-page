import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Eye, Users, BookOpen, Award, TrendingUp, FileText, Loader2, LayoutDashboard, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export const StudentDetailView = () => {
  const { dir } = useLanguage();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const { data: students, isLoading } = useQuery({
    queryKey: ['admin-students-list'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      if (!roles || roles.length === 0) return [];

      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      const enriched = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { count: enrollmentCount } = await supabase
            .from('enrollments')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          return { ...profile, enrollmentCount: enrollmentCount || 0 };
        })
      );

      return enriched;
    },
  });

  const filteredStudents = students?.filter(s =>
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const texts = {
    ar: {
      title: 'الطالب بالتفصيل',
      subtitle: 'عرض لوحات تحكم الطلاب',
      search: 'ابحث عن طالب...',
      viewDashboard: 'عرض اللوحة',
      courses: 'دورة',
      noStudents: 'لا يوجد طلاب',
      overview: 'نظرة عامة',
      myCourses: 'الدورات',
      progress: 'التقدم',
      certificates: 'الشهادات',
      requests: 'الطلبات',
      dashboardOf: 'لوحة تحكم',
    },
    en: {
      title: 'Student Detail',
      subtitle: 'View student dashboards',
      search: 'Search for student...',
      viewDashboard: 'View Dashboard',
      courses: 'courses',
      noStudents: 'No students found',
      overview: 'Overview',
      myCourses: 'Courses',
      progress: 'Progress',
      certificates: 'Certificates',
      requests: 'Requests',
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
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t.noStudents}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredStudents.map((student) => (
            <Card key={student.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={student.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-bold">
                    {student.full_name?.charAt(0) || 'S'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{student.full_name || student.email}</h3>
                  <p className="text-sm text-muted-foreground truncate">{student.email}</p>
                  {student.study_year && (
                    <Badge variant="outline" className="text-xs mt-1">
                      <Calendar className="w-3 h-3 me-1" />
                      {language === 'ar' ? getYearLabel(student.study_year, 'ar') : getYearLabel(student.study_year, 'en')}
                    </Badge>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {student.enrollmentCount} {t.courses}
                </Badge>
                <Button
                  size="sm"
                  onClick={() => setSelectedStudent(student)}
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

      {/* Student Dashboard Preview Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={selectedStudent?.avatar_url || ''} />
                <AvatarFallback className="bg-gradient-gold text-primary-foreground text-sm">
                  {selectedStudent?.full_name?.charAt(0) || 'S'}
                </AvatarFallback>
              </Avatar>
              {t.dashboardOf}: {selectedStudent?.full_name || selectedStudent?.email}
            </DialogTitle>
          </DialogHeader>

          {selectedStudent && (
            <StudentDashboardPreview studentId={selectedStudent.id} language={language} texts={t} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const YEAR_LABELS_S: Record<string, Record<string, string>> = {
  first: { ar: 'السنة الأولى', en: 'First Year' },
  second: { ar: 'السنة الثانية', en: 'Second Year' },
  third: { ar: 'السنة الثالثة', en: 'Third Year' },
  fourth: { ar: 'السنة الرابعة', en: 'Fourth Year' },
  fifth: { ar: 'السنة الخامسة', en: 'Fifth Year' },
  masters: { ar: 'ماجستير', en: 'Masters' },
  phd: { ar: 'دكتوراه', en: 'PhD' },
};

const getYearLabel = (year: string, lang: string) => YEAR_LABELS_S[year]?.[lang] || year;

const StudentDashboardPreview = ({ studentId, language, texts }: { studentId: string; language: string; texts: any }) => {
  const [activeTab, setActiveTab] = useState('overview');

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
        <TabsTrigger value="progress" className="text-xs sm:text-sm">
          <TrendingUp className="w-4 h-4 me-1 hidden sm:block" />
          {texts.progress}
        </TabsTrigger>
        <TabsTrigger value="certificates" className="text-xs sm:text-sm">
          <Award className="w-4 h-4 me-1 hidden sm:block" />
          {texts.certificates}
        </TabsTrigger>
        <TabsTrigger value="requests" className="text-xs sm:text-sm">
          <FileText className="w-4 h-4 me-1 hidden sm:block" />
          {texts.requests}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6 space-y-6">
        <StudentStatsPreview studentId={studentId} language={language} />
        <StudentCoursesPreview studentId={studentId} language={language} />
      </TabsContent>
      <TabsContent value="courses" className="mt-6">
        <StudentCoursesPreview studentId={studentId} language={language} />
      </TabsContent>
      <TabsContent value="progress" className="mt-6">
        <StudentProgressPreview studentId={studentId} language={language} />
      </TabsContent>
      <TabsContent value="certificates" className="mt-6">
        <StudentCertificatesPreview studentId={studentId} language={language} />
      </TabsContent>
      <TabsContent value="requests" className="mt-6">
        <StudentRequestsPreview studentId={studentId} language={language} />
      </TabsContent>
    </Tabs>
  );
};

const StudentStatsPreview = ({ studentId, language }: { studentId: string; language: string }) => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-student-stats', studentId],
    queryFn: async () => {
      const [enrollmentsRes, progressRes, certificatesRes] = await Promise.all([
        supabase.from('enrollments').select('id', { count: 'exact' }).eq('user_id', studentId),
        supabase.from('lesson_progress').select('completed').eq('user_id', studentId),
        supabase.from('certificates').select('id', { count: 'exact' }).eq('user_id', studentId),
      ]);
      const completedLessons = progressRes.data?.filter(p => p.completed).length || 0;
      const totalLessons = progressRes.data?.length || 1;
      return {
        enrollments: enrollmentsRes.count || 0,
        completedLessons,
        certificates: certificatesRes.count || 0,
        progress: Math.round((completedLessons / totalLessons) * 100),
      };
    },
  });

  const statCards = [
    { label: language === 'ar' ? 'الدورات' : 'Courses', value: stats?.enrollments || 0, icon: BookOpen, color: 'bg-primary' },
    { label: language === 'ar' ? 'ساعات التعلم' : 'Learning Hours', value: `${(stats?.completedLessons || 0) * 0.5}`, icon: Clock, color: 'bg-secondary' },
    { label: language === 'ar' ? 'الشهادات' : 'Certificates', value: stats?.certificates || 0, icon: Award, color: 'bg-accent' },
    { label: language === 'ar' ? 'التقدم' : 'Progress', value: `${stats?.progress || 0}%`, icon: TrendingUp, color: 'bg-success' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-xl font-bold">{isLoading ? '...' : stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const StudentCoursesPreview = ({ studentId, language }: { studentId: string; language: string }) => {
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['admin-student-courses', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('enrollments')
        .select(`*, course:courses(*)`)
        .eq('user_id', studentId)
        .order('enrolled_at', { ascending: false });
      return data || [];
    },
  });

  if (isLoading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{language === 'ar' ? 'الدورات المسجلة' : 'Enrolled Courses'}</CardTitle>
      </CardHeader>
      <CardContent>
        {(!enrollments || enrollments.length === 0) ? (
          <p className="text-center py-4 text-muted-foreground">{language === 'ar' ? 'لا توجد دورات' : 'No courses'}</p>
        ) : (
          <div className="space-y-3">
            {enrollments.map((enrollment: any) => (
              <div key={enrollment.id} className="flex items-center gap-3 p-3 rounded-xl border">
                <div className="w-12 h-12 rounded-lg bg-gradient-gold flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">
                    {language === 'ar' ? enrollment.course?.title_ar : enrollment.course?.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={enrollment.progress || 0} className="flex-1 h-2" />
                    <span className="text-sm font-medium">{enrollment.progress || 0}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const StudentProgressPreview = ({ studentId, language }: { studentId: string; language: string }) => {
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['admin-student-progress', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('enrollments')
        .select(`*, course:courses(id, title, title_ar)`)
        .eq('user_id', studentId)
        .eq('status', 'active');

      if (!data) return [];

      return await Promise.all(
        data.map(async (enrollment: any) => {
          const { count: totalLessons } = await supabase
            .from('lessons')
            .select('id', { count: 'exact', head: true })
            .eq('course_id', enrollment.course_id);

          const { data: lessons } = await supabase
            .from('lessons')
            .select('id')
            .eq('course_id', enrollment.course_id);

          const lessonIds = lessons?.map(l => l.id) || [];
          const { count: completedLessons } = await supabase
            .from('lesson_progress')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', studentId)
            .eq('completed', true)
            .in('lesson_id', lessonIds.length > 0 ? lessonIds : ['none']);

          return {
            ...enrollment,
            totalLessons: totalLessons || 0,
            completedLessons: completedLessons || 0,
            calculatedProgress: totalLessons ? Math.round(((completedLessons || 0) / totalLessons) * 100) : 0,
          };
        })
      );
    },
  });

  if (isLoading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          {language === 'ar' ? 'التقدم في الدورات' : 'Course Progress'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!enrollments || enrollments.length === 0) ? (
          <p className="text-center py-4 text-muted-foreground">{language === 'ar' ? 'لا توجد دورات' : 'No courses'}</p>
        ) : (
          <div className="space-y-4">
            {enrollments.map((item: any) => (
              <div key={item.id} className="p-3 rounded-xl border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{language === 'ar' ? item.course?.title_ar : item.course?.title}</h4>
                  <span className="text-sm text-muted-foreground">{item.completedLessons}/{item.totalLessons}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={item.calculatedProgress} className="flex-1 h-3" />
                  <span className="text-sm font-bold">{item.calculatedProgress}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const StudentCertificatesPreview = ({ studentId, language }: { studentId: string; language: string }) => {
  const { data: certificates, isLoading } = useQuery({
    queryKey: ['admin-student-certificates', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('certificates')
        .select(`*, course:courses(title, title_ar)`)
        .eq('user_id', studentId)
        .order('issued_at', { ascending: false });
      return data || [];
    },
  });

  if (isLoading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          {language === 'ar' ? 'الشهادات' : 'Certificates'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!certificates || certificates.length === 0) ? (
          <p className="text-center py-4 text-muted-foreground">{language === 'ar' ? 'لا توجد شهادات' : 'No certificates'}</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {certificates.map((cert: any) => (
              <div key={cert.id} className="p-4 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-accent" />
                  <h4 className="font-medium">{language === 'ar' ? cert.course?.title_ar : cert.course?.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  {cert.issued_at && format(new Date(cert.issued_at), 'd MMMM yyyy', { locale: language === 'ar' ? ar : enUS })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">#{cert.certificate_number}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const StudentRequestsPreview = ({ studentId, language }: { studentId: string; language: string }) => {
  const { data: requests, isLoading } = useQuery({
    queryKey: ['admin-student-requests', studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('custom_course_requests')
        .select('*')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const statusLabels: Record<string, Record<string, string>> = {
    ar: { pending: 'قيد المراجعة', in_progress: 'قيد التنفيذ', delayed: 'متأخر', urgent: 'عاجل', completed: 'مكتمل' },
    en: { pending: 'Pending', in_progress: 'In Progress', delayed: 'Delayed', urgent: 'Urgent', completed: 'Completed' },
  };

  if (isLoading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          {language === 'ar' ? 'الطلبات' : 'Requests'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!requests || requests.length === 0) ? (
          <p className="text-center py-4 text-muted-foreground">{language === 'ar' ? 'لا توجد طلبات' : 'No requests'}</p>
        ) : (
          <div className="space-y-3">
            {requests.map((request: any) => (
              <div key={request.id} className="flex items-center gap-3 p-3 rounded-xl border">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{request.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(request.created_at), 'PPP', { locale: language === 'ar' ? ar : enUS })}
                  </p>
                </div>
                <Badge>{statusLabels[language][request.status] || request.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
