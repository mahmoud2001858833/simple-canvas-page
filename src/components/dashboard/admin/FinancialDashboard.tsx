import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, Tooltip } from 'recharts';
import { 
  DollarSign, TrendingUp, Calendar, Clock, Users, CheckCircle, XCircle, 
  RefreshCw, Percent, Award, Star, Receipt, Wallet, CreditCard, Building2,
  Download, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek } from 'date-fns';
import { toast } from 'sonner';
import { ar } from 'date-fns/locale';

const COLORS = ['#D4AF37', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

export const FinancialDashboard = () => {
  const { dir } = useLanguage();
  const isRTL = dir === 'rtl';
  const [timeFilter, setTimeFilter] = useState('all');

  // Fetch all financial data
  const { data: financialData, isLoading } = useQuery({
    queryKey: ['admin-financial-dashboard', timeFilter],
    queryFn: async () => {
      const now = new Date();
      const startOfCurrentMonth = startOfMonth(now);
      const startOfCurrentWeek = startOfWeek(now);
      
      // Fetch payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id, amount, status, payment_method, created_at, paid_at,
          course_id, user_id, transaction_id
        `)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Fetch instructor earnings
      const { data: earnings, error: earningsError } = await supabase
        .from('instructor_earnings')
        .select('id, instructor_id, amount, status, course_id, commission_rate, created_at');

      if (earningsError) throw earningsError;

      // Fetch courses with instructor info
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title, title_ar, instructor_id, instructor_commission');

      if (coursesError) throw coursesError;

      // Fetch profiles for names
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email');

      if (profilesError) throw profilesError;

      // Fetch enrollments count
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('id');

      if (enrollmentsError) throw enrollmentsError;

      // Calculate stats
      const paidPayments = payments?.filter(p => p.status === 'paid') || [];
      const pendingPayments = payments?.filter(p => p.status === 'pending') || [];
      const failedPayments = payments?.filter(p => p.status === 'failed') || [];
      const refundedPayments = payments?.filter(p => p.status === 'refunded') || [];

      const totalRevenue = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const monthlyRevenue = paidPayments
        .filter(p => p.paid_at && new Date(p.paid_at) >= startOfCurrentMonth)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const weeklyRevenue = paidPayments
        .filter(p => p.paid_at && new Date(p.paid_at) >= startOfCurrentWeek)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const pendingAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const refundedAmount = refundedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      const instructorTotalEarnings = earnings?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const instructorPaidEarnings = earnings?.filter(e => e.status === 'paid').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const instructorPendingEarnings = earnings?.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      const platformProfit = totalRevenue - instructorTotalEarnings;
      const avgOrderValue = paidPayments.length > 0 ? totalRevenue / paidPayments.length : 0;
      const conversionRate = enrollments && payments ? (paidPayments.length / Math.max(enrollments.length, 1)) * 100 : 0;

      // Revenue by payment method
      const revenueByMethod: Record<string, number> = {};
      paidPayments.forEach(p => {
        const method = p.payment_method || 'unknown';
        revenueByMethod[method] = (revenueByMethod[method] || 0) + Number(p.amount);
      });

      // Course revenue
      const courseRevenue = courses?.map(course => {
        const coursePayments = paidPayments.filter(p => p.course_id === course.id);
        const courseEarnings = earnings?.filter(e => e.course_id === course.id) || [];
        const revenue = coursePayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const instructorEarning = courseEarnings.reduce((sum, e) => sum + Number(e.amount), 0);
        const instructor = profiles?.find(p => p.id === course.instructor_id);
        
        return {
          id: course.id,
          title: isRTL ? course.title_ar : course.title,
          instructor: instructor?.full_name || 'غير محدد',
          purchases: coursePayments.length,
          revenue,
          commission: course.instructor_commission || 30,
          instructorEarning,
          platformProfit: revenue - instructorEarning
        };
      }).filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue) || [];

      // Instructor earnings breakdown
      const instructorBreakdown = Array.from(new Set(earnings?.map(e => e.instructor_id) || [])).map(instructorId => {
        const instructorEarnings = earnings?.filter(e => e.instructor_id === instructorId) || [];
        const instructor = profiles?.find(p => p.id === instructorId);
        const instructorCourses = courses?.filter(c => c.instructor_id === instructorId) || [];
        
        return {
          id: instructorId,
          name: instructor?.full_name || 'غير محدد',
          email: instructor?.email || '',
          coursesCount: instructorCourses.length,
          totalEarnings: instructorEarnings.reduce((sum, e) => sum + Number(e.amount), 0),
          paidEarnings: instructorEarnings.filter(e => e.status === 'paid').reduce((sum, e) => sum + Number(e.amount), 0),
          pendingEarnings: instructorEarnings.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.amount), 0)
        };
      }).sort((a, b) => b.totalEarnings - a.totalEarnings);

      // Monthly revenue trend (last 12 months)
      const monthlyTrend = [];
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        
        const monthPayments = paidPayments.filter(p => {
          const paidAt = p.paid_at ? new Date(p.paid_at) : null;
          return paidAt && paidAt >= monthStart && paidAt <= monthEnd;
        });
        
        const monthEarnings = earnings?.filter(e => {
          const createdAt = new Date(e.created_at);
          return createdAt >= monthStart && createdAt <= monthEnd;
        }) || [];
        
        monthlyTrend.push({
          month: format(monthDate, 'MMM', { locale: isRTL ? ar : undefined }),
          revenue: monthPayments.reduce((sum, p) => sum + Number(p.amount), 0),
          instructorEarnings: monthEarnings.reduce((sum, e) => sum + Number(e.amount), 0),
          profit: monthPayments.reduce((sum, p) => sum + Number(p.amount), 0) - monthEarnings.reduce((sum, e) => sum + Number(e.amount), 0)
        });
      }

      // Best selling course
      const bestCourse = courseRevenue[0];

      // Top earning instructor
      const topInstructor = instructorBreakdown[0];

      // Recent transactions
      const recentTransactions = payments?.slice(0, 20).map(p => {
        const user = profiles?.find(pr => pr.id === p.user_id);
        const course = courses?.find(c => c.id === p.course_id);
        return {
          ...p,
          userName: user?.full_name || 'غير محدد',
          courseName: course ? (isRTL ? course.title_ar : course.title) : 'غير محدد'
        };
      }) || [];

      return {
        stats: {
          totalRevenue,
          monthlyRevenue,
          weeklyRevenue,
          pendingAmount,
          refundedAmount,
          instructorTotalEarnings,
          instructorPaidEarnings,
          instructorPendingEarnings,
          platformProfit,
          avgOrderValue,
          conversionRate,
          totalTransactions: payments?.length || 0,
          successfulTransactions: paidPayments.length,
          failedTransactions: failedPayments.length,
          bestCourse: bestCourse?.title || '-',
          topInstructor: topInstructor?.name || '-'
        },
        revenueByMethod,
        courseRevenue,
        instructorBreakdown,
        monthlyTrend,
        recentTransactions,
        failedPayments: failedPayments.slice(0, 10)
      };
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return isRTL ? 'غير محدد' : 'N/A';
    return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: isRTL ? ar : undefined });
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      online: { ar: 'بطاقة', en: 'Card' },
      bank_transfer: { ar: 'تحويل بنكي', en: 'Bank Transfer' },
      tabby: { ar: 'تابي', en: 'Tabby' },
      manual: { ar: 'يدوي', en: 'Manual' }
    };
    return labels[method]?.[isRTL ? 'ar' : 'en'] || method;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: { ar: string; en: string } }> = {
      paid: { variant: 'default', label: { ar: 'مكتمل', en: 'Paid' } },
      pending: { variant: 'secondary', label: { ar: 'معلق', en: 'Pending' } },
      failed: { variant: 'destructive', label: { ar: 'فاشل', en: 'Failed' } },
      refunded: { variant: 'outline', label: { ar: 'مسترد', en: 'Refunded' } }
    };
    const config = variants[status] || { variant: 'secondary' as const, label: { ar: status, en: status } };
    return <Badge variant={config.variant}>{config.label[isRTL ? 'ar' : 'en']}</Badge>;
  };

  const pieChartData = financialData?.revenueByMethod 
    ? Object.entries(financialData.revenueByMethod).map(([method, amount]) => ({
        name: getPaymentMethodLabel(method),
        value: amount
      }))
    : [];

  const StatCard = ({ title, value, icon: Icon, trend, trendUp, subValue, className }: {
    title: string;
    value: string | number;
    icon: any;
    trend?: string;
    trendUp?: boolean;
    subValue?: string;
    className?: string;
  }) => (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
                {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {trend}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const stats = financialData?.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{isRTL ? 'لوحة المصاريف' : 'Financial Dashboard'}</h1>
          <p className="text-muted-foreground mt-2">
            {isRTL ? 'نظرة شاملة على جميع البيانات المالية' : 'Comprehensive view of all financial data'}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => {
          if (!financialData) return;
          const csvRows = [
            ['Type', 'Amount (SAR)'],
            ['Total Revenue', stats?.totalRevenue || 0],
            ['Monthly Revenue', stats?.monthlyRevenue || 0],
            ['Weekly Revenue', stats?.weeklyRevenue || 0],
            ['Pending', stats?.pendingAmount || 0],
            ['Instructor Earnings', stats?.instructorTotalEarnings || 0],
            ['Platform Profit', stats?.platformProfit || 0],
            ['Refunded', stats?.refundedAmount || 0],
            [],
            ['Course', 'Revenue', 'Instructor', 'Platform Profit'],
            ...(financialData.courseRevenue?.map(c => [c.title, c.revenue, c.instructorEarning, c.platformProfit]) || []),
            [],
            ['Instructor', 'Total Earnings', 'Paid', 'Pending'],
            ...(financialData.instructorBreakdown?.map(i => [i.name, i.totalEarnings, i.paidEarnings, i.pendingEarnings]) || []),
          ];
          const csvContent = csvRows.map(row => Array.isArray(row) ? row.join(',') : '').join('\n');
          const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `financial-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
          link.click();
          toast.success(isRTL ? 'تم تصدير التقرير' : 'Report exported');
        }}>
          <Download className="w-4 h-4" />
          {isRTL ? 'تصدير CSV' : 'Export CSV'}
        </Button>
      </div>

      {/* Main Stats - 8 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={isRTL ? 'إجمالي الإيرادات' : 'Total Revenue'}
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={DollarSign}
        />
        <StatCard
          title={isRTL ? 'إيرادات الشهر' : 'Monthly Revenue'}
          value={formatCurrency(stats?.monthlyRevenue || 0)}
          icon={Calendar}
        />
        <StatCard
          title={isRTL ? 'إيرادات الأسبوع' : 'Weekly Revenue'}
          value={formatCurrency(stats?.weeklyRevenue || 0)}
          icon={TrendingUp}
        />
        <StatCard
          title={isRTL ? 'مدفوعات معلقة' : 'Pending Payments'}
          value={formatCurrency(stats?.pendingAmount || 0)}
          icon={Clock}
        />
        <StatCard
          title={isRTL ? 'أرباح المعلمين الإجمالية' : 'Total Instructor Earnings'}
          value={formatCurrency(stats?.instructorTotalEarnings || 0)}
          icon={Users}
        />
        <StatCard
          title={isRTL ? 'أرباح مدفوعة للمعلمين' : 'Paid to Instructors'}
          value={formatCurrency(stats?.instructorPaidEarnings || 0)}
          icon={CheckCircle}
          className="border-green-200 dark:border-green-800"
        />
        <StatCard
          title={isRTL ? 'أرباح معلقة للمعلمين' : 'Pending for Instructors'}
          value={formatCurrency(stats?.instructorPendingEarnings || 0)}
          icon={Clock}
          className="border-amber-200 dark:border-amber-800"
        />
        <StatCard
          title={isRTL ? 'صافي ربح المنصة' : 'Platform Net Profit'}
          value={formatCurrency(stats?.platformProfit || 0)}
          icon={Wallet}
          className="border-primary/30 bg-primary/5"
        />
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={isRTL ? 'متوسط قيمة الطلب' : 'Avg Order Value'}
          value={formatCurrency(stats?.avgOrderValue || 0)}
          icon={Receipt}
        />
        <StatCard
          title={isRTL ? 'عدد المعاملات' : 'Total Transactions'}
          value={stats?.totalTransactions || 0}
          icon={CreditCard}
          subValue={`${stats?.successfulTransactions || 0} ${isRTL ? 'ناجحة' : 'successful'}`}
        />
        <StatCard
          title={isRTL ? 'معاملات فاشلة' : 'Failed Transactions'}
          value={stats?.failedTransactions || 0}
          icon={XCircle}
          className="border-red-200 dark:border-red-800"
        />
        <StatCard
          title={isRTL ? 'مبالغ مستردة' : 'Refunded Amount'}
          value={formatCurrency(stats?.refundedAmount || 0)}
          icon={RefreshCw}
        />
      </div>

      {/* Best Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-primary/20 rounded-full">
                <Award className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? 'أفضل دورة مبيعاً' : 'Best Selling Course'}</p>
                <p className="text-xl font-bold mt-1">{stats?.bestCourse || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-primary/20 rounded-full">
                <Star className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? 'أفضل معلم إيرادات' : 'Top Earning Instructor'}</p>
                <p className="text-xl font-bold mt-1">{stats?.topInstructor || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'الإيرادات الشهرية' : 'Monthly Revenue'}</CardTitle>
            <CardDescription>{isRTL ? 'آخر 12 شهر' : 'Last 12 months'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialData?.monthlyTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (!active || !payload) return null;
                      return (
                        <div className="bg-popover border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{label}</p>
                          {payload.map((entry, i) => (
                            <p key={i} className="text-sm" style={{ color: entry.color }}>
                              {entry.name}: {formatCurrency(entry.value as number)}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name={isRTL ? 'الإيرادات' : 'Revenue'} fill="#D4AF37" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name={isRTL ? 'صافي الربح' : 'Profit'} fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'توزيع طرق الدفع' : 'Payment Methods Distribution'}</CardTitle>
            <CardDescription>{isRTL ? 'نسبة كل طريقة دفع' : 'Percentage of each payment method'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Section */}
      <Tabs defaultValue="courses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="courses">{isRTL ? 'إيرادات الدورات' : 'Course Revenue'}</TabsTrigger>
          <TabsTrigger value="instructors">{isRTL ? 'أرباح المعلمين' : 'Instructor Earnings'}</TabsTrigger>
          <TabsTrigger value="transactions">{isRTL ? 'المعاملات الأخيرة' : 'Recent Transactions'}</TabsTrigger>
          <TabsTrigger value="failed">{isRTL ? 'المعاملات الفاشلة' : 'Failed Payments'}</TabsTrigger>
        </TabsList>

        {/* Course Revenue Table */}
        <TabsContent value="courses">
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'إيرادات كل دورة' : 'Revenue by Course'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الدورة' : 'Course'}</TableHead>
                      <TableHead>{isRTL ? 'المعلم' : 'Instructor'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'المشتريات' : 'Purchases'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الإيرادات' : 'Revenue'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'نسبة المعلم' : 'Commission'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'أرباح المعلم' : 'Instructor'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'صافي المنصة' : 'Platform'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialData?.courseRevenue?.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell className="font-medium max-w-48 truncate">{course.title}</TableCell>
                        <TableCell className="text-muted-foreground">{course.instructor}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{course.purchases}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{formatCurrency(course.revenue)}</TableCell>
                        <TableCell className="text-center">{course.commission}%</TableCell>
                        <TableCell className="text-center text-amber-600">{formatCurrency(course.instructorEarning)}</TableCell>
                        <TableCell className="text-center text-green-600 font-semibold">{formatCurrency(course.platformProfit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instructor Earnings Table */}
        <TabsContent value="instructors">
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'أرباح كل معلم' : 'Earnings by Instructor'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'المعلم' : 'Instructor'}</TableHead>
                      <TableHead>{isRTL ? 'البريد' : 'Email'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الدورات' : 'Courses'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الإجمالي' : 'Total'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'مدفوع' : 'Paid'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'معلق' : 'Pending'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialData?.instructorBreakdown?.map((instructor) => (
                      <TableRow key={instructor.id}>
                        <TableCell className="font-medium">{instructor.name}</TableCell>
                        <TableCell className="text-muted-foreground">{instructor.email}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{instructor.coursesCount}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{formatCurrency(instructor.totalEarnings)}</TableCell>
                        <TableCell className="text-center text-green-600">{formatCurrency(instructor.paidEarnings)}</TableCell>
                        <TableCell className="text-center text-amber-600">{formatCurrency(instructor.pendingEarnings)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Transactions Table */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>{isRTL ? 'آخر المعاملات' : 'Recent Transactions'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead>{isRTL ? 'المستخدم' : 'User'}</TableHead>
                      <TableHead>{isRTL ? 'الدورة' : 'Course'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الطريقة' : 'Method'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialData?.recentTransactions?.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">{formatDate(tx.created_at)}</TableCell>
                        <TableCell className="font-medium">{tx.userName}</TableCell>
                        <TableCell className="text-muted-foreground max-w-32 truncate">{tx.courseName}</TableCell>
                        <TableCell className="text-center font-semibold">{formatCurrency(Number(tx.amount))}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{getPaymentMethodLabel(tx.payment_method)}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{getStatusBadge(tx.status || 'pending')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Failed Payments Table */}
        <TabsContent value="failed">
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">{isRTL ? 'المعاملات الفاشلة' : 'Failed Payments'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead>{isRTL ? 'المستخدم' : 'User'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'المبلغ' : 'Amount'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'الطريقة' : 'Method'}</TableHead>
                      <TableHead>{isRTL ? 'رقم العملية' : 'Transaction ID'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialData?.failedPayments?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {isRTL ? 'لا توجد معاملات فاشلة' : 'No failed payments'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      financialData?.failedPayments?.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm">{formatDate(tx.created_at)}</TableCell>
                          <TableCell className="font-medium">{tx.user_id}</TableCell>
                          <TableCell className="text-center font-semibold text-destructive">
                            {formatCurrency(Number(tx.amount))}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{getPaymentMethodLabel(tx.payment_method)}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{tx.transaction_id || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
