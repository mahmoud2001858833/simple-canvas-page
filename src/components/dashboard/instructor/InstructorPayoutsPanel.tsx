import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, CalendarClock, AlertTriangle, Receipt, CheckCircle2 } from 'lucide-react';
import { format, addDays, addMonths, differenceInCalendarDays } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { toast } from 'sonner';

type Period = 'weekly' | 'monthly' | 'per_course';

export const InstructorPayoutsPanel = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const locale = isRTL ? ar : enUS;

  const { data, isLoading } = useQuery({
    queryKey: ['my-payouts', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: setting }, { data: earnings }, { data: payouts }] = await Promise.all([
        supabase.from('platform_settings').select('value').eq('key', 'instructor_payout_period').maybeSingle(),
        supabase
          .from('instructor_earnings')
          .select('id, amount, created_at, courses:course_id (title, title_ar)')
          .eq('instructor_id', user!.id)
          .eq('status', 'pending')
          .is('payout_id', null)
          .order('created_at', { ascending: true }),
        supabase.from('instructor_payouts').select('*').eq('instructor_id', user!.id).order('paid_at', { ascending: false }),
      ]);
      return {
        period: ((setting?.value as Period) || 'monthly') as Period,
        earnings: earnings || [],
        payouts: payouts || [],
      };
    },
  });

  const info = useMemo(() => {
    if (!data) return null;
    const total = (data.earnings as any[]).reduce((s, e) => s + Number(e.amount || 0), 0);
    const oldest = (data.earnings as any[])[0]?.created_at;
    const lastPayout = (data.payouts as any[])[0]?.paid_at || null;
    const anchor = lastPayout ? new Date(lastPayout) : oldest ? new Date(oldest) : null;
    let nextDue: Date | null = null;
    if (data.period === 'weekly' && anchor) nextDue = addDays(anchor, 7);
    else if (data.period === 'monthly' && anchor) nextDue = addMonths(anchor, 1);
    else if (data.period === 'per_course' && oldest) nextDue = new Date(oldest);
    const daysLeft = nextDue ? differenceInCalendarDays(nextDue, new Date()) : null;
    const byCourse: Record<string, number> = {};
    (data.earnings as any[]).forEach(e => {
      const t = (isRTL ? e.courses?.title_ar : e.courses?.title) || e.courses?.title || '—';
      byCourse[t] = (byCourse[t] || 0) + Number(e.amount || 0);
    });
    return { total, nextDue, daysLeft, overdue: daysLeft !== null && daysLeft < 0, lastPayout, byCourse };
  }, [data, isRTL]);

  const periodLabel = {
    weekly: isRTL ? 'كل أسبوع' : 'Weekly',
    monthly: isRTL ? 'كل شهر' : 'Monthly',
    per_course: isRTL ? 'بعد كل دورة' : 'After each course',
  }[data?.period || 'monthly'];

  const openReceipt = async (path: string) => {
    const { data: signed } = await supabase.storage.from('payment-receipts').createSignedUrl(path, 300);
    if (signed?.signedUrl) window.open(signed.signedUrl, '_blank');
    else toast.error(isRTL ? 'تعذر فتح الوصل' : 'Could not open receipt');
  };

  if (isLoading || !info) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <Wallet className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm text-muted-foreground">{isRTL ? 'مستحقاتي غير المدفوعة' : 'Unpaid dues'}</p>
            <p className="text-2xl font-bold">{info.total.toLocaleString()} ر.س</p>
          </CardContent>
        </Card>
        <Card className={info.overdue ? 'border-destructive' : ''}>
          <CardContent className="p-4">
            {info.overdue
              ? <AlertTriangle className="w-5 h-5 text-destructive mb-2" />
              : <CalendarClock className="w-5 h-5 text-primary mb-2" />}
            <p className="text-sm text-muted-foreground">{isRTL ? 'موعد الدفع القادم' : 'Next payout'}</p>
            <p className={`text-lg font-bold ${info.overdue ? 'text-destructive' : ''}`}>
              {info.nextDue
                ? info.overdue
                  ? (isRTL ? `متأخر ${Math.abs(info.daysLeft!)} يوم` : `${Math.abs(info.daysLeft!)} days overdue`)
                  : (isRTL ? `بعد ${info.daysLeft} يوم` : `in ${info.daysLeft} days`)
                : '—'}
            </p>
            {info.nextDue && (
              <p className="text-xs text-muted-foreground">{format(info.nextDue, 'PPP', { locale })}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <CheckCircle2 className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm text-muted-foreground">{isRTL ? 'دورية الدفع' : 'Payout schedule'}</p>
            <p className="text-lg font-bold">{periodLabel}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{isRTL ? 'مصدر المستحقات' : 'Source of dues'}</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(info.byCourse).length === 0 ? (
            <p className="text-muted-foreground text-sm">{isRTL ? 'لا توجد مستحقات حالياً' : 'No pending dues'}</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(info.byCourse).map(([title, amount]) => (
                <div key={title} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="truncate">{title}</span>
                  <span className="font-semibold text-primary whitespace-nowrap">{amount.toLocaleString()} ر.س</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{isRTL ? 'سجل الدفعات' : 'Payout history'}</CardTitle></CardHeader>
        <CardContent>
          {(data!.payouts as any[]).length === 0 ? (
            <p className="text-muted-foreground text-sm">{isRTL ? 'لم تُدفع أي مستحقات بعد' : 'No payouts yet'}</p>
          ) : (
            <div className="space-y-2">
              {(data!.payouts as any[]).map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="font-semibold">{Number(p.amount).toLocaleString()} ر.س</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(p.paid_at), 'PPP', { locale })}</p>
                    {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800">{isRTL ? 'مدفوعة' : 'Paid'}</Badge>
                    {p.receipt_url && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openReceipt(p.receipt_url)}>
                        <Receipt className="w-3 h-3" />{isRTL ? 'الوصل' : 'Receipt'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
