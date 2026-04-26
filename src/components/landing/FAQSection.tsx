import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { HelpCircle, ChevronDown } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { openChatWidget } from '@/components/ai-assistant/ChatWidget';

const FAQSection = () => {
  const { language } = useLanguage();

  const faqs = [
    {
      question: language === 'ar' ? 'كيف يمكنني التسجيل في المنصة؟' : 'How can I register on the platform?',
      answer: language === 'ar'
        ? 'يمكنك التسجيل مجاناً من خلال الضغط على زر "إنشاء حساب" وإدخال بياناتك الأساسية. ستحتاج إلى بريد إلكتروني صالح ورقم جوال للتأكيد.'
        : 'You can register for free by clicking the "Create Account" button and entering your basic information. You will need a valid email and phone number for confirmation.',
      icon: '🚀',
    },
    {
      question: language === 'ar' ? 'هل يمكنني طلب مادة غير متوفرة؟' : 'Can I request a course that is not available?',
      answer: language === 'ar'
        ? 'نعم! نوفر خدمة طلب المواد المخصصة. يمكنك رفع متطلباتك وسيقوم فريقنا بإعداد المادة خصيصاً لك مع مدرس متخصص.'
        : 'Yes! We provide custom course request service. You can upload your requirements and our team will prepare the course specifically for you with a specialized instructor.',
      icon: '📚',
    },
    {
      question: language === 'ar' ? 'ما هي طرق الدفع المتاحة؟' : 'What payment methods are available?',
      answer: language === 'ar'
        ? 'نوفر عدة طرق للدفع تشمل: البطاقات الائتمانية، Apple Pay، مدى، والتقسيط عبر تابي. كما نوفر إمكانية الدفع بالتحويل البنكي.'
        : 'We offer several payment methods including: credit cards, Apple Pay, Mada, and installments through Tabby. We also offer bank transfer payment.',
      icon: '💳',
    },
    {
      question: language === 'ar' ? 'هل يمكنني مشاهدة الدروس في أي وقت؟' : 'Can I watch lessons anytime?',
      answer: language === 'ar'
        ? 'نعم، جميع الدروس المسجلة متاحة على مدار الساعة. أما الدروس المباشرة فيتم تسجيلها تلقائياً لتتمكن من مشاهدتها لاحقاً.'
        : 'Yes, all recorded lessons are available 24/7. Live lessons are automatically recorded so you can watch them later.',
      icon: '⏰',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' as const },
    },
  };

  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <motion.div
          className="absolute top-40 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-40 right-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl"
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, delay: 2 }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4"
            whileHover={{ scale: 1.05 }}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="font-medium">{language === 'ar' ? 'لديك سؤال؟' : 'Have a question?'}</span>
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-ocean to-secondary bg-clip-text text-transparent">
            {language === 'ar' ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {language === 'ar'
              ? 'إجابات على أكثر الأسئلة شيوعاً'
              : 'Answers to the most common questions'}
          </p>
        </motion.div>

        {/* FAQ Accordion - Enhanced */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
              >
                <AccordionItem
                  value={`item-${index}`}
                  className="group bg-card border border-border/50 rounded-xl px-6 shadow-sm hover:shadow-lg hover:border-primary/30 data-[state=open]:shadow-xl data-[state=open]:border-primary/50 data-[state=open]:bg-gradient-to-br data-[state=open]:from-card data-[state=open]:to-primary/5 transition-all duration-300 overflow-hidden"
                >
                  {/* Decorative Top Line */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent scale-x-0 group-hover:scale-x-100 group-data-[state=open]:scale-x-100 transition-transform duration-500" />
                  
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6 group-hover:text-primary transition-colors duration-300">
                    <div className="flex items-center gap-4">
                      <motion.span
                        className="text-2xl"
                        whileHover={{ scale: 1.2, rotate: [0, -10, 10, 0] }}
                        transition={{ duration: 0.3 }}
                      >
                        {faq.icon}
                      </motion.span>
                      <span className="text-start">{faq.question}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="ps-12 border-s-2 border-primary/20 ms-3"
                    >
                      {faq.answer}
                    </motion.div>
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </motion.div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center mt-12"
        >
          <p className="text-muted-foreground mb-4">
            {language === 'ar' ? 'لم تجد إجابة سؤالك؟' : "Didn't find your answer?"}
          </p>
          <motion.button
            onClick={() => openChatWidget()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-ocean text-white font-semibold shadow-lg hover:shadow-xl transition-shadow duration-300"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            {language === 'ar' ? 'تواصل معنا' : 'Contact Us'}
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              →
            </motion.span>
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQSection;