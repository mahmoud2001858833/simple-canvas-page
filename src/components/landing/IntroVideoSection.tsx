import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import videoAsset from '@/assets/josoorcom-intro.mp4.asset.json';
import posterAsset from '@/assets/josoorcom-intro-poster.jpg.asset.json';

const IntroVideoSection = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);


  useEffect(() => {
    const el = sectionRef.current;
    const video = videoRef.current;
    if (!el || !video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (entry.intersectionRatio > 0.5) {
            video.play().then(() => setPlaying(true)).catch(() => undefined);
          }
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.5, 0.75] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPlaying(true)).catch(() => undefined);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
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
          <div className="group relative rounded-2xl overflow-hidden border border-border shadow-2xl bg-card">
            <video
              ref={videoRef}
              className="w-full h-auto block aspect-video object-cover"
              src={videoAsset.url}
              poster={posterAsset.url}
              muted={muted}
              loop
              playsInline
              preload="metadata"
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent opacity-60" />

            <div className="absolute bottom-4 start-4 flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="rounded-full shadow-lg backdrop-blur"
                onClick={togglePlay}
                aria-label={playing ? 'إيقاف الفيديو' : 'تشغيل الفيديو'}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="rounded-full shadow-lg backdrop-blur"
                onClick={toggleMute}
                aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default IntroVideoSection;
