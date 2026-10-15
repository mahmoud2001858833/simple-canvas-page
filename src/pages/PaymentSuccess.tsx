import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  PartyPopper,
  BookOpen,
  GraduationCap,
  ArrowRight,
  Receipt,
  PlayCircle,
  Package,
  Loader2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { trackXapi } from '@/lib/xapi';

// 'checking'    → we are asking the server (which asks the bank) for the real result
// 'paid'        → the server confirmed the payment as paid
// 'unconfirmed' → no confirmation yet (customer left the bank page, or the bank is slow)
type Phase = 'checking' | 'paid' | 'unconfirmed';

const VERIFY_ATTEMPTS = 6;
const VERIFY_DELAY_MS = 4000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAYMENT_SELECT = `
  *,
  courses (id, slug, title, title_ar, category),
  custom_course_requests (id, title, notes)
`;

export const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';

  const rawPaymentId = searchParams.get('payment_id') || searchParams.get('paymentId');
  const transactionId =
    searchParams.get('transaction_id') ||
    searchParams.get('transactionId') ||
    searchParams.get('trackId') ||
    searchParams.get('orderId') ||
    searchParams.get('order_id') ||
    searchParams.get('TrackID');
  const courseIdParam = searchParams.get('course_id') || searchParams.get('courseId');
  const bundleIdParam = searchParams.get('bundle_id') || searchParams.get('bundleId');
  const resultParam = searchParams.get('result') || searchParams.get('Result') || searchParams.get('status');
  const responseCodeParam =
    searchParams.get('responseCode') ||
    searchParams.get('response_code') ||
    searchParams.get('code') ||
    searchParams.get('ResponseCode');

  const normResult = (resultParam || '').toUpperCase().trim();
  const normCode = (responseCodeParam || '').trim();

  // The bank explicitly told the customer's browser the payment was cancelled / declined.
  // This is only used to show the failure page sooner. It can never make a payment "paid".
  const hasFailureParams = Boolean(
    normResult.includes('CANCEL') ||
      normResult.includes('FAIL') ||
      normResult.includes('DECLIN') ||
      normResult.includes('REJECT') ||
      normResult.includes('TIMEOUT') ||
      normResult.includes('ERROR') ||
      normCode === '201' ||
      (normCode && !['0', '00', '000', '1', '001'].includes(normCode)),
  );
  const isCancelled = normResult.includes('CANCEL') || normCode === '201';

  const [phase, setPhase] = useState<Phase>('checking');
  const [countdown, setCountdown] = useState(3);
  const [checkRound, setCheckRound] = useState(0);
  const finalizedRef = useRef(false);
  const activatedRef = useRef(false);

  // Fetch payment details (lookup by id, then by gateway order id / transaction id)
  const {
    data: payment,
    isFetched: paymentFetched,
    refetch,
  } = useQuery({
    queryKey: ['payment-success', rawPaymentId, transactionId, user?.id],
    queryFn: async () => {
      if (rawPaymentId && UUID_RE.test(rawPaymentId)) {
        const { data } = await supabase
          .from('payments')
          .select(PAYMENT_SELECT)
          .eq('id', rawPaymentId)
          .maybeSingle();
        if (data) return data;
      }

      const lookupTrack = transactionId || rawPaymentId;
      if (lookupTrack) {
        const { data } = await supabase
          .from('payments')
          .select(PAYMENT_SELECT)
          .eq('transaction_id', lookupTrack)
          .maybeSingle();
        if (data) return data;

        const { data: byGatewayId } = await supabase
          .from('payments')
          .select(PAYMENT_SELECT)
          .eq('tabby_payment_id', lookupTrack)
          .maybeSingle();
        if (byGatewayId) return byGatewayId;
      }

      // Deliberately NO "latest payment of this user" fallback: showing the result of a
      // different payment is how a cancelled attempt could look like a successful one.
      return null;
    },
    enabled: !!user?.id && !!(rawPaymentId || transactionId),
    refetchOnWindowFocus: false,
  });

  const course = payment?.courses as any;
  const request = payment?.custom_course_requests as any;
  const resolvedCourseId = courseIdParam || course?.id || payment?.course_id;

  // Also check sessionStorage for pending bundle checkout if bundleIdParam is not in URL
  let sessionBundleInfo: any = null;
  try {
    const rawSession = sessionStorage.getItem('pending_bundle_checkout');
    if (rawSession) sessionBundleInfo = JSON.parse(rawSession);
  } catch {}

  const reqNotes = request?.notes;
  let parsedReqNotes: any = null;
  if (typeof reqNotes === 'string' && reqNotes.startsWith('{')) {
    try {
      parsedReqNotes = JSON.parse(reqNotes);
    } catch {}
  }

  const instPlan = payment?.installment_plan as any;
  const resolvedBundleId = bundleIdParam || instPlan?.bundle_id || parsedReqNotes?.bundle_id || sessionBundleInfo?.bundleId;
  const isBundle = Boolean(resolvedBundleId || instPlan?.is_bundle || parsedReqNotes?.is_bundle || sessionBundleInfo);

  // Fetch bundle details if bundle transaction
  const { data: bundleData } = useQuery({
    queryKey: ['payment-success-bundle', resolvedBundleId],
    queryFn: async () => {
      if (!resolvedBundleId) return null;
      const { data } = await supabase
        .from('course_bundles')
        .select(`
          *,
          bundle_courses (
            course_id,
            courses (id, title, title_ar, price)
          )
        `)
        .eq('id', resolvedBundleId)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(resolvedBundleId) && phase === 'paid',
  });

  const invalidatePaymentQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] }),
      queryClient.invalidateQueries({ queryKey: ['my-payments'] }),
      queryClient.invalidateQueries({ queryKey: ['payments'] }),
    ]);

  // The payment could not be found at all (e.g. broken link) → cannot confirm anything.
  useEffect(() => {
    if (user?.id && paymentFetched && !payment) setPhase('unconfirmed');
  }, [user?.id, paymentFetched, payment]);

  // THE ONLY source of truth is the server. Nothing here marks a payment as paid:
  // we ask `verify-alinma-payment` (which checks with the bank) and just display its answer.
  useEffect(() => {
    if (!user || !payment || finalizedRef.current) return;
    let cancelled = false;

    const goFailed = (reason: string) => {
      finalizedRef.current = true;
      navigate(
        `/payment/failed?payment_id=${payment.id}&course_id=${payment.course_id || courseIdParam || ''}&error=${reason}`,
        { replace: true },
      );
    };

    const run = async () => {
      // Already settled by the bank webhook before the customer came back.
      if (payment.status === 'paid') {
        finalizedRef.current = true;
        setPhase('paid');
        return;
      }
      if (payment.status === 'failed' || payment.status === 'refunded') {
        goFailed('declined');
        return;
      }

      // Customer cancelled / was declined at the bank: close the attempt as failed
      // (server-side function: only affects the caller's own pending online payment).
      if (hasFailureParams) {
        try {
          await (supabase as any).rpc('mark_payment_failed', { p_payment_id: payment.id });
        } catch (e) {
          console.warn('mark_payment_failed note:', e);
        }
        if (cancelled) return;
        await invalidatePaymentQueries();
        goFailed(isCancelled ? 'cancelled' : 'declined');
        return;
      }

      // No explicit answer in the URL → ask the server, retrying a few times while the
      // bank finishes processing.
      for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
        if (cancelled) return;
        const { data, error } = await supabase.functions.invoke('verify-alinma-payment', {
          body: {
            paymentId: payment.id,
            gatewayParams: Object.fromEntries(searchParams.entries()),
          },
        });
        if (cancelled) return;

        const status = error ? 'pending' : (data as any)?.status;
        if (status === 'paid') {
          finalizedRef.current = true;
          setPhase('paid');
          await Promise.all([refetch(), invalidatePaymentQueries()]);
          return;
        }
        if (status === 'failed') {
          await invalidatePaymentQueries();
          goFailed('declined');
          return;
        }
        if (attempt < VERIFY_ATTEMPTS - 1) await sleep(VERIFY_DELAY_MS);
      }

      if (!cancelled) setPhase('unconfirmed');
    };

    setPhase('checking');
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, payment?.id, payment?.status, checkRound]);

  // After the server confirmed the payment: run the post-payment bookkeeping once.
  // Course enrollment itself is done by the database (trigger on payments.status → paid,
  // with the correct installment percentage), so it is NOT repeated from the browser.
  useEffect(() => {
    if (phase !== 'paid' || !user || !payment || activatedRef.current) return;
    activatedRef.current = true;

    const finalize = async () => {
      try {
        // Bundles unlock several courses; that fulfilment lives in this database function,
        // which itself refuses to run unless the payment is already marked paid.
        if (isBundle || (payment.courses as any)?.category === 'bundle') {
          try {
            await (supabase as any).rpc('confirm_payment_on_return', {
              p_payment_id: payment.id,
              p_order_id: payment.transaction_id || '',
            });
          } catch (rpcErr) {
            console.warn('RPC confirm_payment_on_return note:', rpcErr);
          }
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['my-enrollments'] }),
          queryClient.invalidateQueries({ queryKey: ['enrollment'] }),
          queryClient.invalidateQueries({ queryKey: ['enrollments'] }),
          queryClient.invalidateQueries({ queryKey: ['course-content'] }),
          queryClient.invalidateQueries({ queryKey: ['course'] }),
          queryClient.invalidateQueries({ queryKey: ['student-bundles'] }),
          invalidatePaymentQueries(),
        ]);

        const targetCourseId = resolvedCourseId || payment.course_id;
        if (targetCourseId) {
          try {
            trackXapi({ verb: 'registered', courseId: targetCourseId });
          } catch {
            /* non-blocking */
          }
        }

        try {
          localStorage.removeItem('pending_checkout');
          sessionStorage.removeItem('pending_checkout');
          sessionStorage.removeItem('pending_bundle_checkout');
        } catch {}
      } catch (err) {
        console.error('Post-payment finalize error:', err);
      }
    };

    finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, user?.id, payment?.id]);

  // Trigger confetti only once the payment is really confirmed
  useEffect(() => {
    if (phase !== 'paid') return;
    const timer = setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10B981', '#3B82F6', '#F59E0B', '#EC4899'],
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [phase]);

  // 3-second automatic countdown to the course / dashboard — only after a confirmed payment
  useEffect(() => {
    if (phase !== 'paid') return;
    if (!resolvedCourseId && !isBundle) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (isBundle) {
            navigate('/dashboard/student?tab=courses', { replace: true });
          } else if (course?.slug || resolvedCourseId) {
            navigate(`/courses/${course?.slug || resolvedCourseId}`, { replace: true });
          } else {
            navigate('/dashboard/student', { replace: true });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, resolvedCourseId, isBundle, navigate, course?.slug]);

  // Handle direct navigation click
  const handleOpenCourseNow = () => {
    if (isBundle) {
      navigate('/dashboard/student?tab=courses', { replace: true });
    } else if (course?.slug || resolvedCourseId) {
      navigate(`/courses/${course?.slug || resolvedCourseId}`, { replace: true });
    } else {
      navigate('/dashboard/student', { replace: true });
    }
  };

  // Not (yet) a confirmed payment → never show the success screen.
  if (phase !== 'paid') {
    const checking = phase === 'checking';
    const retryTarget = payment?.course_id || courseIdParam;
    return (
      <div
        className={`min-h-screen bg-gradient-to-b from-amber-50 to-background dark:from-amber-950/20 ${isRTL ? 'rtl' : 'ltr'}`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-lg mx-auto text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-6">
              {checking ? (
                <Loader2 className="h-12 w-12 text-amber-600 animate-spin" />
              ) : (
                <Clock className="h-12 w-12 text-amber-600" />
              )}
            </div>

            <h1 className="text-2xl font-bold text-amber-800 dark:text-amber-400 mb-2">
              {checking
                ? (isRTL ? 'جاري التحقق من الدفع مع البنك...' : 'Verifying your payment with the bank...')
                : (isRTL ? 'لم يصلنا تأكيد الدفع من البنك' : 'We have not received a payment confirmation')}
            </h1>
            <p className="text-muted-foreground mb-8">
              {checking
                ? (isRTL ? 'يرجى عدم إغلاق هذه الصفحة.' : 'Please do not close this page.')
                : (isRTL
                  ? 'إذا خرجت من صفحة البنك دون إكمال الدفع فلم يتم أي خصم ويمكنك المحاولة من جديد. وإذا تم الخصم من حسابك فسيتم تفعيل الدورة تلقائياً فور وصول تأكيد البنك.'
                  : 'If you left the bank page without completing the payment, you were not charged and can try again. If you were charged, the course will be activated automatically as soon as the bank confirms.')}
            </p>

            {!checking && (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      finalizedRef.current = false;
                      setCheckRound((r) => r + 1);
                    }}
                    disabled={!payment}
                  >
                    <RefreshCw className="h-4 w-4 me-2" />
                    {isRTL ? 'تحقق مرة أخرى' : 'Check again'}
                  </Button>
                  {retryTarget && (
                    <Button variant="outline" className="w-full" onClick={() => navigate(`/checkout/${retryTarget}`)}>
                      {isRTL ? 'إعادة محاولة الدفع' : 'Try the payment again'}
                    </Button>
                  )}
                  <Button variant="ghost" className="w-full" asChild>
                    <Link to="/dashboard/student">
                      {isRTL ? 'الذهاب للوحة التحكم' : 'Go to Dashboard'}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-b from-green-50 via-background to-background dark:from-green-950/20 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-900/40 mb-6 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-3xl font-bold text-emerald-800 dark:text-emerald-400 mb-2 flex items-center justify-center gap-2">
                <PartyPopper className="h-8 w-8 text-emerald-600" />
                {isBundle
                  ? (isRTL ? 'تم الدفع وتفعيل الباقة بنجاح!' : 'Payment Successful & Bundle Active!')
                  : (isRTL ? 'تم الدفع وتفعيل الدورة فوراً!' : 'Payment Successful & Course Active!')}
              </h1>
              <p className="text-muted-foreground text-base">
                {isBundle
                  ? (isRTL
                    ? `تهانينا! تم تأكيد الدفع عبر بوابة البنك وتفعيل كافة مقررات المنصة في حسابك فوراً.`
                    : 'Congratulations! Your payment has been confirmed and all platform courses are now unlocked in your account.')
                  : (isRTL 
                    ? 'تهانينا! تم تأكيد الدفع وتفعيل اشتراكك بالدورة بنسبة 100%. يمكنك البدء في الدراسة الآن.'
                    : 'Congratulations! Your payment has been confirmed and course access is 100% active. You can start studying now.'
                  )}
              </p>
              
              {/* Countdown notification */}
              {(resolvedCourseId || isBundle) && (
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
                  <PlayCircle className="w-4 h-4 animate-pulse text-emerald-600" />
                  <span>
                    {isBundle
                      ? (isRTL
                        ? `جاري توجيهك إلى لوحة تحكم الطالب خلال ${countdown} ثوانٍ...`
                        : `Opening your student dashboard in ${countdown}s...`)
                      : (isRTL 
                        ? `جاري فتح محتوى الدورة تلقائياً خلال ${countdown} ثوانٍ...`
                        : `Opening your course automatically in ${countdown}s...`
                      )}
                  </span>
                </div>
              )}
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="shadow-lg border-emerald-500/20">
              <CardContent className="pt-6 space-y-6">
                {/* Instant Action Button */}
                <div className="space-y-3">
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg h-14 shadow-md gap-2" 
                    size="lg"
                    onClick={handleOpenCourseNow}
                  >
                    {isBundle ? <Package className="h-6 w-6" /> : <GraduationCap className="h-6 w-6" />}
                    {isBundle
                      ? (isRTL ? 'تصفح جميع المقررات المفتوحة في حسابي' : 'Explore All Unlocked Courses')
                      : (isRTL ? 'ابدأ مشاهدة الدورة الآن' : 'Start Watching Course Now')}
                    <ArrowRight className="h-5 w-5" />
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate('/dashboard/student')}
                  >
                    {isRTL ? 'عرض دوراتي في لوحة التحكم' : 'View My Courses in Dashboard'}
                  </Button>
                </div>

                {/* Order Details */}
                <div className="text-center p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">
                    {isRTL ? 'رقم العملية المعتمدة' : 'Confirmed Transaction ID'}
                  </p>
                  <p className="font-mono font-semibold text-sm">{transactionId || payment?.transaction_id || rawPaymentId || 'N/A'}</p>
                </div>

                {/* Item Details */}
                {(course || request || bundleData || isBundle) && (
                  <div className="flex items-center gap-4 p-4 border rounded-xl bg-card">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      {isBundle ? (
                        <Package className="h-6 w-6 text-primary" />
                      ) : course ? (
                        <GraduationCap className="h-6 w-6 text-primary" />
                      ) : (
                        <BookOpen className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">
                        {isBundle
                          ? (bundleData ? (isRTL ? bundleData.title_ar : bundleData.title) : instPlan?.bundle_title || (isRTL ? 'باقة تعليمية متكاملة' : 'Integrated Bundle'))
                          : course 
                          ? (isRTL ? course.title_ar : course.title)
                          : request?.title
                        }
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {isBundle
                          ? (isRTL ? `باقة تعليمية (${bundleData?.bundle_courses?.length || ''} مواد مفعلة فوراً)` : `Bundle (${bundleData?.bundle_courses?.length || ''} courses active)`)
                          : course ? (isRTL ? 'دورة تدريبية مفعلة' : 'Active Course') : (isRTL ? 'طلب مخصص' : 'Custom Request')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 text-base">
                        {payment?.amount || bundleData?.price || '1'} {isRTL ? 'ر.س' : 'SAR'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Receipt breakdown */}
                <div className="space-y-2 text-sm pt-2 border-t">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isRTL ? 'طريقة الدفع' : 'Payment Method'}</span>
                    <span className="font-medium">{payment?.payment_method === 'tabby' ? 'Tabby' : isRTL ? 'بطاقة بنكية / الإنماء' : 'Credit Card / Alinma'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isRTL ? 'التاريخ' : 'Date'}</span>
                    <span>{new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isRTL ? 'حالة الاشتراك' : 'Access Status'}</span>
                    <span className="font-semibold flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      {isRTL ? 'مكتمل ومفعل 100%' : 'Active 100%'}
                    </span>
                  </div>
                </div>

                {/* Additional Links */}
                <div className="pt-2 text-center">
                  <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                    <Link to="/dashboard">
                      <Receipt className="h-4 w-4 me-2" />
                      {isRTL ? 'الذهاب للوحة التحكم الرئيسية' : 'Go to Main Dashboard'}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
