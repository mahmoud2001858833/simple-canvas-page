import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, DollarSign, CheckCircle, XCircle, Clock, RefreshCw, Calendar, FileText, Eye, Bell } from 'lucide-react';

import { PaymentsTableSkeleton } from '@/components/ui/skeletons';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export const PaymentsManagement = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  const [newPayment, setNewPayment] = useState({
    user_email: '',
    amount: '',
    course_id: '',
    payment_method: 'manual' as const,
    notes: '',
  });

  // Courses list for manual payment (course + instructor must be identified)
  const { data: coursesList } = useQuery({
    queryKey: ['admin-courses-for-manual-payment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, title_ar, price, instructor_id, instructor_commission')
        .order('title', { ascending: true });
      if (error) throw error;

      const instructorIds = [...new Set((data || []).map((c: any) => c.instructor_id).filter(Boolean))];
      let map: Record<string, string> = {};
      if (instructorIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', instructorIds as string[]);
        map = (profs || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.full_name || p.email || '';
          return acc;
        }, {});
      }
      return (data || []).map((c: any) => ({ ...c, instructor_name: map[c.instructor_id] || '' }));
    },
  });

  const selectedManualCourse = coursesList?.find((c: any) => c.id === newPayment.course_id);

  const { data: payments, isLoading } = useQuery({
    queryKey: ['admin-payments', search, statusFilter, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select(`*, course:courses(title, title_ar, instructor_id, instructor_commission)`)
        .order('created_at', { ascending: false });

      if (statusFilter === 'abandoned') {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        query = query.eq('status', 'pending' as any).lte('created_at', cutoff);
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const paymentsWithUsers = await Promise.all(
        (data || []).map(async (payment) => {
          if (payment.user_id) {
            const { data: user } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', payment.user_id)
              .single();
            return { ...payment, user };
          }
          return { ...payment, user: null };
        })
      );

      return paymentsWithUsers;
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (payment: any) => {
      if (!payment.user_id) throw new Error('No user');
      await supabase.from('notifications').insert({
        user_id: payment.user_id,
        title: 'Complete Your Payment',
        title_ar: 'أكمل عملية الدفع',
        message: `You have a pending payment of ${Number(payment.amount).toLocaleString()} SAR. Complete it to access your course.`,
        message_ar: `لديك دفعة معلقة بقيمة ${Number(payment.amount).toLocaleString()} ر.س. أكمل الدفع للوصول إلى الدورة.`,
        type: 'warning',
        link: '/dashboard',
      });
      if (payment.user?.email) {
        await supabase.functions.invoke('send-notification-email', {
          body: {
            type: 'payment_reminder',
            to_email: payment.user.email,
            to_name: payment.user.full_name || '',
            amount: Number(payment.amount),
            course_title: payment.course?.title,
            course_title_ar: payment.course?.title_ar,
          },
        }).catch(console.error);
      }
    },
    onSuccess: () => toast.success(language === 'ar' ? 'تم إرسال التذكير' : 'Reminder sent'),
    onError: () => toast.error(language === 'ar' ? 'فشل إرسال التذكير' : 'Failed to send reminder'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, payment }: { id: string; status: string; payment?: any }) => {
      const updateData: any = { status };
      if (status === 'paid') {
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Enrollment + instructor earnings are created automatically by the
      // trg_finalize_paid_payment database trigger when status becomes 'paid'.
      if (status === 'paid' && payment?.course_id && payment?.user_id) {
        const plan = payment.installment_plan as Record<string, any> | null;
        const newPaidPercentage = plan?.new_paid_percentage ?? 100;


        // Notify student
        await supabase.from('notifications').insert({
          user_id: payment.user_id,
          title: 'Payment Confirmed',
          title_ar: 'تم تأكيد الدفع',
          message: newPaidPercentage < 100
            ? `Payment confirmed. You now have access to ${newPaidPercentage}% of the course content.`
            : `Your payment has been confirmed. You can now access the course.`,
          message_ar: newPaidPercentage < 100
            ? `تم تأكيد الدفع. يمكنك الآن الوصول لـ ${newPaidPercentage}% من محتوى الدورة.`
            : `تم تأكيد دفعتك. يمكنك الآن الوصول للدورة.`,
          type: 'success',
          link: '/dashboard',
        });

        // Send email to student
        const { data: studentProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', payment.user_id)
          .single();

        if (studentProfile?.email) {
          supabase.functions.invoke('send-notification-email', {
            body: {
              type: 'payment_confirmed',
              to_email: studentProfile.email,
              to_name: studentProfile.full_name || '',
              amount: Number(payment.amount),
              course_title: payment.course?.title,
              course_title_ar: payment.course?.title_ar,
            },
          }).catch(console.error);

          supabase.functions.invoke('send-notification-email', {
            body: {
              type: 'enrollment',
              to_email: studentProfile.email,
              to_name: studentProfile.full_name || '',
              course_title: payment.course?.title,
              course_title_ar: payment.course?.title_ar,
            },
          }).catch(console.error);
        }

        // Notify instructor
        if (payment.course?.instructor_id) {
          const isInstallment = plan?.is_continuation;
          await supabase.from('notifications').insert({
            user_id: payment.course.instructor_id,
            title: isInstallment ? 'Installment Payment Received' : 'New Student Enrolled',
            title_ar: isInstallment ? 'تم استلام دفعة قسط' : 'طالب جديد مسجل',
            message: `Payment of ${Number(payment.amount).toLocaleString()} SAR received.`,
            message_ar: `تم استلام دفعة ${Number(payment.amount).toLocaleString()} ر.س.`,
            type: 'info',
            link: '/instructor-dashboard',
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      toast.success(language === 'ar' ? 'تم تحديث الحالة' : 'Status updated');
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      // The database trigger reverses instructor earnings, enrollment access,
      // coupon usage and referral commission, and notifies both parties.
      const { error } = await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('id', paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      toast.success(language === 'ar' ? 'تم الاسترداد وعكس الأرباح والوصول' : 'Refund processed and earnings reversed');
      setRefundPaymentId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Ask the payment gateway for the real status of every stuck pending payment
  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('verify-alinma-payment', {
        body: { reconcileAll: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      // Anything the gateway can't confirm and is older than 20 minutes fails.
      await supabase.rpc('expire_stale_online_payments' as any, { p_minutes: 20 });
      return data as any;
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      toast.success(
        language === 'ar'
          ? `تمت مراجعة ${data?.checked ?? 0} عملية — مدفوعة: ${data?.paid ?? 0}، مرفوضة: ${data?.failed ?? 0}، غير محسومة: ${data?.unknown ?? 0}`
          : `Checked ${data?.checked ?? 0} — paid: ${data?.paid ?? 0}, failed: ${data?.failed ?? 0}, unknown: ${data?.unknown ?? 0}`,
      );
    },
    onError: (e: any) => toast.error(e.message),
  });


  const addManualPaymentMutation = useMutation({
    mutationFn: async (data: typeof newPayment) => {
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', data.user_email)
        .single();

      if (userError || !user) {
        throw new Error(language === 'ar' ? 'لم يتم العثور على المستخدم' : 'User not found');
      }

      const course = coursesList?.find((c: any) => c.id === data.course_id);
      if (!course) {
        throw new Error(language === 'ar' ? 'يجب اختيار الدورة' : 'Course is required');
      }

      const amount = parseFloat(data.amount);

      const { data: paymentRow, error } = await supabase.from('payments').insert([{
        user_id: user.id,
        course_id: course.id,
        amount,
        payment_method: 'manual',
        status: 'paid',
        paid_at: new Date().toISOString(),
        notes: [
          language === 'ar' ? 'دفعة يدوية بواسطة الإدارة' : 'Manual payment by admin',
          `Course: ${course.title}`,
          course.instructor_name ? `Instructor: ${course.instructor_name}` : null,
          data.notes || null,
        ].filter(Boolean).join(' | '),
      }]).select().single();

      if (error) throw error;

      // Enrollment and instructor earnings are created automatically by the
      // trg_finalize_paid_payment database trigger, and the payment is flagged
      // as manual in the ledger through payment_method = 'manual'.
      void paymentRow;

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      toast.success(language === 'ar' ? 'تمت إضافة الدفعة بنجاح' : 'Payment added successfully');
      setIsAddDialogOpen(false);
      setNewPayment({ user_email: '', amount: '', course_id: '', payment_method: 'manual', notes: '' });
    },
    onError: (error: any) => toast.error(error.message),
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any; label: { ar: string; en: string } }> = {
      pending: { color: 'bg-warning', icon: Clock, label: { ar: 'معلق', en: 'Pending' } },
      paid: { color: 'bg-success', icon: CheckCircle, label: { ar: 'مدفوع', en: 'Paid' } },
      failed: { color: 'bg-destructive', icon: XCircle, label: { ar: 'فشل', en: 'Failed' } },
      refunded: { color: 'bg-muted', icon: RefreshCw, label: { ar: 'مسترد', en: 'Refunded' } },
      partial: { color: 'bg-info', icon: DollarSign, label: { ar: 'جزئي', en: 'Partial' } },
    };
    const cfg = config[status] || config.pending;
    const Icon = cfg.icon;
    return (
      <Badge className={`${cfg.color} text-white flex items-center gap-1 w-fit`}>
        <Icon className="w-3 h-3" />
        {cfg.label[language]}
      </Badge>
    );
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      online: { ar: 'إلكتروني', en: 'Online' },
      tabby: { ar: 'تابي', en: 'Tabby' },
      bank_transfer: { ar: 'تحويل بنكي', en: 'Bank Transfer' },
      manual: { ar: 'يدوي', en: 'Manual' },
    };
    return labels[method]?.[language] || method;
  };

  const totalRevenue = payments?.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0;
  const pendingAmount = payments?.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0;
  const refundedAmount = payments?.filter((p: any) => p.status === 'refunded').reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {language === 'ar' ? 'إدارة المدفوعات' : 'Payments Management'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'تتبع وإدارة المدفوعات' : 'Track and manage payments'}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={reconcileMutation.isPending}
          onClick={() => reconcileMutation.mutate()}
        >
          <RefreshCw className={`w-4 h-4 me-2 ${reconcileMutation.isPending ? 'animate-spin' : ''}`} />
          {language === 'ar' ? 'مطابقة المدفوعات المعلقة' : 'Reconcile Pending Payments'}
        </Button>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>

          <DialogTrigger asChild>
            <Button className="btn-gold">
              <Plus className="w-4 h-4 me-2" />
              {language === 'ar' ? 'إضافة دفعة يدوية' : 'Add Manual Payment'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === 'ar' ? 'إضافة دفعة يدوية' : 'Add Manual Payment'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'البريد الإلكتروني للمستخدم' : 'User Email'}</Label>
                <Input type="email" value={newPayment.user_email}
                  onChange={(e) => setNewPayment({ ...newPayment, user_email: e.target.value })} placeholder="user@example.com" />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'الدورة' : 'Course'}</Label>
                <Select
                  value={newPayment.course_id}
                  onValueChange={(v) => {
                    const c = coursesList?.find((x: any) => x.id === v);
                    setNewPayment({
                      ...newPayment,
                      course_id: v,
                      amount: newPayment.amount || String(c?.price ?? ''),
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر الدورة' : 'Select course'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {coursesList?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {language === 'ar' ? c.title_ar || c.title : c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedManualCourse && (
                <div className="rounded-lg border p-3 text-sm space-y-1 bg-muted/40">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === 'ar' ? 'المعلم' : 'Instructor'}</span>
                    <span className="font-medium">{selectedManualCourse.instructor_name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === 'ar' ? 'نسبة المعلم' : 'Instructor share'}</span>
                    <span className="font-medium">{selectedManualCourse.instructor_commission ?? 70}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === 'ar' ? 'نصيب المعلم من هذه الدفعة' : 'Instructor earning'}</span>
                    <span className="font-medium">
                      {Math.round(((parseFloat(newPayment.amount) || 0) * (selectedManualCourse.instructor_commission ?? 70)) / 100).toLocaleString()} {language === 'ar' ? 'ر.س' : 'SAR'}
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'المبلغ (ر.س)' : 'Amount (SAR)'}</Label>
                <Input type="number" value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
                <Textarea value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'ستُسجَّل الدفعة في السجل المالي مع وسم "يدوي"، ويتم تفعيل تسجيل الطالب واحتساب أرباح المعلم تلقائياً.'
                  : 'The payment is recorded in the financial ledger flagged as Manual, enrolls the student and books instructor earnings.'}
              </p>
              <Button className="btn-gold w-full"
                onClick={() => addManualPaymentMutation.mutate(newPayment)}
                disabled={!newPayment.user_email || !newPayment.amount || !newPayment.course_id || addManualPaymentMutation.isPending}>
                {language === 'ar' ? 'إضافة' : 'Add'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card-premium p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-success rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalRevenue.toLocaleString()} ر.س</div>
              <div className="text-sm text-muted-foreground">{language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}</div>
            </div>
          </div>
        </div>
        <div className="card-premium p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-warning rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold">{pendingAmount.toLocaleString()} ر.س</div>
              <div className="text-sm text-muted-foreground">{language === 'ar' ? 'معلق' : 'Pending'}</div>
            </div>
          </div>
        </div>
        <div className="card-premium p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold">{payments?.filter((p: any) => p.status === 'paid').length || 0}</div>
              <div className="text-sm text-muted-foreground">{language === 'ar' ? 'معاملات ناجحة' : 'Successful'}</div>
            </div>
          </div>
        </div>
        <div className="card-premium p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <div className="text-2xl font-bold">{refundedAmount.toLocaleString()} ر.س</div>
              <div className="text-sm text-muted-foreground">{language === 'ar' ? 'مسترد' : 'Refunded'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={language === 'ar' ? 'بحث...' : 'Search...'} value={search}
            onChange={(e) => setSearch(e.target.value)} className="ps-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
            <SelectItem value="pending">{language === 'ar' ? 'معلق' : 'Pending'}</SelectItem>
            <SelectItem value="paid">{language === 'ar' ? 'مدفوع' : 'Paid'}</SelectItem>
            <SelectItem value="failed">{language === 'ar' ? 'فشل' : 'Failed'}</SelectItem>
            <SelectItem value="refunded">{language === 'ar' ? 'مسترد' : 'Refunded'}</SelectItem>
            <SelectItem value="abandoned">{language === 'ar' ? 'مهجور (+24 ساعة)' : 'Abandoned (>24h)'}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
          <span className="text-muted-foreground">-</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <PaymentsTableSkeleton rows={6} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'المستخدم' : 'User'}</TableHead>
                <TableHead>{language === 'ar' ? 'الدورة' : 'Course'}</TableHead>
                <TableHead>{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                <TableHead>{language === 'ar' ? 'الطريقة' : 'Method'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments?.map((payment: any) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{payment.user?.full_name || '-'}</div>
                      <div className="text-sm text-muted-foreground">{payment.user?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                    {language === 'ar' ? payment.course?.title_ar : payment.course?.title || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="font-bold">{parseFloat(payment.amount).toLocaleString()} ر.س</div>
                    {payment.installment_plan && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {language === 'ar' ? 'قسط' : 'Installment'}: {(payment.installment_plan as any)?.new_paid_percentage || 100}%
                        {(payment.installment_plan as any)?.is_continuation && (
                          <span className="text-primary ms-1">({language === 'ar' ? 'تكملة' : 'cont.'})</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getMethodLabel(payment.payment_method)}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(payment.created_at), 'd MMM yyyy', {
                      locale: language === 'ar' ? ar : enUS,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {/* View Receipt button for bank transfers */}
                      {payment.receipt_url && (
                        <Button size="sm" variant="outline"
                          onClick={async () => {
                            const { data } = await supabase.storage.from('payment-receipts').createSignedUrl(payment.receipt_url, 300);
                            if (data?.signedUrl) {
                              setReceiptUrl(data.signedUrl);
                              setReceiptDialogOpen(true);
                            } else {
                              toast.error(language === 'ar' ? 'تعذر تحميل الوصل' : 'Failed to load receipt');
                            }
                          }}>
                          <Eye className="w-4 h-4 me-1" />
                          {language === 'ar' ? 'الوصل' : 'Receipt'}
                        </Button>
                      )}
                      {payment.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" className="text-success border-success"
                            onClick={() => updateStatusMutation.mutate({ id: payment.id, status: 'paid', payment })}>
                            <CheckCircle className="w-4 h-4 me-1" />
                            {language === 'ar' ? 'تأكيد' : 'Confirm'}
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive border-destructive"
                            onClick={() => updateStatusMutation.mutate({ id: payment.id, status: 'failed' })}>
                            <XCircle className="w-4 h-4" />
                          </Button>
                          {(Date.now() - new Date(payment.created_at).getTime()) > 24 * 60 * 60 * 1000 && payment.user_id && (
                            <Button size="sm" variant="outline" className="text-warning border-warning"
                              disabled={sendReminderMutation.isPending}
                              onClick={() => sendReminderMutation.mutate(payment)}>
                              <Bell className="w-4 h-4 me-1" />
                              {language === 'ar' ? 'تذكير' : 'Remind'}
                            </Button>
                          )}
                        </>
                      )}
                      {payment.status === 'paid' && (
                        <AlertDialog open={refundPaymentId === payment.id} onOpenChange={(open) => !open && setRefundPaymentId(null)}>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-muted-foreground"
                              onClick={() => setRefundPaymentId(payment.id)}>
                              <RefreshCw className="w-4 h-4 me-1" />
                              {language === 'ar' ? 'استرداد' : 'Refund'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {language === 'ar' ? 'تأكيد الاسترداد' : 'Confirm Refund'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {language === 'ar'
                                  ? `هل تريد استرداد مبلغ ${parseFloat(payment.amount).toLocaleString()} ر.س؟ سيتم إلغاء تسجيل الطالب من الدورة.`
                                  : `Refund ${parseFloat(payment.amount).toLocaleString()} SAR? The student will be unenrolled from the course.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground"
                                onClick={() => refundMutation.mutate(payment.id)}>
                                {language === 'ar' ? 'تأكيد الاسترداد' : 'Confirm Refund'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Receipt Viewer Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'وصل التحويل البنكي' : 'Bank Transfer Receipt'}</DialogTitle>
          </DialogHeader>
          {receiptUrl && (
            <div className="flex flex-col items-center gap-4">
              {receiptUrl.match(/\.pdf/i) ? (
                <iframe src={receiptUrl} className="w-full h-[500px] rounded-lg border" />
              ) : (
                <img src={receiptUrl} alt="Receipt" className="max-w-full max-h-[500px] rounded-lg border object-contain" />
              )}
              <Button variant="outline" asChild>
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'فتح في نافذة جديدة' : 'Open in new tab'}
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
