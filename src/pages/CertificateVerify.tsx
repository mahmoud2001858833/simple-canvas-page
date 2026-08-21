import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, GraduationCap, Award, Calendar, User } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const CertificateVerify = () => {
  const { token } = useParams<{ token: string }>();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const { data: certificate, isLoading, error } = useQuery({
    queryKey: ['verify-certificate', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');

      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          courses:course_id (title, title_ar, thumbnail_url, duration_hours),
          profiles:user_id (full_name, full_name_ar)
        `)
        .eq('verification_token', token)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const isValid = !!certificate;

  return (
    <div className={`min-h-screen bg-background flex items-center justify-center p-4 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <Helmet>
        <title>{isRTL ? 'التحقق من صحة الشهادة | جسوركم' : 'Verify a Certificate | Josoorkom'}</title>
        <meta name="description" content={isRTL ? 'تحقق من صحة شهادات إتمام الدورات الصادرة عن منصة جسوركم باستخدام رمز الشهادة.' : 'Verify the authenticity of course completion certificates issued by Josoorkom using the certificate code.'} />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <Card className="w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className={`p-8 text-center ${isValid ? 'bg-gradient-to-br from-green-500 to-emerald-600' : isLoading ? 'bg-gradient-to-br from-primary to-primary/80' : 'bg-gradient-to-br from-destructive to-destructive/80'} text-white`}>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="w-16 h-16 rounded-full mx-auto bg-white/20" />
              <Skeleton className="h-6 w-48 mx-auto bg-white/20" />
            </div>
          ) : isValid ? (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-3" />
              <h1 className="text-2xl font-bold">
                {isRTL ? 'شهادة موثّقة ✓' : 'Verified Certificate ✓'}
              </h1>
              <p className="text-white/80 mt-1">
                {isRTL ? 'هذه الشهادة صادرة من منصة جسوركم' : 'This certificate was issued by Josoorcom'}
              </p>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-3" />
              <h1 className="text-2xl font-bold">
                {isRTL ? 'شهادة غير صالحة' : 'Invalid Certificate'}
              </h1>
              <p className="text-white/80 mt-1">
                {isRTL ? 'لم يتم العثور على شهادة بهذا الرمز' : 'No certificate found with this token'}
              </p>
            </>
          )}
        </div>

        {/* Details */}
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : isValid ? (
            <div className="space-y-4">
              {/* Student Name */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'اسم الطالب' : 'Student Name'}</p>
                  <p className="font-semibold text-foreground">
                    {isRTL
                      ? (certificate.profiles as any)?.full_name_ar || (certificate.profiles as any)?.full_name
                      : (certificate.profiles as any)?.full_name}
                  </p>
                </div>
              </div>

              {/* Course */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'الدورة' : 'Course'}</p>
                  <p className="font-semibold text-foreground">
                    {isRTL ? (certificate.courses as any)?.title_ar : (certificate.courses as any)?.title}
                  </p>
                </div>
              </div>

              {/* Certificate Number */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Award className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'رقم الشهادة' : 'Certificate #'}</p>
                  <p className="font-mono font-semibold text-foreground">{certificate.certificate_number}</p>
                </div>
              </div>

              {/* Issue Date */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? 'تاريخ الإصدار' : 'Issue Date'}</p>
                  <p className="font-semibold text-foreground">
                    {certificate.issued_at
                      ? new Date(certificate.issued_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                  {isRTL ? 'شهادة أصلية ومعتمدة' : 'Authentic & Verified'}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                {isRTL
                  ? 'تأكد من صحة الرابط أو رمز التحقق وحاول مرة أخرى'
                  : 'Please verify the link or verification code and try again'}
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Button asChild variant="outline">
              <Link to="/">{isRTL ? 'العودة للرئيسية' : 'Back to Home'}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CertificateVerify;
