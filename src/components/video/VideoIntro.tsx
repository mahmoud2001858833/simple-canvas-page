import { useEffect, useRef, useState } from 'react';
import introAsset from '@/assets/josoorcom-intro-v3.mp4.asset.json';
import { useLanguage } from '@/contexts/LanguageContext';

interface VideoIntroProps {
  title: string;
  subtitle?: string;
  instructor?: string;
  onFinish: () => void;
}

/** اللحظة التي يكتمل فيها تجميع اللوح الأخضر في المقدمة (بالثواني) */
const BOARD_READY_AT = 5.35;

/**
 * مقدمة تلقائية تُعرض قبل تشغيل الفيديو الأصلي،
 * وتُكتب عليها بيانات الدرس (العنوان، الدورة، المعلم) فوق اللوح الأخضر
 * مع حركة أنيقة تتناغم مع حركة اللوح.
 */
export const VideoIntro = ({ title, subtitle, instructor, onFinish }: VideoIntroProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [progress, setProgress] = useState(0); // 0 → 1 بعد اكتمال اللوح
  const finishedRef = useRef(false);
  const rafRef = useRef<number>();

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => finish());

    const tick = () => {
      const t = v.currentTime;
      const p = Math.min(1, Math.max(0, (t - BOARD_READY_AT) / 1.1));
      setProgress(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const failSafe = setTimeout(finish, 16000);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(failSafe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // منحنى تنعيم أنيق (ease-out-expo)
  const eased = progress === 0 ? 0 : 1 - Math.pow(2, -10 * progress);
  // تنفّس خفيف يجعل النص يتحرك مع اللوح بدل أن يبدو ملصوقاً
  const time = (videoRef.current?.currentTime ?? 0);
  const float = Math.sin(time * 1.6) * 0.35 * eased;

  return (
    <div className="absolute inset-0 z-30 bg-black flex items-center justify-center">
      {/* الحاوية تطابق مساحة الفيديو 16:9 حتى يجلس النص فوق اللوح تماماً */}
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="relative w-full max-h-full aspect-video">
          <video
            ref={videoRef}
            src={introAsset.url}
            className="absolute inset-0 w-full h-full object-contain"
            playsInline
            onEnded={finish}
            onError={finish}
          />

          {/* نص فوق اللوح الأخضر */}
          <div
            className="absolute inset-0 pointer-events-none"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div
              className="absolute flex flex-col items-center justify-center text-center"
              data-board-text
              style={{
                left: '25.5%',
                right: '25.5%',
                top: '27%',
                bottom: '17%',
                opacity: eased,
                transform: `translateY(${(1 - eased) * 24 + float}px) scale(${0.95 + eased * 0.05})`,
                filter: `blur(${(1 - eased) * 5}px)`,
              }}
            >
              <h2
                className="font-black leading-[1.15] w-full"
                style={{
                  color: '#EBC873',
                  fontSize: 'clamp(1.1rem, 3.6vw, 3.4rem)',
                  letterSpacing: '-0.01em',
                  textShadow: '0 2px 0 #8E6A1E, 0 6px 16px rgba(0,0,0,0.5)',
                }}
              >
                {title}
              </h2>

              <div
                className="mx-auto"
                style={{
                  marginTop: '3.5%',
                  marginBottom: '3.5%',
                  height: 3,
                  borderRadius: 3,
                  width: `${20 + eased * 45}%`,
                  background:
                    'linear-gradient(90deg, transparent, #EBC873, #FAEBBE, #EBC873, transparent)',
                  opacity: Math.max(0, (eased - 0.2) / 0.8),
                }}
              />

              {subtitle && (
                <p
                  className="font-semibold w-full"
                  style={{
                    color: '#E7DCBC',
                    fontSize: 'clamp(0.7rem, 1.9vw, 1.7rem)',
                    opacity: Math.max(0, (eased - 0.25) / 0.75),
                    transform: `translateY(${(1 - eased) * 14}px)`,
                    textShadow: '0 2px 8px rgba(0,0,0,0.45)',
                  }}
                >
                  {subtitle}
                </p>
              )}

              {instructor && (
                <p
                  className="font-bold w-full"
                  style={{
                    marginTop: '2.5%',
                    color: '#F3E3B4',
                    fontSize: 'clamp(0.75rem, 2.2vw, 2rem)',
                    opacity: Math.max(0, (eased - 0.45) / 0.55),
                    transform: `translateY(${(1 - eased) * 10}px)`,
                    textShadow: '0 2px 0 #8E6A1E, 0 5px 12px rgba(0,0,0,0.45)',
                  }}
                >
                  {instructor}
                </p>
              )}
            </div>
          </div>
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
