import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface Props {
  onDetected: (minutes: number) => void;
}

export const VideoDurationDetector = ({ onDetected }: Props) => {
  const { language } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    video.onloadedmetadata = () => {
      const minutes = Math.max(1, Math.round(video.duration / 60));
      URL.revokeObjectURL(url);
      onDetected(minutes);
      setBusy(false);
      toast.success(
        language === 'ar'
          ? `تم تحديد المدة: ${minutes} دقيقة`
          : `Detected duration: ${minutes} min`
      );
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      setBusy(false);
      toast.error(
        language === 'ar' ? 'تعذر قراءة مدة الفيديو' : 'Failed to read video duration'
      );
    };
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="w-4 h-4 me-2 animate-spin" />
        ) : (
          <Clock className="w-4 h-4 me-2" />
        )}
        {language === 'ar' ? 'تحديد المدة تلقائياً' : 'Auto-detect duration'}
      </Button>
    </>
  );
};
