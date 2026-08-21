import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

const Terms = () => {
  const { language, dir } = useLanguage();
  const location = useLocation();
  const isPrivacy = location.pathname.startsWith('/privacy');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const key = isPrivacy
      ? (language === 'ar' ? 'privacy_policy_ar' : 'privacy_policy')
      : (language === 'ar' ? 'instructor_policies_ar' : 'instructor_policies_en');
    supabase
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
      .then(({ data }) => {
        setContent((data?.value as string) || '');
        setLoading(false);
      });
  }, [language, isPrivacy]);

  const title = isPrivacy
    ? (language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy')
    : (language === 'ar' ? 'سياسات وشروط استخدام المنصة' : 'Platform Terms & Policies');

  const description = isPrivacy
    ? (language === 'ar'
        ? 'تعرّف على كيفية جمع منصة جسوركم لبياناتك الشخصية واستخدامها وحمايتها أثناء استخدامك للمنصة التعليمية.'
        : 'Learn how Josoorkom collects, uses and protects your personal data while you use the learning platform.')
    : (language === 'ar'
        ? 'شروط وأحكام استخدام منصة جسوركم للطلاب والمعلمين: الحقوق والالتزامات وسياسات المحتوى والدفع.'
        : 'Josoorkom terms of use for students and instructors: rights, obligations, content and payment policies.');

  return (
    <div dir={dir} className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>{`${title} | ${language === 'ar' ? 'جسوركم' : 'Josoorkom'}`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={isPrivacy ? 'https://josoorcom.com/privacy' : 'https://josoorcom.com/terms'} />
        <meta property="og:title" content={`${title} | ${language === 'ar' ? 'جسوركم' : 'Josoorkom'}`} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={isPrivacy ? 'https://josoorcom.com/privacy' : 'https://josoorcom.com/terms'} />
      </Helmet>
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-gradient-gold">{title}</h1>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-11/12" />
            <Skeleton className="h-6 w-10/12" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : (
          <article className="prose prose-lg max-w-none whitespace-pre-wrap leading-relaxed text-foreground/90">
            {content || (language === 'ar' ? 'لا يوجد محتوى متاح حالياً.' : 'No content available.')}
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Terms;
