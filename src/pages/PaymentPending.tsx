import { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { 
  Clock, 
  Building2, 
  Copy, 
  CheckCircle2,
  ArrowRight,
  Upload,
  Loader2,
  FileText,
  X
} from 'lucide-react';
import { toast } from 'sonner';

const PaymentPending = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const [searchParams] = useSearchParams();
  const paramPaymentId = searchParams.get('payment_id');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [resolvedPaymentId, setResolvedPaymentId] = useState<string | null>(paramPaymentId);

  // If no payment_id in URL, try to find latest pending bank_transfer payment
  useEffect(() => {
    if (!paramPaymentId && user) {
      supabase
        .from('payments')
        .select('id')
        .eq('user_id', user.id)
        .eq('payment_method', 'bank_transfer')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
        .then(({ data }) => {
          if (data) setResolvedPaymentId(data.id);
        });
    }
  }, [paramPaymentId, user]);

  const bankDetails = {
    bank: isRTL ? 'بنك الإنماء' : 'Alinma Bank',
    iban: 'SA3805000068207056692000',
    accountNumber: '68207056692000',
    beneficiary: isRTL ? 'عمار سعيد ناشر الجدعاني' : 'Ammar Saeed Nasher Aljadani',
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(isRTL ? `تم نسخ ${label}` : `${label} copied to clipboard`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isRTL ? 'الحد الأقصى 10 ميجابايت' : 'Max file size is 10MB');
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user || !resolvedPaymentId) return;
    setUploading(true);
    try {
      const ext = selectedFile.name.split('.').pop();
      const path = `${user.id}/${resolvedPaymentId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-receipts')
        .upload(path, selectedFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('payments')
        .update({ receipt_url: path })
        .eq('id', resolvedPaymentId)
        .eq('user_id', user.id);
      if (updateError) throw updateError;

      setUploaded(true);
      toast.success(isRTL ? 'تم رفع الإيصال بنجاح! سيتم مراجعته قريباً' : 'Receipt uploaded successfully! It will be reviewed soon.');
    } catch {
      toast.error(isRTL ? 'فشل رفع الإيصال' : 'Failed to upload receipt');
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`min-h-screen bg-gradient-to-b from-amber-50 to-background dark:from-amber-950/20 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-6">
              <Clock className="h-12 w-12 text-amber-600" />
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-3xl font-bold text-amber-800 dark:text-amber-400 mb-2">
                {isRTL ? 'في انتظار التحويل' : 'Awaiting Bank Transfer'}
              </h1>
              <p className="text-muted-foreground">
                {isRTL 
                  ? 'يرجى إتمام التحويل البنكي ورفع إيصال التحويل'
                  : 'Please complete the bank transfer and upload the receipt'
                }
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardContent className="pt-6 space-y-6">
                {/* Bank Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    {isRTL ? 'معلومات الحساب البنكي' : 'Bank Account Details'}
                  </h3>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">{isRTL ? 'البنك' : 'Bank'}</p>
                        <p className="font-medium">{bankDetails.bank}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">{isRTL ? 'رقم الآيبان' : 'IBAN'}</p>
                        <p className="font-mono font-medium text-sm">{bankDetails.iban}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(bankDetails.iban, 'IBAN')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">{isRTL ? 'اسم المستفيد' : 'Beneficiary'}</p>
                        <p className="font-medium">{bankDetails.beneficiary}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(bankDetails.beneficiary, isRTL ? 'اسم المستفيد' : 'Beneficiary')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">{isRTL ? 'رقم الحساب' : 'Account Number'}</p>
                        <p className="font-mono font-medium">{bankDetails.accountNumber}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(bankDetails.accountNumber, isRTL ? 'رقم الحساب' : 'Account')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h4 className="font-semibold text-amber-800 dark:text-amber-400 mb-2">
                    {isRTL ? 'خطوات إتمام الدفع' : 'Steps to Complete Payment'}
                  </h4>
                  <ol className="space-y-2 text-sm text-amber-700 dark:text-amber-500">
                    <li className="flex items-start gap-2">
                      <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">1</span>
                      {isRTL ? 'قم بتحويل المبلغ إلى الحساب البنكي أعلاه' : 'Transfer the amount to the bank account above'}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">2</span>
                      {isRTL ? 'احفظ إيصال التحويل (صورة أو PDF)' : 'Save the transfer receipt (image or PDF)'}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">3</span>
                      {isRTL ? 'ارفع الإيصال من الحقل أدناه' : 'Upload the receipt using the field below'}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">4</span>
                      {isRTL ? 'سيتم تفعيل اشتراكك خلال 24 ساعة' : 'Your subscription will be activated within 24 hours'}
                    </li>
                  </ol>
                </div>

                {/* Upload Receipt Area */}
                <div className="space-y-3 pt-2">
                  <h4 className="font-semibold text-center">
                    {isRTL ? 'ارفع الوصل هنا' : 'Upload your receipt here'}
                  </h4>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  {uploaded ? (
                    <div className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
                      <CheckCircle2 className="w-12 h-12 text-green-500" />
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        {isRTL ? 'تم رفع الإيصال بنجاح! سيتم مراجعته قريباً' : 'Receipt uploaded! It will be reviewed soon.'}
                      </p>
                    </div>
                  ) : selectedFile ? (
                    <div className="relative rounded-xl border-2 border-primary/30 bg-muted/30 p-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 end-2 h-7 w-7 rounded-full"
                        onClick={clearFile}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <div className="flex flex-col items-center gap-3">
                        {previewUrl ? (
                          <img src={previewUrl} alt="Receipt" className="max-h-48 rounded-lg object-contain" />
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText className="w-8 h-8" />
                            <span className="text-sm font-medium">{selectedFile.name}</span>
                          </div>
                        )}
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={handleUpload}
                          disabled={uploading || !resolvedPaymentId}
                        >
                          {uploading ? (
                            <Loader2 className="h-4 w-4 me-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 me-2" />
                          )}
                          {uploading
                            ? (isRTL ? 'جاري الرفع...' : 'Uploading...')
                            : (isRTL ? 'تأكيد رفع الإيصال' : 'Confirm Upload')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload className="w-7 h-7 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">
                          {isRTL ? 'اضغط لاختيار صورة الإيصال' : 'Click to select receipt image'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isRTL ? 'صور أو PDF - الحد الأقصى 10 ميجابايت' : 'Images or PDF - Max 10MB'}
                        </p>
                      </div>
                    </div>
                  )}

                  {!resolvedPaymentId && !uploaded && (
                    <p className="text-xs text-destructive text-center">
                      {isRTL ? 'لا يوجد معرّف دفعة. يمكنك رفع الإيصال من لوحة التحكم.' : 'No payment ID found. You can upload from your dashboard.'}
                    </p>
                  )}
                </div>

                {/* Go to Dashboard */}
                <div className="pt-2">
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/dashboard">
                      {isRTL ? (
                        <>
                          <ArrowRight className="h-4 w-4 ml-2" />
                          الذهاب للوحة التحكم
                        </>
                      ) : (
                        <>
                          Go to Dashboard
                          <ArrowRight className="h-4 w-4 mr-2" />
                        </>
                      )}
                    </Link>
                  </Button>
                </div>

                {/* Note */}
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p>
                    {isRTL 
                      ? 'سنرسل لك إشعاراً فور تأكيد الدفع'
                      : "We'll notify you once the payment is confirmed"
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPending;
