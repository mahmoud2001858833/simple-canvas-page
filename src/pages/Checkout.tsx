import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  Building2, 
  ShoppingCart, 
  ArrowLeft, 
  ArrowRight,
  Shield,
  GraduationCap,
  Loader2,
  CheckCircle2,
  Ticket,
  X,
  Percent,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';

type PaymentMethod = 'alinmapay' | 'bank_transfer';

interface CouponResult {
  valid: boolean;
  error?: string;
  error_ar?: string;
  coupon_id?: string;
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
  final_amount?: number;
}

// Fixed 3-installment plan: 33% / 66% / 100%
const FIXED_INSTALLMENT_OPTIONS = [
  { percent: 33, labelAr: 'الدفعة الأولى (1/3)', labelEn: 'First Installment (1/3)' },
  { percent: 66, labelAr: 'الدفعتان (2/3)', labelEn: 'Two Installments (2/3)' },
  { percent: 100, labelAr: 'كامل المبلغ', labelEn: 'Full Payment' },
];

const Checkout = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request');
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alinmapay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);
  const [selectedInstallment, setSelectedInstallment] = useState<number>(100);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['checkout-course', courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // Fetch existing enrollment (for installment payments)
  const { data: enrollment } = useQuery({
    queryKey: ['checkout-enrollment', courseId, user?.id],
    queryFn: async () => {
      if (!user || !courseId) return null;
      const { data, error } = await supabase
        .from('enrollments')
        .select('*')
        .eq('course_id', courseId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId && !!user,
  });

  // Fetch chapters count for display
  const { data: chaptersCount = 0 } = useQuery({
    queryKey: ['checkout-chapters-count', courseId],
    queryFn: async () => {
      if (!courseId) return 0;
      const { count, error } = await supabase
        .from('chapters')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!courseId,
  });

  // Fetch custom request details
  const { data: customRequest, isLoading: requestLoading } = useQuery({
    queryKey: ['checkout-request', requestId],
    queryFn: async () => {
      if (!requestId) return null;
      const { data, error } = await supabase
        .from('custom_course_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });

  // Is this a continuation payment?
  const currentPaidPercent = (enrollment as any)?.paid_percentage ?? 0;
  const isExistingEnrollment = !!enrollment && enrollment.status === 'active';
  const remainingPercent = 100 - currentPaidPercent;

  const item = course || customRequest;
  const itemType = course ? 'course' : 'request';
  const totalPrice = course?.price || customRequest?.final_price || customRequest?.estimated_price || 0;
  const totalChapters = chaptersCount || 1;

  // Fixed installment options (3 fixed plans)
  const allInstallmentOptions = FIXED_INSTALLMENT_OPTIONS;

  // Filter installment options to only show those above the currently paid percentage
  const availableInstallments = allInstallmentOptions.filter(opt => opt.percent > currentPaidPercent);

  // Set default installment when enrollment data loads
  useEffect(() => {
    if (availableInstallments.length > 0 && !availableInstallments.some(o => o.percent === selectedInstallment)) {
      setSelectedInstallment(availableInstallments[0].percent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExistingEnrollment, currentPaidPercent]);

  // Redirect free courses to direct enrollment
  useEffect(() => {
    if (course && (course.price === 0 || course.price === null) && user && !isExistingEnrollment) {
      const enrollFree = async () => {
        try {
          const { error } = await supabase.from('enrollments').insert({
            user_id: user.id,
            course_id: courseId!,
            status: 'active',
          });
          if (error) {
            if (error.message.includes('duplicate')) {
              toast.info(isRTL ? 'أنت مسجل بالفعل في هذا الكورس' : 'You are already enrolled in this course');
            } else {
              throw error;
            }
          } else {
            toast.success(isRTL ? 'تم التسجيل بنجاح!' : 'Enrolled successfully!');
          }
          navigate(`/courses/${courseId}`, { replace: true });
        } catch (e: any) {
          toast.error(e.message);
          navigate(-1);
        }
      };
      enrollFree();
    }
  }, [course, user, courseId, navigate, isRTL, isExistingEnrollment]);

  // Calculate installment amount: pay the delta between target % and current paid %
  const selectedOption = allInstallmentOptions.find(opt => opt.percent === selectedInstallment);
  const installmentAmount = Math.ceil(totalPrice * ((selectedInstallment - currentPaidPercent) / 100));

  const priceBeforeCoupon = installmentAmount;
  const finalPrice = appliedCoupon?.valid
    ? Math.max(0, priceBeforeCoupon - (appliedCoupon.discount_amount || 0))
    : priceBeforeCoupon;

  // What the new paid_percentage will be after this payment
  const newPaidPercentage = selectedInstallment;
  // Approx accessible chapter count after this payment, for UX summary
  const accessibleChapters = Math.ceil((newPaidPercentage / 100) * totalChapters);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !user) return;
    setCouponLoading(true);
    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: couponCode.trim(),
        p_user_id: user.id,
        p_course_id: courseId || null,
        p_order_amount: priceBeforeCoupon,
      });
      if (error) throw error;
      const result = data as unknown as CouponResult;
      if (result.valid) {
        setAppliedCoupon(result);
        toast.success(isRTL ? `تم تطبيق الكوبون! خصم ${result.discount_amount?.toLocaleString()} ر.س` : `Coupon applied! ${result.discount_amount?.toLocaleString()} SAR off`);
      } else {
        toast.error(isRTL ? result.error_ar : result.error);
        setAppliedCoupon(null);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const paymentMethods = [
    {
      id: 'alinmapay' as PaymentMethod,
      title: isRTL ? 'الدفع الإلكتروني (إنماء باي)' : 'Online Payment (AlinmaPay)',
      description: isRTL ? 'بطاقة مدى / فيزا / ماستركارد' : 'Mada / Visa / Mastercard',
      icon: CreditCard,
      badge: isRTL ? 'موصى به' : 'Recommended',
      badgeSecondary: isRTL ? 'فوري' : 'Instant',
    },
    {
      id: 'bank_transfer' as PaymentMethod,
      title: isRTL ? 'تحويل بنكي' : 'Bank Transfer',
      description: isRTL ? 'تحويل يدوي - يتطلب مراجعة' : 'Manual transfer - requires review',
      icon: Building2,
      badge: isRTL ? '24 ساعة' : '24 hours',
    },
  ];

  const handlePayment = async () => {
    if (!user || !item) return;

    setIsProcessing(true);
    try {
      // Free via 100% coupon → enroll directly, skip gateway
      if (finalPrice === 0 && courseId) {
        const { data: paymentData, error: payErr } = await supabase.from('payments').insert({
          user_id: user.id,
          course_id: courseId,
          request_id: requestId || null,
          amount: 0,
          payment_method: 'online',
          status: 'paid',
          paid_at: new Date().toISOString(),
          notes: appliedCoupon?.valid ? `100% Coupon: ${couponCode}` : 'Free enrollment',
        }).select().single();
        if (payErr) {
          toast.error(isRTL ? 'فشل تسجيل الدفع' : 'Failed to record payment');
          return;
        }
        const { error: enrollErr } = await supabase.from('enrollments').upsert({
          user_id: user.id,
          course_id: courseId,
          status: 'active',
          paid_percentage: 100,
        }, { onConflict: 'user_id,course_id' });
        if (enrollErr && !enrollErr.message.includes('duplicate')) {
          toast.error(isRTL ? 'فشل التسجيل' : 'Enrollment failed');
          return;
        }
        if (appliedCoupon?.valid && appliedCoupon.coupon_id && paymentData) {
          try {
            await supabase.rpc('use_coupon', {
              p_coupon_id: appliedCoupon.coupon_id,
              p_user_id: user.id,
              p_payment_id: paymentData.id,
              p_discount_amount: appliedCoupon.discount_amount || 0,
            });
          } catch (e) { console.error(e); }
        }
        toast.success(isRTL ? 'تم تفعيل الكورس مجاناً!' : 'Course activated for free!');
        navigate(`/courses/${courseId}`);
        return;
      }

      if (paymentMethod === 'alinmapay') {
        const { data, error } = await supabase.functions.invoke('create-alinma-payment', {
          body: {
            courseId: courseId || null,
            requestId: requestId || null,
            userId: user.id,
            amount: finalPrice,
            customerEmail: user.email,
          },
        });

        if (error) {
          const errorMsg = error.message || 'Payment processing failed';
          if (errorMsg.includes('already enrolled')) {
            toast.error(isRTL ? 'أنت مسجل بالفعل في هذا الكورس' : 'You are already enrolled in this course');
          } else if (errorMsg.includes('not configured')) {
            toast.error(isRTL ? 'بوابة الدفع غير مهيأة. يرجى التواصل مع الدعم' : 'Payment gateway not configured. Please contact support');
          } else {
            toast.error(isRTL ? 'حدث خطأ أثناء معالجة الدفع' : 'Payment processing error');
          }
          return;
        }

        if (data?.redirect_url) {
          window.location.href = data.redirect_url;
        } else {
          toast.error(isRTL ? 'لم يتم استلام رابط الدفع' : 'No payment link received');
        }
      } else if (paymentMethod === 'bank_transfer') {
        // Create pending payment for bank transfer
        const { data: paymentData, error: paymentError } = await supabase.from('payments').insert({
          user_id: user.id,
          course_id: courseId || null,
          request_id: requestId || null,
          amount: finalPrice,
          payment_method: 'bank_transfer',
          status: 'pending',
          notes: [
            appliedCoupon?.valid ? `Coupon: ${couponCode} (-${appliedCoupon.discount_amount} SAR)` : null,
            `Installment: ${selectedInstallment}% of total`,
            isExistingEnrollment ? `Existing paid: ${currentPaidPercent}%, new total: ${newPaidPercentage}%` : null,
          ].filter(Boolean).join(' | '),
          installment_plan: {
            installment_percent: selectedInstallment,
            new_paid_percentage: newPaidPercentage,
            is_continuation: isExistingEnrollment,
          },
        }).select().single();

        if (paymentError) {
          if (paymentError.message.includes('duplicate')) {
            toast.error(isRTL ? 'لديك طلب دفع قائم بالفعل' : 'You already have a pending payment request');
          } else {
            toast.error(isRTL ? 'فشل في إنشاء طلب الدفع' : 'Failed to create payment request');
          }
          return;
        }

        // Record coupon usage
        if (appliedCoupon?.valid && appliedCoupon.coupon_id && paymentData) {
          try {
            await supabase.rpc('use_coupon', {
              p_coupon_id: appliedCoupon.coupon_id,
              p_user_id: user.id,
              p_payment_id: paymentData.id,
              p_discount_amount: appliedCoupon.discount_amount || 0,
            });
          } catch (e) {
            console.error('Coupon usage recording error:', e);
          }
        }

        toast.success(
          isRTL 
            ? 'تم إنشاء طلب الدفع. يرجى إتمام التحويل وإرفاق الإيصال.' 
            : 'Payment request created. Please complete the transfer and attach the receipt.'
        );
        navigate(`/payment/pending?payment_id=${paymentData?.id || ''}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Payment error:', errorMessage);
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error(isRTL ? 'خطأ في الاتصال. يرجى التحقق من اتصالك بالإنترنت' : 'Connection error. Please check your internet');
      } else {
        toast.error(isRTL ? 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى' : 'An unexpected error occurred. Please try again');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (courseLoading || requestLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">
          {isRTL ? 'المنتج غير موجود' : 'Item Not Found'}
        </h1>
        <Button onClick={() => navigate('/courses')} variant="outline" className="mt-4">
          {isRTL ? 'تصفح الكورسات' : 'Browse Courses'}
        </Button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-8">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => navigate(-1)}
          >
            {isRTL ? (
              <>
                <ArrowRight className="h-4 w-4 ml-2" />
                العودة
              </>
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>

          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShoppingCart className="h-8 w-8" />
            {isExistingEnrollment 
              ? (isRTL ? 'دفع القسط التالي' : 'Pay Next Installment')
              : (isRTL ? 'إتمام الدفع' : 'Checkout')
            }
          </h1>
          {isExistingEnrollment && (
            <p className="mt-2 text-primary-foreground/80">
              {isRTL 
                ? `المدفوع حالياً: ${currentPaidPercent}% - المتبقي: ${remainingPercent}%`
                : `Currently paid: ${currentPaidPercent}% - Remaining: ${remainingPercent}%`
              }
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Installment Selection - only for courses (not requests) */}
            {course && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5" />
                    {isRTL ? 'خطة الدفع' : 'Payment Plan'}
                  </CardTitle>
                  <CardDescription>
                    {isExistingEnrollment
                      ? (isRTL ? 'اختر المبلغ الذي تريد دفعه لفتح محتوى إضافي' : 'Choose how much to pay to unlock more content')
                      : (isRTL ? 'ادفع المبلغ كاملاً أو على أقساط' : 'Pay in full or choose an installment plan')
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Current progress bar for existing enrollment */}
                  {isExistingEnrollment && (
                    <div className="mb-6 p-4 rounded-lg bg-muted/50 border">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">{isRTL ? 'المدفوع' : 'Paid'}</span>
                        <span className="font-medium">{currentPaidPercent}%</span>
                      </div>
                      <Progress value={currentPaidPercent} className="h-2 mb-2" />
                      <p className="text-xs text-muted-foreground">
                        {isRTL 
                          ? `${Math.ceil((currentPaidPercent / 100) * totalChapters)} من ${totalChapters} فصل متاح حالياً`
                          : `${Math.ceil((currentPaidPercent / 100) * totalChapters)} of ${totalChapters} chapters currently accessible`
                        }
                      </p>
                    </div>
                  )}

                  <RadioGroup
                    value={String(selectedInstallment)}
                    onValueChange={(v) => {
                      setSelectedInstallment(Number(v));
                      // Reset coupon when installment changes
                      if (appliedCoupon) removeCoupon();
                    }}
                    className="space-y-3"
                  >
                    {availableInstallments.map((opt) => {
                      const payAmount = Math.ceil(totalPrice * ((opt.percent - currentPaidPercent) / 100));
                      const optAccessibleChapters = Math.ceil((opt.percent / 100) * totalChapters);

                      return (
                        <div
                          key={opt.percent}
                          className={`relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedInstallment === opt.percent
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => {
                            setSelectedInstallment(opt.percent);
                            if (appliedCoupon) removeCoupon();
                          }}
                        >
                          <RadioGroupItem value={String(opt.percent)} id={`inst-${opt.percent}`} className="mt-0" />
                          <div className="flex-1 mx-4">
                            <Label htmlFor={`inst-${opt.percent}`} className="text-base font-semibold cursor-pointer">
                              {isRTL ? opt.labelAr : opt.labelEn} ({opt.percent}%)
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              {isRTL
                                ? `يفتح ${optAccessibleChapters} من ${totalChapters} فصل`
                                : `Unlocks ${optAccessibleChapters} of ${totalChapters} chapters`}
                            </p>
                          </div>
                          <div className="text-end">
                            <span className="text-lg font-bold text-primary">{payAmount} {isRTL ? 'ر.س' : 'SAR'}</span>
                            {opt.percent === 100 && !isExistingEnrollment && (
                              <Badge className="block mt-1 text-xs" variant="secondary">
                                {isRTL ? 'الأفضل قيمة' : 'Best Value'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {isRTL ? 'طريقة الدفع' : 'Payment Method'}
                </CardTitle>
                <CardDescription>
                  {isRTL ? 'اختر طريقة الدفع المناسبة لك' : 'Choose your preferred payment method'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                  className="space-y-4"
                >
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className={`relative flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        paymentMethod === method.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setPaymentMethod(method.id)}
                    >
                      <RadioGroupItem value={method.id} id={method.id} className="mt-1" />
                      <div className="flex-1 mx-4">
                        <Label htmlFor={method.id} className="text-base font-semibold cursor-pointer">
                          {method.title}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">{method.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{method.badge}</Badge>
                        <method.icon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </RadioGroup>

                {paymentMethod === 'bank_transfer' && (
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-800 dark:text-blue-400">
                          {isRTL ? 'معلومات الحساب البنكي' : 'Bank Account Details'}
                        </h4>
                        <div className="text-sm text-blue-700 dark:text-blue-500 mt-2 space-y-1">
                          <p>{isRTL ? 'البنك: بنك الإنماء' : 'Bank: Alinma Bank'}</p>
                          <p>{isRTL ? 'صاحب الحساب: عمار سعيد ناشر الجدعاني' : 'Account Holder: Ammar Saeed Nasher Aljadani'}</p>
                          <p>{isRTL ? 'رقم الحساب: 68207056692000' : 'Account: 68207056692000'}</p>
                          <p>{isRTL ? 'الآيبان: SA3805000068207056692000' : 'IBAN: SA3805000068207056692000'}</p>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
                          {isRTL 
                            ? '⚠️ يرجى إرسال إيصال التحويل للتفعيل الفوري'
                            : '⚠️ Please send transfer receipt for instant activation'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security Notice */}
            <Card className="bg-muted/50">
              <CardContent className="flex items-center gap-4 py-4">
                <Shield className="h-10 w-10 text-green-600" />
                <div>
                  <h4 className="font-semibold">
                    {isRTL ? 'دفع آمن ومشفر' : 'Secure & Encrypted Payment'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {isRTL 
                      ? 'جميع المعاملات مشفرة ومحمية بأعلى معايير الأمان'
                      : 'All transactions are encrypted and protected with highest security standards'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>{isRTL ? 'ملخص الطلب' : 'Order Summary'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Item Details */}
                <div className="flex gap-4">
                  {course?.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={isRTL ? course.title_ar : course.title}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-primary/10 rounded-lg flex items-center justify-center">
                      <GraduationCap className="h-8 w-8 text-primary/50" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold line-clamp-2">
                      {course 
                        ? (isRTL ? course.title_ar : course.title)
                        : customRequest?.title
                      }
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {itemType === 'course' 
                        ? (isRTL ? 'كورس' : 'Course')
                        : (isRTL ? 'طلب مخصص' : 'Custom Request')
                      }
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Price Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{isRTL ? 'السعر الكلي للكورس' : 'Total Course Price'}</span>
                    <span>{totalPrice} {isRTL ? 'ر.س' : 'SAR'}</span>
                  </div>
                  
                  {selectedInstallment < 100 || isExistingEnrollment ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {isRTL ? `قسط ${selectedInstallment}%` : `${selectedInstallment}% Installment`}
                      </span>
                      <span>{priceBeforeCoupon} {isRTL ? 'ر.س' : 'SAR'}</span>
                    </div>
                  ) : null}

                  {course?.original_price && course.original_price > totalPrice && (
                    <div className="flex justify-between text-green-600">
                      <span>{isRTL ? 'الخصم' : 'Discount'}</span>
                      <span>-{course.original_price - totalPrice} {isRTL ? 'ر.س' : 'SAR'}</span>
                    </div>
                  )}
                  {appliedCoupon?.valid && (
                    <div className="flex justify-between text-green-600">
                      <span className="flex items-center gap-1">
                        <Ticket className="w-3 h-3" />
                        {isRTL ? 'كوبون' : 'Coupon'} ({couponCode})
                      </span>
                      <span>-{appliedCoupon.discount_amount?.toLocaleString()} {isRTL ? 'ر.س' : 'SAR'}</span>
                    </div>
                  )}
                </div>

                {/* What you get */}
                {course && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        {isRTL ? 'ما ستحصل عليه' : 'What you\'ll get'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isRTL 
                        ? `${accessibleChapters} من ${totalChapters} فصل (${newPaidPercentage}% من المحتوى)`
                        : `${accessibleChapters} of ${totalChapters} chapters (${newPaidPercentage}% of content)`
                      }
                    </p>
                    {newPaidPercentage < 100 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {isRTL 
                          ? 'يمكنك دفع أقساط إضافية لاحقاً لفتح باقي المحتوى'
                          : 'You can pay more installments later to unlock remaining content'
                        }
                      </p>
                    )}
                  </div>
                )}

                {/* Coupon Input */}
                <div className="space-y-2">
                  {appliedCoupon?.valid ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <Ticket className="w-4 h-4" />
                        <span className="text-sm font-medium">{couponCode}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeCoupon}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder={isRTL ? 'كود الكوبون' : 'Coupon code'}
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                        dir="ltr"
                        className="text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponCode.trim()}
                      >
                        {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isRTL ? 'تطبيق' : 'Apply')}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Total */}
                <div className="flex justify-between text-lg font-bold">
                  <span>{isRTL ? 'المطلوب دفعه' : 'Amount Due'}</span>
                  <span className="text-primary">{finalPrice} {isRTL ? 'ر.س' : 'SAR'}</span>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePayment}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isRTL ? 'جاري المعالجة...' : 'Processing...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {isExistingEnrollment
                        ? (isRTL ? 'دفع القسط' : 'Pay Installment')
                        : (isRTL ? 'تأكيد الدفع' : 'Confirm Payment')
                      }
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  {isRTL 
                    ? 'بالضغط على تأكيد الدفع، أنت توافق على شروط الخدمة'
                    : 'By clicking Confirm Payment, you agree to our Terms of Service'
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
