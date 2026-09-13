import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Eye,
  CheckCircle2,
  Clock,
  Search,
  Download,
  Mail,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Copy,
  ExternalLink,
  RefreshCw,
  UserCheck,
  Target,
  Video,
  BookOpen,
  Filter,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

export interface PreviewStudentRecord {
  id: string; // user_id + lesson_id composite key
  userId: string;
  studentName: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
  institution?: string | null;
  studyYear?: string | null;
  registeredAt?: string | null;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  coursePrice: number;
  firstWatchedAt: string;
  lastWatchedAt: string;
  watchCount: number;
  hasPurchased: boolean;
  purchaseAmount?: number | null;
  purchaseDate?: string | null;
}

interface PreviewStudentsProps {
  onNavigateStudent?: (studentId: string) => void;
}

export const PreviewStudents = ({ onNavigateStudent }: PreviewStudentsProps) => {
  const { language, dir } = useLanguage();
  const isRTL = language === 'ar';

  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'converted' | 'pending'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | '7days' | '30days'>('all');
  const [selectedStudent, setSelectedStudent] = useState<PreviewStudentRecord | null>(null);

  // 1. Fetch preview lessons and their parent course info
  const {
    data: previewData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['preview-students-data'],
    queryFn: async () => {
      // Step A: Get all preview lessons
      const { data: previewLessons, error: lessonsError } = await supabase
        .from('lessons')
        .select(`
          id,
          title,
          title_ar,
          course_id,
          duration_minutes,
          courses (
            id,
            title,
            title_ar,
            price,
            thumbnail_url
          )
        `)
        .eq('is_preview', true);

      if (lessonsError) throw lessonsError;

      const lessons = previewLessons || [];
      const lessonIds = lessons.map((l) => l.id);

      if (lessonIds.length === 0) {
        return {
          records: [],
          coursesList: [],
        };
      }

      // Build unique courses list with preview lessons
      const coursesMap = new Map<string, { id: string; title: string; price: number }>();
      lessons.forEach((l) => {
        const c = l.courses as any;
        if (c && !coursesMap.has(c.id)) {
          coursesMap.set(c.id, {
            id: c.id,
            title: isRTL ? c.title_ar || c.title : c.title || c.title_ar,
            price: Number(c.price || 0),
          });
        }
      });
      const coursesList = Array.from(coursesMap.values());

      // Step B: Query video access logs for preview lessons
      const { data: accessLogs = [], error: accessError } = await supabase
        .from('video_access_logs')
        .select('id, lesson_id, user_id, accessed_at')
        .in('lesson_id', lessonIds);

      if (accessError) console.warn('Error fetching video access logs:', accessError);

      // Step C: Also query lesson progress for preview lessons
      const { data: progressLogs = [], error: progressError } = await supabase
        .from('lesson_progress')
        .select('id, lesson_id, user_id, updated_at, created_at')
        .in('lesson_id', lessonIds);

      if (progressError) console.warn('Error fetching lesson progress:', progressError);

      // Step D: Combine distinct viewers per (user_id, lesson_id)
      const userViewerMap = new Map<
        string,
        {
          userId: string;
          lessonId: string;
          firstWatchedAt: string;
          lastWatchedAt: string;
          count: number;
        }
      >();

      const registerView = (userId: string, lessonId: string, timestamp: string | null) => {
        if (!userId || !lessonId) return;
        const key = `${userId}_${lessonId}`;
        const time = timestamp || new Date().toISOString();
        const existing = userViewerMap.get(key);
        if (!existing) {
          userViewerMap.set(key, {
            userId,
            lessonId,
            firstWatchedAt: time,
            lastWatchedAt: time,
            count: 1,
          });
        } else {
          existing.count += 1;
          if (new Date(time) < new Date(existing.firstWatchedAt)) {
            existing.firstWatchedAt = time;
          }
          if (new Date(time) > new Date(existing.lastWatchedAt)) {
            existing.lastWatchedAt = time;
          }
        }
      };

      (accessLogs || []).forEach((log) => {
        if (log.user_id && log.lesson_id) {
          registerView(log.user_id, log.lesson_id, log.accessed_at);
        }
      });

      (progressLogs || []).forEach((prog) => {
        if (prog.user_id && prog.lesson_id) {
          registerView(prog.user_id, prog.lesson_id, prog.updated_at || prog.created_at);
        }
      });

      const uniqueUserIds = Array.from(new Set(Array.from(userViewerMap.values()).map((v) => v.userId)));

      if (uniqueUserIds.length === 0) {
        return {
          records: [],
          coursesList,
        };
      }

      // Step E: Fetch Profiles, Enrollments, and Payments for these users
      const [profilesRes, enrollmentsRes, paymentsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, full_name_ar, email, phone, avatar_url, institution_name, study_year, created_at')
          .in('id', uniqueUserIds),
        supabase
          .from('enrollments')
          .select('id, user_id, course_id, status, paid_percentage, enrolled_at')
          .in('user_id', uniqueUserIds),
        supabase
          .from('payments')
          .select('id, user_id, course_id, amount, status, paid_at, created_at')
          .in('user_id', uniqueUserIds)
          .eq('status', 'paid'),
      ]);

      const profiles = profilesRes.data || [];
      const enrollments = enrollmentsRes.data || [];
      const payments = paymentsRes.data || [];

      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      // Build active enrollment lookup: `${userId}_${courseId}`
      const activeEnrollmentMap = new Map<string, any>();
      enrollments.forEach((e) => {
        if (e.status === 'active' || (e.paid_percentage && e.paid_percentage > 0)) {
          activeEnrollmentMap.set(`${e.user_id}_${e.course_id}`, e);
        }
      });

      // Build paid payment lookup: `${userId}_${courseId}`
      const paidPaymentMap = new Map<string, any>();
      payments.forEach((p) => {
        if (p.course_id) {
          const key = `${p.user_id}_${p.course_id}`;
          const current = paidPaymentMap.get(key);
          if (!current || (p.amount && p.amount > (current.amount || 0))) {
            paidPaymentMap.set(key, p);
          }
        }
      });

      // Step F: Map into rich PreviewStudent records
      const lessonMap = new Map(lessons.map((l) => [l.id, l]));

      const records: PreviewStudentRecord[] = [];

      userViewerMap.forEach((view, key) => {
        const prof = profileMap.get(view.userId);
        const lesson = lessonMap.get(view.lessonId);
        if (!lesson) return;

        const course = lesson.courses as any;
        const courseId = lesson.course_id;
        const courseTitle = isRTL
          ? course?.title_ar || course?.title || 'دورة تعليمية'
          : course?.title || course?.title_ar || 'Educational Course';
        const lessonTitle = isRTL
          ? lesson.title_ar || lesson.title || 'درس معاينة'
          : lesson.title || lesson.title_ar || 'Preview Lesson';
        const coursePrice = Number(course?.price || 0);

        const enrollKey = `${view.userId}_${courseId}`;
        const activeEnroll = activeEnrollmentMap.get(enrollKey);
        const paidPayment = paidPaymentMap.get(enrollKey);

        const hasPurchased = !!activeEnroll || !!paidPayment;
        const purchaseAmount = paidPayment?.amount ?? (hasPurchased ? coursePrice : 0);
        const purchaseDate = paidPayment?.paid_at || paidPayment?.created_at || activeEnroll?.enrolled_at || null;

        const studentName = isRTL
          ? prof?.full_name_ar || prof?.full_name || prof?.email?.split('@')[0] || 'طالب مجهول'
          : prof?.full_name || prof?.full_name_ar || prof?.email?.split('@')[0] || 'Unknown Student';

        records.push({
          id: key,
          userId: view.userId,
          studentName,
          email: prof?.email || '',
          phone: prof?.phone || '',
          avatarUrl: prof?.avatar_url,
          institution: prof?.institution_name,
          studyYear: prof?.study_year,
          registeredAt: prof?.created_at,
          lessonId: view.lessonId,
          lessonTitle,
          courseId,
          courseTitle,
          coursePrice,
          firstWatchedAt: view.firstWatchedAt,
          lastWatchedAt: view.lastWatchedAt,
          watchCount: view.count,
          hasPurchased,
          purchaseAmount: hasPurchased ? purchaseAmount : null,
          purchaseDate,
        });
      });

      // Sort newest view first
      records.sort((a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime());

      return {
        records,
        coursesList,
      };
    },
    staleTime: 30000,
  });

  const allRecords = previewData?.records || [];
  const coursesList = previewData?.coursesList || [];

  // Filter records
  const filteredRecords = useMemo(() => {
    return allRecords.filter((rec) => {
      // Course filter
      if (courseFilter !== 'all' && rec.courseId !== courseFilter) return false;

      // Status filter
      if (statusFilter === 'converted' && !rec.hasPurchased) return false;
      if (statusFilter === 'pending' && rec.hasPurchased) return false;

      // Time filter
      if (timeFilter !== 'all') {
        const watchTime = new Date(rec.lastWatchedAt).getTime();
        const now = Date.now();
        const days = timeFilter === '7days' ? 7 : 30;
        if (now - watchTime > days * 24 * 60 * 60 * 1000) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const nameMatch = rec.studentName.toLowerCase().includes(q);
        const emailMatch = rec.email.toLowerCase().includes(q);
        const phoneMatch = rec.phone.toLowerCase().includes(q);
        const courseMatch = rec.courseTitle.toLowerCase().includes(q);
        const lessonMatch = rec.lessonTitle.toLowerCase().includes(q);
        return nameMatch || emailMatch || phoneMatch || courseMatch || lessonMatch;
      }

      return true;
    });
  }, [allRecords, courseFilter, statusFilter, timeFilter, search]);

  // Key KPI Calculations
  const stats = useMemo(() => {
    const totalPreviewStudents = new Set(allRecords.map((r) => r.userId)).size;
    const totalPreviewViews = allRecords.reduce((sum, r) => sum + r.watchCount, 0);

    const convertedUsers = new Set(allRecords.filter((r) => r.hasPurchased).map((r) => r.userId));
    const convertedStudentsCount = convertedUsers.size;

    const pendingUsers = new Set(allRecords.filter((r) => !r.hasPurchased).map((r) => r.userId));
    const pendingStudentsCount = pendingUsers.size;

    const conversionRate = totalPreviewStudents > 0
      ? ((convertedStudentsCount / totalPreviewStudents) * 100).toFixed(1)
      : '0.0';

    const realizedRevenue = allRecords
      .filter((r) => r.hasPurchased)
      .reduce((sum, r) => sum + (r.purchaseAmount || r.coursePrice || 0), 0);

    const potentialRevenue = allRecords
      .filter((r) => !r.hasPurchased)
      .reduce((sum, r) => sum + (r.coursePrice || 0), 0);

    return {
      totalPreviewStudents,
      totalPreviewViews,
      convertedStudentsCount,
      pendingStudentsCount,
      conversionRate,
      realizedRevenue,
      potentialRevenue,
    };
  }, [allRecords]);

  // Format WhatsApp Link
  const buildWhatsAppLink = (phone: string, studentName: string, courseTitle: string) => {
    if (!phone) return null;
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('05')) {
      clean = '966' + clean.slice(1);
    } else if (clean.startsWith('5') && clean.length === 9) {
      clean = '966' + clean;
    }

    const greeting = studentName ? `مرحباً ${studentName}، ` : 'مرحباً، ';
    const message = isRTL
      ? `${greeting}يسعدنا تواصلك مع منصة جسوركم! لاحظنا اهتمامك بمعاينة دورة "${courseTitle}". هل تود الحصول على مساعدة بخصوص الدورة أو كود خصم خاص لإتمام تسجيلك؟`
      : `Hello ${studentName}, thank you for checking out "${courseTitle}" on Josoorcom! We'd love to help answer any questions or offer a special discount code.`;

    return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  };

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(isRTL ? `تم نسخ ${label} بنجاح` : `${label} copied to clipboard`);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      toast.info(isRTL ? 'لا توجد بيانات لتصديرها' : 'No data to export');
      return;
    }

    const headers = [
      isRTL ? 'اسم الطالب' : 'Student Name',
      isRTL ? 'البريد الإلكتروني' : 'Email',
      isRTL ? 'رقم الهاتف' : 'Phone',
      isRTL ? 'الجامعة / الجهة' : 'Institution',
      isRTL ? 'الدورة' : 'Course',
      isRTL ? 'درس المعاينة' : 'Preview Lesson',
      isRTL ? 'سعر الدورة' : 'Course Price',
      isRTL ? 'عدد المشاهدات' : 'Watch Count',
      isRTL ? 'تاريخ أول معاينة' : 'First Watched',
      isRTL ? 'تاريخ آخر معاينة' : 'Last Watched',
      isRTL ? 'حالة الشراء' : 'Purchase Status',
      isRTL ? 'المبلغ المدفوع' : 'Amount Paid',
      isRTL ? 'تاريخ الشراء' : 'Purchase Date',
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.studentName.replace(/"/g, '""')}"`,
      `"${r.email}"`,
      `"${r.phone}"`,
      `"${(r.institution || '-').replace(/"/g, '""')}"`,
      `"${r.courseTitle.replace(/"/g, '""')}"`,
      `"${r.lessonTitle.replace(/"/g, '""')}"`,
      r.coursePrice,
      r.watchCount,
      new Date(r.firstWatchedAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US'),
      new Date(r.lastWatchedAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US'),
      r.hasPurchased ? (isRTL ? 'اشترى الدورة' : 'Purchased') : (isRTL ? 'لم يشترِ بعد' : 'Pending Lead'),
      r.purchaseAmount || 0,
      r.purchaseDate ? new Date(r.purchaseDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '-',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `preview_students_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(isRTL ? 'تم تصدير ملف CSV بنجاح' : 'CSV exported successfully');
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isRTL ? 'طلاب المعاينة والفرص البيعية' : 'Preview Students & Conversion Leads'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isRTL
                ? 'سجل تفصيلي للطلاب الذين شاهدوا فيديوهات المعاينة، معلومات التواصل، ومعدلات تحويلهم لمشتركين.'
                : 'Detailed log of students who watched preview videos, contact info, and conversion rates.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isRTL ? 'تحديث' : 'Refresh'}
          </Button>

          <Button
            size="sm"
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="w-4 h-4" />
            {isRTL ? 'تصدير CSV' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Preview Students */}
        <Card className="border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 end-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -me-6 -mt-6" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {isRTL ? 'مشاهدو المعاينة' : 'Preview Viewers'}
              </span>
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold mt-1">
              {stats.totalPreviewStudents}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span>{stats.totalPreviewViews}</span>
              <span>{isRTL ? 'مشاهدة إجمالية مسجلة' : 'total views recorded'}</span>
            </p>
          </CardContent>
        </Card>

        {/* Converted to Paid */}
        <Card className="border border-emerald-500/20 bg-emerald-500/5 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                {isRTL ? 'اشتروا بعد المعاينة' : 'Converted Buyers'}
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <CardTitle className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {stats.convertedStudentsCount}
              </CardTitle>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                {stats.conversionRate}% {isRTL ? 'تحويل' : 'rate'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'طالب تحول إلى مشترك فعلي' : 'students purchased the course'}
            </p>
          </CardContent>
        </Card>

        {/* Pending Leads */}
        <Card className="border border-amber-500/20 bg-amber-500/5 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                {isRTL ? 'فرص بانتظار الشراء' : 'Pending Leads'}
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">
              {stats.pendingStudentsCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'مهتمون بالدورة بحاجة لمتابعة' : 'interested leads ready for outreach'}
            </p>
          </CardContent>
        </Card>

        {/* Realized Revenue */}
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {isRTL ? 'الإيرادات المحققة' : 'Realized Revenue'}
              </span>
              <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold mt-1 text-green-600">
              {stats.realizedRevenue.toLocaleString()} <span className="text-xs font-normal">{isRTL ? 'ر.س' : 'SAR'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'من مبيعات دورات المعاينة' : 'from converted preview courses'}
            </p>
          </CardContent>
        </Card>

        {/* Potential Revenue */}
        <Card className="border border-purple-500/20 bg-purple-500/5 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-purple-800 dark:text-purple-300">
                {isRTL ? 'المبيعات المحتملة' : 'Potential Sales'}
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-purple-700 dark:text-purple-400 mt-1">
              {stats.potentialRevenue.toLocaleString()} <span className="text-xs font-normal">{isRTL ? 'ر.س' : 'SAR'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {isRTL ? 'فرصة مبيعات إضافية من المعاينات' : 'opportunity from pending leads'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel Bar */}
      {stats.totalPreviewStudents > 0 && (
        <Card className="p-4 border shadow-sm bg-gradient-to-r from-card to-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">
                {isRTL ? 'قمع التحويل من المعاينة إلى الشراء' : 'Preview-to-Purchase Conversion Funnel'}
              </span>
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              {stats.convertedStudentsCount} {isRTL ? 'اشتروا' : 'purchased'} ({stats.conversionRate}%) • {stats.pendingStudentsCount} {isRTL ? 'بانتظار التحويل' : 'pending'}
            </div>
          </div>
          <div className="relative h-2.5 w-full bg-amber-500/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, Number(stats.conversionRate)))}%` }}
            />
          </div>
        </Card>
      )}

      {/* Filter & Search Bar */}
      <Card className="p-4 border shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRTL ? 'ابحث بالطالب، البريد، أو الجوال...' : 'Search student, email, phone...'}
              className="ps-9 pe-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Course filter */}
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger>
              <div className="flex items-center gap-2 truncate">
                <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                <SelectValue placeholder={isRTL ? 'الدورة' : 'Course'} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'جميع الدورات' : 'All Courses'}</SelectItem>
              {coursesList.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
            <SelectTrigger>
              <div className="flex items-center gap-2 truncate">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                <SelectValue placeholder={isRTL ? 'حالة الشراء' : 'Status'} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'جميع الحالات' : 'All Statuses'}</SelectItem>
              <SelectItem value="converted">{isRTL ? 'اشترى الدورة (تم التحويل)' : 'Purchased'}</SelectItem>
              <SelectItem value="pending">{isRTL ? 'لم يشترِ بعد (فرصة بيعية)' : 'Pending Lead'}</SelectItem>
            </SelectContent>
          </Select>

          {/* Time filter */}
          <Select value={timeFilter} onValueChange={(val: any) => setTimeFilter(val)}>
            <SelectTrigger>
              <div className="flex items-center gap-2 truncate">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <SelectValue placeholder={isRTL ? 'الفترة الزمنية' : 'Time Period'} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كافة الفترات' : 'All Time'}</SelectItem>
              <SelectItem value="7days">{isRTL ? 'آخر 7 أيام' : 'Last 7 Days'}</SelectItem>
              <SelectItem value="30days">{isRTL ? 'آخر 30 يوم' : 'Last 30 Days'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Main Students Table */}
      <Card className="border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[240px]">{isRTL ? 'الطالب' : 'Student'}</TableHead>
                <TableHead>{isRTL ? 'بيانات التواصل والمتابعة' : 'Contact & Outreach'}</TableHead>
                <TableHead>{isRTL ? 'الدورة المعاينة' : 'Previewed Course'}</TableHead>
                <TableHead>{isRTL ? 'تاريخ المعاينة' : 'Preview Date'}</TableHead>
                <TableHead>{isRTL ? 'حالة الشراء والتحويل' : 'Conversion Status'}</TableHead>
                <TableHead className="text-end">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="py-6">
                      <div className="h-6 bg-muted/60 rounded animate-pulse w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Eye className="w-10 h-10 opacity-30" />
                      <p className="font-semibold">
                        {isRTL ? 'لا يوجد طلاب معاينة مطابقين للبحث' : 'No preview students found'}
                      </p>
                      <p className="text-xs max-w-sm">
                        {isRTL
                          ? 'بمجرد تسجيل دخول أي طالب ومشاهدته لفيديو المعاينة في أي دورة، سيظهر سجله ومعلومات تواصله هنا فوراً.'
                          : 'As soon as any registered student watches a preview lesson, their details and conversion status will appear here.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((rec) => {
                  const waLink = buildWhatsAppLink(rec.phone, rec.studentName, rec.courseTitle);

                  return (
                    <TableRow key={rec.id} className="hover:bg-muted/50 transition-colors">
                      {/* Student Info */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9 border border-primary/20">
                            <AvatarImage src={rec.avatarUrl || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                              {rec.studentName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedStudent(rec)}
                              className="font-medium text-sm text-foreground hover:text-primary transition-colors text-start block truncate max-w-[160px]"
                            >
                              {rec.studentName}
                            </button>
                            {rec.institution && (
                              <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                                {rec.institution}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Contact Info & WhatsApp */}
                      <TableCell>
                        <div className="space-y-1">
                          {rec.phone ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-medium text-foreground dir-ltr">
                                {rec.phone}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(rec.phone, isRTL ? 'رقم الهاتف' : 'phone number')}
                                className="text-muted-foreground hover:text-foreground p-0.5"
                                title={isRTL ? 'نسخ رقم الهاتف' : 'Copy phone'}
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-full transition-colors ms-1"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>{isRTL ? 'واتساب' : 'WhatsApp'}</span>
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              {isRTL ? 'لا يوجد رقم هاتف' : 'No phone'}
                            </span>
                          )}

                          {rec.email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="w-3 h-3 shrink-0" />
                              <a
                                href={`mailto:${rec.email}`}
                                className="hover:text-foreground hover:underline truncate max-w-[180px]"
                              >
                                {rec.email}
                              </a>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Course & Lesson */}
                      <TableCell>
                        <div className="min-w-[160px]">
                          <div className="font-medium text-xs text-foreground truncate max-w-[200px]" title={rec.courseTitle}>
                            {rec.courseTitle}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                            <Video className="w-3 h-3 text-primary shrink-0" />
                            <span className="truncate max-w-[180px]" title={rec.lessonTitle}>
                              {rec.lessonTitle}
                            </span>
                          </div>
                          {rec.coursePrice > 0 && (
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {rec.coursePrice} {isRTL ? 'ر.س' : 'SAR'}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Preview Date & Count */}
                      <TableCell>
                        <div className="text-xs">
                          <div className="font-medium text-foreground">
                            {formatDateTime(rec.lastWatchedAt)}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Eye className="w-3 h-3" />
                            <span>
                              {rec.watchCount} {isRTL ? 'مرات مشاهدة' : 'views'}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Purchase Status */}
                      <TableCell>
                        {rec.hasPurchased ? (
                          <div className="space-y-1">
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[11px] font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              {isRTL ? 'اشترى الدورة' : 'Purchased'}
                            </Badge>
                            {rec.purchaseAmount && (
                              <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                                {rec.purchaseAmount} {isRTL ? 'ر.س' : 'SAR'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 text-[11px]">
                              <Clock className="w-3 h-3" />
                              {isRTL ? 'لم يشترِ بعد' : 'Pending Lead'}
                            </Badge>
                            <div className="text-[10px] text-muted-foreground">
                              {isRTL ? 'فرصة بيع متاحة' : 'Sales lead'}
                            </div>
                          </div>
                        )}
                      </TableCell>

                      {/* Quick Actions */}
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {waLink && (
                            <Button
                              asChild
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              title={isRTL ? 'مراسلة عبر واتساب' : 'Chat on WhatsApp'}
                            >
                              <a href={waLink} target="_blank" rel="noopener noreferrer">
                                <MessageSquare className="w-4 h-4" />
                              </a>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedStudent(rec)}
                            className="h-8 text-xs gap-1"
                          >
                            <span>{isRTL ? 'التفاصيل' : 'Details'}</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Student Details Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        {selectedStudent && (
          <DialogContent className="max-w-md p-6" dir={dir}>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 border-2 border-primary/20">
                  <AvatarImage src={selectedStudent.avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                    {selectedStudent.studentName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {selectedStudent.studentName}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {selectedStudent.institution || (isRTL ? 'طالب منصة جسوركم' : 'Josoorcom Student')}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-3 text-sm">
              {/* Status Box */}
              <div className={`p-3 rounded-xl border ${selectedStudent.hasPurchased ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs">
                    {isRTL ? 'حالة الاشتراك بالدورة:' : 'Course Enrollment Status:'}
                  </span>
                  <Badge className={selectedStudent.hasPurchased ? 'bg-emerald-600' : 'bg-amber-600'}>
                    {selectedStudent.hasPurchased ? (isRTL ? 'مشترك فعلي' : 'Enrolled') : (isRTL ? 'مهتم / لم يشترك' : 'Pending Lead')}
                  </Badge>
                </div>
                {selectedStudent.hasPurchased && selectedStudent.purchaseAmount && (
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
                    {isRTL ? 'المبلغ المدفوع: ' : 'Paid Amount: '}
                    <strong>{selectedStudent.purchaseAmount} {isRTL ? 'ر.س' : 'SAR'}</strong>
                  </p>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-2 bg-muted/30 p-3 rounded-xl border">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {isRTL ? 'معلومات الاتصال' : 'Contact Information'}
                </h4>
                <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRTL ? 'البريد الإلكتروني' : 'Email'}:</span>
                  <span className="font-mono font-medium">{selectedStudent.email || '-'}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-muted-foreground">{isRTL ? 'رقم الجوال' : 'Phone'}:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-medium dir-ltr">{selectedStudent.phone || '-'}</span>
                    {selectedStudent.phone && (
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedStudent.phone, isRTL ? 'رقم الهاتف' : 'phone')}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Course Info */}
              <div className="space-y-2 bg-muted/30 p-3 rounded-xl border">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {isRTL ? 'بيانات المعاينة' : 'Preview Details'}
                </h4>
                <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRTL ? 'الدورة' : 'Course'}:</span>
                  <span className="font-semibold text-end">{selectedStudent.courseTitle}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRTL ? 'درس المعاينة' : 'Preview Lesson'}:</span>
                  <span className="font-medium text-end">{selectedStudent.lessonTitle}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRTL ? 'عدد المشاهدات' : 'View Count'}:</span>
                  <span className="font-medium">{selectedStudent.watchCount} {isRTL ? 'مرات' : 'times'}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-muted-foreground">{isRTL ? 'آخر مشاهدة' : 'Last Watched'}:</span>
                  <span className="font-medium">{formatDateTime(selectedStudent.lastWatchedAt)}</span>
                </div>
              </div>

              {/* Direct Actions */}
              <div className="flex flex-col gap-2 pt-2">
                {selectedStudent.phone && (
                  <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                    <a
                      href={buildWhatsAppLink(selectedStudent.phone, selectedStudent.studentName, selectedStudent.courseTitle) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {isRTL ? 'مراسلة عبر واتساب مباشرة' : 'Direct WhatsApp Outreach'}
                    </a>
                  </Button>
                )}

                {onNavigateStudent && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onNavigateStudent(selectedStudent.userId);
                      setSelectedStudent(null);
                    }}
                    className="w-full gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {isRTL ? 'عرض ملف الطالب الكامل' : 'View Full Student Profile'}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};
