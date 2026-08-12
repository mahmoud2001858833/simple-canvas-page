import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Wallet, CalendarClock, AlertTriangle, Receipt, Loader2, CheckCircle2, History } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, addMonths, differenceInCalendarDays } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

type Period = 'weekly' | 'monthly' | 'per_course';

interface DueRow {
  instructor_id: string;
  name: string;
  email: string;
  total: number;
  earnings: any[];
  courses: { title: string; amount: number; count: number }[];
  oldest: string;
  lastPayout: string | null;
  nextDue: Date | null;
  overdue: boolean;
  daysLeft: number | null;
}

export const InstructorPayouts = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const locale = isRTL ? ar : enUS;
  const queryClient = useQueryClient();

  const [dialogFor, setDialogFor] = useState<DueRow | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['payout-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('platform_settings').select('*').eq('key', 'instructor_payout_period').maybeSingle();
      return (data?.value as Period) || 'monthly';
    },
  });
  const period: Period = (settings as Period) || 'monthly';

  const { data, isLoading } = useQuery({
    queryKey: ['instructor-payout-dues'],
    queryFn: async () => {
      const [{ data: earnings }, { data: payouts }, { data: profiles }] = await Promise.all([
        supabase
          .from('instructor_earnings')
          .select('id, instructor_id, amount, status, created_at, course_id, courses:course_id (title, title_ar)')
          .eq('status', 'pending')
          .is('payout_id', null)
          .order('created_at', { ascending: true }),
        supabase.from('instructor_payouts').select('*').order('paid_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, full_name_ar, email'),
      ]);
      return { earnings: earnings || [], payouts: payouts || [], profiles: profiles || [] };
    },
  });

  const rows: DueRow[] = useMemo(() => {
    if (!data) return [];
    const profMap: Record<string, any> = {};
    (data.profiles as any[]).forEach(p => { profMap[p.id] = p; });
    const lastPayoutMap: Record<string, string> = {};
    (data.payouts as any[]).forEach(p => {
      if (!lastPayoutMap[p.instructor_id]) lastPayoutMap[p.instructor_id] = p.paid_at;
    });

    const grouped: Record<string, any[]> = {};
    (data.earnings as any[]).forEach(e => {
      (grouped[e.instructor_id] ||= []).push(e);
    });

    return Object.entries(grouped).map(([id, list]) => {
      const prof = profMap[id] || {};
      const total = list.reduce((s, e) => s + Number(e.amount || 0), 0);
      const byCourse: Record<string, { title: string; amount: number; count: number }> = {};
      list.forEach(e => {
        const title = (isRTL ? e.courses?.title_ar : e.courses?.title) || e.courses?.title || '—';
        byCourse[title] ||= { title, amount: 0, count: 0 };
        byCourse[title].amount += Number(e.amount || 0);
        byCourse[title].count += 1;
      });
      const oldest = list[0]?.created_at;
      const lastPayout = lastPayoutMap[id] || null;
      const anchor = lastPayout ? new Date(lastPayout) : oldest ? new Date(oldest) : null;
      let nextDue: Date | null = null;
      if (period === 'weekly' && anchor) nextDue = addDays(anchor, 7);
      else if (period === 'monthly' && anchor) nextDue = addMonths(anchor, 1);
      else if (period === 'per_course' && oldest) nextDue = new Date(oldest);
      const daysLeft = nextDue ? differenceInCalendarDays(nextDue, new Date()) : null;
      return {
        instructor_id: id,
        name: (isRTL ? prof.full_name_ar || prof.full_name : prof.full_name) || prof.email || id.slice(0, 8),
        email: prof.email || '',
        total,
        earnings: list,
        courses: Object.values(byCourse),
        oldest,
        lastPayout,
        nextDue,
        overdue: daysLeft !== null && daysLeft < 0,
        daysLeft,
      };
    }).sort((a, b) => b.total - a.total);
  }, [data, period, isRTL]);

  const savePeriod = async (value: Period) => {
    const { error } = await supabase.from('platform_settings').upsert({ key: 'instructor_payout_period', value }, { onConflict: 'key' });
    if (error) { toast.error(isRTL ? 'فشل حفظ الإعداد' : 'Failed to save'); return; }
    toast.success(isRTL ? 'تم حفظ دورية الدفع' : 'Payout period saved');
    queryClient.invalidateQueries({ queryKey: ['payout-settings'] });
  };

  const openPay = (row: DueRow) => {
    setDialogFor(row);
    setAmount(String(Math.round(row.total * 100) / 100));
    setNotes('');
    setReceipt(null);
  };

  const confirmPay = async () => {
    if (!dialogFor || !user) return;
    const value = Number(amount);
    if (!value || value <= 0 || value > dialogFor.total + 0.01) {
      toast.error(isRTL ? 'المبلغ غير صالح' : 'Invalid amount');
      return;
    }
    setSaving(true);
    try {
      let receiptPath: string | null = null;
      if (receipt) {
        const path = `${user.id}/payouts/${Date.now()}-${receipt.name}`;
        const { error: upErr } = await supabase.storage.from('payment-receipts').upload(path, receipt);
        if (upErr) throw upErr;
        receiptPath = path;
      }

      // pick earnings (oldest first) covered by the amount
      let remaining = value;
      const covered: string[] = [];
      for (const e of dialogFor.earnings) {
        const amt = Number(e.amount || 0);
        if (amt <= remaining + 0.001) { covered.push(e.id); remaining -= amt; }
      }

      const { data: payout, error } = await supabase
        .from('instructor_payouts')
        .insert({
          instructor_id: dialogFor.instructor_id,
          amount: value,
          earnings_count: covered.length,
          period_start: dialogFor.oldest,
          period_end: new Date().toISOString(),
          receipt_url: receiptPath,
          notes: notes || null,
          created_by: user.id,
          status: 'paid',
        })
        .select()
        .single();
      if (error) throw error;

      if (covered.length) {
        await supabase
          .from('instructor_earnings')
          .update({ status: 'paid', paid_at: new Date().toISOString(), payout_id: payout.id })
          .in('id', covered);
      }

      await supabase.from('notifications').insert({
        user_id: dialogFor.instructor_id,
        title: 'Payout sent',
        title_ar: 'تم تحويل مستحقاتك',
        message: `A payout of ${value.toLocaleString()} SAR has been transferred to you.`,
        message_ar: `تم تحويل مبلغ ${value.toLocaleString()} ر.س من مستحقاتك.`,
        type: 'payment',
        link: '/instructor',
      });

      toast.success(isRTL ? 'تم تسجيل الدفع وإشعار المعلم' : 'Payout recorded and instructor notified');
      setDialogFor(null);
      queryClient.invalidateQueries({ queryKey: ['instructor-payout-dues'] });
    } catch (e: any) {
      console.error(e);
      toast.error(isRTL ? 'فشل تسجيل الدفع' : 'Failed to record payout');
    } finally {
      setSaving(false);
    }
  };

  const totalDue = rows.reduce((s, r) => s + r.total, 0);
  const overdueCount = rows.filter(r => r.overdue).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <Wallet className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي المستحقات' : 'Total Due'}</p>
            <p className="text-2xl font-bold">{totalDue.toLocaleString()} ر.س</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <CalendarClock className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm text-muted-foreground">{isRTL ? 'معلمون لهم مستحقات' : 'Instructors with dues'}</p>
            <p className="text-2xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card className={overdueCount ? 'border-destructive' : ''}>
          <CardContent className="p-4">
            <AlertTriangle className={`w-5 h-5 mb-2 ${overdueCount ? 'text-destructive' : 'text-muted-foreground'}`} />
            <p className="text-sm text-muted-foreground">{isRTL ? 'متأخرة عن موعد الدفع' : 'Overdue'}</p>
            <p className={`text-2xl font-bold ${overdueCount ? 'text-destructive' : ''}`}>{overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? 'دورية دفع أجور المعلمين' : 'Payout Schedule'}</CardTitle>
          <CardDescription>
            {isRTL ? 'اختر كل متى تُدفع مستحقات المعلمين' : 'Choose how often instructors are paid'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Select value={period} onValueChange={(v) => savePeriod(v as Period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">{isRTL ? 'كل أسبوع' : 'Weekly'}</SelectItem>
                <SelectItem value="monthly">{isRTL ? 'كل شهر' : 'Monthly'}</SelectItem>
                <SelectItem value="per_course">{isRTL ? 'بعد كل دورة' : 'After each course'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? 'مستحقات المعلمين' : 'Instructor Dues'}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>{isRTL ? 'لا توجد مستحقات غير مدفوعة' : 'No unpaid dues'}</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {rows.map(row => (
                <AccordionItem
                  key={row.instructor_id}
                  value={row.instructor_id}
                  className={`border rounded-xl px-4 ${row.overdue ? 'border-destructive bg-destructive/5' : ''}`}
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 items-center justify-between gap-4 pe-3">
                      <div className="text-start">
                        <p className="font-semibold">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {row.nextDue && (
                          <Badge variant={row.overdue ? 'destructive' : 'secondary'} className="whitespace-nowrap">
                            {row.overdue
                              ? (isRTL ? `متأخر ${Math.abs(row.daysLeft!)} يوم` : `${Math.abs(row.daysLeft!)}d overdue`)
                              : (isRTL ? `بعد ${row.daysLeft} يوم` : `in ${row.daysLeft}d`)}
                          </Badge>
                        )}
                        <span className={`font-bold ${row.overdue ? 'text-destructive' : 'text-primary'}`}>
                          {row.total.toLocaleString()} ر.س
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pb-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{isRTL ? 'مصدر المستحقات' : 'Source of dues'}</p>
                        {row.courses.map(c => (
                          <div key={c.title} className="flex items-center justify-between text-sm rounded-lg border p-2">
                            <span className="truncate">{c.title}</span>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {c.count} {isRTL ? 'عملية' : 'txns'} · {c.amount.toLocaleString()} ر.س
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <History className="w-3 h-3" />
                          {isRTL ? 'آخر دفعة: ' : 'Last payout: '}
                          {row.lastPayout ? format(new Date(row.lastPayout), 'PPP', { locale }) : (isRTL ? 'لا يوجد' : 'None')}
                        </span>
                        {row.nextDue && (
                          <span className="flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            {isRTL ? 'الاستحقاق: ' : 'Due: '}{format(row.nextDue, 'PPP', { locale })}
                          </span>
                        )}
                      </div>
                      <Button onClick={() => openPay(row)} className="gap-2">
                        <Wallet className="w-4 h-4" />
                        {isRTL ? 'دفع المستحقات' : 'Pay dues'}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dialogFor} onOpenChange={(o) => !o && setDialogFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'دفع مستحقات المعلم' : 'Pay instructor dues'}</DialogTitle>
            <DialogDescription>
              {dialogFor?.name} — {isRTL ? 'المستحق' : 'due'}: {dialogFor?.total.toLocaleString()} ر.س
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRTL ? 'المبلغ المراد دفعه (ر.س)' : 'Amount to pay (SAR)'}</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Receipt className="w-4 h-4" />{isRTL ? 'وصل الدفع (اختياري)' : 'Payment receipt (optional)'}</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} />
            </div>
            <div>
              <Label>{isRTL ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFor(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={confirmPay} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {isRTL ? 'تأكيد الدفع' : 'Confirm payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
