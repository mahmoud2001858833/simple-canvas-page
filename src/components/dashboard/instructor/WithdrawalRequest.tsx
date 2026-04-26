import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { DollarSign, Send, Clock, CheckCircle, XCircle, Wallet, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { motion } from 'framer-motion';

export const WithdrawalRequest = () => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    bank_name: '',
    iban: '',
    account_holder_name: '',
    notes: '',
  });

  const texts = {
    ar: {
      title: 'طلب سحب أرباح',
      availableBalance: 'الرصيد المتاح للسحب',
      totalWithdrawn: 'إجمالي المسحوب',
      pendingWithdrawals: 'طلبات معلقة',
      newRequest: 'طلب سحب جديد',
      amount: 'المبلغ (ر.س)',
      bankName: 'اسم البنك',
      iban: 'رقم الآيبان (IBAN)',
      accountHolder: 'اسم صاحب الحساب',
      notes: 'ملاحظات (اختياري)',
      submit: 'إرسال الطلب',
      noRequests: 'لا توجد طلبات سحب',
      myRequests: 'طلباتي السابقة',
      status: {
        pending: 'قيد المراجعة',
        approved: 'تمت الموافقة',
        paid: 'تم التحويل',
        rejected: 'مرفوض',
      },
      errors: {
        exceedsBalance: 'المبلغ يتجاوز الرصيد المتاح',
        fillRequired: 'يرجى ملء جميع الحقول المطلوبة',
      },
      success: 'تم إرسال طلب السحب بنجاح',
    },
    en: {
      title: 'Withdrawal Request',
      availableBalance: 'Available Balance',
      totalWithdrawn: 'Total Withdrawn',
      pendingWithdrawals: 'Pending Withdrawals',
      newRequest: 'New Withdrawal',
      amount: 'Amount (SAR)',
      bankName: 'Bank Name',
      iban: 'IBAN Number',
      accountHolder: 'Account Holder Name',
      notes: 'Notes (optional)',
      submit: 'Submit Request',
      noRequests: 'No withdrawal requests',
      myRequests: 'Previous Requests',
      status: {
        pending: 'Under Review',
        approved: 'Approved',
        paid: 'Paid',
        rejected: 'Rejected',
      },
      errors: {
        exceedsBalance: 'Amount exceeds available balance',
        fillRequired: 'Please fill all required fields',
      },
      success: 'Withdrawal request submitted successfully',
    },
  };
  const t = texts[language];

  // Fetch earnings summary
  const { data: earningsSummary, isLoading: loadingEarnings } = useQuery({
    queryKey: ['instructor-earnings-summary', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructor_earnings')
        .select('amount, status')
        .eq('instructor_id', user!.id);

      if (error) throw error;

      const total = data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
      const pending = data?.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      // Fetch paid withdrawals
      const { data: withdrawals } = await supabase
        .from('withdrawal_requests')
        .select('amount, status')
        .eq('instructor_id', user!.id);

      const totalWithdrawn = withdrawals?.filter(w => w.status === 'paid').reduce((sum, w) => sum + Number(w.amount), 0) || 0;
      const pendingWithdrawals = withdrawals?.filter(w => w.status === 'pending' || w.status === 'approved').reduce((sum, w) => sum + Number(w.amount), 0) || 0;

      return {
        availableBalance: pending - pendingWithdrawals,
        totalWithdrawn,
        pendingWithdrawals,
      };
    },
    enabled: !!user,
  });

  // Fetch withdrawal requests
  const { data: withdrawals, isLoading: loadingWithdrawals } = useQuery({
    queryKey: ['instructor-withdrawals', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('instructor_id', user!.id)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(form.amount);
      if (!form.amount || !form.bank_name || !form.iban || !form.account_holder_name) {
        throw new Error(t.errors.fillRequired);
      }
      if (amount > (earningsSummary?.availableBalance || 0)) {
        throw new Error(t.errors.exceedsBalance);
      }

      const { error } = await supabase.from('withdrawal_requests').insert({
        instructor_id: user!.id,
        amount,
        bank_name: form.bank_name,
        iban: form.iban,
        account_holder_name: form.account_holder_name,
        notes: form.notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-earnings-summary'] });
      toast.success(t.success);
      setIsDialogOpen(false);
      setForm({ amount: '', bank_name: '', iban: '', account_holder_name: '', notes: '' });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      pending: { variant: 'secondary', icon: Clock },
      approved: { variant: 'default', icon: CheckCircle },
      paid: { variant: 'default', icon: CheckCircle },
      rejected: { variant: 'destructive', icon: XCircle },
    };
    const cfg = config[status] || config.pending;
    const Icon = cfg.icon;
    return (
      <Badge variant={cfg.variant} className={status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}>
        <Icon className="w-3 h-3 me-1" />
        {t.status[status as keyof typeof t.status] || status}
      </Badge>
    );
  };

  if (loadingEarnings) {
    return <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t.title}</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gold">
              <Send className="w-4 h-4 me-2" />
              {t.newRequest}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.newRequest}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-sm text-muted-foreground">{t.availableBalance}</p>
                <p className="text-2xl font-bold text-primary">
                  {(earningsSummary?.availableBalance || 0).toLocaleString()} ر.س
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t.amount} *</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  max={earningsSummary?.availableBalance || 0}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.bankName} *</Label>
                <Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t.iban} *</Label>
                <Input value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value })} placeholder="SA..." dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>{t.accountHolder} *</Label>
                <Input value={form.account_holder_name} onChange={e => setForm({ ...form, account_holder_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t.notes}</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button
                className="btn-gold w-full"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? '...' : t.submit}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: t.availableBalance, value: earningsSummary?.availableBalance || 0, icon: Wallet, color: 'from-primary to-primary/80' },
          { title: t.totalWithdrawn, value: earningsSummary?.totalWithdrawn || 0, icon: CheckCircle, color: 'from-green-500 to-green-600' },
          { title: t.pendingWithdrawals, value: earningsSummary?.pendingWithdrawals || 0, icon: Clock, color: 'from-amber-500 to-amber-600' },
        ].map((card, index) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                    <card.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-xl font-bold">{card.value.toLocaleString()} ر.س</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Withdrawal History */}
      <Card>
        <CardHeader>
          <CardTitle>{t.myRequests}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingWithdrawals ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : !withdrawals || withdrawals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t.noRequests}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w: any, index: number) => (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{w.bank_name} - {w.iban?.slice(-4)}</h4>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(w.requested_at), 'PPP', { locale: language === 'ar' ? ar : enUS })}
                    </p>
                    {w.rejection_reason && (
                      <p className="text-xs text-destructive mt-1">{w.rejection_reason}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-bold">{Number(w.amount).toLocaleString()} ر.س</span>
                    {getStatusBadge(w.status)}
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
