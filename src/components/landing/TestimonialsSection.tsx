import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const TestimonialsSection = () => {
  const { language } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  // Parallax transforms
  const headerY = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const cardsY = useTransform(scrollYProgress, [0, 1], [30, -30]);
  const leftGlowY = useTransform(scrollYProgress, [0, 1], [-40, 40]);
  const rightGlowY = useTransform(scrollYProgress, [0, 1], [40, -40]);

  const testimonials = [
    {
      name: language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohammed',
      role: language === 'ar' ? 'طالب هندسة' : 'Engineering Student',
      university: language === 'ar' ? 'جهة الملك سعود' : 'King Saud University',
      content: language === 'ar'
        ? 'المنصة ساعدتني كثيراً في فهم المواد الصعبة. الشرح واضح والمدرسين ممتازين!'
        : 'The platform helped me a lot in understanding difficult subjects. Clear explanations and excellent instructors!',
      rating: 5,
      avatar: 'A',
    },
    {
      name: language === 'ar' ? 'سارة العتيبي' : 'Sara Al-Otaibi',
      role: language === 'ar' ? 'طالبة طب' : 'Medical Student',
      university: language === 'ar' ? 'جهة الملك عبدالعزيز' : 'King Abdulaziz University',
      content: language === 'ar'
        ? 'أفضل منصة تعليمية استخدمتها. الدروس المباشرة تفاعلية جداً والتسجيلات واضحة.'
        : 'Best educational platform I have used. Live lessons are very interactive and recordings are clear.',
      rating: 5,
      avatar: 'S',
    },
    {
      name: language === 'ar' ? 'خالد الشمري' : 'Khalid Al-Shammari',
      role: language === 'ar' ? 'طالب إدارة أعمال' : 'Business Student',
      university: language === 'ar' ? 'جهة القصيم' : 'Qassim University',
      content: language === 'ar'
        ? 'نظام الدفع المرن ساعدني كثيراً. والشهادات المعتمدة أضافت قيمة كبيرة لسيرتي الذاتية.'
        : 'Flexible payment system helped me a lot. Certified certificates added great value to my CV.',
      rating: 5,
      avatar: 'K',
    },
  ];

  return (
    <section ref={sectionRef} className="py-24 bg-muted/30 relative overflow-hidden">
      {/* Background Elements with Parallax */}
      <motion.div 
        className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" 
        style={{ y: leftGlowY }}
      />
      <motion.div 
        className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" 
        style={{ y: rightGlowY }}
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header with Parallax */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ y: headerY }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-ocean to-secondary bg-clip-text text-transparent">
            {language === 'ar' ? 'ماذا يقول طلابنا' : 'What Our Students Say'}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {language === 'ar'
              ? 'آراء حقيقية من طلاب استفادوا من المنصة'
              : 'Real reviews from students who benefited from the platform'}
          </p>
        </motion.div>

        {/* Testimonials Grid with Parallax */}
        <motion.div className="grid md:grid-cols-3 gap-8" style={{ y: cardsY }}>
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ 
                y: -10,
                scale: 1.02,
                transition: { duration: 0.3, ease: "easeOut" }
              }}
              className="relative group cursor-pointer"
            >
              <div className="h-full p-8 rounded-2xl bg-card border border-border/50 shadow-elegant hover:shadow-xl hover:border-secondary/40 transition-all duration-500 overflow-hidden">
                {/* Background Glow Effects */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-primary/10 to-transparent opacity-0 group-hover:opacity-100 blur-2xl transition-all duration-700" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 blur-2xl transition-all duration-700 delay-100" />
                
                {/* Quote Icon - Enhanced */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.3 }}
                >
                  <Quote className="w-10 h-10 text-primary/20 mb-4 group-hover:text-primary/40 transition-colors duration-300" />
                </motion.div>

                {/* Content */}
                <p className="text-foreground/80 mb-6 leading-relaxed text-lg group-hover:text-foreground/90 transition-colors duration-300">
                  "{testimonial.content}"
                </p>

                {/* Rating - Enhanced Animation */}
                <div className="flex gap-1 mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.2, rotate: 15 }}
                      transition={{ duration: 0.2, delay: i * 0.05 }}
                    >
                      <Star className="w-5 h-5 fill-primary text-primary group-hover:fill-secondary group-hover:text-secondary transition-colors duration-300" />
                    </motion.div>
                  ))}
                </div>

                {/* Author - Enhanced */}
                <div className="flex items-center gap-4">
                  <motion.div 
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300"
                    whileHover={{ rotate: [0, -5, 5, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    {testimonial.avatar}
                  </motion.div>
                  <div>
                    <h4 className="font-bold group-hover:text-primary transition-colors duration-300">{testimonial.name}</h4>
                    <p className="text-sm text-muted-foreground group-hover:text-foreground/70 transition-colors duration-300">
                      {testimonial.role} • {testimonial.university}
                    </p>
                  </div>
                </div>

                {/* Bottom Decorative Line */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
