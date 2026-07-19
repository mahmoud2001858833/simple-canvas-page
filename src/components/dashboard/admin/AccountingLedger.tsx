import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, Legend, Tooltip, AreaChart, Area
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Users, CheckCircle, Clock,
  Download, ArrowUpRight, ArrowDownRight, Wallet, CreditCard, Building2,
  RefreshCw, Search, Filter, Percent, ArrowRight, Banknote, Receipt,
  BookOpen, UserCheck, XCircle, Calendar, FileText, PiggyBank
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, subDays, isWithinInterval } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale';
import { toast } from 'sonner';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', '#EF4444'];

export const AccountingLedger = () => {
  const { dir } = useLanguage();
  const isRTL = dir === 'rtl';
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-ledger', dateFrom, dateTo],
    queryFn: async () => {
      // Fetch all data in parallel
      const [paymentsRes, earningsRes, coursesRes, profilesRes, withdrawalsRes, couponsRes, couponUsageRes, enrollmentsRes] = await Promise.all([
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
        supabase.from('instructor_earnings').select('*'),
        supabase.from('courses').select('id, title, title_ar, instructor_id, instructor_commission, price, original_price'),
        supabase.from('profiles').select('id, full_name, email'),
        supabase.from('withdrawal_requests').select('*'),
        supabase.from('coupons').select('*'),
        supabase.from('coupon_usage').select('*'),
        supabase.from('enrollments').select('id, course_id, user_id, enrolled_at'),
      ]);

      return {
        payments: paymentsRes.data || [],
        earnings: earningsRes.data || [],
        courses: coursesRes.data || [],
        profiles: profilesRes.data || [],
        withdrawals: withdrawalsRes.data || [],
        coupons: couponsRes.data || [],
        couponUsage: couponUsageRes.data || [],
        enrollments: enrollmentsRes.data || [],
      };
    },
  });

  const computed = useMemo(() => {
    if (!data) return null;

    const { payments, earnings, courses, profiles, withdrawals, coupons, couponUsage, enrollments } = data;

    const getProfile = (id: string) => profiles.find(p => p.id === id);
    const getCourse = (id: string) => courses.find(c => c.id === id);

    // Filter by date range
    const filterByDate = (date: string | null) => {
      if (!date) return true;
      const d = new Date(date);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    };

    const filteredPayments = payments.filter(p => filterByDate(p.created_at));
    const paidPayments = filteredPayments.filter(p => p.status === 'paid');
    const pendingPayments = filteredPayments.filter(p => p.status === 'pending');
    const failedPayments = filteredPayments.filter(p => p.status === 'failed');
    const refundedPayments = filteredPayments.filter(p => p.status === 'refunded');

    // === MONEY IN ===
    const totalMoneyIn = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
    const pendingMoneyIn = pendingPayments.reduce((s, p) => s + Number(p.amount), 0);
    const refundedTotal = refundedPayments.reduce((s, p) => s + Number(p.amount), 0);

    // === MONEY OUT (to instructors) ===
    const filteredEarnings = earnings.filter(e => filterByDate(e.created_at));
    const totalInstructorEarnings = filteredEarnings.reduce((s, e) => s + Number(e.amount), 0);
    const paidToInstructors = filteredEarnings.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.amount), 0);
    const pendingForInstructors = filteredEarnings.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount), 0);

    // === WITHDRAWALS ===
    const filteredWithdrawals = withdrawals.filter(w => filterByDate(w.requested_at));
    const approvedWithdrawals = filteredWithdrawals.filter(w => w.status === 'approved' || w.status === 'paid');
    const pendingWithdrawals = filteredWithdrawals.filter(w => w.status === 'pending');
    const totalWithdrawn = approvedWithdrawals.reduce((s, w) => s + Number(w.amount), 0);
    const pendingWithdrawalAmount = pendingWithdrawals.reduce((s, w) => s + Number(w.amount), 0);

    // === PLATFORM NET ===
    const platformNet = totalMoneyIn - totalInstructorEarnings;

    // === COUPON IMPACT ===
    const totalCouponDiscounts = couponUsage.reduce((s, u) => s + Number(u.discount_amount), 0);
    const activeCoupons = coupons.filter(c => c.is_active).length;

    // === PER-COURSE DETAILED BREAKDOWN ===
    const courseBreakdown = courses.map(course => {
      const coursePayments = paidPayments.filter(p => p.course_id === course.id);
      const courseEarnings = filteredEarnings.filter(e => e.course_id === course.id);
      const courseCouponUsage = couponUsage.filter(u => {
        const payment = payments.find(p => p.id === u.payment_id);
        return payment?.course_id === course.id;
      });
      const courseEnrollments = enrollments.filter(e => e.course_id === course.id);
      const instructor = getProfile(course.instructor_id || '');
      
      const grossRevenue = coursePayments.reduce((s, p) => s + Number(p.amount), 0);
      const discountsGiven = courseCouponUsage.reduce((s, u) => s + Number(u.discount_amount), 0);
      const instructorShare = courseEarnings.reduce((s, e) => s + Number(e.amount), 0);
      const platformShare = grossRevenue - instructorShare;
      const commission = course.instructor_commission || 30;

      return {
        id: course.id,
        title: isRTL ? course.title_ar : course.title,
        instructor: instructor?.full_name || '-',
        instructorEmail: instructor?.email || '',
        salesCount: coursePayments.length,
        enrollmentsCount: courseEnrollments.length,
        listPrice: course.price || 0,
        grossRevenue,
        discountsGiven,
        netRevenue: grossRevenue,
        commission,
        instructorShare,
        platformShare,
        paidToInstructor: courseEarnings.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.amount), 0),
        pendingForInstructor: courseEarnings.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount), 0),
      };
    }).filter(c => c.grossRevenue > 0 || c.enrollmentsCount > 0).sort((a, b) => b.grossRevenue - a.grossRevenue);

    // === PER-INSTRUCTOR BREAKDOWN ===
    const instructorIds = [...new Set(earnings.map(e => e.instructor_id))];
    const instructorBreakdown = instructorIds.map(id => {
      const instructor = getProfile(id);
      const instEarnings = filteredEarnings.filter(e => e.instructor_id === id);
      const instWithdrawals = filteredWithdrawals.filter(w => w.instructor_id === id);
      const instCourses = courses.filter(c => c.instructor_id === id);
      
      const totalEarned = instEarnings.reduce((s, e) => s + Number(e.amount), 0);
      const totalPaid = instEarnings.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.amount), 0);
      const totalPending = instEarnings.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount), 0);
      const totalWithdrawnByInst = instWithdrawals.filter(w => w.status === 'paid' || w.status === 'approved').reduce((s, w) => s + Number(w.amount), 0);
      const pendingWithdrawalByInst = instWithdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + Number(w.amount), 0);
      const balance = totalPaid - totalWithdrawnByInst;

      return {
        id,
        name: instructor?.full_name || '-',
        email: instructor?.email || '',
        coursesCount: instCourses.length,
        totalEarned,
        totalPaid,
        totalPending,
        totalWithdrawn: totalWithdrawnByInst,
        pendingWithdrawal: pendingWithdrawalByInst,
        balance,
      };
    }).sort((a, b) => b.totalEarned - a.totalEarned);

    // === PAYMENT METHOD BREAKDOWN ===
    const methodBreakdown: Record<string, { count: number; amount: number }> = {};
    paidPayments.forEach(p => {
      const method = p.payment_method || 'unknown';
      if (!methodBreakdown[method]) methodBreakdown[method] = { count: 0, amount: 0 };
      methodBreakdown[method].count++;
      methodBreakdown[method].amount += Number(p.amount);
    });

    // === DAILY REVENUE (last 30 days) ===
    const dailyRevenue = [];
    for (let i = 29; i >= 0; i--) {
      const day = subDays(new Date(), i);
      const dayStart = new Date(day.setHours(0, 0, 0, 0));
      const dayEnd = new Date(day.setHours(23, 59, 59, 999));
      const dayPayments = paidPayments.filter(p => {
        const d = new Date(p.paid_at || p.created_at);
        return d >= dayStart && d <= dayEnd;
      });
      const dayEarnings = filteredEarnings.filter(e => {
        const d = new Date(e.created_at);
        return d >= dayStart && d <= dayEnd;
      });
      dailyRevenue.push({
        date: format(dayStart, 'dd/MM'),
        revenue: dayPayments.reduce((s, p) => s + Number(p.amount), 0),
        instructorShare: dayEarnings.reduce((s, e) => s + Number(e.amount), 0),
        platformShare: dayPayments.reduce((s, p) => s + Number(p.amount), 0) - dayEarnings.reduce((s, e) => s + Number(e.amount), 0),
        transactions: dayPayments.length,
      });
    }

    // === FULL TRANSACTION LEDGER ===
    const ledger = filteredPayments.map(p => {
      const student = getProfile(p.user_id);
      const course = getCourse(p.course_id || '');
      const instructor = course ? getProfile(course.instructor_id || '') : null;
      const paymentEarnings = earnings.filter(e => e.payment_id === p.id);
      const instructorAmount = paymentEarnings.reduce((s, e) => s + Number(e.amount), 0);
      const platformAmount = p.status === 'paid' ? Number(p.amount) - instructorAmount : 0;
      const couponUsed = couponUsage.find(u => u.payment_id === p.id);

      return {
        id: p.id,
        date: p.created_at,
        paidAt: p.paid_at,
        student: student?.full_name || student?.email || '-',
        course: course ? (isRTL ? course.title_ar : course.title) : '-',
        instructor: instructor?.full_name || '-',
        amount: Number(p.amount),
        method: p.payment_method,
        status: p.status,
        instructorAmount,
        platformAmount,
        commission: course?.instructor_commission || 30,
        couponDiscount: couponUsed ? Number(couponUsed.discount_amount) : 0,
        transactionId: p.transaction_id,
        notes: p.notes,
      };
    });

    // Search filter
    const filteredLedger = search
      ? ledger.filter(l =>
          l.student.toLowerCase().includes(search.toLowerCase()) ||
          l.course.toLowerCase().includes(search.toLowerCase()) ||
          l.instructor.toLowerCase().includes(search.toLowerCase()) ||
          l.transactionId?.toLowerCase().includes(search.toLowerCase())
        )
      : ledger;

    // === MONEY FLOW SUMMARY ===
    const moneyFlow = {
      totalIn: totalMoneyIn,
      toInstructors: totalInstructorEarnings,
      toPlatform: platformNet,
      refunded: refundedTotal,
      pendingIn: pendingMoneyIn,
      withdrawn: totalWithdrawn,
      pendingWithdrawal: pendingWithdrawalAmount,
      couponDiscounts: totalCouponDiscounts,
      activeCoupons,
      paidToInstructors,
      pendingForInstructors,
    };

    return {
      moneyFlow,
      courseBreakdown,
      instructorBreakdown,
      methodBreakdown,
      dailyRevenue,
      ledger: filteredLedger,
      stats: {
        totalTransactions: filteredPayments.length,
        successRate: filteredPayments.length > 0 ? Math.round((paidPayments.length / filteredPayments.length) * 100) : 0,
        failedCount: failedPayments.length,
        avgOrderValue: paidPayments.length > 0 ? totalMoneyIn / paidPayments.length : 0,
      },
    };
  }, [data, dateFrom, dateTo, search, isRTL]);

  const fmt = (n: number) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: isRTL ? arLocale : undefined }) : '-';

  const methodLabel = (m: string) => {
    const map: Record<string, string> = isRTL
      ? { online: 'بطاقة', bank_transfer: 'تحويل بنكي', tabby: 'تابي', manual: 'يدوي' }
      : { online: 'Card', bank_transfer: 'Bank Transfer', tabby: 'Tabby', manual: 'Manual' };
    return map[m] || m;
  };

  const statusBadge = (s: string) => {
    const cfg: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      paid: { variant: 'default', label: isRTL ? 'مدفوع' : 'Paid' },
      pending: { variant: 'secondary', label: isRTL ? 'معلق' : 'Pending' },
      failed: { variant: 'destructive', label: isRTL ? 'فشل' : 'Failed' },
      refunded: { variant: 'outline', label: isRTL ? 'مسترد' : 'Refunded' },
    };
    const c = cfg[s] || { variant: 'secondary' as const, label: s };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const exportCSV = () => {
    if (!computed) return;
    const rows = [
      ['التاريخ', 'الطالب', 'الدورة', 'المعلم', 'المبلغ', 'طريقة الدفع', 'الحالة', 'حصة المعلم', 'حصة المنصة', 'خصم كوبون', 'رقم العملية'],
      ...computed.ledger.map(l => [
        fmtDate(l.date), l.student, l.course, l.instructor,
        l.amount, methodLabel(l.method), l.status,
        l.instructorAmount, l.platformAmount, l.couponDiscount, l.transactionId || ''
      ]),
      [],
      ['--- ملخص ---'],
      ['إجمالي الإيرادات', computed.moneyFlow.totalIn],
      ['حصة المعلمين', computed.moneyFlow.toInstructors],
      ['صافي المنصة', computed.moneyFlow.toPlatform],
      ['المبالغ المستردة', computed.moneyFlow.refunded],
      ['المبالغ المسحوبة', computed.moneyFlow.withdrawn],
      ['خصومات الكوبونات', computed.moneyFlow.couponDiscounts],
    ];
    const csv = rows.map(r => Array.isArray(r) ? r.join(',') : r).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `accounting-ledger-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success(isRTL ? 'تم تصدير دفتر الحسابات' : 'Ledger exported');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!computed) return null;
  const { moneyFlow, courseBreakdown, instructorBreakdown, methodBreakdown, dailyRevenue, ledger, stats } = computed;

  const pieData = Object.entries(methodBreakdown).map(([method, { amount }]) => ({
    name: methodLabel(method),
    value: amount,
  }));

  const flowData = [
    { name: isRTL ? 'حصة المعلمين' : 'Instructors', value: moneyFlow.toInstructors },
    { name: isRTL ? 'صافي المنصة' : 'Platform', value: moneyFlow.toPlatform },
    { name: isRTL ? 'مستردات' : 'Refunds', value: moneyFlow.refunded },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{isRTL ? 'دفتر الحسابات الشامل' : 'Comprehensive Accounting Ledger'}</h1>
          <p className="text-muted-foreground mt-1">
            {isRTL ? 'تتبع كل ريال: من أين جاء وأين ذهب' : 'Track every riyal: where it came from and where it went'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportCSV}>
            <Download className="w-4 h-4" />
            {isRTL ? 'تصدير CSV' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium">{isRTL ? 'فترة التقرير:' : 'Report Period:'}</span>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                {isRTL ? 'إزالة الفلتر' : 'Clear'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* === MONEY FLOW OVERVIEW === */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Banknote className="w-5 h-5 text-primary" />
          {isRTL ? 'تدفق الأموال' : 'Money Flow'}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Money IN */}
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <ArrowDownRight className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'إجمالي الداخل' : 'Total Money In'}</p>
                  <p className="text-lg font-bold text-green-600">{fmt(moneyFlow.totalIn)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Platform Share */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <PiggyBank className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'صافي المنصة' : 'Platform Net'}</p>
                  <p className="text-lg font-bold text-primary">{fmt(moneyFlow.toPlatform)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* To Instructors */}
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'حصة المعلمين' : 'Instructor Share'}</p>
                  <p className="text-lg font-bold text-amber-600">{fmt(moneyFlow.toInstructors)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'معلق' : 'Pending'}</p>
                  <p className="text-lg font-bold">{fmt(moneyFlow.pendingIn)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{isRTL ? 'مدفوع للمعلمين' : 'Paid Out'}</p>
            <p className="font-bold text-green-600">{fmt(moneyFlow.paidToInstructors)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{isRTL ? 'معلق للمعلمين' : 'Owed'}</p>
            <p className="font-bold text-amber-600">{fmt(moneyFlow.pendingForInstructors)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{isRTL ? 'تم سحبه' : 'Withdrawn'}</p>
            <p className="font-bold">{fmt(moneyFlow.withdrawn)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{isRTL ? 'سحب معلق' : 'Pending Wd.'}</p>
            <p className="font-bold text-amber-600">{fmt(moneyFlow.pendingWithdrawal)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{isRTL ? 'مستردات' : 'Refunds'}</p>
            <p className="font-bold text-destructive">{fmt(moneyFlow.refunded)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{isRTL ? 'خصومات كوبونات' : 'Coupon Disc.'}</p>
            <p className="font-bold text-purple-600">{fmt(moneyFlow.couponDiscounts)}</p>
          </CardContent></Card>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue Area Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isRTL ? 'الإيرادات اليومية (30 يوم)' : 'Daily Revenue (30 days)'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Area type="monotone" dataKey="revenue" name={isRTL ? 'الإيرادات' : 'Revenue'} stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                <Area type="monotone" dataKey="instructorShare" name={isRTL ? 'حصة المعلم' : 'Instructor'} stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isRTL ? 'توزيع الإيرادات' : 'Revenue Distribution'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={flowData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {flowData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <p className="text-xs text-center text-muted-foreground">{isRTL ? 'توزيع الأرباح' : 'Profit Split'}</p>
              <p className="text-xs text-center text-muted-foreground">{isRTL ? 'طرق الدفع' : 'Payment Methods'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      <Tabs defaultValue="ledger" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="ledger">{isRTL ? 'سجل المعاملات' : 'Transaction Ledger'}</TabsTrigger>
          <TabsTrigger value="courses">{isRTL ? 'حسابات الدورات' : 'Course Accounts'}</TabsTrigger>
          <TabsTrigger value="instructors">{isRTL ? 'حسابات المعلمين' : 'Instructor Accounts'}</TabsTrigger>
          <TabsTrigger value="methods">{isRTL ? 'طرق الدفع' : 'Payment Methods'}</TabsTrigger>
        </TabsList>

        {/* Full Transaction Ledger */}
        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <CardTitle>{isRTL ? 'سجل المعاملات التفصيلي' : 'Detailed Transaction Ledger'}</CardTitle>
                <div className="relative w-full md:w-72">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={isRTL ? 'بحث بالاسم أو الدورة...' : 'Search by name or course...'}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="ps-10"
                  />
                </div>
              </div>
              <CardDescription>
                {isRTL
                  ? `${ledger.length} معاملة | نسبة النجاح: ${stats.successRate}% | متوسط الطلب: ${fmt(stats.avgOrderValue)}`
                  : `${ledger.length} transactions | Success: ${stats.successRate}% | Avg: ${fmt(stats.avgOrderValue)}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{isRTL ? 'الدورة' : 'Course'}</TableHead>
                      <TableHead>{isRTL ? 'المعلم' : 'Instructor'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'خصم' : 'Disc.'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'المعلم' : 'Instr.'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'المنصة' : 'Platform'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الطريقة' : 'Method'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.slice(0, 50).map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{fmtDate(l.date)}</TableCell>
                        <TableCell className="font-medium text-sm max-w-[120px] truncate">{l.student}</TableCell>
                        <TableCell className="text-sm max-w-[120px] truncate">{l.course}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[100px] truncate">{l.instructor}</TableCell>
                        <TableCell className="text-center font-semibold">{fmt(l.amount)}</TableCell>
                        <TableCell className="text-center text-purple-600 text-sm">
                          {l.couponDiscount > 0 ? fmt(l.couponDiscount) : '-'}
                        </TableCell>
                        <TableCell className="text-center text-amber-600 text-sm">{l.instructorAmount > 0 ? fmt(l.instructorAmount) : '-'}</TableCell>
                        <TableCell className="text-center text-green-600 text-sm">{l.platformAmount > 0 ? fmt(l.platformAmount) : '-'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">{methodLabel(l.method)}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{statusBadge(l.status || 'pending')}</TableCell>
                      </TableRow>
                    ))}
                    {ledger.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          {isRTL ? 'لا توجد معاملات' : 'No transactions'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {ledger.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    {isRTL ? `يتم عرض 50 من ${ledger.length} معاملة` : `Showing 50 of ${ledger.length} transactions`}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Course Accounts */}
        <TabsContent value="courses">
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'حسابات كل دورة بالتفصيل' : 'Detailed Course Accounts'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الدورة' : 'Course'}</TableHead>
                      <TableHead>{isRTL ? 'المعلم' : 'Instructor'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'المبيعات' : 'Sales'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'المسجلين' : 'Enrolled'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'السعر' : 'Price'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الإيرادات' : 'Revenue'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'العمولة' : 'Comm.'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'للمعلم' : 'Instructor'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'للمنصة' : 'Platform'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'مدفوع' : 'Paid'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'معلق' : 'Pending'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseBreakdown.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium max-w-[150px] truncate">{c.title}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{c.instructor}</TableCell>
                        <TableCell className="text-center"><Badge variant="secondary">{c.salesCount}</Badge></TableCell>
                        <TableCell className="text-center">{c.enrollmentsCount}</TableCell>
                        <TableCell className="text-center text-sm">{fmt(c.listPrice)}</TableCell>
                        <TableCell className="text-center font-bold">{fmt(c.grossRevenue)}</TableCell>
                        <TableCell className="text-center text-sm">{c.commission}%</TableCell>
                        <TableCell className="text-center text-amber-600">{fmt(c.instructorShare)}</TableCell>
                        <TableCell className="text-center text-green-600 font-semibold">{fmt(c.platformShare)}</TableCell>
                        <TableCell className="text-center text-green-600 text-sm">{fmt(c.paidToInstructor)}</TableCell>
                        <TableCell className="text-center text-amber-600 text-sm">{fmt(c.pendingForInstructor)}</TableCell>
                      </TableRow>
                    ))}
                    {courseBreakdown.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                          {isRTL ? 'لا توجد بيانات' : 'No data'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instructor Accounts */}
        <TabsContent value="instructors">
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'حسابات كل معلم بالتفصيل' : 'Detailed Instructor Accounts'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'المعلم' : 'Instructor'}</TableHead>
                      <TableHead>{isRTL ? 'البريد' : 'Email'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الدورات' : 'Courses'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'إجمالي الأرباح' : 'Total Earned'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'مدفوع' : 'Paid'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'معلق' : 'Pending'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'تم سحبه' : 'Withdrawn'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'سحب معلق' : 'Pend. Wd.'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الرصيد' : 'Balance'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {instructorBreakdown.map(inst => (
                      <TableRow key={inst.id}>
                        <TableCell className="font-medium">{inst.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{inst.email}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline">{inst.coursesCount}</Badge></TableCell>
                        <TableCell className="text-center font-bold">{fmt(inst.totalEarned)}</TableCell>
                        <TableCell className="text-center text-green-600">{fmt(inst.totalPaid)}</TableCell>
                        <TableCell className="text-center text-amber-600">{fmt(inst.totalPending)}</TableCell>
                        <TableCell className="text-center">{fmt(inst.totalWithdrawn)}</TableCell>
                        <TableCell className="text-center text-amber-600">{fmt(inst.pendingWithdrawal)}</TableCell>
                        <TableCell className="text-center font-bold">
                          <span className={inst.balance >= 0 ? 'text-green-600' : 'text-destructive'}>
                            {fmt(inst.balance)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {instructorBreakdown.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          {isRTL ? 'لا توجد بيانات' : 'No data'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Methods Breakdown */}
        <TabsContent value="methods">
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'تفصيل طرق الدفع' : 'Payment Methods Breakdown'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(methodBreakdown).map(([method, { count, amount }]) => (
                  <Card key={method} className="border-primary/20">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <CreditCard className="w-5 h-5 text-primary" />
                        <span className="font-semibold">{methodLabel(method)}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">{isRTL ? 'عدد المعاملات' : 'Transactions'}</span>
                          <span className="font-bold">{count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">{isRTL ? 'المبلغ' : 'Amount'}</span>
                          <span className="font-bold text-primary">{fmt(amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">{isRTL ? 'متوسط' : 'Average'}</span>
                          <span className="text-sm">{fmt(count > 0 ? amount / count : 0)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
