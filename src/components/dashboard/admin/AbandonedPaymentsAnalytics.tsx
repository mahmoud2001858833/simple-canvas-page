import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Download,
  FileText,
  Users,
  BookOpen,
  DollarSign,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AbandonedPayment {
  id: string;
  user_id: string;
  course_id: string | null;
  amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  user?: { full_name: string | null; email: string | null } | null;
  course?: { title: string | null; title_ar: string | null } | null;
}

export const AbandonedPaymentsAnalytics = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [hoursThreshold, setHoursThreshold] = useState<number>(24);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  const { data: courses = [] } = useQuery({
    queryKey: ['courses-list-abandoned'],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, title_ar')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['abandoned-payments', hoursThreshold, dateFrom, dateTo, courseFilter, methodFilter],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from('payments')
        .select('id, user_id, course_id, amount, payment_method, status, created_at')
        .eq('status', 'pending')
        .lte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (courseFilter !== 'all') query = query.eq('course_id', courseFilter);
      if (methodFilter !== 'all') query = query.eq('payment_method', methodFilter as any);
      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

      const { data: payments, error } = await query;
      if (error) throw error;
      if (!payments || payments.length === 0) return [] as AbandonedPayment[];

      const userIds = [...new Set(payments.map((p) => p.user_id))];
      const courseIds = [...new Set(payments.map((p) => p.course_id).filter(Boolean))] as string[];

      const [{ data: profs }, { data: crs }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').in('id', userIds),
        courseIds.length
          ? supabase.from('courses').select('id, title, title_ar').in('id', courseIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
      const crsMap = new Map((crs || []).map((c: any) => [c.id, c]));

      return payments.map((p) => ({
        ...p,
        user: profMap.get(p.user_id) || null,
        course: p.course_id ? crsMap.get(p.course_id) || null : null,
      })) as AbandonedPayment[];
    },
  });

  const filtered = useMemo(() => {
    if (!studentSearch.trim()) return rows;
    const q = studentSearch.toLowerCase();
    return rows.filter(
      (r) =>
        (r.user?.full_name || '').toLowerCase().includes(q) ||
        (r.user?.email || '').toLowerCase().includes(q),
    );
  }, [rows, studentSearch]);

  const stats = useMemo(() => {
    const totalAmount = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
    const uniqueStudents = new Set(filtered.map((r) => r.user_id)).size;
    const uniqueCourses = new Set(filtered.map((r) => r.course_id).filter(Boolean)).size;
    return { count: filtered.length, totalAmount, uniqueStudents, uniqueCourses };
  }, [filtered]);

  const byCourse = useMemo(() => {
    const map = new Map<string, { title: string; count: number; total: number }>();
    for (const r of filtered) {
      const key = r.course_id || 'no-course';
      const title = r.course
        ? (isRTL ? r.course.title_ar : r.course.title) || key
        : isRTL
          ? 'طلب مخصص'
          : 'Custom Request';
      const cur = map.get(key) || { title, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(r.amount || 0);
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, isRTL]);

  const exportCSV = () => {
    const headers = [
      isRTL ? 'التاريخ' : 'Date',
      isRTL ? 'اسم الطالب' : 'Student Name',
      isRTL ? 'البريد' : 'Email',
      isRTL ? 'الدورة' : 'Course',
      isRTL ? 'المبلغ (ر.س)' : 'Amount (SAR)',
      isRTL ? 'طريقة الدفع' : 'Payment Method',
      isRTL ? 'ساعات منذ الإنشاء' : 'Hours Since Created',
    ];
    const lines = filtered.map((r) => {
      const hours = Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60));
      return [
        new Date(r.created_at).toISOString(),
        r.user?.full_name || '',
        r.user?.email || '',
        (isRTL ? r.course?.title_ar : r.course?.title) || (isRTL ? 'طلب مخصص' : 'Custom Request'),
        r.amount,
        r.payment_method,
        hours,
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });
    const csv = '\uFEFF' + [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abandoned-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(isRTL ? 'تم التصدير CSV' : 'Exported to CSV');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('Abandoned Payments Report', 14, 15);
    doc.setFontSize(10);
    doc.text(
      `Generated: ${new Date().toLocaleString()} | Threshold: ${hoursThreshold}h | Total: ${stats.count} | Amount: ${stats.totalAmount.toLocaleString()} SAR`,
      14,
      22,
    );

    autoTable(doc, {
      startY: 28,
      head: [['Date', 'Student', 'Email', 'Course', 'Amount', 'Method', 'Hrs']],
      body: filtered.map((r) => {
        const hours = Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60));
        return [
          new Date(r.created_at).toLocaleDateString(),
          r.user?.full_name || '',
          r.user?.email || '',
          r.course?.title || r.course?.title_ar || 'Custom Request',
          `${Number(r.amount).toLocaleString()} SAR`,
          r.payment_method,
          String(hours),
        ];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`abandoned-payments-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(isRTL ? 'تم التصدير PDF' : 'Exported to PDF');
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            {isRTL ? 'إحصائيات الدفع المهجور' : 'Abandoned Payments Analytics'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL
              ? 'مدفوعات معلّقة لم يتم إكمالها بعد المدة المحددة'
              : 'Pending payments not completed within the selected time window'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCSV} variant="outline" disabled={!filtered.length}>
            <Download className="w-4 h-4 me-2" />
            CSV
          </Button>
          <Button onClick={exportPDF} disabled={!filtered.length}>
            <FileText className="w-4 h-4 me-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? 'مهجور' : 'Abandoned'}</p>
                <p className="text-2xl font-bold">{stats.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? 'قيمة مفقودة' : 'Lost Value'}</p>
                <p className="text-2xl font-bold">{stats.totalAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? 'طلاب' : 'Students'}</p>
                <p className="text-2xl font-bold">{stats.uniqueStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? 'دورات' : 'Courses'}</p>
                <p className="text-2xl font-bold">{stats.uniqueCourses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isRTL ? 'الفلاتر' : 'Filters'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">{isRTL ? 'الحد (ساعات)' : 'Threshold (h)'}</Label>
              <Select value={String(hoursThreshold)} onValueChange={(v) => setHoursThreshold(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="24">24</SelectItem>
                  <SelectItem value="48">48</SelectItem>
                  <SelectItem value="168">168 (7d)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isRTL ? 'الدورة' : 'Course'}</Label>
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                  {courses.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {isRTL ? c.title_ar : c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isRTL ? 'طريقة الدفع' : 'Method'}</Label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="tabby">Tabby</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isRTL ? 'من تاريخ' : 'From'}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{isRTL ? 'إلى تاريخ' : 'To'}</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{isRTL ? 'بحث طالب' : 'Search student'}</Label>
              <Input
                placeholder={isRTL ? 'اسم أو بريد' : 'Name or email'}
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* By course summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isRTL ? 'حسب الدورة' : 'By Course'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الدورة' : 'Course'}</TableHead>
                  <TableHead>{isRTL ? 'العدد' : 'Count'}</TableHead>
                  <TableHead>{isRTL ? 'الإجمالي (ر.س)' : 'Total (SAR)'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCourse.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    {isRTL ? 'لا يوجد' : 'None'}
                  </TableCell></TableRow>
                ) : byCourse.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>{c.count}</TableCell>
                    <TableCell>{c.total.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {isRTL ? 'تفاصيل الدفعات المهجورة' : 'Abandoned Payment Details'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                  <TableHead>{isRTL ? 'البريد' : 'Email'}</TableHead>
                  <TableHead>{isRTL ? 'الدورة' : 'Course'}</TableHead>
                  <TableHead>{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                  <TableHead>{isRTL ? 'طريقة' : 'Method'}</TableHead>
                  <TableHead>{isRTL ? 'منذ' : 'Age'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6">…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    {isRTL ? 'لا يوجد نتائج' : 'No results'}
                  </TableCell></TableRow>
                ) : filtered.map((r) => {
                  const hours = Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60));
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{r.user?.full_name || '-'}</TableCell>
                      <TableCell className="text-xs">{r.user?.email || '-'}</TableCell>
                      <TableCell>{(isRTL ? r.course?.title_ar : r.course?.title) || (isRTL ? 'طلب مخصص' : 'Custom Request')}</TableCell>
                      <TableCell className="font-semibold">{Number(r.amount).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{r.payment_method}</Badge></TableCell>
                      <TableCell>{hours}h</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
