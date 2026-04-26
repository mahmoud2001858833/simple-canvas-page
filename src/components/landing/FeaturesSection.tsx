import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { GraduationCap, BookOpen, Brain } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const FeaturesSection = () => {
  const { t } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  // Parallax transforms
  const headerY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const gridY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const decorY = useTransform(scrollYProgress, [0, 1], [-30, 30]);

  const features = [
    { icon: GraduationCap, ...t.features.academic, color: 'from-amber-500 to-yellow-500' },
    { icon: BookOpen, ...t.features.custom, color: 'from-emerald-500 to-green-500' },
    { icon: Brain, ...t.features.ai, color: 'from-green-500 to-emerald-500' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: 'easeOut' as const,
      },
    },
  };

  return (
    <section ref={sectionRef} className="py-24 bg-gradient-to-b from-background via-emerald-50/30 to-background dark:via-emerald-950/20 relative overflow-hidden">
      {/* Background Parallax Decorations */}
      <motion.div
        className="absolute top-20 right-10 w-64 h-64 bg-accent/10 rounded-full blur-3xl"
        style={{ y: decorY }}
      />
      <motion.div
        className="absolute bottom-20 left-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl"
        style={{ y: useTransform(scrollYProgress, [0, 1], [30, -30]) }}
      />
      
      <div className="container mx-auto px-4">
        {/* Section Header with Parallax */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ y: headerY }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-emerald-600 via-accent to-secondary bg-clip-text text-transparent">
            {t.features.title}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t.features.subtitle}</p>
        </motion.div>

        {/* Features Grid with Parallax */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{ y: gridY }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ 
                y: -12,
                scale: 1.02,
                transition: { duration: 0.3, ease: "easeOut" } 
              }}
              className="group cursor-pointer"
            >
              <div className="relative h-full p-8 rounded-2xl bg-card border border-emerald-500/20 shadow-elegant hover:shadow-xl hover:border-accent/40 transition-all duration-500 overflow-hidden">
                {/* Background Glow - Enhanced */}
                <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-20 blur-3xl transition-all duration-700`} />
                <div className={`absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr ${feature.color} opacity-0 group-hover:opacity-15 blur-2xl transition-all duration-700 delay-100`} />
                
                {/* Icon - Enhanced Animation */}
                <motion.div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl transition-shadow duration-300`}
                  whileHover={{ 
                    rotate: [0, -10, 10, -5, 5, 0], 
                    scale: 1.15,
                    transition: { duration: 0.6 }
                  }}
                >
                  <feature.icon className="w-8 h-8 text-white group-hover:scale-110 transition-transform duration-300" />
                </motion.div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors duration-300">
                  {feature.description}
                </p>

                {/* Decorative Line - Enhanced */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out" />
                
                {/* Corner Accent */}
                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-bl-3xl`} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;
