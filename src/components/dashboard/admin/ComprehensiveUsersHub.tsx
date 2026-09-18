import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users,
  GraduationCap,
  BookOpen,
  Award,
  Wallet,
  MessageSquare,
  ClipboardList,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Phone,
  Mail,
  Calendar,
  Building2,
  DollarSign,
  Send,
  Download,
  Eye,
  ExternalLink,
  Package,
  Trash2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Check,
  X,
  CreditCard,
  FileText,
  UserCheck,
  UserX,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { syncTeacherDataToCloud, TeacherCertificate } from '@/lib/teacherLifecycleService';

export interface AdminUserTask {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: 'normal' | 'important' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  created_by?: string;
}

export const ComprehensiveUsersHub = () => {
  const { dir } = useLanguage();
  const isRTL = dir === 'rtl';
  const { user: currentAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [activeView, setActiveView] = useState<'instructors' | 'students'>('instructors');
  const [search, setSearch] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all');

  // Modals state
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [teacherDetailTab, setTeacherDetailTab] = useState<string>('profile');
  const [studentDetailTab, setStudentDetailTab] = useState<string>('profile');

  // Task creation state
  const [taskModalUser, setTaskModalUser] = useState<{ id: string; name: string; role: 'instructor' | 'student' } | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'normal' | 'important' | 'urgent'>('normal');

  // Direct chat state
  const [chatModalUser, setChatModalUser] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [chatMessageText, setChatMessageText] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; sender: string; text: string; time: string; isAdmin: boolean }>>([]);

  // New certificate upload for teacher modal
  const [isAddingCert, setIsAddingCert] = useState(false);
  const [newCertTitle, setNewCertTitle] = useState('');
  const [newCertFile, setNewCertFile] = useState<string | null>(null);
  const [newCertFileName, setNewCertFileName] = useState('');

  // 1. Fetch all profiles & roles
  const { data: rawUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['comprehensive-users-list'],
    queryFn: async () => {
      const { data: profilesData, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profError) throw profError;

      // Fetch user roles
      const { data: rolesData } = await supabase.from('user_roles').select('user_id, role');
      const rolesMap: Record<string, string[]> = {};
      (rolesData || []).forEach((r) => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      });

      return (profilesData || []).map((p) => {
        const assignedRoles = rolesMap[p.id] || [];
        const isTeacher =
          assignedRoles.includes('instructor') ||
          p.specialty ||
          p.teaching_year ||
          p.academic_degree === 'professor' ||
          p.academic_degree === 'assistant_professor';
        const role = isTeacher ? 'instructor' : 'student';

        // Parse teacher metadata / certificates if available
        let teacherData: any = {};
        if (p.teaching_experience_details) {
          try {
            teacherData = JSON.parse(p.teaching_experience_details);
          } catch {}
        }

        return {
          ...p,
          computedRole: role,
          teacherData,
          certificates: teacherData.certificates || [],
        };
      });
    },
  });

  // 2. Fetch courses
  const { data: allCourses = [] } = useQuery({
    queryKey: ['comprehensive-courses-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, title_ar, price, instructor_id, is_active, is_approved, thumbnail_url, category');
      if (error) return [];
      return data || [];
    },
  });

  // 3. Fetch enrollments
  const { data: allEnrollments = [] } = useQuery({
    queryKey: ['comprehensive-enrollments-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enrollments')
        .select('id, user_id, course_id, status, paid_percentage, enrolled_at');
      if (error) return [];
      return data || [];
    },
  });

  // 4. Fetch payments
  const { data: allPayments = [] } = useQuery({
    queryKey: ['comprehensive-payments-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, user_id, amount, status, course_id, created_at, paid_at, installment_plan')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
  });

  // 5. Fetch bundle purchases
  const { data: allBundlePurchases = [] } = useQuery({
    queryKey: ['comprehensive-bundle-purchases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bundle_purchases')
        .select('id, bundle_id, user_id, amount_paid, status, purchased_at');
      if (error) return [];
      return data || [];
    },
  });

  // 6. Fetch platform settings for tasks
  const { data: allTasksSettings = [] } = useQuery({
    queryKey: ['comprehensive-admin-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value')
        .like('key', 'admin_user_tasks_%');
      if (error) return [];
      return data || [];
    },
  });

  // Map tasks by user_id
  const userTasksMap = useMemo(() => {
    const map: Record<string, AdminUserTask[]> = {};
    allTasksSettings.forEach((s) => {
      const userId = s.key.replace('admin_user_tasks_', '');
      try {
        map[userId] = JSON.parse(s.value);
      } catch {
        map[userId] = [];
      }
    });
    return map;
  }, [allTasksSettings]);

  // Separate Teachers and Students
  const teachers = useMemo(() => {
    return rawUsers.filter((u) => u.computedRole === 'instructor');
  }, [rawUsers]);

  const students = useMemo(() => {
    return rawUsers.filter((u) => u.computedRole === 'student');
  }, [rawUsers]);

  // Filtered teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const name = (t.full_name_ar || t.full_name || '').toLowerCase();
      const email = (t.email || '').toLowerCase();
      const phone = (t.phone || '').toLowerCase();
      const spec = (t.specialty || '').toLowerCase();
      const query = search.toLowerCase();

      const matchesSearch = !query || name.includes(query) || email.includes(query) || phone.includes(query) || spec.includes(query);
      const matchesSpec = filterSpecialty === 'all' || (t.specialty && t.specialty.toLowerCase().includes(filterSpecialty.toLowerCase()));

      return matchesSearch && matchesSpec;
    });
  }, [teachers, search, filterSpecialty]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const name = (s.full_name_ar || s.full_name || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      const query = search.toLowerCase();

      return !query || name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [students, search]);

  // Helper metrics for a teacher
  const getTeacherMetrics = (teacherId: string) => {
    const teacherCourses = allCourses.filter((c) => c.instructor_id === teacherId);
    const courseIds = new Set(teacherCourses.map((c) => c.id));
    const teacherEnrollments = allEnrollments.filter((e) => courseIds.has(e.course_id));
    const teacherPayments = allPayments.filter((p) => p.course_id && courseIds.has(p.course_id) && p.status === 'paid');
    const totalRevenue = teacherPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return {
      courses: teacherCourses,
      coursesCount: teacherCourses.length,
      studentsCount: teacherEnrollments.length,
      totalRevenue,
      teacherShare: Math.round(totalRevenue * 0.7), // Default 70% share
      platformShare: Math.round(totalRevenue * 0.3),
    };
  };

  // Helper metrics for a student
  const getStudentMetrics = (studentId: string) => {
    const studentEnrollments = allEnrollments.filter((e) => e.user_id === studentId);
    const studentBundles = allBundlePurchases.filter((b) => b.user_id === studentId);
    const studentPayments = allPayments.filter((p) => p.user_id === studentId && (p.status === 'paid' || p.status === 'completed'));
    const totalSpent = studentPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return {
      enrollmentsCount: studentEnrollments.length,
      bundlesCount: studentBundles.length,
      totalSpent,
      enrollments: studentEnrollments,
      bundles: studentBundles,
      payments: studentPayments,
    };
  };

  // Save Task Mutation
  const saveTaskMutation = useMutation({
    mutationFn: async () => {
      if (!taskModalUser || !taskTitle.trim()) {
        throw new Error(isRTL ? 'يرجى كتابة عنوان المهمة' : 'Please enter task title');
      }
      const userId = taskModalUser.id;
      const currentTasks = userTasksMap[userId] || [];
      const newTask: AdminUserTask = {
        id: `task_${Date.now()}`,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        due_date: taskDueDate || undefined,
        priority: taskPriority,
        status: 'pending',
        created_at: new Date().toISOString(),
        created_by: currentAdmin?.id,
      };

      const updatedTasks = [newTask, ...currentTasks];
      const { error } = await supabase.from('platform_settings').upsert(
        {
          key: `admin_user_tasks_${userId}`,
          value: JSON.stringify(updatedTasks),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
      if (error) throw error;
      return { userId, updatedTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comprehensive-admin-tasks'] });
      toast.success(isRTL ? 'تمت إضافة المهمة بنجاح' : 'Task added successfully');
      setTaskModalUser(null);
      setTaskTitle('');
      setTaskDesc('');
      setTaskDueDate('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل حفظ المهمة');
    },
  });

  // Toggle Task Status
  const toggleTaskStatus = async (userId: string, taskId: string, newStatus: AdminUserTask['status']) => {
    const currentTasks = userTasksMap[userId] || [];
    const updated = currentTasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      await supabase.from('platform_settings').upsert(
        {
          key: `admin_user_tasks_${userId}`,
          value: JSON.stringify(updated),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
      queryClient.invalidateQueries({ queryKey: ['comprehensive-admin-tasks'] });
      toast.success(isRTL ? 'تم تحديث حالة المهمة' : 'Task status updated');
    } catch {
      toast.error('تعذر تحديث المهمة');
    }
  };

  // Delete Task
  const deleteTask = async (userId: string, taskId: string) => {
    const currentTasks = userTasksMap[userId] || [];
    const updated = currentTasks.filter((t) => t.id !== taskId);

    try {
      await supabase.from('platform_settings').upsert(
        {
          key: `admin_user_tasks_${userId}`,
          value: JSON.stringify(updated),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
      queryClient.invalidateQueries({ queryKey: ['comprehensive-admin-tasks'] });
      toast.success(isRTL ? 'تم حذف المهمة' : 'Task removed');
    } catch {
      toast.error('تعذر حذف المهمة');
    }
  };

  // Upload certificate on behalf of teacher
  const handleSaveCertificate = async (teacherId: string) => {
    if (!newCertTitle.trim()) {
      toast.error(isRTL ? 'يرجى كتابة عنوان الشهادة' : 'Please provide certificate title');
      return;
    }
    const newCert: TeacherCertificate = {
      id: `cert_${Date.now()}`,
      title: newCertTitle.trim(),
      file_url: newCertFile || '',
      file_name: newCertFileName || 'certificate.pdf',
      uploaded_at: new Date().toISOString(),
    };

    const targetUser = rawUsers.find((u) => u.id === teacherId);
    const existing = targetUser?.certificates || [];
    const updated = [...existing, newCert];

    await syncTeacherDataToCloud(teacherId, { certificates: updated }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['comprehensive-users-list'] });
    toast.success(isRTL ? 'تم حفظ الشهادة بنجاح' : 'Certificate saved');
    setIsAddingCert(false);
    setNewCertTitle('');
    setNewCertFile(null);
  };

  // Handle send message in 1-on-1 direct chat
  const handleSendChatMessage = () => {
    if (!chatMessageText.trim() || !chatModalUser) return;
    const msg = {
      id: `chat_${Date.now()}`,
      sender: 'إدارة المنصة (أنت)',
      text: chatMessageText.trim(),
      time: new Date().toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
      isAdmin: true,
    };
    setChatMessages((prev) => [...prev, msg]);
    setChatMessageText('');
    toast.success(isRTL ? `تم إرسال الرسالة إلى ${chatModalUser.name}` : `Message sent to ${chatModalUser.name}`);
  };

  return (
    <div dir={dir} className="space-y-6">
      {/* Header & Overview Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-card via-card/90 to-primary/5 p-6 rounded-2xl border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                {isRTL ? 'دليل المستخدمين الشامل 👥 (360°)' : 'Comprehensive Users Directory (360°)'}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isRTL
                  ? 'عرض تفصيلي لجميع المعلمين والطلاب، بيانات التواصل، الشهادات، الدورات، الأرباح، الشات وإسناد المهام'
                  : 'Full 360 view of instructors and students with contacts, certificates, courses, earnings, chat and tasks'}
              </p>
            </div>
          </div>
        </div>

        {/* Global Mini Stats */}
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1">
          <div className="bg-background/80 border px-3 py-2 rounded-xl text-center shrink-0">
            <span className="text-[11px] text-muted-foreground block">{isRTL ? 'إجمالي المعلمين' : 'Teachers'}</span>
            <span className="text-lg font-black text-amber-600">{teachers.length}</span>
          </div>
          <div className="bg-background/80 border px-3 py-2 rounded-xl text-center shrink-0">
            <span className="text-[11px] text-muted-foreground block">{isRTL ? 'إجمالي الطلاب' : 'Students'}</span>
            <span className="text-lg font-black text-indigo-600">{students.length}</span>
          </div>
          <div className="bg-background/80 border px-3 py-2 rounded-xl text-center shrink-0">
            <span className="text-[11px] text-muted-foreground block">{isRTL ? 'الدورات المتاحة' : 'Courses'}</span>
            <span className="text-lg font-black text-emerald-600">{allCourses.length}</span>
          </div>
        </div>
      </div>

      {/* Main Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Toggle [المعلمون] / [الطلاب] */}
        <div className="bg-muted/60 p-1 rounded-xl flex items-center gap-1 border shrink-0">
          <Button
            type="button"
            variant={activeView === 'instructors' ? 'default' : 'ghost'}
            onClick={() => setActiveView('instructors')}
            className={`gap-2 text-xs sm:text-sm font-bold rounded-lg ${
              activeView === 'instructors' ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs' : 'text-muted-foreground'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>{isRTL ? 'المعلمون والمدربون' : 'Teachers & Instructors'}</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[11px] bg-white/20 text-white font-black">
              {teachers.length}
            </Badge>
          </Button>

          <Button
            type="button"
            variant={activeView === 'students' ? 'default' : 'ghost'}
            onClick={() => setActiveView('students')}
            className={`gap-2 text-xs sm:text-sm font-bold rounded-lg ${
              activeView === 'students' ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs' : 'text-muted-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isRTL ? 'الطلاب والمتعلمون' : 'Students'}</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[11px] bg-white/20 text-white font-black">
              {students.length}
            </Badge>
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeView === 'instructors'
                ? isRTL
                  ? 'ابحث باسم المعلم، التخصص، البريد، أو الهاتف...'
                  : 'Search by teacher name, specialty, email, phone...'
                : isRTL
                ? 'ابحث باسم الطالب، البريد، أو الهاتف...'
                : 'Search by student name, email, phone...'
            }
            className="ps-9 rounded-xl text-xs bg-background/80"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TEACHERS VIEW */}
      {/* ========================================================================= */}
      {activeView === 'instructors' && (
        <div className="space-y-4">
          {isLoadingUsers ? (
            <div className="py-16 text-center text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
              <p className="text-sm">{isRTL ? 'جاري تحميل سجل المعلمين...' : 'Loading teachers directory...'}</p>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <Card className="border shadow-xs text-center py-12">
              <GraduationCap className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-bold text-sm text-foreground">{isRTL ? 'لم يتم العثور على أي معلمين' : 'No instructors found'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? 'جرب البحث بكلمات أخرى أو تحقق من تسجيلات المعلمين' : 'Try searching with different terms'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTeachers.map((teacher) => {
                const metrics = getTeacherMetrics(teacher.id);
                const teacherName = teacher.full_name_ar || teacher.full_name || teacher.email || 'معلم';
                const userTasks = userTasksMap[teacher.id] || [];
                const pendingTasksCount = userTasks.filter((t) => t.status !== 'completed').length;

                return (
                  <Card key={teacher.id} className="border shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden group">
                    <div>
                      {/* Teacher Card Header */}
                      <div className="p-4 border-b bg-gradient-to-br from-amber-500/5 via-transparent to-transparent flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                            {teacherName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-foreground truncate">{teacherName}</h3>
                            <p className="text-[11px] text-muted-foreground truncate">{teacher.email}</p>
                            {teacher.phone && (
                              <p className="text-[11px] text-foreground/80 font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5 text-muted-foreground" />
                                {teacher.phone}
                              </p>
                            )}
                          </div>
                        </div>

                        {teacher.specialty && (
                          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 text-[10px] shrink-0">
                            {teacher.specialty}
                          </Badge>
                        )}
                      </div>

                      {/* Teacher Key Metrics Pills */}
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-muted/40 p-2 rounded-lg border">
                            <span className="text-[10px] text-muted-foreground block">{isRTL ? 'الدورات' : 'Courses'}</span>
                            <span className="font-black text-sm text-foreground">{metrics.coursesCount}</span>
                          </div>
                          <div className="bg-muted/40 p-2 rounded-lg border">
                            <span className="text-[10px] text-muted-foreground block">{isRTL ? 'الطلاب' : 'Students'}</span>
                            <span className="font-black text-sm text-indigo-600">{metrics.studentsCount}</span>
                          </div>
                          <div className="bg-muted/40 p-2 rounded-lg border">
                            <span className="text-[10px] text-muted-foreground block">{isRTL ? 'المبيعات' : 'Revenue'}</span>
                            <span className="font-black text-sm text-emerald-600">{metrics.totalRevenue} ر.س</span>
                          </div>
                        </div>

                        {/* Badges bar */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                          <span className="flex items-center gap-1 text-[11px]">
                            <Award className="w-3.5 h-3.5 text-amber-500" />
                            <span>{teacher.certificates?.length || 0} {isRTL ? 'شهادات مرفوعة' : 'certificates'}</span>
                          </span>

                          {pendingTasksCount > 0 ? (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] px-1.5 py-0">
                              {pendingTasksCount} {isRTL ? 'مهام معلقة' : 'pending tasks'}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">{isRTL ? 'لا توجد مهام' : 'no tasks'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Teacher Action Footer */}
                    <div className="p-3 border-t bg-muted/20 flex items-center justify-between gap-1.5">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setSelectedTeacher(teacher);
                          setTeacherDetailTab('profile');
                        }}
                        className="text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1 flex-1 shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isRTL ? 'التفاصيل الكاملة 360' : 'Full 360 Details'}</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setChatModalUser({ id: teacher.id, name: teacherName, email: teacher.email });
                        }}
                        className="text-xs h-8 gap-1 px-2.5 text-indigo-600 hover:bg-indigo-50 border-indigo-200"
                        title={isRTL ? 'محادثة مباشرة' : 'Direct Chat'}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTaskModalUser({ id: teacher.id, name: teacherName, role: 'instructor' });
                        }}
                        className="text-xs h-8 gap-1 px-2.5 text-foreground hover:bg-muted"
                        title={isRTL ? 'إسناد مهمة' : 'Assign Task'}
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. STUDENTS VIEW */}
      {/* ========================================================================= */}
      {activeView === 'students' && (
        <div className="space-y-4">
          {isLoadingUsers ? (
            <div className="py-16 text-center text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              <p className="text-sm">{isRTL ? 'جاري تحميل سجل الطلاب...' : 'Loading students directory...'}</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <Card className="border shadow-xs text-center py-12">
              <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="font-bold text-sm text-foreground">{isRTL ? 'لم يتم العثور على أي طلاب' : 'No students found'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? 'جرب البحث بكلمات أخرى' : 'Try searching with different terms'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredStudents.map((student) => {
                const metrics = getStudentMetrics(student.id);
                const studentName = student.full_name_ar || student.full_name || student.email || 'طالب';
                const userTasks = userTasksMap[student.id] || [];
                const pendingTasksCount = userTasks.filter((t) => t.status !== 'completed').length;
                const dateJoined = student.created_at ? new Date(student.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '-';

                return (
                  <Card key={student.id} className="border shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden group">
                    <div>
                      {/* Student Card Header */}
                      <div className="p-4 border-b bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                            {studentName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-foreground truncate">{studentName}</h3>
                            <p className="text-[11px] text-muted-foreground truncate">{student.email}</p>
                            {student.phone && (
                              <p className="text-[11px] text-foreground/80 font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5 text-muted-foreground" />
                                {student.phone}
                              </p>
                            )}
                          </div>
                        </div>

                        <Badge variant="outline" className="text-[10px] bg-slate-100 dark:bg-slate-800 text-muted-foreground shrink-0">
                          {dateJoined}
                        </Badge>
                      </div>

                      {/* Student Key Metrics */}
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-muted/40 p-2 rounded-lg border">
                            <span className="text-[10px] text-muted-foreground block">{isRTL ? 'الدورات' : 'Courses'}</span>
                            <span className="font-black text-sm text-foreground">{metrics.enrollmentsCount}</span>
                          </div>
                          <div className="bg-muted/40 p-2 rounded-lg border">
                            <span className="text-[10px] text-muted-foreground block">{isRTL ? 'البكجات' : 'Bundles'}</span>
                            <span className="font-black text-sm text-amber-600">{metrics.bundlesCount}</span>
                          </div>
                          <div className="bg-muted/40 p-2 rounded-lg border">
                            <span className="text-[10px] text-muted-foreground block">{isRTL ? 'المدفوعات' : 'Paid'}</span>
                            <span className="font-black text-sm text-emerald-600">{metrics.totalSpent} ر.س</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                          <span className="text-[11px] truncate">
                            {student.study_year ? `${isRTL ? 'السنة: ' : 'Year: '}${student.study_year}` : (isRTL ? 'حساب مسجل' : 'Registered user')}
                          </span>

                          {pendingTasksCount > 0 && (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] px-1.5 py-0">
                              {pendingTasksCount} {isRTL ? 'ملاحظات/مهام' : 'tasks'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Student Action Footer */}
                    <div className="p-3 border-t bg-muted/20 flex items-center justify-between gap-1.5">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setSelectedStudent(student);
                          setStudentDetailTab('profile');
                        }}
                        className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1 flex-1 shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isRTL ? 'التفاصيل الشاملة 360' : 'Full 360 Details'}</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setChatModalUser({ id: student.id, name: studentName, email: student.email });
                        }}
                        className="text-xs h-8 gap-1 px-2.5 text-indigo-600 hover:bg-indigo-50 border-indigo-200"
                        title={isRTL ? 'محادثة مباشرة' : 'Direct Chat'}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTaskModalUser({ id: student.id, name: studentName, role: 'student' });
                        }}
                        className="text-xs h-8 gap-1 px-2.5 text-foreground hover:bg-muted"
                        title={isRTL ? 'إضافة مهمة/ملاحظة' : 'Add Note/Task'}
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TEACHER 360 FULL DETAILS MODAL */}
      {/* ========================================================================= */}
      {selectedTeacher && (
        <Dialog open={!!selectedTeacher} onOpenChange={(open) => !open && setSelectedTeacher(null)}>
          <DialogContent dir={dir} className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-5 pb-3 border-b bg-muted/20 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-600 text-white font-black text-lg flex items-center justify-center shadow-xs">
                    {(selectedTeacher.full_name_ar || selectedTeacher.full_name || 'T').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                      <span>{selectedTeacher.full_name_ar || selectedTeacher.full_name}</span>
                      <Badge className="bg-amber-600 text-white text-[10px] px-1.5 py-0">
                        👨‍🏫 {isRTL ? 'معلم معتمد' : 'Teacher'}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-0.5">
                      {selectedTeacher.email} {selectedTeacher.phone && `• ${selectedTeacher.phone}`}
                    </DialogDescription>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    setChatModalUser({
                      id: selectedTeacher.id,
                      name: selectedTeacher.full_name_ar || selectedTeacher.full_name,
                      email: selectedTeacher.email,
                    });
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'محادثة مباشرة' : 'Direct Chat'}</span>
                </Button>
              </div>

              {/* Subtabs Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pt-3">
                <Button
                  size="sm"
                  variant={teacherDetailTab === 'profile' ? 'default' : 'ghost'}
                  onClick={() => setTeacherDetailTab('profile')}
                  className="text-xs h-8"
                >
                  {isRTL ? 'البيانات الشخصية والتواصل' : 'Profile & Contacts'}
                </Button>
                <Button
                  size="sm"
                  variant={teacherDetailTab === 'certificates' ? 'default' : 'ghost'}
                  onClick={() => setTeacherDetailTab('certificates')}
                  className="text-xs h-8 gap-1"
                >
                  <span>{isRTL ? 'الشهادات والمؤهلات' : 'Certificates'}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {selectedTeacher.certificates?.length || 0}
                  </Badge>
                </Button>
                <Button
                  size="sm"
                  variant={teacherDetailTab === 'courses' ? 'default' : 'ghost'}
                  onClick={() => setTeacherDetailTab('courses')}
                  className="text-xs h-8 gap-1"
                >
                  <span>{isRTL ? 'الدورات والمقررات' : 'Courses'}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {getTeacherMetrics(selectedTeacher.id).coursesCount}
                  </Badge>
                </Button>
                <Button
                  size="sm"
                  variant={teacherDetailTab === 'finance' ? 'default' : 'ghost'}
                  onClick={() => setTeacherDetailTab('finance')}
                  className="text-xs h-8"
                >
                  {isRTL ? 'الأرباح والمالية' : 'Earnings & Finance'}
                </Button>
                <Button
                  size="sm"
                  variant={teacherDetailTab === 'tasks' ? 'default' : 'ghost'}
                  onClick={() => setTeacherDetailTab('tasks')}
                  className="text-xs h-8 gap-1"
                >
                  <span>{isRTL ? 'المهام الإدارية' : 'Tasks'}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {(userTasksMap[selectedTeacher.id] || []).length}
                  </Badge>
                </Button>
              </div>
            </DialogHeader>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Tab 1: Profile & Contact */}
              {teacherDetailTab === 'profile' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1 p-3 rounded-xl border bg-muted/20">
                      <span className="text-[11px] text-muted-foreground block">{isRTL ? 'الاسم الكامل' : 'Full Name'}</span>
                      <span className="text-sm font-bold text-foreground">{selectedTeacher.full_name_ar || selectedTeacher.full_name}</span>
                    </div>
                    <div className="space-y-1 p-3 rounded-xl border bg-muted/20">
                      <span className="text-[11px] text-muted-foreground block">{isRTL ? 'البريد الإلكتروني' : 'Email'}</span>
                      <span className="text-sm font-bold text-foreground">{selectedTeacher.email}</span>
                    </div>
                    <div className="space-y-1 p-3 rounded-xl border bg-muted/20">
                      <span className="text-[11px] text-muted-foreground block">{isRTL ? 'رقم الهاتف / الواتساب' : 'Phone'}</span>
                      <span className="text-sm font-mono font-bold text-foreground">{selectedTeacher.phone || '-'}</span>
                    </div>
                    <div className="space-y-1 p-3 rounded-xl border bg-muted/20">
                      <span className="text-[11px] text-muted-foreground block">{isRTL ? 'التخصص المعتمد' : 'Specialty'}</span>
                      <span className="text-sm font-bold text-amber-700">{selectedTeacher.specialty || '-'}</span>
                    </div>
                    <div className="space-y-1 p-3 rounded-xl border bg-muted/20">
                      <span className="text-[11px] text-muted-foreground block">{isRTL ? 'الحالة الأكاديمية / المؤهل' : 'Academic Degree'}</span>
                      <span className="text-sm font-bold text-foreground">{selectedTeacher.academic_degree || '-'}</span>
                    </div>
                    <div className="space-y-1 p-3 rounded-xl border bg-muted/20">
                      <span className="text-[11px] text-muted-foreground block">{isRTL ? 'تاريخ الانضمام' : 'Join Date'}</span>
                      <span className="text-sm font-bold text-foreground">
                        {selectedTeacher.created_at ? new Date(selectedTeacher.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '-'}
                      </span>
                    </div>
                  </div>

                  {selectedTeacher.teacherData?.bio && (
                    <div className="p-4 rounded-xl border bg-muted/10 space-y-1">
                      <span className="text-xs font-bold text-foreground block">{isRTL ? 'النبذة التعريفية' : 'Biography'}</span>
                      <p className="text-xs text-muted-foreground leading-relaxed">{selectedTeacher.teacherData.bio}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Certificates */}
              {teacherDetailTab === 'certificates' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm">{isRTL ? 'الشهادات والمؤهلات المرفوعة' : 'Uploaded Certificates'}</h4>
                      <p className="text-xs text-muted-foreground">
                        {isRTL ? 'الشهادات الأكاديمية والمهنية المرفقة من قبل المعلم' : 'Degrees and qualifications submitted by teacher'}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAddingCert(true)}
                      className="text-xs gap-1.5 border-primary/30"
                    >
                      <Plus className="w-3.5 h-3.5 text-primary" />
                      <span>{isRTL ? 'إرفاق شهادة جديدة' : 'Add Certificate'}</span>
                    </Button>
                  </div>

                  {isAddingCert && (
                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                      <h5 className="text-xs font-bold text-foreground">{isRTL ? 'إضافة شهادة جديدة للمعلم' : 'Add New Certificate'}</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          placeholder={isRTL ? 'عنوان أو اسم الشهادة...' : 'Certificate title...'}
                          value={newCertTitle}
                          onChange={(e) => setNewCertTitle(e.target.value)}
                          className="text-xs rounded-xl"
                        />
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setNewCertFileName(file.name);
                              const reader = new FileReader();
                              reader.onload = () => setNewCertFile(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="text-xs"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setIsAddingCert(false)} className="text-xs">
                          {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button size="sm" onClick={() => handleSaveCertificate(selectedTeacher.id)} className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold">
                          {isRTL ? 'حفظ الشهادة' : 'Save Certificate'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {(!selectedTeacher.certificates || selectedTeacher.certificates.length === 0) ? (
                    <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl space-y-2">
                      <Award className="w-8 h-8 mx-auto opacity-40 text-amber-600" />
                      <p className="text-xs font-medium">{isRTL ? 'لم يقم المعلم برفع أي شهادات بعد' : 'No certificates uploaded yet'}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedTeacher.certificates.map((cert: TeacherCertificate) => (
                        <div key={cert.id} className="p-3.5 rounded-xl border bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                              <Award className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-bold text-xs text-foreground truncate">{cert.title}</h5>
                              <p className="text-[10px] text-muted-foreground truncate">{cert.file_name || 'ملف الشهادة'}</p>
                            </div>
                          </div>

                          {cert.file_url ? (
                            <a
                              href={cert.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 rounded-lg border text-xs text-primary font-medium hover:bg-primary/5 flex items-center gap-1 shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>{isRTL ? 'عرض' : 'View'}</span>
                            </a>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">{isRTL ? 'نصية' : 'Text'}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Courses */}
              {teacherDetailTab === 'courses' && (
                <div className="space-y-4">
                  {(() => {
                    const metrics = getTeacherMetrics(selectedTeacher.id);
                    if (metrics.courses.length === 0) {
                      return (
                        <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl space-y-2">
                          <BookOpen className="w-8 h-8 mx-auto opacity-40" />
                          <p className="text-xs font-medium">{isRTL ? 'لم ينشر هذا المعلم أي دورات بعد' : 'No courses published yet'}</p>
                        </div>
                      );
                    }

                    return (
                      <div className="rounded-xl border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="text-xs">{isRTL ? 'الدورة' : 'Course'}</TableHead>
                              <TableHead className="text-center text-xs">{isRTL ? 'السعر' : 'Price'}</TableHead>
                              <TableHead className="text-center text-xs">{isRTL ? 'الطلاب' : 'Students'}</TableHead>
                              <TableHead className="text-center text-xs">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {metrics.courses.map((course) => {
                              const courseEnr = allEnrollments.filter((e) => e.course_id === course.id).length;
                              return (
                                <TableRow key={course.id}>
                                  <TableCell className="font-bold text-xs">
                                    <div className="flex items-center gap-2">
                                      <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                                      <span>{isRTL ? course.title_ar || course.title : course.title}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center text-xs font-bold text-emerald-600">
                                    {course.price ? `${course.price} ر.س` : 'مجاني'}
                                  </TableCell>
                                  <TableCell className="text-center text-xs font-bold text-indigo-600">
                                    {courseEnr}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant={course.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                      {course.is_active ? (isRTL ? 'نشطة' : 'Active') : (isRTL ? 'معطلة' : 'Inactive')}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tab 4: Earnings & Financials */}
              {teacherDetailTab === 'finance' && (
                <div className="space-y-4">
                  {(() => {
                    const metrics = getTeacherMetrics(selectedTeacher.id);
                    const bank = selectedTeacher.teacherData?.bank;

                    return (
                      <div className="space-y-4">
                        {/* Metrics Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-4 rounded-xl border bg-muted/20 text-center">
                            <span className="text-xs text-muted-foreground block">{isRTL ? 'إجمالي المبيعات' : 'Gross Sales'}</span>
                            <span className="text-xl font-black text-foreground">{metrics.totalRevenue} ر.س</span>
                          </div>
                          <div className="p-4 rounded-xl border bg-emerald-500/10 text-center">
                            <span className="text-xs text-muted-foreground block">{isRTL ? 'حصة المعلم التقريبية (70%)' : 'Teacher Payout (70%)'}</span>
                            <span className="text-xl font-black text-emerald-600">{metrics.teacherShare} ر.س</span>
                          </div>
                          <div className="p-4 rounded-xl border bg-indigo-500/10 text-center">
                            <span className="text-xs text-muted-foreground block">{isRTL ? 'حصة المنصة (30%)' : 'Platform Revenue (30%)'}</span>
                            <span className="text-xl font-black text-indigo-600">{metrics.platformShare} ر.س</span>
                          </div>
                        </div>

                        {/* Bank Details */}
                        <div className="p-4 rounded-xl border bg-card space-y-3">
                          <h5 className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                            <CreditCard className="w-4 h-4 text-primary" />
                            <span>{isRTL ? 'بيانات الحساب البنكي والتحويل' : 'Bank & Payout Details'}</span>
                          </h5>

                          {bank ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                              <div>
                                <span className="text-muted-foreground block text-[11px]">{isRTL ? 'اسم البنك:' : 'Bank:'}</span>
                                <strong className="text-foreground">{bank.bank_name || '-'}</strong>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[11px]">{isRTL ? 'اسم صاحب الحساب:' : 'Account Holder:'}</span>
                                <strong className="text-foreground">{bank.account_holder_name || '-'}</strong>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[11px]">{isRTL ? 'رقم الآيبان (IBAN):' : 'IBAN:'}</span>
                                <strong className="font-mono text-foreground">{bank.iban || '-'}</strong>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              {isRTL ? 'لم يتم إدخال بيانات بنكية لهذا المعلم بعد' : 'No bank details submitted yet'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tab 5: Tasks */}
              {teacherDetailTab === 'tasks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm">{isRTL ? 'المهام الإدارية للمعلم' : 'Assigned Tasks'}</h4>
                      <p className="text-xs text-muted-foreground">{isRTL ? 'المهام والتكليفات الموجهة لهذا المعلم' : 'Tasks assigned to this instructor'}</p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setTaskModalUser({ id: selectedTeacher.id, name: selectedTeacher.full_name_ar || selectedTeacher.full_name, role: 'instructor' })}
                      className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isRTL ? 'إضافة مهمة جديدة' : 'Add Task'}</span>
                    </Button>
                  </div>

                  {(() => {
                    const tasks = userTasksMap[selectedTeacher.id] || [];
                    if (tasks.length === 0) {
                      return (
                        <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl space-y-2">
                          <ClipboardList className="w-8 h-8 mx-auto opacity-40" />
                          <p className="text-xs font-medium">{isRTL ? 'لا توجد أي مهام مسندة لهذا المعلم حتى الآن' : 'No tasks assigned yet'}</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2.5">
                        {tasks.map((task) => (
                          <div key={task.id} className="p-3.5 rounded-xl border bg-card flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-foreground">{task.title}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${
                                    task.status === 'completed'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : task.status === 'in_progress'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {task.status === 'completed' ? 'مكتملة ✓' : task.status === 'in_progress' ? 'قيد التنفيذ ⏳' : 'قيد الانتظار 🟡'}
                                </Badge>
                                {task.priority === 'urgent' && (
                                  <Badge className="bg-rose-600 text-white text-[9px] px-1 py-0">{isRTL ? 'عاجل' : 'Urgent'}</Badge>
                                )}
                              </div>
                              {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                              {task.due_date && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{isRTL ? 'تاريخ الاستحقاق: ' : 'Due: '}{task.due_date}</span>
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {task.status !== 'completed' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleTaskStatus(selectedTeacher.id, task.id, 'completed')}
                                  className="text-[11px] h-7 gap-1 text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>{isRTL ? 'اكتمال' : 'Done'}</span>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleTaskStatus(selectedTeacher.id, task.id, 'pending')}
                                  className="text-[11px] h-7 gap-1 text-muted-foreground"
                                >
                                  <span>{isRTL ? 'إعادة فتح' : 'Reopen'}</span>
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTask(selectedTeacher.id, task.id)}
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
              <Button variant="outline" onClick={() => setSelectedTeacher(null)}>
                {isRTL ? 'إغلاق' : 'Close'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* 4. STUDENT 360 FULL DETAILS MODAL */}
      {/* ========================================================================= */}
      {selectedStudent && (
        <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
          <DialogContent dir={dir} className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-5 pb-3 border-b bg-muted/20 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-xs">
                    {(selectedStudent.full_name_ar || selectedStudent.full_name || 'S').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                      <span>{selectedStudent.full_name_ar || selectedStudent.full_name}</span>
                      <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0">
                        🎓 {isRTL ? 'طالب' : 'Student'}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-0.5">
                      {selectedStudent.email} {selectedStudent.phone && `• ${selectedStudent.phone}`}
                    </DialogDescription>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    setChatModalUser({
                      id: selectedStudent.id,
                      name: selectedStudent.full_name_ar || selectedStudent.full_name,
                      email: selectedStudent.email,
                    });
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'محادثة مباشرة' : 'Direct Chat'}</span>
                </Button>
              </div>

              {/* Subtabs Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pt-3">
                <Button
                  size="sm"
                  variant={studentDetailTab === 'profile' ? 'default' : 'ghost'}
                  onClick={() => setStudentDetailTab('profile')}
                  className="text-xs h-8"
                >
                  {isRTL ? 'البيانات الأكاديمية' : 'Academic Profile'}
                </Button>
                <Button
                  size="sm"
                  variant={studentDetailTab === 'courses' ? 'default' : 'ghost'}
                  onClick={() => setStudentDetailTab('courses')}
                  className="text-xs h-8 gap-1"
                >
                  <span>{isRTL ? 'الدورات المسجلة' : 'Courses'}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {getStudentMetrics(selectedStudent.id).enrollmentsCount}
                  </Badge>
                </Button>
                <Button
                  size="sm"
                  variant={studentDetailTab === 'bundles' ? 'default' : 'ghost'}
                  onClick={() => setStudentDetailTab('bundles')}
                  className="text-xs h-8 gap-1"
                >
                  <span>{isRTL ? 'البكجات المشتراة' : 'Bundles'}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {getStudentMetrics(selectedStudent.id).bundlesCount}
                  </Badge>
                </Button>
                <Button
                  size="sm"
                  variant={studentDetailTab === 'payments' ? 'default' : 'ghost'}
                  onClick={() => setStudentDetailTab('payments')}
                  className="text-xs h-8 gap-1"
                >
                  <span>{isRTL ? 'سجل المدفوعات' : 'Payments'}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {getStudentMetrics(selectedStudent.id).payments.length}
                  </Badge>
                </Button>
                <Button
                  size="sm"
                  variant={studentDetailTab === 'tasks' ? 'default' : 'ghost'}
                  onClick={() => setStudentDetailTab('tasks')}
                  className="text-xs h-8 gap-1"
                >
                  <span>{isRTL ? 'ملاحظات ومهام المتابعة' : 'Notes & Tasks'}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {(userTasksMap[selectedStudent.id] || []).length}
                  </Badge>
                </Button>
              </div>
            </DialogHeader>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Tab 1: Profile */}
              {studentDetailTab === 'profile' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 p-3 rounded-xl border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">{isRTL ? 'الاسم الكامل' : 'Full Name'}</span>
                    <span className="text-sm font-bold text-foreground">{selectedStudent.full_name_ar || selectedStudent.full_name}</span>
                  </div>
                  <div className="space-y-1 p-3 rounded-xl border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">{isRTL ? 'البريد الإلكتروني' : 'Email'}</span>
                    <span className="text-sm font-bold text-foreground">{selectedStudent.email}</span>
                  </div>
                  <div className="space-y-1 p-3 rounded-xl border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">{isRTL ? 'رقم الهاتف' : 'Phone'}</span>
                    <span className="text-sm font-mono font-bold text-foreground">{selectedStudent.phone || '-'}</span>
                  </div>
                  <div className="space-y-1 p-3 rounded-xl border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">{isRTL ? 'السنة الدراسية' : 'Study Year'}</span>
                    <span className="text-sm font-bold text-foreground">{selectedStudent.study_year || selectedStudent.academic_year || '-'}</span>
                  </div>
                  <div className="space-y-1 p-3 rounded-xl border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">{isRTL ? 'تاريخ التسجيل' : 'Registered At'}</span>
                    <span className="text-sm font-bold text-foreground">
                      {selectedStudent.created_at ? new Date(selectedStudent.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '-'}
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 2: Enrolled Courses */}
              {studentDetailTab === 'courses' && (
                <div className="space-y-3">
                  {(() => {
                    const metrics = getStudentMetrics(selectedStudent.id);
                    if (metrics.enrollments.length === 0) {
                      return (
                        <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl space-y-2">
                          <BookOpen className="w-8 h-8 mx-auto opacity-40" />
                          <p className="text-xs font-medium">{isRTL ? 'لم يشترك الطالب في أي دورات حتى الآن' : 'No courses enrolled yet'}</p>
                        </div>
                      );
                    }

                    return (
                      <div className="rounded-xl border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="text-xs">{isRTL ? 'الدورة' : 'Course'}</TableHead>
                              <TableHead className="text-center text-xs">{isRTL ? 'تاريخ التسجيل' : 'Enrolled At'}</TableHead>
                              <TableHead className="text-center text-xs">{isRTL ? 'التقدم / الدفع' : 'Paid %'}</TableHead>
                              <TableHead className="text-center text-xs">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {metrics.enrollments.map((enr) => {
                              const crs = allCourses.find((c) => c.id === enr.course_id);
                              return (
                                <TableRow key={enr.id}>
                                  <TableCell className="font-bold text-xs">
                                    {crs ? (isRTL ? crs.title_ar || crs.title : crs.title) : enr.course_id}
                                  </TableCell>
                                  <TableCell className="text-center text-xs text-muted-foreground">
                                    {enr.enrolled_at ? new Date(enr.enrolled_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '-'}
                                  </TableCell>
                                  <TableCell className="text-center text-xs font-bold text-emerald-600">
                                    %{enr.paid_percentage || 100}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                      {enr.status || 'نشط'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tab 3: Purchased Bundles */}
              {studentDetailTab === 'bundles' && (
                <div className="space-y-3">
                  {(() => {
                    const metrics = getStudentMetrics(selectedStudent.id);
                    if (metrics.bundles.length === 0) {
                      return (
                        <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl space-y-2">
                          <Package className="w-8 h-8 mx-auto opacity-40 text-amber-600" />
                          <p className="text-xs font-medium">{isRTL ? 'لم يشترِ الطالب أي باقة حتى الآن' : 'No bundles purchased yet'}</p>
                        </div>
                      );
                    }

                    return (
                      <div className="rounded-xl border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="text-xs">{isRTL ? 'الباقة' : 'Bundle'}</TableHead>
                              <TableHead className="text-center text-xs">{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                              <TableHead className="text-center text-xs">{isRTL ? 'تاريخ الشراء' : 'Date'}</TableHead>
                              <TableHead className="text-center text-xs">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {metrics.bundles.map((b) => (
                              <TableRow key={b.id}>
                                <TableCell className="font-bold text-xs flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{isRTL ? 'باقة شاملة' : 'Bundle'}</span>
                                </TableCell>
                                <TableCell className="text-center text-xs font-bold text-emerald-600">
                                  {b.amount_paid} ر.س
                                </TableCell>
                                <TableCell className="text-center text-xs text-muted-foreground">
                                  {b.purchased_at ? new Date(b.purchased_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '-'}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                    {b.status || 'نشط'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tab 4: Payments Log */}
              {studentDetailTab === 'payments' && (
                <div className="space-y-3">
                  {(() => {
                    const metrics = getStudentMetrics(selectedStudent.id);
                    if (metrics.payments.length === 0) {
                      return (
                        <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl space-y-2">
                          <DollarSign className="w-8 h-8 mx-auto opacity-40" />
                          <p className="text-xs font-medium">{isRTL ? 'لا توجد أي عمليات دفع مسجلة لهذا الطالب' : 'No payments found'}</p>
                        </div>
                      );
                    }

                    return (
                      <div className="rounded-xl border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="text-xs">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                              <TableHead className="text-center text-xs">{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                              <TableHead className="text-center text-xs">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {metrics.payments.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell className="text-xs text-muted-foreground">
                                  {p.created_at ? new Date(p.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '-'}
                                </TableCell>
                                <TableCell className="text-center text-xs font-bold text-emerald-600">
                                  {p.amount} ر.س
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      p.status === 'paid' || p.status === 'completed'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                  >
                                    {p.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tab 5: Tasks & Notes */}
              {studentDetailTab === 'tasks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm">{isRTL ? 'ملاحظات ومهام متابعة الطالب' : 'Student Follow-up Tasks'}</h4>
                      <p className="text-xs text-muted-foreground">{isRTL ? 'سجل المهام والمتابعات الأكاديمية للطالب' : 'Follow-up items and notes for this student'}</p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setTaskModalUser({ id: selectedStudent.id, name: selectedStudent.full_name_ar || selectedStudent.full_name, role: 'student' })}
                      className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isRTL ? 'إضافة مهمة/ملاحظة' : 'Add Task/Note'}</span>
                    </Button>
                  </div>

                  {(() => {
                    const tasks = userTasksMap[selectedStudent.id] || [];
                    if (tasks.length === 0) {
                      return (
                        <div className="py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl space-y-2">
                          <ClipboardList className="w-8 h-8 mx-auto opacity-40" />
                          <p className="text-xs font-medium">{isRTL ? 'لا توجد ملاحظات أو مهام لهذا الطالب' : 'No follow-up tasks recorded'}</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2.5">
                        {tasks.map((task) => (
                          <div key={task.id} className="p-3.5 rounded-xl border bg-card flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-foreground">{task.title}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${
                                    task.status === 'completed'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  }`}
                                >
                                  {task.status === 'completed' ? 'تمت ✓' : 'قيد المتابعة ⏳'}
                                </Badge>
                              </div>
                              {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteTask(selectedStudent.id, task.id)}
                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
              <Button variant="outline" onClick={() => setSelectedStudent(null)}>
                {isRTL ? 'إغلاق' : 'Close'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* 5. ADD TASK DIALOG (FOR TEACHER OR STUDENT) */}
      {/* ========================================================================= */}
      <Dialog open={!!taskModalUser} onOpenChange={(open) => !open && setTaskModalUser(null)}>
        <DialogContent dir={dir} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              <span>{isRTL ? 'إسناد مهمة جديدة إلى:' : 'Assign New Task To:'} {taskModalUser?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isRTL
                ? 'حدد تفاصيل المهمة وتاريخ الاستحقاق لتتبع تنفيذها ومتابعتها في النظام'
                : 'Enter task details and due date for internal administration tracking'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{isRTL ? 'عنوان المهمة *' : 'Task Title *'}</Label>
              <Input
                placeholder={isRTL ? 'مثال: مراجعة خطة دورة الرياضيات وإرسال التعديل' : 'e.g. Review syllabus'}
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{isRTL ? 'وصف أو تفاصيل إضافية' : 'Description'}</Label>
              <Textarea
                placeholder={isRTL ? 'شرح للمطلوب إنجازه...' : 'Details...'}
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                rows={3}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{isRTL ? 'تاريخ الاستحقاق' : 'Due Date'}</Label>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{isRTL ? 'درجة الأهمية' : 'Priority'}</Label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as any)}
                  className="w-full h-9 rounded-xl border bg-background px-3 text-xs"
                >
                  <option value="normal">{isRTL ? 'عادية' : 'Normal'}</option>
                  <option value="important">{isRTL ? 'مهمة' : 'Important'}</option>
                  <option value="urgent">{isRTL ? 'عاجلة جداً' : 'Urgent'}</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button variant="outline" onClick={() => setTaskModalUser(null)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              disabled={saveTaskMutation.isPending}
              onClick={() => saveTaskMutation.mutate()}
              className="bg-primary text-primary-foreground font-bold"
            >
              {saveTaskMutation.isPending ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ وإسناد المهمة' : 'Save Task')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 6. DIRECT 1-ON-1 CHAT MODAL */}
      {/* ========================================================================= */}
      <Dialog open={!!chatModalUser} onOpenChange={(open) => !open && setChatModalUser(null)}>
        <DialogContent dir={dir} className="max-w-lg h-[550px] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-muted/20 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <span>{isRTL ? 'محادثة مباشرة مع:' : 'Direct Chat with:'} {chatModalUser?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {chatModalUser?.email}
            </DialogDescription>
          </DialogHeader>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-xs text-amber-800 dark:text-amber-300">
              <Sparkles className="w-3.5 h-3.5 inline me-1 text-amber-600" />
              <span>{isRTL ? 'هذه محادثة مباشرة خاصة بين إدارة المنصة والمستخدم' : 'Direct private chat channel'}</span>
            </div>

            {chatMessages.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs">
                {isRTL ? 'ابدأ المحادثة الآن بإرسال رسالة توجيهية أو استفسار.' : 'Send a message to start conversation.'}
              </div>
            ) : (
              chatMessages.map((m) => (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] bg-indigo-600 text-white rounded-2xl rounded-br-xs px-3.5 py-2 text-xs shadow-xs space-y-1">
                    <span className="text-[10px] text-indigo-200 block font-bold">{m.sender}</span>
                    <p className="leading-relaxed">{m.text}</p>
                    <span className="text-[9px] text-indigo-200 block text-start">{m.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Message Input Box */}
          <div className="p-3 border-t bg-background shrink-0 flex items-center gap-2">
            <Input
              value={chatMessageText}
              onChange={(e) => setChatMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChatMessage();
                }
              }}
              placeholder={isRTL ? 'اكتب رسالتك المباشرة هنا...' : 'Type direct message...'}
              className="rounded-xl text-xs flex-1"
            />
            <Button
              size="icon"
              onClick={handleSendChatMessage}
              disabled={!chatMessageText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 rounded-xl"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComprehensiveUsersHub;
