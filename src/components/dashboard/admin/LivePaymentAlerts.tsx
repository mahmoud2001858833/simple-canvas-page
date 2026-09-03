import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Radio,
  Bell,
  BellOff,
  Clock,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

type PaymentRow = {
  id: string;
  user_id: string;
  course_id: string | null;
  amount: number;
  status: string;
  payment_method: string;
  transaction_id: string | null;
  created_at: string;
  paid_at: string | null;
};

type FeedItem = PaymentRow & {
  event: 'paid' | 'failed' | 'pending';
  receivedAt: string;
  studentName?: string | null;
  courseName?: string | null;
};

const beep = (ok: boolean) => {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = ok ? 880 : 260;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    /* audio unsupported */
  }
};

export const LivePaymentAlerts = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const queryClient = useQueryClient();

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [autoVerify, setAutoVerify] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const t = (ar: string, en: string) => (isRTL ? ar : en);

  const enrich = useCallback(async (row: PaymentRow): Promise<FeedItem> => {
    const event: FeedItem['event'] =
      row.status === 'paid' ? 'paid' : row.status === 'failed' ? 'failed' : 'pending';
    const [{ data: profile }, courseRes] = await Promise.all([
      supabase.from('profiles').select('full_name, email').eq('id', row.user_id).maybeSingle(),
      row.course_id
        ? supabase.from('courses').select('title, title_ar').eq('id', row.course_id).maybeSingle()
        : Promise.resolve({ data: null } as { data: null }),
    ]);
    const course = (courseRes as { data: { title: string | null; title_ar: string | null } | null }).data;
    return {
      ...row,
      event,
      receivedAt: new Date().toISOString(),
      studentName: profile?.full_name || profile?.email || null,
      courseName: course ? (isRTL ? course.title_ar || course.title : course.title || course.title_ar) : null,
    };
  }, [isRTL]);

  const pushItem = useCallback(
    async (row: PaymentRow) => {
      const key = `${row.id}:${row.status}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const item = await enrich(row);
      setFeed((prev) => [item, ...prev].slice(0, 60));

      if (item.event === 'paid') {
        if (soundOn) beep(true);
        toast.success(
          t(
            `دفعة ناجحة: ${item.amount} ر.س من ${item.studentName || 'طالب'}`,
            `Payment succeeded: ${item.amount} SAR from ${item.studentName || 'a student'}`,
          ),
        );
      } else if (item.event === 'failed') {
        if (soundOn) beep(false);
        toast.error(
          t(
            `دفعة فاشلة: ${item.amount} ر.س من ${item.studentName || 'طالب'}`,
            `Payment failed: ${item.amount} SAR from ${item.studentName || 'a student'}`,
          ),
        );
      }
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    },
    [enrich, queryClient, soundOn, t],
  );

  // Seed the feed with the most recent decided payments
  const { isLoading } = useQuery({
    queryKey: ['live-payment-alerts-seed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, user_id, course_id, amount, status, payment_method, transaction_id, created_at, paid_at')
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      const rows = (data || []) as PaymentRow[];
      const items = await Promise.all(rows.map(enrich));
      rows.forEach((r) => seen.current.add(`${r.id}:${r.status}`));
      setFeed(items);
      return rows;
    },
    staleTime: 30_000,
  });

  // Realtime subscription — replaces reliance on the gateway webhook
  useEffect(() => {
    const channel = supabase
      .channel('live-payment-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payments' },
        (payload) => pushItem(payload.new as PaymentRow),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payments' },
        (payload) => pushItem(payload.new as PaymentRow),
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pushItem]);

  const reconcile = useCallback(
    async (silent = false) => {
      setVerifying(true);
      try {
        const { data, error } = await supabase.functions.invoke('verify-alinma-payment', {
          body: { reconcileAll: true },
        });
        if (error) throw error;
        setLastCheck(new Date());
        const results = (data as { results?: Array<{ status: string }> } | null)?.results || [];
        if (!silent) {
          toast.success(
            t(
              `تمت مطابقة ${results.length} عملية معلّقة مع البوابة`,
              `Reconciled ${results.length} pending transaction(s) with the gateway`,
            ),
          );
        }
      } catch (e) {
        if (!silent) {
          toast.error(t('تعذّرت المطابقة مع بوابة الدفع', 'Could not reconcile with the payment gateway'));
        }
        console.error('reconcile error', e);
      } finally {
        setVerifying(false);
      }
    },
    [t],
  );

  // Auto polling as a webhook-independent safety net
  useEffect(() => {
    if (!autoVerify) return;
    reconcile(true);
    const id = window.setInterval(() => reconcile(true), 60_000);
    return () => window.clearInterval(id);
  }, [autoVerify, reconcile]);

  const paidCount = feed.filter((f) => f.event === 'paid').length;
  const failedCount = feed.filter((f) => f.event === 'failed').length;
  const pendingCount = feed.filter((f) => f.event === 'pending').length;

  const statusBadge = (event: FeedItem['event']) => {
    if (event === 'paid') {
      return (
        <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/15 border-green-500/30">
          <CheckCircle2 className="w-3 h-3 me-1" />
          {t('ناجحة', 'Paid')}
        </Badge>
      );
    }
    if (event === 'failed') {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 me-1" />
          {t('فاشلة', 'Failed')}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="w-3 h-3 me-1" />
        {t('قيد التحقق', 'Verifying')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>{t('الإشعارات الفورية للمدفوعات', 'Live Payment Alerts')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t(
                  'يعمل مباشرة من قاعدة البيانات دون الاعتماد على إشعار البوابة (webhook)',
                  'Runs straight from the database without relying on the gateway webhook',
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <Radio className={`w-4 h-4 ${connected ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
              <span className={connected ? 'text-green-600' : 'text-muted-foreground'}>
                {connected ? t('متصل مباشر', 'Live') : t('غير متصل', 'Offline')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {soundOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
              <Switch id="sound" checked={soundOn} onCheckedChange={setSoundOn} />
              <Label htmlFor="sound" className="text-sm cursor-pointer">{t('صوت', 'Sound')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="auto" checked={autoVerify} onCheckedChange={setAutoVerify} />
              <Label htmlFor="auto" className="text-sm cursor-pointer">
                {t('تحقق تلقائي كل دقيقة', 'Auto-verify every minute')}
              </Label>
            </div>
            <Button size="sm" variant="outline" onClick={() => reconcile(false)} disabled={verifying}>
              {verifying ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <RefreshCw className="w-4 h-4 me-2" />}
              {t('تحقق الآن', 'Verify now')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
              <p className="text-sm text-muted-foreground">{t('عمليات ناجحة', 'Successful')}</p>
              <p className="text-2xl font-bold text-green-600">{paidCount}</p>
            </div>
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-muted-foreground">{t('عمليات فاشلة', 'Failed')}</p>
              <p className="text-2xl font-bold text-destructive">{failedCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">{t('قيد التحقق', 'Verifying')}</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
          </div>
          {lastCheck && (
            <p className="text-xs text-muted-foreground mt-3">
              {t('آخر مطابقة مع البوابة:', 'Last gateway reconciliation:')}{' '}
              {lastCheck.toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US')}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('سجل الأحداث اللحظي', 'Live event feed')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              {t('جاري التحميل...', 'Loading...')}
            </div>
          ) : feed.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              {t('لا توجد عمليات دفع بعد', 'No payment events yet')}
            </div>
          ) : (
            <ScrollArea className="h-[460px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('الحالة', 'Status')}</TableHead>
                    <TableHead>{t('الطالب', 'Student')}</TableHead>
                    <TableHead>{t('الدورة', 'Course')}</TableHead>
                    <TableHead>{t('المبلغ', 'Amount')}</TableHead>
                    <TableHead>{t('الطريقة', 'Method')}</TableHead>
                    <TableHead>{t('الوقت', 'Time')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feed.map((item) => (
                    <TableRow key={`${item.id}-${item.status}-${item.receivedAt}`}>
                      <TableCell>{statusBadge(item.event)}</TableCell>
                      <TableCell className="font-medium">{item.studentName || '—'}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{item.courseName || '—'}</TableCell>
                      <TableCell>{item.amount} {t('ر.س', 'SAR')}</TableCell>
                      <TableCell className="text-muted-foreground">{item.payment_method}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(item.paid_at || item.created_at).toLocaleString(isRTL ? 'ar-SA' : 'en-US')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LivePaymentAlerts;
