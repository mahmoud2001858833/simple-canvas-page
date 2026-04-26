import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';

const AUTO_REDIRECT_SECONDS = 3;

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';

  const paymentId = searchParams.get('payment_id');
  const transactionId = searchParams.get('transaction_id');
  const courseIdParam = searchParams.get('course_id');

  const [countdown, setCountdown] = useState(AUTO_REDIRECT_SECONDS);
  const [maxWaitReached, setMaxWaitReached] = useState(false);

  // Fetch payment details
  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment-success', paymentId],
    queryFn: async () => {
      if (!paymentId) return null;
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          courses (id, title, title_ar),
          custom_course_requests (id, title)
        `)
        .eq('id', paymentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!paymentId,
    refetchInterval: (query) => {
      // Keep polling if payment is still pending (webhook may not have arrived yet)
      const data = query.state.data as any;
      if (data && data.status === 'pending') return 3000;
      return false;
    },
  });

  // Trigger confetti on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10B981', '#3B82F6', '#F59E0B', '#EC4899'],
      });
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const course = payment?.courses as any;
  const request = payment?.custom_course_requests as any;
  const resolvedCourseId = course?.id || courseIdParam;

  const isPaid = payment?.status === 'paid';

  // Create enrollment client-side as fallback when payment is confirmed
  useEffect(() => {
    if (!isPaid || !resolvedCourseId || !user) return;
    
    const ensureEnrollment = async () => {
      try {
        // Check if enrollment already exists
        const { data: existing } = await supabase
          .from('enrollments')
          .select('id')
          .eq('user_id', user.id)
          .eq('course_id', resolvedCourseId)
          .maybeSingle();
        
        if (!existing) {
          await supabase.from('enrollments').insert({
            user_id: user.id,
            course_id: resolvedCourseId,
            status: 'active',
          });
          console.log('Enrollment created client-side as fallback');
        }
      } catch (err) {
        console.log('Enrollment fallback skipped (may already exist):', err);
      }
    };
    
    ensureEnrollment();
  }, [isPaid, resolvedCourseId, user]);

  // Auto-redirect countdown — only starts when payment is confirmed OR after max wait
  
  useEffect(() => {
    // After 10 seconds, redirect regardless (webhook may be slow)
    const maxWait = setTimeout(() => setMaxWaitReached(true), 10000);
    return () => clearTimeout(maxWait);
  }, []);

  const shouldRedirect = resolvedCourseId && (isPaid || maxWaitReached);

  useEffect(() => {
    if (!shouldRedirect) return;
    
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate(`/courses/${resolvedCourseId}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [shouldRedirect, resolvedCourseId, navigate]);

  const isPending = payment?.status === 'pending';

  return (
    <div className={`min-h-screen bg-gradient-to-b from-green-50 to-background dark:from-green-950/20 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
              {isPending ? (
                <Loader2 className="h-12 w-12 text-green-600 animate-spin" />
              ) : (
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              )}
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-3xl font-bold text-green-800 dark:text-green-400 mb-2 flex items-center justify-center gap-2">
                <PartyPopper className="h-8 w-8" />
                {isPending 
                  ? (isRTL ? 'جاري تأكيد الدفع...' : 'Confirming Payment...')
                  : (isRTL ? 'تم الدفع بنجاح!' : 'Payment Successful!')
                }
              </h1>
              <p className="text-muted-foreground">
                {isPending
                  ? (isRTL ? 'يتم الآن التحقق من عملية الدفع، يرجى الانتظار...' : 'Verifying your payment, please wait...')
                  : (isRTL 
                    ? 'شكراً لك! تم تأكيد الدفع وتفعيل اشتراكك'
                    : 'Thank you! Your payment has been confirmed and your subscription is active'
                  )
                }
              </p>
              
              {/* Auto-redirect countdown */}
              {shouldRedirect && (
                <p className="text-sm text-primary mt-3 font-medium">
                  {isRTL 
                    ? `سيتم توجيهك للكورس خلال ${countdown} ثوان...`
                    : `Redirecting to your course in ${countdown} seconds...`
                  }
                </p>
              )}
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardContent className="pt-6 space-y-6">
                {/* Order Details */}
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">
                    {isRTL ? 'رقم العملية' : 'Transaction ID'}
                  </p>
                  <p className="font-mono font-semibold">{transactionId || payment?.transaction_id || 'N/A'}</p>
                </div>

                {/* Item Details */}
                {(course || request) && (
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      {course ? (
                        <GraduationCap className="h-6 w-6 text-primary" />
                      ) : (
                        <BookOpen className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {course 
                          ? (isRTL ? course.title_ar : course.title)
                          : request?.title
                        }
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {course ? (isRTL ? 'كورس' : 'Course') : (isRTL ? 'طلب مخصص' : 'Custom Request')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">
                        {payment?.amount} {isRTL ? 'ر.س' : 'SAR'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Receipt */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isRTL ? 'طريقة الدفع' : 'Payment Method'}</span>
                    <span>{payment?.payment_method === 'tabby' ? 'Tabby' : isRTL ? 'بطاقة ائتمان' : 'Credit Card'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isRTL ? 'التاريخ' : 'Date'}</span>
                    <span>{new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isRTL ? 'الحالة' : 'Status'}</span>
                    <span className={`font-medium flex items-center gap-1 ${isPending ? 'text-yellow-600' : 'text-green-600'}`}>
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {isPending ? (isRTL ? 'قيد التأكيد' : 'Confirming') : (isRTL ? 'مكتمل' : 'Completed')}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-4">
                  {resolvedCourseId ? (
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={() => navigate(`/courses/${resolvedCourseId}`)}
                    >
                      <GraduationCap className="h-4 w-4 mr-2" />
                      {isRTL ? 'ابدأ التعلم الآن' : 'Start Learning Now'}
                    </Button>
                  ) : (
                    <Button asChild className="w-full" size="lg">
                      <Link to="/dashboard">
                        <ArrowRight className="h-4 w-4 mr-2" />
                        {isRTL ? 'تتبع طلبك' : 'Track Your Request'}
                      </Link>
                    </Button>
                  )}

                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/dashboard">
                      {isRTL ? 'الذهاب للوحة التحكم' : 'Go to Dashboard'}
                    </Link>
                  </Button>
                </div>

                {/* Download Receipt */}
                <div className="text-center pt-2">
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <Receipt className="h-4 w-4 mr-2" />
                    {isRTL ? 'تحميل الفاتورة' : 'Download Receipt'}
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
