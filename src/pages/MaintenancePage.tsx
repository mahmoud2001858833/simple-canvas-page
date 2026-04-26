import { motion } from 'framer-motion';
import { Construction, Wrench } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const MaintenancePage = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-lg"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-500/20 mb-8"
        >
          <Construction className="w-12 h-12 text-amber-400" />
        </motion.div>

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          {isRTL ? 'الموقع تحت الصيانة' : 'Under Maintenance'}
        </h1>
        
        <p className="text-lg text-slate-300 mb-8 leading-relaxed">
          {isRTL 
            ? 'نعمل حالياً على تحسين المنصة. سنعود قريباً بإذن الله. شكراً لصبركم.'
            : 'We are currently improving the platform. We will be back soon. Thank you for your patience.'}
        </p>

        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Wrench className="w-4 h-4" />
          <span className="text-sm">
            {isRTL ? 'فريق العمل يعمل على ذلك' : 'Our team is working on it'}
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default MaintenancePage;
