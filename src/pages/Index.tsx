import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/landing/Navbar';
import AnnouncementBar from '@/components/landing/AnnouncementBar';
import HeroSection from '@/components/landing/HeroSection';
import HowItWorks from '@/components/landing/HowItWorks';
import IntroVideoSection from '@/components/landing/IntroVideoSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import UniversitiesSection from '@/components/landing/UniversitiesSection';
import CoursesSection from '@/components/landing/CoursesSection';
import FAQSection from '@/components/landing/FAQSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';
import ScrollToTop from '@/components/landing/ScrollToTop';

const Index = () => {
  const { dir } = useLanguage();
  const navigate = useNavigate();

  // Check for password recovery tokens in URL and redirect to reset-password page
  useEffect(() => {
    const fullUrl = window.location.href;
    const hash = window.location.hash;
    const search = window.location.search;
    
    // Check for recovery token in hash or query params
    const hasRecoveryToken = 
      (hash && hash.includes('type=recovery')) ||
      (search && search.includes('type=recovery')) ||
      fullUrl.includes('type=recovery');
    
    if (hasRecoveryToken) {
      console.log('[Index] Password recovery token detected, redirecting to /reset-password');
      // Preserve the full URL fragment for the reset page
      const fragment = hash || (search ? `#${search.substring(1)}` : '');
      navigate(`/reset-password${fragment}`, { replace: true });
      return;
    }
  }, [navigate]);

  // Enable smooth scroll behavior
  useEffect(() => {
    // Handle anchor links with smooth scroll
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLAnchorElement;
      if (target.tagName === 'A' && target.hash && !target.hash.includes('access_token')) {
        const element = document.querySelector(target.hash);
        if (element) {
          e.preventDefault();
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  return (
    <div className="min-h-screen scroll-smooth" dir={dir}>
      <Navbar />
      <AnnouncementBar />
      <HeroSection />
      <IntroVideoSection />
      <section id="how-it-works">
        <HowItWorks />
      </section>
      <section id="universities">
        <UniversitiesSection />
      </section>
      <section id="courses">
        <CoursesSection />
      </section>
      <section id="features">
        <FeaturesSection />
      </section>
      <section id="faq">
        <FAQSection />
      </section>
      <CTASection />
      <Footer />
      <ScrollToTop />
    </div>
  );
};

export default Index;
