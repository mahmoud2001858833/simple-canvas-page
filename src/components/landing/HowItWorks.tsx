import { motion } from 'framer-motion';
import { UserPlus, Search, BookOpen } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const HowItWorks = () => {
  const { language, dir } = useLanguage();

  const steps = [
    {
      icon: UserPlus,
      title: language === 'ar' ? 'إنشاء حساب' : 'Create Account',
      description: language === 'ar' 
        ? 'سجل مجاناً واختر تخصصك وجهتك'
        : 'Sign up for free and choose your major and university',
      color: 'from-emerald-500 to-teal-500',
    },
    {
      icon: Search,
      title: language === 'ar' ? 'اختر المادة' : 'Choose Course',
      description: language === 'ar'
        ? 'تصفح المواد المتوفرة أو اطلب مادة مخصصة'
        : 'Browse available courses or request a custom one',
      color: 'from-amber-500 to-yellow-500',
    },
    {
      icon: BookOpen,
      title: language === 'ar' ? 'ابدأ التعلم' : 'Start Learning',
      description: language === 'ar'
        ? 'شاهد الدروس المباشرة أو المسجلة بأي وقت'
        : 'Watch live or recorded lessons anytime',
      color: 'from-green-500 to-emerald-500',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: 'easeOut' as const,
      },
    },
  };

  return (
    <section className="py-24 bg-gradient-to-b from-background via-accent/5 to-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%23d4af37%22%20fill-opacity%3D%220.05%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2020h40v1H0z%22%2F%3E%3Cpath%20d%3D%22M20%200v40h1V0z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')]" />
      
      {/* Background Glow Effects */}
      <motion.div
        className="absolute top-20 left-1/4 w-64 h-64 bg-accent/15 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-20 right-1/4 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-emerald-600 via-accent to-yellow-500 bg-clip-text text-transparent">
            {language === 'ar' ? 'كيف تبدأ؟' : 'How It Works?'}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {language === 'ar' 
              ? 'ثلاث خطوات بسيطة للبدء في رحلتك التعليمية'
              : 'Three simple steps to start your learning journey'}
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto relative"
        >
          {/* Connection Line - Enhanced */}
          <div className="hidden md:block absolute top-16 left-[12%] right-[12%] h-1 bg-gradient-to-r from-emerald-500/20 via-accent/50 to-emerald-500/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full w-1/4 bg-gradient-to-r from-transparent via-white/50 to-transparent"
              animate={{ x: ['-100%', '500%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </div>

          {steps.map((step, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="relative group cursor-pointer"
            >
              <motion.div
                className="flex flex-col items-center text-center"
                whileHover={{ y: -8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {/* Step Number & Icon - Enhanced */}
                <motion.div
                  className="relative mb-6"
                  whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  {/* Glow Effect */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${step.color} rounded-2xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500`} />
                  
                  <div className={`w-20 h-20 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl relative z-10 transition-shadow duration-300`}>
                    <step.icon className="w-10 h-10 text-white group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  
                  {/* Step Number Badge - Enhanced */}
                  <motion.div
                    className="absolute -top-2 ltr:-right-2 rtl:-left-2 w-8 h-8 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center text-white font-bold text-sm z-20 shadow-lg"
                    whileHover={{ scale: 1.2, rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    {index + 1}
                  </motion.div>
                </motion.div>

                {/* Content - Enhanced */}
                <h3 className="text-xl font-bold mb-3 group-hover:text-emerald-600 dark:group-hover:text-accent transition-colors duration-300">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors duration-300">
                  {step.description}
                </p>

                {/* Bottom Accent Line */}
                <div className={`mt-4 h-1 w-0 group-hover:w-16 bg-gradient-to-r ${step.color} rounded-full transition-all duration-500`} />
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;