import { useState, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ClipboardList, Users, GraduationCap, BookOpen, Award, 
  Clock, CheckCircle, AlertTriangle, Loader2, TrendingUp,
  DollarSign, FileText, GripVertical, Search, X, Download,
  CreditCard, BarChart3, Eye, Percent
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ListSkeleton } from '@/components/ui/skeletons';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
  delayed: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
  urgent: 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30',
  completed: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
};

const statusLabels: Record<string, { ar: string; en: string }> = {
  pending: { ar: 'معلق', en: 'Pending' },
  in_progress: { ar: 'قيد التنفيذ', en: 'In Progress' },
  delayed: { ar: 'متأخر', en: 'Delayed' },
  urgent: { ar: 'عاجل', en: 'Urgent' },
  completed: { ar: 'مكتمل', en: 'Completed' },
};

const statusIcons: Record<string, any> = {
  pending: Clock,
  in_progress: Loader2,
  delayed: AlertTriangle,
  urgent: AlertTriangle,
  completed: CheckCircle,
};

export const WorkflowDashboard = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('kanban');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [kanbanSearch, setKanbanSearch] = useState('');
  const [instructorSearch, setInstructorSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, requestId: string) => {
    e.dataTransfer.setData('text/plain', requestId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem(requestId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const requestId = e.dataTransfer.getData('text/plain');
    setDraggedItem(null);
    setDragOverColumn(null);

    if (!requestId) return;

    queryClient.setQueryData(['workflow-requests'], (old: any[]) => {
      if (!old) return old;
      return old.map(r => r.id === requestId ? { ...r, status: newStatus } : r);
    });

    const { error } = await supabase
      .from('custom_course_requests')
      .update({ status: newStatus as any })
      .eq('id', requestId);

    if (error) {
      queryClient.invalidateQueries({ queryKey: ['workflow-requests'] });
      toast.error(language === 'ar' ? 'فشل تحديث الحالة' : 'Failed to update status');
    } else {
      toast.success(language === 'ar' ? 'تم تحديث الحالة بنجاح' : 'Status updated successfully');
    }
  }, [queryClient, language]);

  // Fetch requests for Kanban
  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['workflow-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_course_requests')
        .select('*, profiles:user_id(full_name, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch instructor progress with last activity
  const { data: instructors, isLoading: instructorsLoading } = useQuery({
    queryKey: ['workflow-instructors'],
    queryFn: async () => {
      const { data: instructorRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');
      
      if (!instructorRoles?.length) return [];

      const instructorIds = instructorRoles.map(r => r.user_id);
      
      const [profilesRes, coursesRes, earningsRes, lessonsRes, enrollmentsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', instructorIds),
        supabase.from('courses').select('id, title, title_ar, instructor_id, is_active, approval_status, created_at').in('instructor_id', instructorIds),
        supabase.from('instructor_earnings').select('instructor_id, amount, status, created_at').in('instructor_id', instructorIds),
        supabase.from('lessons').select('id, course_id, created_at').in('course_id', 
          (await supabase.from('courses').select('id').in('instructor_id', instructorIds)).data?.map(c => c.id) || []
        ),
        supabase.from('enrollments').select('course_id, status').in('course_id',
          (await supabase.from('courses').select('id').in('instructor_id', instructorIds)).data?.map(c => c.id) || []
        ),
      ]);

      return (profilesRes.data || []).map(profile => {
        const courses = coursesRes.data?.filter(c => c.instructor_id === profile.id) || [];
        const earnings = earningsRes.data?.filter(e => e.instructor_id === profile.id) || [];
        const courseIds = courses.map(c => c.id);
        const lessons = lessonsRes.data?.filter(l => courseIds.includes(l.course_id)) || [];
        const courseEnrollments = enrollmentsRes.data?.filter(e => courseIds.includes(e.course_id)) || [];
        const totalEarnings = earnings.reduce((sum, e) => sum + Number(e.amount), 0);
        const pendingEarnings = earnings.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.amount), 0);
        const activeCourses = courses.filter(c => c.is_active && c.approval_status === 'approved');
        const pendingCourses = courses.filter(c => c.approval_status === 'pending');
        const totalStudents = courseEnrollments.filter(e => e.status === 'active').length;

        // Last activity: most recent lesson or course creation
        const allDates = [
          ...lessons.map(l => l.created_at),
          ...courses.map(c => c.created_at),
        ].filter(Boolean).sort().reverse();
        const lastActivity = allDates[0] || null;

        return {
          ...profile,
          totalCourses: courses.length,
          activeCourses: activeCourses.length,
          pendingCourses: pendingCourses.length,
          totalLessons: lessons.length,
          totalEarnings,
          pendingEarnings,
          totalStudents,
          lastActivity,
        };
      });
    },
  });

  // Fetch student progress with course details & paid_percentage
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['workflow-students'],
    queryFn: async () => {
      const { data: studentRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student')
        .limit(100);
      
      if (!studentRoles?.length) return [];

      const studentIds = studentRoles.map(r => r.user_id);

      const [profilesRes, enrollmentsRes, progressRes, certificatesRes, paymentsRes, coursesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', studentIds),
        supabase.from('enrollments').select('id, user_id, course_id, progress, status, paid_percentage, enrolled_at').in('user_id', studentIds),
        supabase.from('lesson_progress').select('user_id, completed').in('user_id', studentIds),
        supabase.from('certificates').select('user_id').in('user_id', studentIds),
        supabase.from('payments').select('user_id, amount, status, course_id, installment_plan, created_at').in('user_id', studentIds),
        supabase.from('courses').select('id, title, title_ar, price'),
      ]);

      const coursesMap = new Map((coursesRes.data || []).map(c => [c.id, c]));

      return (profilesRes.data || []).map(profile => {
        const enrollments = enrollmentsRes.data?.filter(e => e.user_id === profile.id) || [];
        const progress = progressRes.data?.filter(p => p.user_id === profile.id) || [];
        const certs = certificatesRes.data?.filter(c => c.user_id === profile.id) || [];
        const payments = paymentsRes.data?.filter(p => p.user_id === profile.id && p.status === 'paid') || [];
        const completedLessons = progress.filter(p => p.completed).length;
        const totalLessons = progress.length || 1;
        const avgProgress = enrollments.length > 0 
          ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress || 0), 0) / enrollments.length)
          : 0;
        const totalSpent = payments.reduce((sum, p) => sum + Number(p.amount), 0);

        // Enrollment details with course names & paid percentage
        const enrollmentDetails = enrollments.map(e => {
          const course = coursesMap.get(e.course_id);
          const coursePayments = payments.filter(p => p.course_id === e.course_id);
          const hasInstallment = coursePayments.some(p => p.installment_plan);
          return {
            courseId: e.course_id,
            courseName: language === 'ar' ? course?.title_ar : course?.title,
            coursePrice: course?.price || 0,
            progress: e.progress || 0,
            paidPercentage: Number(e.paid_percentage) || 100,
            status: e.status,
            enrolledAt: e.enrolled_at,
            hasInstallment,
            totalPaid: coursePayments.reduce((s, p) => s + Number(p.amount), 0),
          };
        });

        // Determine payment health
        const hasPartialPayments = enrollmentDetails.some(e => e.paidPercentage < 100);
        const lastPayment = payments.sort((a, b) => 
          new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
        )[0];

        return {
          ...profile,
          enrollments: enrollments.length,
          completedLessons,
          totalLessons,
          avgProgress,
          certificates: certs.length,
          totalSpent,
          activeEnrollments: enrollments.filter(e => e.status === 'active').length,
          enrollmentDetails,
          hasPartialPayments,
          lastPaymentDate: lastPayment?.created_at || null,
        };
      });
    },
  });

  // Filters
  const filteredRequests = kanbanSearch
    ? requests?.filter(r => {
        const q = kanbanSearch.toLowerCase();
        return r.title?.toLowerCase().includes(q) ||
          (r.profiles as any)?.full_name?.toLowerCase().includes(q) ||
          (r.profiles as any)?.email?.toLowerCase().includes(q);
      })
    : requests;

  const filteredInstructors = instructorSearch
    ? instructors?.filter((i: any) => {
        const q = instructorSearch.toLowerCase();
        return i.full_name?.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q);
      })
    : instructors;

  const filteredStudents = studentSearch
    ? students?.filter((s: any) => {
        const q = studentSearch.toLowerCase();
        return s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
      })
    : students;

  // Kanban
  const kanbanColumns = ['pending', 'in_progress', 'urgent', 'delayed', 'completed'];
  const groupedRequests = kanbanColumns.reduce((acc, status) => {
    acc[status] = filteredRequests?.filter(r => r.status === status) || [];
    return acc;
  }, {} as Record<string, any[]>);

  const totalRequests = requests?.length || 0;
  const pendingCount = groupedRequests.pending?.length || 0;
  const inProgressCount = groupedRequests.in_progress?.length || 0;
  const completedCount = groupedRequests.completed?.length || 0;
  const delayedCount = (groupedRequests.delayed?.length || 0) + (groupedRequests.urgent?.length || 0);

  // CSV Export
  const exportCSV = (type: 'requests' | 'instructors' | 'students') => {
    let csv = '';
    const BOM = '\uFEFF';
    
    if (type === 'requests' && requests?.length) {
      const headers = ['Title', 'User', 'Email', 'Status', 'Delivery Method', 'Deadline', 'Final Price', 'Created At'];
      const rows = requests.map(r => [
        `"${r.title || ''}"`, `"${(r.profiles as any)?.full_name || ''}"`, `"${(r.profiles as any)?.email || ''}"`,
        r.status || '', r.delivery_method || '',
        r.deadline ? new Date(r.deadline).toLocaleDateString() : '', r.final_price || '',
        r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
      ]);
      csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (type === 'instructors' && instructors?.length) {
      const headers = ['Name', 'Email', 'Total Courses', 'Active Courses', 'Pending', 'Lessons', 'Students', 'Total Earnings', 'Pending Earnings', 'Last Activity'];
      const rows = instructors.map((i: any) => [
        `"${i.full_name || ''}"`, `"${i.email || ''}"`, i.totalCourses, i.activeCourses, i.pendingCourses,
        i.totalLessons, i.totalStudents, i.totalEarnings, i.pendingEarnings,
        i.lastActivity ? new Date(i.lastActivity).toLocaleDateString() : '',
      ]);
      csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (type === 'students' && students?.length) {
      const headers = ['Name', 'Email', 'Enrollments', 'Active', 'Avg Progress %', 'Completed Lessons', 'Certificates', 'Total Spent', 'Has Installments', 'Last Payment'];
      const rows = students.map((s: any) => [
        `"${s.full_name || ''}"`, `"${s.email || ''}"`, s.enrollments, s.activeEnrollments, s.avgProgress,
        s.completedLessons, s.certificates, s.totalSpent, s.hasPartialPayments ? 'Yes' : 'No',
        s.lastPaymentDate ? new Date(s.lastPaymentDate).toLocaleDateString() : '',
      ]);
      csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else {
      toast.info(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }

    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${type}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(language === 'ar' ? 'تم التصدير بنجاح' : 'Exported successfully');
  };

  const formatRelativeDate = (dateStr: string | null) => {
    if (!dateStr) return language === 'ar' ? 'غير معروف' : 'Unknown';
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return language === 'ar' ? 'اليوم' : 'Today';
    if (days === 1) return language === 'ar' ? 'أمس' : 'Yesterday';
    if (days < 7) return language === 'ar' ? `منذ ${days} أيام` : `${days}d ago`;
    if (days < 30) return language === 'ar' ? `منذ ${Math.floor(days/7)} أسبوع` : `${Math.floor(days/7)}w ago`;
    return language === 'ar' ? `منذ ${Math.floor(days/30)} شهر` : `${Math.floor(days/30)}mo ago`;
  };

  // Summary stats for overview
  const totalStudentsCount = students?.length || 0;
  const totalInstructorsCount = instructors?.length || 0;
  const totalRevenue = students?.reduce((s, st: any) => s + (st.totalSpent || 0), 0) || 0;
  const studentsWithInstallments = students?.filter((s: any) => s.hasPartialPayments).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">
          {language === 'ar' ? 'إدارة سير العمل' : 'Workflow Management'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'ar' ? 'متابعة الطلبات وتقدم المعلمين والطلاب وحالة الأقساط' : 'Track requests, instructor & student progress, and installment status'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: language === 'ar' ? 'إجمالي الطلبات' : 'Total Requests', value: totalRequests, icon: ClipboardList, color: 'bg-primary' },
          { label: language === 'ar' ? 'المعلمين' : 'Instructors', value: totalInstructorsCount, icon: Users, color: 'bg-blue-500' },
          { label: language === 'ar' ? 'الطلاب' : 'Students', value: totalStudentsCount, icon: GraduationCap, color: 'bg-green-500' },
          { label: language === 'ar' ? 'طلبات متأخرة' : 'Delayed', value: delayedCount, icon: AlertTriangle, color: 'bg-red-500' },
          { label: language === 'ar' ? 'أقساط نشطة' : 'Active Installments', value: studentsWithInstallments, icon: CreditCard, color: 'bg-orange-500' },
        ].map((stat, i) => (
          <Card key={i} className="card-premium">
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="kanban" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            {language === 'ar' ? 'لوحة المهام' : 'Task Board'}
          </TabsTrigger>
          <TabsTrigger value="instructors" className="gap-2">
            <Users className="w-4 h-4" />
            {language === 'ar' ? `المعلمين (${totalInstructorsCount})` : `Instructors (${totalInstructorsCount})`}
          </TabsTrigger>
          <TabsTrigger value="students" className="gap-2">
            <GraduationCap className="w-4 h-4" />
            {language === 'ar' ? `الطلاب (${totalStudentsCount})` : `Students (${totalStudentsCount})`}
          </TabsTrigger>
        </TabsList>

        {/* KANBAN TAB */}
        <TabsContent value="kanban" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={kanbanSearch}
                onChange={e => setKanbanSearch(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث عن طلب أو مستخدم...' : 'Search requests or users...'}
                className="ps-9 pe-9"
              />
              {kanbanSearch && (
                <button onClick={() => setKanbanSearch('')} className="absolute end-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => exportCSV('requests')} title={language === 'ar' ? 'تصدير CSV' : 'Export CSV'}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
          {requestsLoading ? <ListSkeleton rows={5} /> : (
            <ScrollArea className="w-full">
              <div className="flex gap-4 min-w-[900px] pb-4">
                {kanbanColumns.map(status => {
                  const StatusIcon = statusIcons[status];
                  const items = groupedRequests[status] || [];
                  const isOver = dragOverColumn === status;
                  return (
                    <div
                      key={status}
                      className="flex-1 min-w-[220px]"
                      onDragOver={(e) => handleDragOver(e, status)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, status)}
                    >
                      <div className={`rounded-xl border p-3 mb-3 flex items-center gap-2 ${statusColors[status]}`}>
                        <StatusIcon className="w-4 h-4" />
                        <span className="font-semibold text-sm">
                          {statusLabels[status]?.[language] || status}
                        </span>
                        <Badge variant="secondary" className="ms-auto text-xs">{items.length}</Badge>
                      </div>
                      <div
                        className={`space-y-3 min-h-[100px] rounded-xl p-1 transition-all duration-200 ${
                          isOver ? 'bg-primary/10 border-2 border-dashed border-primary/40' : 'border-2 border-transparent'
                        }`}
                      >
                        {items.length === 0 && !isOver ? (
                          <div className="text-center text-muted-foreground text-xs py-8 border border-dashed rounded-xl">
                            {language === 'ar' ? 'لا توجد طلبات' : 'No requests'}
                          </div>
                        ) : items.length === 0 && isOver ? (
                          <div className="text-center text-primary text-xs py-8 font-medium">
                            {language === 'ar' ? 'أفلت هنا' : 'Drop here'}
                          </div>
                        ) : items.map((req: any) => (
                          <Card
                            key={req.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, req.id)}
                            onDragEnd={() => { setDraggedItem(null); setDragOverColumn(null); }}
                            className={`hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
                              draggedItem === req.id ? 'opacity-40 scale-95' : ''
                            }`}
                          >
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start gap-2">
                                <GripVertical className="w-4 h-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm line-clamp-2">{req.title}</h4>
                                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                    {(req.profiles as any)?.full_name || (req.profiles as any)?.email || '—'}
                                  </p>
                                </div>
                              </div>
                              {req.deadline && (
                                <div className={`flex items-center gap-1 text-xs ${
                                  new Date(req.deadline) < new Date() ? 'text-destructive font-medium' : 'text-muted-foreground'
                                }`}>
                                  <Clock className="w-3 h-3" />
                                  {new Date(req.deadline).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                                  {new Date(req.deadline) < new Date() && (
                                    <Badge variant="destructive" className="text-[9px] px-1 py-0 ms-1">
                                      {language === 'ar' ? 'فات الموعد' : 'Overdue'}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                {req.final_price && (
                                  <div className="flex items-center gap-1 text-xs font-medium">
                                    <DollarSign className="w-3 h-3" />
                                    {req.final_price} {language === 'ar' ? 'ر.س' : 'SAR'}
                                  </div>
                                )}
                                <Badge variant="outline" className="text-[10px]">
                                  {req.delivery_method === 'recorded' 
                                    ? (language === 'ar' ? 'مسجل' : 'Recorded')
                                    : req.delivery_method === 'zoom_live' ? 'Zoom' : 'Google Meet'
                                  }
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* INSTRUCTORS TAB */}
        <TabsContent value="instructors" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={instructorSearch}
                onChange={e => setInstructorSearch(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث عن معلم بالاسم أو البريد...' : 'Search instructors...'}
                className="ps-9 pe-9"
              />
              {instructorSearch && (
                <button onClick={() => setInstructorSearch('')} className="absolute end-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => exportCSV('instructors')}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
          {instructorsLoading ? <ListSkeleton rows={5} /> : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'ar' ? 'المعلم' : 'Instructor'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الدورات' : 'Courses'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الدروس' : 'Lessons'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الطلاب' : 'Students'}</TableHead>
                      <TableHead>{language === 'ar' ? 'بانتظار الموافقة' : 'Pending'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الأرباح' : 'Earnings'}</TableHead>
                      <TableHead>{language === 'ar' ? 'أرباح معلقة' : 'Pending $'}</TableHead>
                      <TableHead>{language === 'ar' ? 'آخر نشاط' : 'Last Active'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInstructors?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          {language === 'ar' ? 'لا يوجد نتائج' : 'No results found'}
                        </TableCell>
                      </TableRow>
                    ) : filteredInstructors?.map((inst: any) => (
                      <TableRow key={inst.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                              {(inst.full_name || inst.email || '?')[0]}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{inst.full_name || '—'}</div>
                              <div className="text-xs text-muted-foreground">{inst.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{inst.activeCourses}</span>
                            <span className="text-xs text-muted-foreground">/ {inst.totalCourses}</span>
                          </div>
                        </TableCell>
                        <TableCell><span className="font-medium">{inst.totalLessons}</span></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium">{inst.totalStudents}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {inst.pendingCourses > 0 ? (
                            <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                              {inst.pendingCourses}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="w-3 h-3 me-1" />0
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{inst.totalEarnings.toLocaleString()} {language === 'ar' ? 'ر.س' : 'SAR'}</span>
                        </TableCell>
                        <TableCell>
                          {inst.pendingEarnings > 0 ? (
                            <span className="text-yellow-600 font-medium">{inst.pendingEarnings.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{formatRelativeDate(inst.lastActivity)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* STUDENTS TAB */}
        <TabsContent value="students" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث عن طالب بالاسم أو البريد...' : 'Search students...'}
                className="ps-9 pe-9"
              />
              {studentSearch && (
                <button onClick={() => setStudentSearch('')} className="absolute end-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => exportCSV('students')}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
          {studentsLoading ? <ListSkeleton rows={5} /> : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'ar' ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{language === 'ar' ? 'التسجيلات' : 'Enrollments'}</TableHead>
                      <TableHead>{language === 'ar' ? 'التقدم' : 'Progress'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الدروس المكتملة' : 'Lessons'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الشهادات' : 'Certs'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الأقساط' : 'Payments'}</TableHead>
                      <TableHead>{language === 'ar' ? 'إجمالي المدفوعات' : 'Total Spent'}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          {language === 'ar' ? 'لا يوجد نتائج' : 'No results found'}
                        </TableCell>
                      </TableRow>
                    ) : filteredStudents?.map((student: any) => (
                      <>
                        <TableRow key={student.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedStudent(expandedStudent === student.id ? null : student.id)}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold">
                                {(student.full_name || student.email || '?')[0]}
                              </div>
                              <div>
                                <div className="font-medium text-sm">{student.full_name || '—'}</div>
                                <div className="text-xs text-muted-foreground">{student.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{student.activeEnrollments}</span>
                              <span className="text-xs text-muted-foreground">/ {student.enrollments}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <Progress value={student.avgProgress} className="h-2 flex-1" />
                              <span className="text-xs font-medium w-8 text-end">{student.avgProgress}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{student.completedLessons}</span>
                            <span className="text-xs text-muted-foreground"> / {student.totalLessons}</span>
                          </TableCell>
                          <TableCell>
                            {student.certificates > 0 ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <Award className="w-4 h-4" />
                                <span className="font-medium">{student.certificates}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {student.hasPartialPayments ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30 text-[10px]">
                                      <CreditCard className="w-3 h-3 me-1" />
                                      {language === 'ar' ? 'أقساط' : 'Installment'}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {language === 'ar' ? 'هذا الطالب لديه أقساط لم تكتمل بعد' : 'This student has incomplete installments'}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-green-600">
                                <CheckCircle className="w-3 h-3 me-1" />
                                {language === 'ar' ? 'مكتمل' : 'Full'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{student.totalSpent.toLocaleString()} {language === 'ar' ? 'ر.س' : 'SAR'}</span>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {/* Expanded row: course details with paid_percentage */}
                        {expandedStudent === student.id && student.enrollmentDetails?.length > 0 && (
                          <TableRow key={`${student.id}-details`}>
                            <TableCell colSpan={8} className="bg-muted/30 p-0">
                              <div className="p-4 space-y-2">
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-primary" />
                                  {language === 'ar' ? 'تفاصيل الدورات والأقساط' : 'Course & Payment Details'}
                                </h4>
                                <div className="grid gap-2">
                                  {student.enrollmentDetails.map((ed: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-card border text-sm">
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{ed.courseName || ed.courseId}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {language === 'ar' ? 'مسجل' : 'Enrolled'}: {ed.enrolledAt ? new Date(ed.enrolledAt).toLocaleDateString() : '—'}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-4 text-xs">
                                        <div className="text-center">
                                          <p className="text-muted-foreground">{language === 'ar' ? 'التقدم' : 'Progress'}</p>
                                          <div className="flex items-center gap-1 mt-1">
                                            <Progress value={ed.progress} className="h-1.5 w-16" />
                                            <span className="font-medium">{ed.progress}%</span>
                                          </div>
                                        </div>
                                        <div className="text-center">
                                          <p className="text-muted-foreground">{language === 'ar' ? 'المدفوع' : 'Paid'}</p>
                                          <div className="flex items-center gap-1 mt-1">
                                            <Percent className="w-3 h-3" />
                                            <span className={`font-bold ${ed.paidPercentage >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                                              {ed.paidPercentage}%
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-center">
                                          <p className="text-muted-foreground">{language === 'ar' ? 'المبلغ' : 'Amount'}</p>
                                          <p className="font-medium mt-1">{ed.totalPaid.toLocaleString()} / {Number(ed.coursePrice).toLocaleString()}</p>
                                        </div>
                                        {ed.hasInstallment && (
                                          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[10px]">
                                            {language === 'ar' ? 'قسط' : 'Installment'}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
