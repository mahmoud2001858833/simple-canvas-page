import { useEffect, useState, useRef } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingTooltipProps {
  className?: string;
}

export const OnboardingTooltip = ({ className }: OnboardingTooltipProps) => {
  const { currentStepData, state, steps, nextStep, prevStep, skipOnboarding } = useOnboarding();
  const { language, dir } = useLanguage();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isRTL = dir === 'rtl';

  useEffect(() => {
    if (!currentStepData) return;

    const targetElement = document.querySelector(currentStepData.target);
    if (!targetElement) return;

    const updatePosition = () => {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect(rect);

      const tooltipHeight = tooltipRef.current?.offsetHeight || 150;
      const tooltipWidth = tooltipRef.current?.offsetWidth || 300;
      const padding = 16;

      let top = 0;
      let left = 0;

      switch (currentStepData.placement) {
        case 'top':
          top = rect.top - tooltipHeight - padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'bottom':
          top = rect.bottom + padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - padding;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + padding;
          break;
      }

      // Keep tooltip within viewport
      left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
      top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

      setPosition({ top, left });
    };

    updatePosition();

    // Scroll element into view
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add highlight to target
    targetElement.classList.add('onboarding-highlight');

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      targetElement.classList.remove('onboarding-highlight');
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [currentStepData]);

  if (!currentStepData || !state.isOnboardingActive) return null;

  const title = language === 'ar' ? currentStepData.title_ar : currentStepData.title;
  const description = language === 'ar' ? currentStepData.description_ar : currentStepData.description;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[9998] pointer-events-none" />
      
      {/* Highlight cutout */}
      {targetRect && (
        <div
          className="fixed z-[9999] rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] pointer-events-none"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence>
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`fixed z-[10000] bg-card border border-border rounded-xl shadow-2xl p-4 w-80 ${className}`}
          style={{ top: position.top, left: position.left }}
          dir={dir}
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={skipOnboarding}
            className="absolute top-2 end-2 h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Content */}
          <div className="pe-8">
            <h4 className="font-semibold text-lg mb-2 text-foreground">{title}</h4>
            <p className="text-muted-foreground text-sm mb-4">{description}</p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-1 mb-4">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  index <= state.currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={prevStep}
              disabled={state.currentStep === 0}
              className="text-muted-foreground"
            >
              {isRTL ? <ChevronRight className="h-4 w-4 me-1" /> : <ChevronLeft className="h-4 w-4 me-1" />}
              {language === 'ar' ? 'السابق' : 'Previous'}
            </Button>

            <span className="text-xs text-muted-foreground">
              {state.currentStep + 1} / {steps.length}
            </span>

            <Button
              size="sm"
              onClick={nextStep}
              className="bg-primary text-primary-foreground"
            >
              {state.currentStep === steps.length - 1 
                ? (language === 'ar' ? 'إنهاء' : 'Finish')
                : (language === 'ar' ? 'التالي' : 'Next')
              }
              {state.currentStep < steps.length - 1 && (
                isRTL ? <ChevronLeft className="h-4 w-4 ms-1" /> : <ChevronRight className="h-4 w-4 ms-1" />
              )}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};
