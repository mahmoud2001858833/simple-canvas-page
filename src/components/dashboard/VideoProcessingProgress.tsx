import { useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, Clock, Zap, FileVideo, Upload } from 'lucide-react';

interface VideoProcessingProgressProps {
  progress: number; // 0-100
  message: string;
  isActive: boolean;
  language: 'ar' | 'en';
}

interface Step {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: React.ReactNode;
  range: [number, number]; // progress range
}

const STEPS: Step[] = [
  { id: 'fetch', labelAr: 'تحميل الفيديو', labelEn: 'Downloading video', icon: <FileVideo className="w-4 h-4" />, range: [0, 10] },
  { id: 'ffmpeg', labelAr: 'تحميل المحرك', labelEn: 'Loading engine', icon: <Zap className="w-4 h-4" />, range: [10, 15] },
  { id: 'process', labelAr: 'معالجة الفيديو', labelEn: 'Processing video', icon: <Loader2 className="w-4 h-4 animate-spin" />, range: [15, 90] },
  { id: 'finalize', labelAr: 'إنهاء المعالجة', labelEn: 'Finalizing', icon: <CheckCircle className="w-4 h-4" />, range: [90, 95] },
  { id: 'upload', labelAr: 'رفع الفيديو', labelEn: 'Uploading', icon: <Upload className="w-4 h-4" />, range: [95, 100] },
];

const VideoProcessingProgress = ({ progress, message, isActive, language }: VideoProcessingProgressProps) => {
  const startTimeRef = useRef<number>(0);
  const [eta, setEta] = useState<string>('');
  const isRTL = language === 'ar';

  useEffect(() => {
    if (isActive && progress <= 1) {
      startTimeRef.current = Date.now();
      setEta('');
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive || progress <= 2 || progress >= 100) {
      if (progress >= 100) setEta(isRTL ? 'اكتمل!' : 'Done!');
      return;
    }

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    if (elapsed < 2) return; // Wait at least 2s before estimating

    const rate = progress / elapsed;
    const remaining = (100 - progress) / rate;

    if (remaining < 60) {
      setEta(isRTL ? `~${Math.ceil(remaining)} ثانية متبقية` : `~${Math.ceil(remaining)}s remaining`);
    } else {
      const mins = Math.floor(remaining / 60);
      const secs = Math.ceil(remaining % 60);
      setEta(isRTL ? `~${mins}د ${secs}ث متبقية` : `~${mins}m ${secs}s remaining`);
    }
  }, [progress, isActive, isRTL]);

  if (!isActive) return null;

  const currentStepIndex = STEPS.findIndex(s => progress >= s.range[0] && progress < s.range[1]);
  const activeStep = currentStepIndex >= 0 ? currentStepIndex : STEPS.length - 1;

  return (
    <div className="rounded-xl border bg-card/80 backdrop-blur-sm p-5 space-y-4 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Main progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{message}</span>
          <span className="font-mono text-primary font-bold text-base">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-3" />
        {eta && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>{eta}</span>
          </div>
        )}
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isDone = progress >= step.range[1];
          const isCurrent = i === activeStep;
          return (
            <div key={step.id} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full h-1.5 rounded-full transition-all duration-500 ${
                isDone ? 'bg-primary' : isCurrent ? 'bg-primary/50' : 'bg-muted'
              }`} />
              <div className={`flex items-center gap-1 text-[10px] transition-colors ${
                isDone ? 'text-primary' : isCurrent ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {isDone ? <CheckCircle className="w-3 h-3 text-primary" /> : isCurrent ? step.icon : null}
                <span className="hidden sm:inline">{isRTL ? step.labelAr : step.labelEn}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VideoProcessingProgress;
