import { useEffect, useRef, useState } from 'react';
import introAsset from '@/assets/josoorcom-video-intro.mp4.asset.json';
import { useLanguage } from '@/contexts/LanguageContext';

interface VideoIntroProps {
  title: string;
  subtitle?: string;
  onFinish: () => void;
}

/**
 * مقدمة تلقائية تُعرض قبل تشغيل الفيديو الأصلي،
 * ويُكتب عليها عنوان الدرس تلقائياً.
 */
export const VideoIntro = ({ title, subtitle, onFinish }: VideoIntroProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [showTitle, setShowTitle] = useState(false);
  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => finish());
    const timer = setTimeout(() => setShowTitle(true), 900);
    // شبكة أمان في حال تعذّر تحميل المقدمة
    const failSafe = setTimeout(finish, 14000);
    return () => {
      clearTimeout(timer);
      clearTimeout(failSafe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 z-30 bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={introAsset.url}
        className="w-full h-full object-contain"
        playsInline
        onEnded={finish}
        onError={finish}
      />

      {/* لوحة العنوان في نهاية المقدمة */}
      <div
        className={`absolute inset-x-0 bottom-[10%] flex justify-center px-6 transition-all duration-700 ${
          showTitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="max-w-[85%] rounded-xl bg-background/85 backdrop-blur-md px-6 py-4 text-center shadow-lg border border-border">
          <h2 className="text-lg md:text-2xl font-bold text-foreground line-clamp-2">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-xs md:text-sm text-muted-foreground line-clamp-1">{subtitle}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={finish}
        className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} rounded-md bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background transition-colors`}
      >
        {isRTL ? 'تخطي المقدمة' : 'Skip intro'}
      </button>
    </div>
  );
};
