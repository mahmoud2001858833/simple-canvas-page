import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DollarSign, CheckCircle, XCircle, Clock, Search, Wallet, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export const WithdrawalsManagement = () => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const texts = {
    ar: {
      title: 'إدارة طلبات السحب',
      subtitle: 'مراجعة وإدارة طلبات سحب أرباح المعلمين',
      totalPending: 'إجمالي المعلق',
      totalApproved: 'تمت الموافقة',
      totalPaid: 'تم التحويل',
      instructor: 'المعلم',
      amount: 'المبلغ',
      bank: 'البنك',
      iban: 'الآيبان',
      status: 'الحالة',
      date: 'التاريخ',
      actions: 'إجراءات',
      approve: 'موافقة',
      markPaid: 'تم التحويل',
      reject: 'رفض',
      rejectionReason: 'سبب الرفض',
      noRequests: 'لا توجد طلبات سحب',
      details: 'تفاصيل الطلب',
      accountHolder: 'صاحب الحساب',
      notes: 'ملاحظات المعلم',
      statuses: {
        pending: 'قيد المراجعة',
        approved: 'تمت الموافقة',
        paid: 'تم التحويل',
        rejected: 'مرفوض',
      },
    },
    en: {
      title: 'Withdrawals Management',
      subtitle: 'Review and manage instructor withdrawal requests',
      totalPending: 'Total Pending',
      totalApproved: 'Approved',
      totalPaid: 'Total Paid',
      instructor: 'Instructor',
      amount: 'Amount',
      bank: 'Bank',
      iban: 'IBAN',
      status: 'Status',
      date: 'Date',
      actions: 'Actions',
      approve: 'Approve',
      markPaid: 'Mark Paid',
      reject: 'Reject',
      rejectionReason: 'Rejection Reason',
      noRequests: 'No withdrawal requests',
      details: 'Request Details',
      accountHolder: 'Account Holder',
      notes: 'Instructor Notes',
      statuses: {
        pending: 'Pending',
        approved: 'Approved',
        paid: 'Paid',
        rejected: 'Rejected',
      },
    },
  };
  const t = texts[language];

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ['admin-withdrawals', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('withdrawal_requests')
        .select('*')
        .order('requested_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch instructor profiles
      const instructorIds = [...new Set(data?.map(w => w.instructor_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', instructorIds);

      return (data || []).map(w => ({
        ...w,
        instructor: profiles?.find(p => p.id === w.instructor_id),
      }));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, rejection_reason }: { id: string; status: string; rejection_reason?: string }) => {
      const updateData: any = {
        status,
        processed_at: new Date().toISOString(),
        processed_by: user?.id,
      };
      if (rejection_reason) updateData.rejection_reason = rejection_reason;

      const { error } = await supabase
        .from('withdrawal_requests')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      toast.success(language === 'ar' ? 'تم تحديث الحالة' : 'Status updated');
      setSelectedWithdrawal(null);
      setRejectionReason('');
    },
  });

  const totalPending = withdrawals?.filter(w => w.status === 'pending').reduce((sum, w) => sum + Number(w.amount), 0) || 0;
  const totalApproved = withdrawals?.filter(w => w.status === 'approved').reduce((sum, w) => sum + Number(w.amount), 0) || 0;
  const totalPaid = withdrawals?.filter(w => w.status === 'paid').reduce((sum, w) => sum + Number(w.amount), 0) || 0;

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      pending: { variant: 'secondary', icon: Clock },
      approved: { variant: 'outline', icon: CheckCircle },
      paid: { variant: 'default', icon: CheckCircle },
      rejected: { variant: 'destructive', icon: XCircle },
    };
    const cfg = config[status] || config.pending;
    const Icon = cfg.icon;
    return (
      <Badge variant={cfg.variant} className={status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}>
        <Icon className="w-3 h-3 me-1" />
        {t.statuses[status as keyof typeof t.statuses] || status}
      </Badge>
    );
  };

  const filtered = withdrawals?.filter(w => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      w.instructor?.full_name?.toLowerCase().includes(q) ||
      w.instructor?.email?.toLowerCase().includes(q) ||
      w.bank_name?.toLowerCase().includes(q) ||
      w.iban?.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-96" />
    </div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-muted-foreground">{t.subtitle}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: t.totalPending, value: totalPending, icon: Clock, color: 'bg-amber-500' },
          { title: t.totalApproved, value: totalApproved, icon: CheckCircle, color: 'bg-blue-500' },
          { title: t.totalPaid, value: totalPaid, icon: Wallet, color: 'bg-green-500' },
        ].map(card => (
          <div key={card.title} className="card-premium p-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">{card.value.toLocaleString()} ر.س</div>
                <div className="text-sm text-muted-foreground">{card.title}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={language === 'ar' ? 'بحث بالاسم أو الآيبان...' : 'Search by name or IBAN...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
            <SelectItem value="pending">{t.statuses.pending}</SelectItem>
            <SelectItem value="approved">{t.statuses.approved}</SelectItem>
            <SelectItem value="paid">{t.statuses.paid}</SelectItem>
            <SelectItem value="rejected">{t.statuses.rejected}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="card-premium overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.instructor}</TableHead>
              <TableHead>{t.amount}</TableHead>
              <TableHead>{t.bank}</TableHead>
              <TableHead>{t.iban}</TableHead>
              <TableHead>{t.status}</TableHead>
              <TableHead>{t.date}</TableHead>
              <TableHead>{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filtered || filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t.noRequests}</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((w: any) => (
                <TableRow key={w.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedWithdrawal(w)}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{w.instructor?.full_name || '-'}</div>
                      <div className="text-xs text-muted-foreground">{w.instructor?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">{Number(w.amount).toLocaleString()} ر.س</TableCell>
                  <TableCell>{w.bank_name || '-'}</TableCell>
                  <TableCell dir="ltr" className="text-sm">{w.iban || '-'}</TableCell>
                  <TableCell>{getStatusBadge(w.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(w.requested_at), 'd MMM yyyy', { locale: language === 'ar' ? ar : enUS })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      {w.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" className="text-green-600 border-green-300"
                            onClick={() => updateStatusMutation.mutate({ id: w.id, status: 'approved' })}>
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive border-destructive"
                            onClick={() => { setSelectedWithdrawal(w); setRejectionReason(''); }}>
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {w.status === 'approved' && (
                        <Button size="sm" variant="outline" className="text-green-600 border-green-300"
                          onClick={() => updateStatusMutation.mutate({ id: w.id, status: 'paid' })}>
                          <Send className="w-4 h-4 me-1" />
                          {t.markPaid}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail/Rejection Dialog */}
      <Dialog open={!!selectedWithdrawal} onOpenChange={(open) => { if (!open) setSelectedWithdrawal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.details}</DialogTitle>
          </DialogHeader>
          {selectedWithdrawal && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t.instructor}</p>
                  <p className="font-medium">{selectedWithdrawal.instructor?.full_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.amount}</p>
                  <p className="font-bold text-lg">{Number(selectedWithdrawal.amount).toLocaleString()} ر.س</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.bank}</p>
                  <p className="font-medium">{selectedWithdrawal.bank_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.iban}</p>
                  <p className="font-medium" dir="ltr">{selectedWithdrawal.iban}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.accountHolder}</p>
                  <p className="font-medium">{selectedWithdrawal.account_holder_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.status}</p>
                  {getStatusBadge(selectedWithdrawal.status)}
                </div>
              </div>

              {selectedWithdrawal.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t.notes}</p>
                  <p className="text-sm p-3 rounded-lg bg-muted">{selectedWithdrawal.notes}</p>
                </div>
              )}

              {selectedWithdrawal.status === 'pending' && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t.rejectionReason}</p>
                    <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 btn-gold"
                      onClick={() => updateStatusMutation.mutate({ id: selectedWithdrawal.id, status: 'approved' })}>
                      <CheckCircle className="w-4 h-4 me-2" />
                      {t.approve}
                    </Button>
                    <Button variant="destructive" className="flex-1"
                      disabled={!rejectionReason}
                      onClick={() => updateStatusMutation.mutate({
                        id: selectedWithdrawal.id,
                        status: 'rejected',
                        rejection_reason: rejectionReason
                      })}>
                      <XCircle className="w-4 h-4 me-2" />
                      {t.reject}
                    </Button>
                  </div>
                </div>
              )}

              {selectedWithdrawal.status === 'approved' && (
                <Button className="w-full btn-gold"
                  onClick={() => updateStatusMutation.mutate({ id: selectedWithdrawal.id, status: 'paid' })}>
                  <Send className="w-4 h-4 me-2" />
                  {t.markPaid}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
