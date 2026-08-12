import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ListSkeleton } from '@/components/ui/skeletons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { RotateCcw, Wallet, CheckCircle, Users } from 'lucide-react';
import { format } from 'date-fns';

interface RefundRow {
  id: string;
  user_id: string;
  course_id: string | null;
  amount: number;
  status: string;
  reason: string | null;
  notes: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
  student_name?: string;
  student_email?: string;
  course_title?: string;
}

export const StudentRefunds = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ar = language === 'ar';

  const [selected, setSelected] = useState<RefundRow | null>(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: refunds, isLoading } = useQuery({
    queryKey: ['student-refunds'],
    queryFn: async (): Promise<RefundRow[]> => {
      const { data, error } = await supabase
        .from('student_refunds')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = (data || []) as RefundRow[];
      const userIds = [...new Set(rows.map(r => r.user_id))];
      const courseIds = [...new Set(rows.map(r => r.course_id).filter(Boolean))] as string[];

      const [{ data: profiles }, { data: courses }] = await Promise.all([
        userIds.length
          ? supabase.from('profiles').select('id, full_name, full_name_ar, email').in('id', userIds)
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length
          ? supabase.from('courses').select('id, title, title_ar').in('id', courseIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const pMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const cMap = new Map((courses || []).map((c: any) => [c.id, c]));

      return rows.map(r => {
        const p: any = pMap.get(r.user_id);
        const c: any = r.course_id ? cMap.get(r.course_id) : null;
        return {
          ...r,
          student_name: p ? (ar ? p.full_name_ar || p.full_name : p.full_name) || p.email : '',
          student_email: p?.email || '',
          course_title: c ? (ar ? c.title_ar : c.title) : '',
        };
      });
    },
  });

  const pending = (refunds || []).filter(r => r.status === 'pending');
  const paid = (refunds || []).filter(r => r.status === 'paid');
  const totalDue = pending.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalPaid = paid.reduce((s, r) => s + Number(r.amount || 0), 0);

  const openPay = (row: RefundRow) => {
    setSelected(row);
    setReceiptUrl(row.receipt_url || '');
    setNotes(row.notes || '');
  };

  const confirmPay = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('student_refunds')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          processed_by: user?.id ?? null,
          receipt_url: receiptUrl || null,
          notes: notes || null,
        })
        .eq('id', selected.id);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: selected.user_id,
        title: 'Refund transferred',
        title_ar: 'تم تحويل مبلغ الاسترداد',
        message: `Your refund of ${selected.amount} SAR has been transferred.`,
        message_ar: `تم تحويل مبلغ الاسترداد ${selected.amount} ر.س إلى حسابك.`,
        type: 'success',
        link: '/dashboard',
      });

      toast.success(ar ? 'تم تأكيد التحويل وتحديث السجلات المالية' : 'Transfer confirmed and records updated');
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['student-refunds'] });
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['financial-dashboard'] });
    } catch (e: any) {
      toast.error(ar ? 'تعذر تأكيد التحويل' : 'Could not confirm transfer');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <ListSkeleton rows={5} />;

  const cards = [
    { title: ar ? 'مستحقات لم تُحوَّل' : 'Pending refunds', value: totalDue, icon: Wallet, gradient: 'from-orange-500 to-orange-600' },
    { title: ar ? 'تم تحويلها' : 'Transferred', value: totalPaid, icon: CheckCircle, gradient: 'from-green-500 to-green-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <RotateCcw className="w-6 h-6 text-primary" />
          {ar ? 'مستحقات الطلبة المنسحبين' : 'Withdrawn Students Refunds'}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {ar
            ? 'المبالغ الواجب تحويلها للطلبة الذين انسحبوا من الدورات. عند تأكيد التحويل يتم تحديث السجلات المالية.'
            : 'Amounts owed to students who withdrew. Confirming a transfer updates the financial records.'}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.title}>
            <CardContent className="p-4">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.gradient} flex items-center justify-center mb-3`}>
                <c.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{c.title}</p>
              <p className="text-xl font-bold">{c.value.toLocaleString()} ر.س</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="p-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{ar ? 'عدد الطلبات' : 'Requests'}</p>
            <p className="text-xl font-bold">{(refunds || []).length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{ar ? 'قائمة المستحقات' : 'Refunds list'}</CardTitle>
        </CardHeader>
        <CardContent>
          {(refunds || []).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {ar ? 'لا توجد مستحقات حالياً' : 'No refunds yet'}
            </p>
          ) : (
            <div className="space-y-3">
              {(refunds || []).map(r => (
                <div key={r.id} className="flex flex-wrap items-center gap-4 p-4 rounded-xl border bg-card">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium">{r.student_name || r.student_email}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {r.course_title} · {format(new Date(r.created_at), 'yyyy-MM-dd')}
                    </p>
                  </div>
                  <span className="font-bold text-primary">{Number(r.amount).toLocaleString()} ر.س</span>
                  <Badge variant={r.status === 'paid' ? 'default' : 'secondary'}>
                    {r.status === 'paid' ? (ar ? 'تم التحويل' : 'Paid') : ar ? 'بانتظار التحويل' : 'Pending'}
                  </Badge>
                  {r.status === 'pending' ? (
                    <Button size="sm" onClick={() => openPay(r)}>
                      {ar ? 'تأكيد الدفع' : 'Confirm payment'}
                    </Button>
                  ) : (
                    r.receipt_url && (
                      <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                        {ar ? 'الوصل' : 'Receipt'}
                      </a>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ar ? 'تأكيد تحويل المبلغ للطالب' : 'Confirm refund transfer'}</DialogTitle>
            <DialogDescription>
              {ar
                ? `المبلغ المطلوب تحويله: ${Number(selected?.amount || 0).toLocaleString()} ر.س`
                : `Amount to transfer: ${Number(selected?.amount || 0).toLocaleString()} SAR`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{ar ? 'رابط وصل التحويل (اختياري)' : 'Receipt URL (optional)'}</Label>
              <Input value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>{ar ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              {ar ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={confirmPay} disabled={saving}>
              {ar ? 'تأكيد الدفع' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
