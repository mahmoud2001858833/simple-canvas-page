import { useEffect, useRef, useState } from 'react';
import introAsset from '@/assets/josoorcom-intro-blank.mp4.asset.json';
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
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div
              className="text-center absolute left-1/2 -translate-x-1/2 w-[52%]"
              data-board-text
              style={{
                top: '36%',
                opacity: eased,
                transform: `translate(-50%, ${(1 - eased) * 26 + float}px) scale(${0.94 + eased * 0.06})`,
                filter: `blur(${(1 - eased) * 6}px)`,
                textShadow: '0 2px 10px rgba(0,0,0,0.45)',
              }}
            >
              <h2
                className="font-extrabold leading-tight"
                style={{
                  color: '#E4BE63',
                  fontSize: 'clamp(0.9rem, 2.6vw, 2.2rem)',
                  letterSpacing: '0.01em',
                }}
              >
                {title}
              </h2>

              {subtitle && (
                <div
                  style={{
                    opacity: Math.max(0, (eased - 0.25) / 0.75),
                    transform: `translateY(${(1 - eased) * 14}px)`,
                  }}
                >
                  <div
                    className="mx-auto my-[2%]"
                    style={{
                      height: 2,
                      width: `${30 + eased * 40}%`,
                      background:
                        'linear-gradient(90deg, transparent, #D8C38A, transparent)',
                    }}
                  />
                  <p
                    style={{
                      color: '#E7DCBC',
                      fontSize: 'clamp(0.6rem, 1.5vw, 1.1rem)',
                    }}
                  >
                    {subtitle}
                  </p>
                </div>
              )}

              {instructor && (
                <p
                  className="mt-[1.5%] font-semibold"
                  style={{
                    color: '#F0DFAE',
                    fontSize: 'clamp(0.6rem, 1.6vw, 1.2rem)',
                    opacity: Math.max(0, (eased - 0.45) / 0.55),
                    transform: `translateY(${(1 - eased) * 10}px)`,
                  }}
                >
                  {isRTL ? `المعلم: ${instructor}` : `Instructor: ${instructor}`}
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
