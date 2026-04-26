import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { 
  XCircle, 
  RefreshCw, 
  HelpCircle, 
  ArrowLeft,
  ArrowRight,
  MessageCircle
} from 'lucide-react';

const PaymentFailed = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const errorCode = searchParams.get('error');
  const courseId = searchParams.get('course_id');
  const requestId = searchParams.get('request_id');

  const getErrorMessage = () => {
    switch (errorCode) {
      case 'declined':
        return isRTL 
          ? 'تم رفض البطاقة من قبل البنك. يرجى التحقق من بيانات البطاقة أو استخدام بطاقة أخرى.'
          : 'Your card was declined by the bank. Please verify your card details or use a different card.';
      case 'insufficient_funds':
        return isRTL 
          ? 'رصيد غير كافٍ في البطاقة. يرجى استخدام بطاقة أخرى.'
          : 'Insufficient funds on the card. Please use a different card.';
      case 'expired':
        return isRTL 
          ? 'انتهت صلاحية البطاقة. يرجى استخدام بطاقة صالحة.'
          : 'The card has expired. Please use a valid card.';
      case 'cancelled':
        return isRTL 
          ? 'تم إلغاء العملية من قبلك.'
          : 'The transaction was cancelled by you.';
      default:
        return isRTL 
          ? 'حدث خطأ أثناء معالجة الدفع. يرجى المحاولة مرة أخرى.'
          : 'An error occurred while processing your payment. Please try again.';
    }
  };

  const handleRetry = () => {
    if (courseId) {
      navigate(`/checkout/${courseId}`);
    } else if (requestId) {
      navigate(`/checkout?request=${requestId}`);
    } else {
      navigate('/courses');
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-b from-red-50 to-background dark:from-red-950/20 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
              <XCircle className="h-12 w-12 text-red-600" />
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-3xl font-bold text-red-800 dark:text-red-400 mb-2">
                {isRTL ? 'فشل الدفع' : 'Payment Failed'}
              </h1>
              <p className="text-muted-foreground">
                {isRTL 
                  ? 'لم نتمكن من إتمام عملية الدفع'
                  : "We couldn't complete your payment"
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
                {/* Error Details */}
                <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-red-800 dark:text-red-400 mb-1">
                        {isRTL ? 'ما حدث؟' : 'What happened?'}
                      </h4>
                      <p className="text-sm text-red-700 dark:text-red-500">
                        {getErrorMessage()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Suggestions */}
                <div className="space-y-3">
                  <h4 className="font-semibold">
                    {isRTL ? 'ماذا يمكنك أن تفعل؟' : 'What can you do?'}
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {isRTL 
                        ? 'تحقق من بيانات البطاقة وحاول مرة أخرى'
                        : 'Verify your card details and try again'
                      }
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {isRTL 
                        ? 'استخدم طريقة دفع مختلفة (تابي / تحويل بنكي)'
                        : 'Use a different payment method (Tabby / Bank Transfer)'
                      }
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {isRTL 
                        ? 'تواصل مع البنك للتأكد من عدم وجود قيود'
                        : 'Contact your bank to ensure there are no restrictions'
                      }
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {isRTL 
                        ? 'تواصل مع فريق الدعم للمساعدة'
                        : 'Contact our support team for assistance'
                      }
                    </li>
                  </ul>
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-4">
                  <Button onClick={handleRetry} className="w-full" size="lg">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {isRTL ? 'المحاولة مرة أخرى' : 'Try Again'}
                  </Button>

                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/courses">
                      {isRTL ? (
                        <>
                          <ArrowRight className="h-4 w-4 ml-2" />
                          تصفح الكورسات
                        </>
                      ) : (
                        <>
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Browse Courses
                        </>
                      )}
                    </Link>
                  </Button>

                  <Button variant="ghost" className="w-full text-muted-foreground">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    {isRTL ? 'تواصل مع الدعم' : 'Contact Support'}
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

export default PaymentFailed;
