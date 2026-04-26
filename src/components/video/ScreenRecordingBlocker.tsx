import { useLanguage } from '@/contexts/LanguageContext';
import { Shield, VideoOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScreenRecordingBlockerProps {
  onDismiss?: () => void;
}

export const ScreenRecordingBlocker = ({ onDismiss }: ScreenRecordingBlockerProps) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-md mx-auto p-8 text-center">
        {/* Warning Icon */}
        <div className="relative mx-auto mb-6">
          <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mx-auto animate-pulse">
            <VideoOff className="w-12 h-12 text-red-500" />
          </div>
          <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-4">
          {isRTL 
            ? 'تم اكتشاف تسجيل الشاشة!' 
            : 'Screen Recording Detected!'}
        </h1>

        {/* Description */}
        <p className="text-gray-400 mb-6 leading-relaxed">
          {isRTL 
            ? 'لقد اكتشفنا أنك تحاول تسجيل الشاشة. يرجى إيقاف التسجيل للمتابعة في مشاهدة الفيديو. هذه الحماية لضمان حقوق المحتوى.' 
            : 'We detected that you are trying to record the screen. Please stop recording to continue watching the video. This protection is to ensure content rights.'}
        </p>

        {/* Protection Badge */}
        <div className="flex items-center justify-center gap-2 text-primary mb-6">
          <Shield className="w-5 h-5" />
          <span className="text-sm font-medium">
            {isRTL ? 'محتوى محمي' : 'Protected Content'}
          </span>
        </div>

        {/* Instructions */}
        <div className="bg-white/5 rounded-xl p-4 mb-6 text-start">
          <h3 className="font-semibold text-white mb-3">
            {isRTL ? 'كيفية إيقاف التسجيل:' : 'How to stop recording:'}
          </h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              {isRTL 
                ? 'أوقف أي برنامج تسجيل شاشة مفتوح' 
                : 'Stop any screen recording software'}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              {isRTL 
                ? 'أغلق أي مشاركة شاشة نشطة' 
                : 'Close any active screen sharing'}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              {isRTL 
                ? 'أغلق وضع صورة في صورة (PiP)' 
                : 'Exit Picture-in-Picture mode'}
            </li>
          </ul>
        </div>

        {/* Retry Button */}
        {onDismiss && (
          <Button 
            onClick={onDismiss}
            className="w-full"
            size="lg"
          >
            {isRTL ? 'أوقفت التسجيل، تابع المشاهدة' : 'I stopped recording, continue watching'}
          </Button>
        )}

        {/* Footer Note */}
        <p className="text-xs text-gray-500 mt-4">
          {isRTL 
            ? 'هذا المحتوى محمي بحقوق الملكية الفكرية' 
            : 'This content is protected by intellectual property rights'}
        </p>
      </div>
    </div>
  );
};
