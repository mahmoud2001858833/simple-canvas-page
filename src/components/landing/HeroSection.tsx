import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Play, Sparkles, Star, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';
import AnimatedBackground from './AnimatedBackground';
import heroStudent from '@/assets/hero-student.png';
import logo from '@/assets/logo.png';
const HeroSection = () => {
  const { t, dir } = useLanguage();
  const { scrollToElement } = useSmoothScroll();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeOut' as const,
      },
    },
  };

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-emerald-950 via-teal-900 to-green-950 flex items-center justify-center pt-20 overflow-hidden">
      {/* Static Background */}
      <AnimatedBackground />
      
      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center lg:text-start order-2 lg:order-1"
          >
            {/* Badge */}
            <motion.div variants={itemVariants} className="mb-6">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-accent/20 via-secondary/20 to-emerald/20 border border-accent/40 text-accent text-sm font-semibold backdrop-blur-sm shadow-gold">
                <Sparkles className="w-4 h-4" />
                {dir === 'rtl' ? 'منصة التعليم الرقمي الأولى' : '#1 Digital Learning Platform'}
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-accent text-accent" />
                  ))}
                </div>
              </span>
            </motion.div>

            {/* Main Title */}
            <motion.h1 
              variants={itemVariants}
              className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 leading-tight"
            >
              <span className="text-gradient-gold">{t.hero.title}</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p 
              variants={itemVariants}
              className="text-xl md:text-2xl lg:text-3xl text-white/90 mb-4 font-medium"
            >
              {t.hero.subtitle}
            </motion.p>

            {/* Description */}
            <motion.p 
              variants={itemVariants}
              className="text-base md:text-lg text-white/70 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              {t.hero.description}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div 
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
            >
              <Link to="/signup">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-emerald-600 via-teal-500 to-secondary text-white font-bold text-lg px-10 py-7 shadow-green hover:shadow-2xl hover:scale-105 transition-all duration-300 group"
                >
                  <span className="flex items-center">
                    {t.hero.cta}
                    {dir === 'rtl' ? (
                      <ChevronLeft className="mr-2 group-hover:-translate-x-1 transition-transform" />
                    ) : (
                      <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    )}
                  </span>
                </Button>
              </Link>
              <Link to="/courses">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-accent to-warning text-foreground font-bold text-lg px-10 py-7 shadow-gold hover:shadow-2xl hover:scale-105 transition-all duration-300 group"
                >
                  <Play className="w-5 h-5 ltr:mr-2 rtl:ml-2 group-hover:scale-110 transition-transform" />
                  {t.hero.exploreCourses}
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Hero Image - Premium */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative order-1 lg:order-2 flex justify-center"
          >
            {/* Multi-layer glow */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[80%] h-[80%] bg-gradient-to-br from-accent/30 via-emerald-500/20 to-teal-400/15 rounded-full blur-[80px]" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[50%] h-[50%] bg-accent/20 rounded-full blur-[60px] translate-y-8" />
            </div>
            
            {/* Main image with premium frame */}
            <div className="relative z-10">
              {/* Decorative ring */}
              <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-accent/30 via-transparent to-emerald-500/20 blur-sm" />
              <div className="absolute -inset-[1px] rounded-[2rem] bg-gradient-to-br from-accent/40 via-white/10 to-emerald-400/30" />
              
              <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm p-1">
                <div className="rounded-[1.75rem] overflow-hidden">
                  <img 
                    src={heroStudent} 
                    alt="Student learning"
                    className="w-full max-w-sm xl:max-w-md object-cover"
                    loading="eager"
                  />
                </div>
              </div>
              
              {/* Platform Logo - premium floating */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
                className="absolute -top-6 left-1/2 -translate-x-1/2 z-20"
              >
                <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-3 border border-accent/20 ring-1 ring-accent/10">
                  <img 
                    src={logo} 
                    alt="Platform Logo"
                    className="w-16 h-16 md:w-20 md:h-20 object-contain"
                  />
                </div>
              </motion.div>
              
              {/* Floating badges */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7, duration: 0.4 }}
                className="absolute -bottom-3 -left-6 bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] p-3 flex items-center gap-3 border border-white/50 animate-float-delayed"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-accent to-yellow-500 rounded-xl flex items-center justify-center shadow-sm">
                  <span className="text-lg">⭐</span>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground font-medium">{dir === 'rtl' ? 'تقييم' : 'Rating'}</div>
                  <div className="font-bold text-sm text-foreground">4.9/5</div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="absolute top-1/2 -translate-y-1/2 -right-10 bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] p-3 border border-white/50 animate-float-slow"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-primary rounded-xl flex items-center justify-center shadow-sm">
                  <span className="text-lg">📚</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Down Indicator */}
      <button
        onClick={() => scrollToElement('how-it-works', { offset: -60, duration: 800 })}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 text-white/60 hover:text-white transition-colors cursor-pointer group animate-bounce-slow"
      >
        <span className="text-sm font-medium">{dir === 'rtl' ? 'اكتشف المزيد' : 'Discover More'}</span>
        <ChevronDown className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path 
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" 
            fill="hsl(var(--background))"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
