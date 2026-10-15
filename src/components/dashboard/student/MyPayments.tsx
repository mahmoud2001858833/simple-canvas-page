import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DollarSign, CheckCircle, Clock, XCircle, CreditCard, Building2, Receipt, Upload, Eye, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export const MyPayments = () => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPaymentId, setUploadingPaymentId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  const { data: payments, isLoading } = useQuery({
    queryKey: ['student-payments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          course:courses(title, title_ar)
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const uploadReceiptMutation = useMutation({
    mutationFn: async ({ paymentId, file }: { paymentId: string; file: File }) => {
      const ext = file.name.split('.').pop();
      const path = `${user!.id}/${paymentId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('payments')
        .update({ receipt_url: path })
        .eq('id', paymentId)
        .eq('user_id', user!.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-payments'] });
      toast.success(language === 'ar' ? 'تم رفع الإيصال بنجاح' : 'Receipt uploaded successfully');
      setUploadingPaymentId(null);
      setUploadDialogOpen(false);
    },
    onError: () => {
      toast.error(language === 'ar' ? 'فشل رفع الإيصال' : 'Failed to upload receipt');
      setUploadingPaymentId(null);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingPaymentId) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'الحد الأقصى 10 ميجابايت' : 'Max file size is 10MB');
      return;
    }
    uploadReceiptMutation.mutate({ paymentId: uploadingPaymentId, file });
    e.target.value = '';
  };

  const viewReceipt = async (receiptPath: string) => {
    const { data } = await supabase.storage.from('payment-receipts').createSignedUrl(receiptPath, 300);
    if (data?.signedUrl) {
      setReceiptUrl(data.signedUrl);
      setReceiptDialogOpen(true);
    } else {
      toast.error(language === 'ar' ? 'تعذر تحميل الإيصال' : 'Failed to load receipt');
    }
  };

  const texts = {
    ar: {
      title: 'مدفوعاتي',
      totalPaid: 'إجمالي المدفوع',
      pending: 'معلق',
      transactions: 'عدد المعاملات',
      noPayments: 'لا توجد مدفوعات بعد',
      uploadReceipt: 'رفع إيصال',
      viewReceipt: 'عرض الإيصال',
      receiptTitle: 'إيصال التحويل البنكي',
      openNewTab: 'فتح في نافذة جديدة',
      status: {
        pending: 'معلق',
        paid: 'مدفوع',
        failed: 'فشل',
        refunded: 'مسترد',
        partial: 'جزئي',
      },
      methods: {
        online: 'بطاقة إلكترونية',
        bank_transfer: 'تحويل بنكي',
        tabby: 'تابي',
        manual: 'يدوي',
      },
    },
    en: {
      title: 'My Payments',
      totalPaid: 'Total Paid',
      pending: 'Pending',
      transactions: 'Transactions',
      noPayments: 'No payments yet',
      uploadReceipt: 'Upload Receipt',
      viewReceipt: 'View Receipt',
      receiptTitle: 'Bank Transfer Receipt',
      openNewTab: 'Open in new tab',
      status: {
        pending: 'Pending',
        paid: 'Paid',
        failed: 'Failed',
        refunded: 'Refunded',
        partial: 'Partial',
      },
      methods: {
        online: 'Online Card',
        bank_transfer: 'Bank Transfer',
        tabby: 'Tabby',
        manual: 'Manual',
      },
    },
  };

  const t = texts[language];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const totalPaid = payments?.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const pendingAmount = payments?.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <DollarSign className="w-4 h-4" />;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'online': return <CreditCard className="w-4 h-4" />;
      case 'bank_transfer': return <Building2 className="w-4 h-4" />;
      default: return <Receipt className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t.title}</h2>

      {/* Hidden file input for upload dialog */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.totalPaid}</p>
                  <p className="text-xl font-bold">{totalPaid.toLocaleString()} ر.س</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.pending}</p>
                  <p className="text-xl font-bold">{pendingAmount.toLocaleString()} ر.س</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.transactions}</p>
                  <p className="text-xl font-bold">{payments?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {!payments || payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t.noPayments}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment: any, index: number) => (
                <motion.div
                  key={payment.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex flex-col gap-3 p-4 rounded-xl border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {getStatusIcon(payment.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">
                        {language === 'ar' ? payment.course?.title_ar : payment.course?.title || '-'}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        {getMethodIcon(payment.payment_method)}
                        <span className="text-xs text-muted-foreground">
                          {t.methods[payment.payment_method as keyof typeof t.methods] || payment.payment_method}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(payment.created_at), 'PPP', { locale: language === 'ar' ? ar : enUS })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold">{Number(payment.amount).toLocaleString()} ر.س</span>
                      <Badge
                        variant={payment.status === 'paid' ? 'default' : payment.status === 'failed' ? 'destructive' : 'secondary'}
                        className={payment.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}
                      >
                        {t.status[payment.status as keyof typeof t.status] || payment.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Receipt actions for bank_transfer payments */}
                  {payment.payment_method === 'bank_transfer' && (
                    <div className="flex items-center gap-2 ps-8">
                      {payment.receipt_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => viewReceipt(payment.receipt_url)}
                        >
                          <Eye className="w-4 h-4 me-1" />
                          {t.viewReceipt}
                        </Button>
                      ) : null}
                      {payment.status === 'pending' && (
                        <Button
                          size="sm"
                          type="button"
                          variant={payment.receipt_url ? 'ghost' : 'default'}
                          disabled={uploadReceiptMutation.isPending && uploadingPaymentId === payment.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setUploadingPaymentId(payment.id);
                            setUploadDialogOpen(true);
                          }}
                        >
                          {uploadReceiptMutation.isPending && uploadingPaymentId === payment.id ? (
                            <Loader2 className="w-4 h-4 me-1 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4 me-1" />
                          )}
                          {payment.receipt_url
                            ? (language === 'ar' ? 'تغيير الإيصال' : 'Change Receipt')
                            : t.uploadReceipt}
                        </Button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Receipt Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) setUploadingPaymentId(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.uploadReceipt}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div
              className="w-full border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                {language === 'ar' ? 'اضغط لاختيار ملف' : 'Click to select a file'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'ar' ? 'صور أو PDF - الحد الأقصى 10 ميجابايت' : 'Images or PDF - Max 10MB'}
              </p>
            </div>
            {uploadReceiptMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {language === 'ar' ? 'جاري الرفع...' : 'Uploading...'}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Viewer Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.receiptTitle}</DialogTitle>
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
                  {t.openNewTab}
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
