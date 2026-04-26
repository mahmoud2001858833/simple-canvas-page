import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Rocket, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const CTASection = () => {
  const { language, t } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  // Parallax transforms
  const backgroundY = useTransform(scrollYProgress, [0, 1], [-50, 50]);
  const contentY = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const leftGlowX = useTransform(scrollYProgress, [0, 1], [-100, 100]);
  const rightGlowX = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1, 0.9]);
  const rotate = useTransform(scrollYProgress, [0, 1], [-5, 5]);

  return (
    <section ref={sectionRef} className="py-24 relative overflow-hidden">
      {/* Background */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-teal-900 to-green-950" 
        style={{ y: backgroundY }}
      />
      
      {/* Animated Background Elements with Parallax */}
      <motion.div
        className="absolute top-10 left-10 w-64 h-64 rounded-full bg-accent/15 blur-3xl"
        style={{ x: leftGlowX }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl"
        style={{ x: rightGlowX }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
      />
      
      {/* Additional Parallax Decorations */}
      <motion.div
        className="absolute top-1/4 right-1/4 w-4 h-4 rounded-full bg-accent/60"
        style={{ y: useTransform(scrollYProgress, [0, 1], [-30, 30]), rotate }}
      />
      <motion.div
        className="absolute bottom-1/4 left-1/4 w-6 h-6 rounded-full bg-emerald-500/50"
        style={{ y: useTransform(scrollYProgress, [0, 1], [30, -30]) }}
      />
      <motion.div
        className="absolute top-1/3 left-1/3 w-3 h-3 rounded-full bg-teal-400/50"
        style={{ y: useTransform(scrollYProgress, [0, 1], [-20, 20]) }}
      />

      {/* Content */}
      <motion.div 
        className="container mx-auto px-4 relative z-10"
        style={{ y: contentY, scale }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          {/* Icon with Parallax Rotation */}
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            style={{ rotate }}
            className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold"
          >
            <Rocket className="w-10 h-10 text-primary-foreground" />
          </motion.div>

          {/* Title */}
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            {language === 'ar' ? 'ابدأ رحلتك التعليمية اليوم' : 'Start Your Learning Journey Today'}
          </h2>

          {/* Description */}
          <p className="text-xl text-white/70 mb-10 leading-relaxed">
            {language === 'ar'
              ? 'انضم إلى آلاف الطلاب الذين يحققون أهدافهم الأكاديمية معنا. سجّل الآن واحصل على خصم 20% على أول مادة!'
              : 'Join thousands of students achieving their academic goals with us. Register now and get 20% off on your first course!'}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button 
                size="lg" 
                className="btn-gold text-lg px-10 py-7 group"
              >
                <Sparkles className="w-5 h-5 ltr:mr-2 rtl:ml-2 group-hover:rotate-12 transition-transform" />
                {t.nav.signup}
              </Button>
            </Link>
            <Link to="/courses">
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-10 py-7 border-white/30 text-white hover:bg-white/10"
              >
                {t.nav.courses}
              </Button>
            </Link>
          </div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-8 text-white/50"
          >
            {[
              { icon: '🔒', text: language === 'ar' ? 'دفع آمن' : 'Secure Payment' },
              { icon: '💳', text: language === 'ar' ? 'تقسيط مريح' : 'Easy Installments' },
              { icon: '📜', text: language === 'ar' ? 'شهادات معتمدة' : 'Certified' },
            ].map((badge, index) => (
              <motion.div
                key={index}
                className="flex items-center gap-2"
                whileHover={{ scale: 1.1, y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-2xl">{badge.icon}</span>
                <span>{badge.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default CTASection;