import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VIDEO_SRC = '/videos/josoorcom-intro.mp4';
const POSTER_SRC = '/videos/josoorcom-intro-poster.jpg';
const FALLBACK_SRC = 'https://9775b4a5-557d-4e28-bd31-b5ad8a3936a7.lovableproject.com/__l5e/assets-v1/ea94c115-5819-4227-91e0-651aaf39dd2e/josoorcom-intro.mp4';

const IntroVideoSection = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  const safePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setPlaying(true);
          setUserPaused(false);
        })
        .catch(() => {
          // Autoplay was prevented by browser; try muted
          video.muted = true;
          setMuted(true);
          video
            .play()
            .then(() => {
              setPlaying(true);
              setUserPaused(false);
            })
            .catch(() => {
              setPlaying(false);
            });
        });
    }
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    const video = videoRef.current;
    if (!el || !video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (entry.intersectionRatio > 0.4 && !userPaused) {
            safePlay();
          }
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.4, 0.75] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [userPaused, safePlay]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      safePlay();
    } else {
      video.pause();
      setPlaying(false);
      setUserPaused(true);
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const toggleFullscreen = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen rejection
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPos = (e.clientX - rect.left) / rect.width;
    video.currentTime = clickPos * video.duration;
  };

  return (
    <section
      ref={sectionRef}
      id="intro-video"
      className="relative overflow-hidden bg-gradient-to-b from-background via-muted/30 to-background py-16 md:py-24"
    >
      <div className="container mx-auto px-4">
        <div
          className={`mx-auto max-w-4xl text-center transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-3">تعرّف على منصة جسوركم</h2>
          <p className="text-muted-foreground mb-8 md:mb-10">
            شاهد جولة سريعة تشرح كيف تساعدك المنصة على التعلّم والتدريس بسهولة
          </p>
        </div>

        <div
          className={`mx-auto max-w-5xl transition-all duration-1000 ${
            visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-[0.97]'
          }`}
        >
          <div
            ref={containerRef}
            className="group relative rounded-2xl overflow-hidden border border-border shadow-2xl bg-black cursor-pointer select-none"
            onClick={() => togglePlay()}
          >
            <video
              ref={videoRef}
              className="w-full h-auto block aspect-video object-cover"
              poster={POSTER_SRC}
              muted={muted}
              loop
              playsInline
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
            >
              <source src={VIDEO_SRC} type="video/mp4" />
              <source src={FALLBACK_SRC} type="video/mp4" />
              متصفحك لا يدعم تشغيل هذا الفيديو مباشرة.
            </video>

            {/* Gradient Overlays */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-70 group-hover:opacity-90 transition-opacity" />

            {/* Large Center Play/Pause Button */}
            {!playing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                <button
                  type="button"
                  className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary/95 text-primary-foreground flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 border-2 border-white/20"
                  onClick={(e) => togglePlay(e)}
                  aria-label="تشغيل الفيديو"
                >
                  <Play className="h-9 w-9 md:h-11 md:w-11 translate-x-0.5 fill-current" />
                </button>
              </div>
            )}

            {/* Progress Bar (at very bottom) */}
            <div
              className="absolute bottom-0 inset-x-0 h-1.5 bg-white/20 hover:h-2.5 transition-all cursor-pointer z-10"
              onClick={handleSeek}
              title="تقديم / ترجيع الفيديو"
            >
              <div
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Controls Bar */}
            <div className="absolute bottom-3 start-4 end-4 flex items-center justify-between pointer-events-auto z-10">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="rounded-full shadow-lg backdrop-blur bg-background/80 hover:bg-background h-9 w-9"
                  onClick={(e) => togglePlay(e)}
                  aria-label={playing ? 'إيقاف الفيديو' : 'تشغيل الفيديو'}
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="rounded-full shadow-lg backdrop-blur bg-background/80 hover:bg-background h-9 w-9"
                  onClick={(e) => toggleMute(e)}
                  aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                {muted && playing && (
                  <span
                    className="text-xs text-white/90 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full border border-white/10 hidden sm:inline-block cursor-pointer"
                    onClick={(e) => toggleMute(e)}
                  >
                    الصوت مكتوم - اضغط لإلغاء الكتم
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="rounded-full shadow-lg backdrop-blur bg-background/80 hover:bg-background h-9 w-9"
                  onClick={(e) => toggleFullscreen(e)}
                  aria-label={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default IntroVideoSection;
