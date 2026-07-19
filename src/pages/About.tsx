import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Target, Eye, Heart, Users, BookOpen, Award, Sparkles, Shield, GraduationCap, TrendingUp, CheckCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { usePlatformStats } from '@/hooks/usePlatformStats';

const About = () => {
  const { language, dir } = useLanguage();
  const isArabic = language === 'ar';
  const platformStats = usePlatformStats();
  const fmt = (n: number) => new Intl.NumberFormat(isArabic ? 'ar-EG' : 'en-US').format(n);

  const content = {
    ar: {
      pageTitle: 'من نحن - جسوركم',
      pageDescription: 'تعرف على منصة جسوركم للتعليم الإلكتروني - نعزز نرتقي نتفوق',
      
      // Hero
      heroTitle: 'منصة جسوركم',
      heroSubtitle: 'نعزز – نرتقي – نتفوق',
      heroIntro: 'منصة جسوركم هي المكان الذي يتحول فيه التعلم من مجرد معلومات إلى فهم عميق، ومن فهم إلى تفوق حقيقي.',
      heroDescription: 'نحن لا نقدم شروحات عابرة، بل نبني جسوراً معرفية تربط بين الطالب وبين المادة بطريقة واضحة وسهلة ومُحفّزة.',
      
      // Slogan Section
      sloganTitle: 'شعارنا',
      sloganItems: [
        { word: 'نعزز', description: 'الشروحات الأكاديمية' },
        { word: 'نرتقي', description: 'بمستوى الطلاب' },
        { word: 'نتفوق', description: 'في المسيرة العلمية' },
      ],
      sloganText: 'بالتوازي مع جامعاتنا العربية ومؤسساتنا التعليمية، تعمل منصة جسوركم على تعزيز الشروحات وترتقي بطلابها نحو التفوق الأكاديمي والوظيفي.',
      sloganNote: 'ففي عالم سريع التغير، لا يكفي أن تدرس… بل يجب أن تفهم وتُطبق وتتميز.',
      
      // For Students
      studentsTitle: 'للطلاب',
      studentsIntro: 'إذا شعرت أن المحاضرات لا تكفي، أو أن المادة تحتاج لشرح أوضح، فهنا يأتي دور منصة جسوركم.',
      studentsFeatures: [
        'نحوّل ملاحظات المحاضرة وخطة المادة إلى شروحات فيديو احترافية',
        'ملخصات ومراجعات سريعة تساعدك على الحفظ والفهم',
        'تجعلك جاهزًا للامتحان بثقة',
        'متابعة دورية وتقييم مستمر',
      ],
      studentsConclusion: 'سنعمل معك خطوة بخطوة لتصل إلى هدفك: التفوق الأكاديمي والنجاح المهني.',
      
      // For Instructors
      instructorsTitle: 'للمعلمين',
      instructorsIntro: 'وإذا كنت معلمًا تبحث عن منصة تُظهر جودة شروحاتك وتوسع تأثيرك، فستجد في جسوركم شريكًا حقيقيًا.',
      instructorsFeatures: [
        'نساعدك على تقديم محتواك بطريقة منظمة واحترافية',
        'دعم تسويقي وتقني للوصول إلى أكبر عدد من الطلاب',
        'فرصة لتحقيق دخل إضافي من جهودك التعليمية',
        'أدوات متقدمة لإدارة المحتوى والطلاب',
      ],
      
      // Why Us
      whyUsTitle: 'لماذا جسوركم؟',
      whyUsIntro: 'لأننا نؤمن أن التعليم الجيد يبدأ من فهم صحيح، ثم يتطور إلى مهارات وقدرة على التفوق.',
      whyUsFeatures: [
        { icon: CheckCircle, text: 'محتوى موثوق ومُراجع' },
        { icon: BookOpen, text: 'مُصمم حسب خطة المادة' },
        { icon: Award, text: 'جودة إنتاج عالية' },
        { icon: Sparkles, text: 'تجربة تعليمية متكاملة' },
      ],
      whyUsConclusion: 'مع جسوركم، لا تدرس فقط… بل تتعلم بذكاء، ترتقي بقدراتك، وتصل إلى التفوق.',
      
      // Stats
      stats: {
        title: 'إنجازاتنا',
        items: [
          { value: fmt(platformStats.students), label: 'طالب مسجل' },
          { value: fmt(platformStats.courses), label: 'دورة تدريبية' },
          { value: fmt(platformStats.instructors), label: 'مدرس خبير' },
          { value: platformStats.satisfactionPercent > 0 ? `${platformStats.satisfactionPercent}%` : '—', label: 'نسبة رضا الطلاب' }
        ]
      },
    },
    en: {
      pageTitle: 'About Us - Jasorkom',
      pageDescription: 'Learn about Jasorkom e-learning platform - Enhance, Rise, Excel',
      
      // Hero
      heroTitle: 'Jasorkom Platform',
      heroSubtitle: 'Enhance – Rise – Excel',
      heroIntro: 'Jasorkom is the place where learning transforms from mere information to deep understanding, and from understanding to real excellence.',
      heroDescription: 'We don\'t offer passing explanations, but we build knowledge bridges that connect students to the material in a clear, easy, and motivating way.',
      
      // Slogan Section
      sloganTitle: 'Our Slogan',
      sloganItems: [
        { word: 'Enhance', description: 'Academic Explanations' },
        { word: 'Rise', description: 'Student Levels' },
        { word: 'Excel', description: 'In Academic Journey' },
      ],
      sloganText: 'In parallel with our Arab universities and educational institutions, Jasorkom platform works to enhance explanations and elevate its students towards academic and professional excellence.',
      sloganNote: 'In a rapidly changing world, it\'s not enough to study... you must understand, apply, and stand out.',
      
      // For Students
      studentsTitle: 'For Students',
      studentsIntro: 'If you feel that lectures are not enough, or that the material needs clearer explanation, this is where Jasorkom comes in.',
      studentsFeatures: [
        'We transform lecture notes and course plans into professional video explanations',
        'Quick summaries and reviews to help you memorize and understand',
        'Make you ready for the exam with confidence',
        'Regular follow-up and continuous assessment',
      ],
      studentsConclusion: 'We will work with you step by step to reach your goal: Academic excellence and professional success.',
      
      // For Instructors
      instructorsTitle: 'For Instructors',
      instructorsIntro: 'If you\'re an instructor looking for a platform that showcases your teaching quality and expands your impact, you\'ll find a real partner in Jasorkom.',
      instructorsFeatures: [
        'We help you present your content in an organized and professional way',
        'Marketing and technical support to reach the largest number of students',
        'Opportunity to earn additional income from your teaching efforts',
        'Advanced tools for content and student management',
      ],
      
      // Why Us
      whyUsTitle: 'Why Jasorkom?',
      whyUsIntro: 'Because we believe that good education starts from proper understanding, then develops into skills and the ability to excel.',
      whyUsFeatures: [
        { icon: CheckCircle, text: 'Trusted and reviewed content' },
        { icon: BookOpen, text: 'Designed according to course plan' },
        { icon: Award, text: 'High production quality' },
        { icon: Sparkles, text: 'Comprehensive learning experience' },
      ],
      whyUsConclusion: 'With Jasorkom, you don\'t just study... you learn smartly, elevate your abilities, and reach excellence.',
      
      // Stats
      stats: {
        title: 'Our Achievements',
        items: [
          { value: fmt(platformStats.students), label: 'Registered Students' },
          { value: fmt(platformStats.courses), label: 'Courses' },
          { value: fmt(platformStats.instructors), label: 'Expert Instructors' },
          { value: platformStats.satisfactionPercent > 0 ? `${platformStats.satisfactionPercent}%` : '—', label: 'Student Satisfaction' }
        ]
      },
    }
  };

  const t = content[isArabic ? 'ar' : 'en'];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "جسوركم - Jasorkom",
    "url": "https://xbuild.lovable.app",
    "logo": "https://xbuild.lovable.app/favicon.png",
    "description": isArabic 
      ? "منصة جسوركم للتعليم الإلكتروني - نعزز نرتقي نتفوق"
      : "Jasorkom e-learning platform - Enhance, Rise, Excel",
    "slogan": isArabic ? "نعزز – نرتقي – نتفوق" : "Enhance – Rise – Excel",
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "SA"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "availableLanguage": ["Arabic", "English"]
    }
  };

  return (
    <>
      <Helmet>
        <title>{t.pageTitle}</title>
        <meta name="description" content={t.pageDescription} />
        <meta property="og:title" content={t.pageTitle} />
        <meta property="og:description" content={t.pageDescription} />
        <link rel="canonical" href="https://xbuild.lovable.app/about" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background" dir={dir}>
        <Navbar />
        
        {/* Hero Section */}
        <section className="pt-32 pb-16 bg-gradient-to-b from-primary/10 via-secondary/5 to-background relative overflow-hidden">
          {/* Background decorations */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-20 start-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-10 end-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
          </div>
          
          <div className="container mx-auto px-4 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary via-ocean to-secondary rounded-2xl flex items-center justify-center shadow-xl"
            >
              <GraduationCap className="w-10 h-10 text-white" />
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-ocean to-secondary bg-clip-text text-transparent mb-4"
            >
              {t.heroTitle}
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl md:text-3xl font-bold text-foreground mb-6"
            >
              {t.heroSubtitle}
            </motion.p>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-foreground max-w-3xl mx-auto leading-relaxed mb-4"
            >
              {t.heroIntro}
            </motion.p>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed"
            >
              {t.heroDescription}
            </motion.p>
          </div>
        </section>

        {/* Slogan Section */}
        <section className="py-16 bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5">
          <div className="container mx-auto px-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl font-bold text-center text-foreground mb-12"
            >
              {t.sloganTitle}
            </motion.h2>
            
            <div className="flex flex-wrap justify-center gap-8 mb-12">
              {t.sloganItems.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className="text-center"
                >
                  <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-lg">
                    <TrendingUp className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-primary mb-2">{item.word}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </motion.div>
              ))}
            </div>
            
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto text-center"
            >
              <p className="text-lg text-foreground mb-4 leading-relaxed">{t.sloganText}</p>
              <p className="text-lg text-primary font-semibold italic">{t.sloganNote}</p>
            </motion.div>
          </div>
        </section>

        {/* For Students Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: isArabic ? 50 : -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold text-foreground">{t.studentsTitle}</h2>
                </div>
                
                <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                  {t.studentsIntro}
                </p>
                
                <ul className="space-y-4 mb-6">
                  {t.studentsFeatures.map((feature, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: isArabic ? 20 : -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{feature}</span>
                    </motion.li>
                  ))}
                </ul>
                
                <p className="text-lg font-semibold text-primary">
                  {t.studentsConclusion}
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: isArabic ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="aspect-square bg-gradient-to-br from-primary/20 via-ocean/20 to-secondary/20 rounded-3xl flex items-center justify-center">
                  <div className="w-32 h-32 bg-gradient-to-br from-primary to-ocean rounded-2xl flex items-center justify-center shadow-2xl">
                    <GraduationCap className="w-16 h-16 text-white" />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* For Instructors Section */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: isArabic ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative order-2 lg:order-1"
              >
                <div className="aspect-square bg-gradient-to-br from-secondary/20 via-teal/20 to-emerald/20 rounded-3xl flex items-center justify-center">
                  <div className="w-32 h-32 bg-gradient-to-br from-secondary to-teal rounded-2xl flex items-center justify-center shadow-2xl">
                    <Users className="w-16 h-16 text-white" />
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: isArabic ? 50 : -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-1 lg:order-2"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Users className="w-7 h-7 text-secondary" />
                  </div>
                  <h2 className="text-3xl font-bold text-foreground">{t.instructorsTitle}</h2>
                </div>
                
                <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                  {t.instructorsIntro}
                </p>
                
                <ul className="space-y-4">
                  {t.instructorsFeatures.map((feature, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: isArabic ? 20 : -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle className="w-6 h-6 text-secondary flex-shrink-0 mt-0.5" />
                      <span className="text-foreground">{feature}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-16 bg-gradient-to-r from-primary/10 via-ocean/10 to-secondary/10">
          <div className="container mx-auto px-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl font-bold text-center text-foreground mb-12"
            >
              {t.stats.title}
            </motion.h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {t.stats.items.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center bg-card/50 backdrop-blur-sm rounded-2xl p-6 border border-border"
                >
                  <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Us */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl font-bold text-center text-foreground mb-4"
            >
              {t.whyUsTitle}
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12"
            >
              {t.whyUsIntro}
            </motion.p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {t.whyUsFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card rounded-xl p-6 border border-border text-center hover:shadow-lg transition-shadow"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-medium text-foreground">{feature.text}</p>
                </motion.div>
              ))}
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <p className="text-xl font-bold bg-gradient-to-r from-primary via-ocean to-secondary bg-clip-text text-transparent">
                {t.whyUsConclusion}
              </p>
            </motion.div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
};

export default About;
