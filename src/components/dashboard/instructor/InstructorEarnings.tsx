import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InstructorEarningsSkeleton } from '@/components/ui/skeletons';
import { DollarSign, TrendingUp, Clock, CheckCircle, BookOpen, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Earning {
  id: string;
  amount: number;
  commission_rate: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  course_title: string;
  course_title_ar: string;
  student_name: string;
  payment_amount: number;
  is_installment: boolean;
}

interface EarningsSummary {
  total: number;
  pending: number;
  paid: number;
  thisMonth: number;
  refunded: number;
}

interface MonthlyData {
  month: string;
  amount: number;
}

interface InstructorEarningsProps {
  limit?: number;
}

export const InstructorEarnings = ({ limit }: InstructorEarningsProps) => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';
  
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState<EarningsSummary>({ total: 0, pending: 0, paid: 0, thisMonth: 0, refunded: 0 });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  const texts = {
    ar: {
      title: 'أرباحي',
      totalEarnings: 'إجمالي الأرباح',
      pendingEarnings: 'أرباح معلقة',
      paidEarnings: 'تم التحويل',
      thisMonth: 'هذا الشهر',
      noEarnings: 'لا توجد أرباح بعد',
      status: { pending: 'قيد الانتظار', paid: 'تم التحويل' },
      commission: 'العمولة',
      recentTransactions: 'آخر المعاملات',
      monthlyChart: 'الأرباح الشهرية',
      student: 'الطالب',
      installment: 'قسط',
      fullPayment: 'كامل',
    },
    en: {
      title: 'My Earnings',
      totalEarnings: 'Total Earnings',
      pendingEarnings: 'Pending',
      paidEarnings: 'Paid',
      thisMonth: 'This Month',
      noEarnings: 'No earnings yet',
      status: { pending: 'Pending', paid: 'Paid' },
      commission: 'Commission',
      recentTransactions: 'Recent Transactions',
      monthlyChart: 'Monthly Earnings',
      student: 'Student',
      installment: 'Installment',
      fullPayment: 'Full',
    },
  };

  const t = texts[language];

  useEffect(() => {
    if (user) fetchEarnings();
  }, [user]);

  const fetchEarnings = async () => {
    try {
      const { data, error } = await supabase
        .from('instructor_earnings')
        .select(`
          *,
          courses:course_id (title, title_ar),
          payments:payment_id (amount, user_id, installment_plan)
        `)
        .eq('instructor_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch student names for payments
      const userIds = [...new Set((data || []).map((e: any) => e.payments?.user_id).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, full_name_ar')
          .in('id', userIds);
        profilesMap = (profiles || []).reduce((acc: Record<string, string>, p) => {
          acc[p.id] = language === 'ar' ? (p.full_name_ar || p.full_name || '') : (p.full_name || '');
          return acc;
        }, {});
      }

      const earningsData: Earning[] = (data || []).map((e: any) => ({
        id: e.id,
        amount: e.amount,
        commission_rate: e.commission_rate,
        status: e.status,
        created_at: e.created_at,
        paid_at: e.paid_at,
        course_title: e.courses?.title || '',
        course_title_ar: e.courses?.title_ar || '',
        student_name: profilesMap[e.payments?.user_id] || '',
        payment_amount: e.payments?.amount || 0,
        is_installment: !!(e.payments?.installment_plan as any)?.is_continuation,
      }));

      // Calculate summary (refunded earnings are excluded from all totals)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const active = earningsData.filter(e => e.status !== 'refunded');
      const total = active.reduce((sum, e) => sum + e.amount, 0);
      const pending = active.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);
      const paid = active.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);
      const refunded = earningsData.filter(e => e.status === 'refunded').reduce((sum, e) => sum + e.amount, 0);
      const thisMonth = active
        .filter(e => new Date(e.created_at) >= startOfMonth)
        .reduce((sum, e) => sum + e.amount, 0);

      setSummary({ total, pending, paid, thisMonth, refunded });

      // Monthly chart data (last 6 months)
      const monthly: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = format(d, 'yyyy-MM');
        monthly[key] = 0;
      }
      active.forEach(e => {
        const key = format(new Date(e.created_at), 'yyyy-MM');
        if (monthly[key] !== undefined) monthly[key] += e.amount;
      });
      setMonthlyData(Object.entries(monthly).map(([month, amount]) => ({
        month: format(new Date(month + '-01'), 'MMM', { locale: language === 'ar' ? ar : enUS }),
        amount: Math.round(amount),
      })));

      setEarnings(limit ? earningsData.slice(0, limit) : earningsData);
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <InstructorEarningsSkeleton rows={limit || 5} />;

  const summaryCards = [
    { title: t.totalEarnings, value: summary.total, icon: DollarSign, gradient: 'from-primary to-primary/80' },
    { title: t.paidEarnings, value: summary.paid, icon: CheckCircle, gradient: 'from-green-500 to-green-600' },
    { title: t.pendingEarnings, value: summary.pending, icon: Clock, gradient: 'from-orange-500 to-orange-600' },
    { title: t.thisMonth, value: summary.thisMonth, icon: TrendingUp, gradient: 'from-blue-500 to-blue-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
            <Card>
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-3`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-xl font-bold">{card.value.toLocaleString()} ر.س</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Monthly Chart */}
      {!limit && monthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.monthlyChart}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`${value.toLocaleString()} ر.س`, t.totalEarnings]} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.recentTransactions}</CardTitle>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t.noEarnings}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {earnings.map((earning, index) => (
                <motion.div
                  key={earning.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">
                      {language === 'ar' ? earning.course_title_ar : earning.course_title}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {earning.student_name && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {earning.student_name}
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        {format(new Date(earning.created_at), 'PPP', {
                          locale: language === 'ar' ? ar : enUS,
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-bold text-primary">
                      +{earning.amount.toLocaleString()} ر.س
                    </span>
                    <div className="flex items-center gap-1">
                      {earning.is_installment && (
                        <Badge variant="outline" className="text-xs">
                          {t.installment}
                        </Badge>
                      )}
                      <Badge
                        variant={earning.status === 'paid' ? 'default' : 'secondary'}
                        className={earning.status === 'paid' ? 'bg-green-100 text-green-800' : ''}
                      >
                        {t.status[earning.status as keyof typeof t.status] || earning.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t.commission}: {earning.commission_rate}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
