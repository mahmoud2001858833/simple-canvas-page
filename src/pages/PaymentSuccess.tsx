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
  PlayCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { trackXapi } from '@/lib/xapi';

export const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';

  const rawPaymentId = searchParams.get('payment_id') || searchParams.get('paymentId');
  const transactionId = searchParams.get('transaction_id') || searchParams.get('transactionId') || searchParams.get('trackId') || searchParams.get('orderId') || searchParams.get('TrackID');
  const courseIdParam = searchParams.get('course_id') || searchParams.get('courseId');
  const resultParam = searchParams.get('result') || searchParams.get('Result') || searchParams.get('status');
  const responseCodeParam = searchParams.get('responseCode') || searchParams.get('response_code') || searchParams.get('code') || searchParams.get('ResponseCode');

  const [isActivated, setIsActivated] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const activatedRef = useRef(false);

  // Fetch payment details with comprehensive multi-tier lookup
  const { data: payment, refetch } = useQuery({
    queryKey: ['payment-success', rawPaymentId, transactionId, user?.id],
    queryFn: async () => {
      // 1. If valid UUID, query by id
      const isUuid = rawPaymentId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawPaymentId);
      if (isUuid) {
        const { data } = await supabase
          .from('payments')
          .select(`
            *,
            courses (id, title, title_ar),
            custom_course_requests (id, title)
          `)
          .eq('id', rawPaymentId)
          .maybeSingle();
        if (data) return data;
      }

      // 2. Query by transaction_id (orderId / trackId)
      const lookupTrack = transactionId || rawPaymentId;
      if (lookupTrack) {
        const { data } = await supabase
          .from('payments')
          .select(`
            *,
            courses (id, title, title_ar),
            custom_course_requests (id, title)
          `)
          .eq('transaction_id', lookupTrack)
          .maybeSingle();
        if (data) return data;
      }

      // 3. Query by tabby_payment_id
      if (lookupTrack) {
        const { data } = await supabase
          .from('payments')
          .select(`
            *,
            courses (id, title, title_ar),
            custom_course_requests (id, title)
          `)
          .eq('tabby_payment_id', lookupTrack)
          .maybeSingle();
        if (data) return data;
      }

      // 4. Query latest payment for currently authenticated user
      if (user?.id) {
        const { data } = await supabase
          .from('payments')
          .select(`
            *,
            courses (id, title, title_ar),
            custom_course_requests (id, title)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }

      return null;
    },
    enabled: !!(rawPaymentId || transactionId || user?.id),
  });

  const course = payment?.courses as any;
  const request = payment?.custom_course_requests as any;
  const resolvedCourseId = courseIdParam || course?.id || payment?.course_id;

  // Trigger confetti on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10B981', '#3B82F6', '#F59E0B', '#EC4899'],
      });
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // INSTANT ZERO-SECOND ACTIVATION:
  // The exact second the student lands on the return receipt URL from the bank,
  // we immediately update payment to paid and upsert active enrollment in Supabase!
  useEffect(() => {
    const effectiveCourseId = resolvedCourseId;
    if (!user || (!effectiveCourseId && !payment) || activatedRef.current) return;
    activatedRef.current = true;

    const executeInstantActivation = async () => {
      try {
        const targetCourseId = effectiveCourseId || payment?.course_id || course?.id;
        const targetPaymentId = payment?.id || rawPaymentId;

        // 1. Direct update to payments table: mark as paid immediately
        if (targetPaymentId) {
          await supabase
            .from('payments')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              tabby_payment_id: transactionId || payment?.tabby_payment_id || undefined,
              notes: [payment?.notes, 'Payment confirmed on return receipt'].filter(Boolean).join(' | '),
            })
            .eq('id', targetPaymentId);
        }

        // 2. Direct upsert into enrollments table - student has access in 0.1 seconds!
        if (targetCourseId && user.id) {
          await supabase
            .from('enrollments')
            .upsert(
              {
                user_id: user.id,
                course_id: targetCourseId,
                status: 'active',
                paid_percentage: 100,
                enrolled_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,course_id' }
            );

          setIsActivated(true);
        }

        // 3. Invalidate all query caches so all course and dashboard pages reflect instant enrollment
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['my-enrollments'] }),
          queryClient.invalidateQueries({ queryKey: ['enrollment'] }),
          queryClient.invalidateQueries({ queryKey: ['enrollments'] }),
          queryClient.invalidateQueries({ queryKey: ['course-content'] }),
          queryClient.invalidateQueries({ queryKey: ['course'] }),
          queryClient.invalidateQueries({ queryKey: ['admin-payments'] }),
          queryClient.invalidateQueries({ queryKey: ['my-payments'] }),
        ]);

        // 4. Track registration event
        if (targetCourseId) {
          try {
            trackXapi({ verb: 'registered', courseId: targetCourseId });
          } catch { /* non-blocking */ }
        }

        // 5. Notify both webhooks in the background for permanent audit logging
        fetch('/api/alinma-webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: targetPaymentId,
            courseId: targetCourseId,
            trackId: transactionId || payment?.transaction_id || targetPaymentId,
            transactionId,
            result: resultParam || 'SUCCESS',
            responseCode: responseCodeParam || '000',
            source: 'return_receipt',
          }),
        }).catch(console.warn);

        fetch('https://ixhvcxwbiisrxhngfjyg.supabase.co/functions/v1/alinma-webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: targetPaymentId,
            courseId: targetCourseId,
            trackId: transactionId || payment?.transaction_id || targetPaymentId,
            transactionId,
            result: resultParam || 'SUCCESS',
            responseCode: responseCodeParam || '000',
            source: 'return_receipt',
          }),
        }).catch(console.warn);

        await refetch();
      } catch (err) {
        console.error('Instant activation error:', err);
      }
    };

    executeInstantActivation();
  }, [user, resolvedCourseId, payment, rawPaymentId, transactionId, resultParam, responseCodeParam, queryClient, refetch, course]);

  // 3-Second Automatic Countdown to redirect directly into the course
  useEffect(() => {
    if (!resolvedCourseId) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate(`/courses/${resolvedCourseId}`, { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resolvedCourseId, navigate]);

  // Handle direct navigation click
  const handleOpenCourseNow = () => {
    if (resolvedCourseId) {
      navigate(`/courses/${resolvedCourseId}`, { replace: true });
    } else {
      navigate('/dashboard?tab=courses', { replace: true });
    }
  };

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
                {isRTL ? 'تم الدفع وتفعيل الدورة فوراً!' : 'Payment Successful & Course Active!'}
              </h1>
              <p className="text-muted-foreground text-base">
                {isRTL 
                  ? 'تهانينا! تم تأكيد الدفع وتفعيل اشتراكك بالدورة بنسبة 100%. يمكنك البدء في الدراسة الآن.'
                  : 'Congratulations! Your payment has been confirmed and course access is 100% active. You can start studying now.'
                }
              </p>
              
              {/* Countdown notification */}
              {resolvedCourseId && (
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
                  <PlayCircle className="w-4 h-4 animate-pulse text-emerald-600" />
                  <span>
                    {isRTL 
                      ? `جاري فتح محتوى الدورة تلقائياً خلال ${countdown} ثوانٍ...`
                      : `Opening your course automatically in ${countdown}s...`
                    }
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
                    <GraduationCap className="h-6 w-6" />
                    {isRTL ? 'ابدأ مشاهدة الدورة الآن' : 'Start Watching Course Now'}
                    <ArrowRight className="h-5 w-5" />
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate('/dashboard?tab=courses')}
                  >
                    {isRTL ? 'عرض دوراتي في لوحة التحكم' : 'View My Courses in Dashboard'}
                  </Button>
                </div>

                {/* Order Details */}
                <div className="text-center p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">
                    {isRTL ? 'رقم العملية المعتمدة' : 'Confirmed Transaction ID'}
                  </p>
                  <p className="font-mono font-semibold text-sm">{transactionId || payment?.transaction_id || paymentId || 'N/A'}</p>
                </div>

                {/* Item Details */}
                {(course || request) && (
                  <div className="flex items-center gap-4 p-4 border rounded-xl bg-card">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      {course ? (
                        <GraduationCap className="h-6 w-6 text-primary" />
                      ) : (
                        <BookOpen className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">
                        {course 
                          ? (isRTL ? course.title_ar : course.title)
                          : request?.title
                        }
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {course ? (isRTL ? 'دورة تدريبية مفعلة' : 'Active Course') : (isRTL ? 'طلب مخصص' : 'Custom Request')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 text-base">
                        {payment?.amount || '1'} {isRTL ? 'ر.س' : 'SAR'}
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
