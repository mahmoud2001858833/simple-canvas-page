import { useOnboarding } from '@/contexts/OnboardingContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GraduationCap, BookOpen, FileText, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

const WelcomeModal = () => {
  const { showWelcomeModal, markWelcomeSeen, skipAllOnboarding } = useOnboarding();
  const { language, dir } = useLanguage();

  const texts = {
    ar: {
      title: 'مرحباً بك في جسوركم! 🎓',
      subtitle: 'منصتك التعليمية للتميز الأكاديمي',
      features: [
        {
          icon: BookOpen,
          title: 'دورات متخصصة',
          description: 'تصفح مكتبة واسعة من الدورات المصممة لجهتك وتخصصك',
        },
        {
          icon: FileText,
          title: 'طلب شرح مخصص',
          description: 'ارفع ملفاتك واحصل على شرح مخصص من أفضل المدرسين',
        },
        {
          icon: Trophy,
          title: 'شهادات معتمدة',
          description: 'احصل على شهادات إتمام عند إكمال الدورات',
        },
      ],
      startButton: 'ابدأ الجولة التعريفية',
      skipTourButton: 'تخطي الجولة',
      skipAllButton: 'تخطي الكل ولا تظهر مجدداً',
    },
    en: {
      title: 'Welcome to Jasorkom! 🎓',
      subtitle: 'Your educational platform for academic excellence',
      features: [
        {
          icon: BookOpen,
          title: 'Specialized Courses',
          description: 'Browse a wide library of courses designed for your university and major',
        },
        {
          icon: FileText,
          title: 'Custom Course Requests',
          description: 'Upload your files and get custom explanations from top instructors',
        },
        {
          icon: Trophy,
          title: 'Certified Certificates',
          description: 'Earn completion certificates when you finish courses',
        },
      ],
      startButton: 'Start Guided Tour',
      skipTourButton: 'Skip Tour',
      skipAllButton: 'Skip All & Don\'t Show Again',
    },
  };

  const t = texts[language === 'ar' ? 'ar' : 'en'];

  return (
    <Dialog open={showWelcomeModal} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-lg overflow-hidden p-0" 
        dir={dir}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-8 text-center text-primary-foreground">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center backdrop-blur"
          >
            <GraduationCap className="w-10 h-10" />
          </motion.div>
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-bold text-primary-foreground">
              {t.title}
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80">
              {t.subtitle}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Features */}
        <div className="p-6 space-y-4">
          {t.features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: language === 'ar' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-3">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={markWelcomeSeen}
              className="flex-1"
            >
              {t.skipTourButton}
            </Button>
            <Button
              onClick={markWelcomeSeen}
              className="flex-1 bg-gradient-to-r from-primary to-primary/80"
            >
              {t.startButton}
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={skipAllOnboarding}
            className="w-full text-muted-foreground hover:text-foreground"
            size="sm"
          >
            {t.skipAllButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { WelcomeModal };
export default WelcomeModal;
