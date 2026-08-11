import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CertificatesSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/EmptyState';
import { Award, Download, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { trackXapi } from '@/lib/xapi';

export const MyCertificates = () => {
  const { language } = useLanguage();
  const { user } = useAuth();

  const { data: certificates, isLoading } = useQuery({
    queryKey: ['my-certificates', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          course:courses(title, title_ar, thumbnail_url)
        `)
        .eq('user_id', user.id)
        .order('issued_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'd MMMM yyyy', {
      locale: language === 'ar' ? ar : enUS,
    });
  };

  if (isLoading) {
    return <CertificatesSkeleton />;
  }

  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          {language === 'ar' ? 'شهاداتي' : 'My Certificates'}
        </h2>
      </div>

      {certificates && certificates.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((cert: any) => (
            <div
              key={cert.id}
              className="relative overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 p-6 hover:border-primary/40 transition-all group"
            >
              {/* Certificate Badge */}
              <div className="absolute top-4 end-4">
                <div className="w-12 h-12 bg-gradient-gold rounded-full flex items-center justify-center shadow-gold">
                  <Award className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>

              {/* Content */}
              <div className="pt-8">
                <h3 className="text-lg font-bold mb-2">
                  {language === 'ar' ? cert.course?.title_ar : cert.course?.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {language === 'ar' ? 'تاريخ الإصدار:' : 'Issued:'} {formatDate(cert.issued_at)}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {language === 'ar' ? 'رقم الشهادة:' : 'Certificate #:'} {cert.certificate_number}
                </p>

                {/* Actions */}
                <div className="flex gap-2">
                  {cert.pdf_url && (
                    <Button size="sm" className="flex-1 btn-gold">
                      <Download className="w-4 h-4 me-1" />
                      {language === 'ar' ? 'تحميل' : 'Download'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1">
                    <ExternalLink className="w-4 h-4 me-1" />
                    {language === 'ar' ? 'مشاركة' : 'Share'}
                  </Button>
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -bottom-4 -start-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Award}
          title={language === 'ar' ? 'لا توجد شهادات بعد' : 'No certificates yet'}
          description={language === 'ar' 
            ? 'أكمل دوراتك بنجاح للحصول على شهادات إتمام معتمدة تضيف قيمة لمسيرتك المهنية' 
            : 'Complete your courses successfully to earn certified completion certificates that add value to your career'}
          actionLabel={language === 'ar' ? 'تصفح الدورات' : 'Browse Courses'}
          actionLink="/courses"
          variant="card"
          illustration="certificates"
        />
      )}
    </div>
  );
};
