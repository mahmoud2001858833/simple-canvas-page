import { useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  X, 
  CheckCircle, 
  Video, 
  Loader2,
  Film
} from 'lucide-react';
import { cn } from '@/lib/utils';

const WORKER_URL = 'https://alkaser-upload.jowmahmoud6.workers.dev';
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

interface VideoQuality {
  key: '480p' | '720p' | '1080p';
  label: string;
  url: string;
}

interface MultiQualityVideoUploaderProps {
  currentUrls?: {
    default?: string;
    '480p'?: string;
    '720p'?: string;
    '1080p'?: string;
  };
  onUploadComplete: (quality: string, objectKey: string) => void;
  onUploadError: (error: string) => void;
  language?: 'ar' | 'en';
  disabled?: boolean;
}

export interface MultiQualityVideoUploaderRef {
  reset: () => void;
}

interface UploadState {
  file: File | null;
  progress: number;
  status: 'idle' | 'uploading' | 'completed' | 'error';
  error?: string;
}

const texts = {
  ar: {
    defaultVideo: 'الفيديو الأصلي',
    quality480: 'جودة 480p',
    quality720: 'جودة 720p',
    quality1080: 'جودة 1080p',
    dropVideo: 'اسحب الفيديو هنا أو اضغط للاختيار',
    uploading: 'جاري الرفع...',
    uploaded: 'تم الرفع',
    noVideo: 'لم يتم رفع فيديو',
    hasVideo: 'يوجد فيديو',
    replace: 'استبدال',
    cancel: 'إلغاء',
    supportedFormats: 'MP4, WebM, MOV',
  },
  en: {
    defaultVideo: 'Default Video',
    quality480: '480p Quality',
    quality720: '720p Quality',
    quality1080: '1080p Quality',
    dropVideo: 'Drop video here or click to select',
    uploading: 'Uploading...',
    uploaded: 'Uploaded',
    noVideo: 'No video uploaded',
    hasVideo: 'Has video',
    replace: 'Replace',
    cancel: 'Cancel',
    supportedFormats: 'MP4, WebM, MOV',
  },
};

const QualityUploader = ({
  quality,
  label,
  currentUrl,
  onUploadComplete,
  onUploadError,
  language = 'ar',
  disabled = false,
}: {
  quality: string;
  label: string;
  currentUrl?: string;
  onUploadComplete: (objectKey: string) => void;
  onUploadError: (error: string) => void;
  language?: 'ar' | 'en';
  disabled?: boolean;
}) => {
  const [state, setState] = useState<UploadState>({
    file: null,
    progress: 0,
    status: currentUrl ? 'completed' : 'idle',
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const t = texts[language];

  const validateFile = (file: File): boolean => {
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      onUploadError(language === 'ar' ? 'صيغة الفيديو غير مدعومة' : 'Unsupported video format');
      return false;
    }
    return true;
  };

  const handleFileSelection = (file: File) => {
    if (!validateFile(file)) return;
    setState({ file, progress: 0, status: 'idle' });
    handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelection(file);
  };

  const handleUpload = async (file: File) => {
    abortControllerRef.current = new AbortController();
    setState(prev => ({ ...prev, status: 'uploading', progress: 0 }));

    try {
      // Start upload
      const startRes = await fetch(`${WORKER_URL}/upload/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!startRes.ok) throw new Error('Failed to start upload');
      const { uploadId, key } = await startRes.json();

      // Upload parts
      const totalParts = Math.ceil(file.size / CHUNK_SIZE);
      const parts: { partNumber: number; etag: string }[] = [];

      for (let i = 0; i < totalParts; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const partRes = await fetch(
          `${WORKER_URL}/upload/part?uploadId=${uploadId}&key=${encodeURIComponent(key)}&partNumber=${i + 1}`,
          {
            method: 'PUT',
            body: chunk,
            signal: abortControllerRef.current.signal,
          }
        );

        if (!partRes.ok) throw new Error(`Failed to upload part ${i + 1}`);
        const { etag } = await partRes.json();
        parts.push({ partNumber: i + 1, etag });

        setState(prev => ({ ...prev, progress: Math.round(((i + 1) / totalParts) * 100) }));
      }

      // Complete upload
      const completeRes = await fetch(`${WORKER_URL}/upload/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, key, parts }),
        signal: abortControllerRef.current.signal,
      });

      if (!completeRes.ok) throw new Error('Failed to complete upload');

      setState(prev => ({ ...prev, status: 'completed', progress: 100 }));
      onUploadComplete(key);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setState(prev => ({ ...prev, status: 'idle', progress: 0 }));
      } else {
        setState(prev => ({ ...prev, status: 'error', error: error.message }));
        onUploadError(error.message);
      }
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setState({ file: null, progress: 0, status: 'idle' });
  };

  const hasVideo = currentUrl || state.status === 'completed';

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">{label}</Label>
        </div>
        {hasVideo && (
          <Badge variant="outline" className="text-green-600 border-green-200">
            <CheckCircle className="w-3 h-3 me-1" />
            {t.hasVideo}
          </Badge>
        )}
      </div>

      {state.status === 'uploading' ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-muted-foreground">{t.uploading}</span>
            <span className="text-sm font-medium ms-auto">{state.progress}%</span>
          </div>
          <Progress value={state.progress} className="h-2" />
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="w-3 h-3 me-1" />
            {t.cancel}
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
            disabled={disabled}
          />
          <Upload className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {hasVideo ? t.replace : t.dropVideo}
          </p>
        </div>
      )}
    </div>
  );
};

export const MultiQualityVideoUploader = forwardRef<MultiQualityVideoUploaderRef, MultiQualityVideoUploaderProps>(
  ({ currentUrls, onUploadComplete, onUploadError, language = 'ar', disabled = false }, ref) => {
    const t = texts[language];

    useImperativeHandle(ref, () => ({
      reset: () => {},
    }));

    const qualities = [
      { key: 'default', label: t.defaultVideo, url: currentUrls?.default },
      { key: '480p', label: t.quality480, url: currentUrls?.['480p'] },
      { key: '720p', label: t.quality720, url: currentUrls?.['720p'] },
      { key: '1080p', label: t.quality1080, url: currentUrls?.['1080p'] },
    ];

    return (
      <div className="space-y-3">
        {qualities.map(({ key, label, url }) => (
          <QualityUploader
            key={key}
            quality={key}
            label={label}
            currentUrl={url}
            onUploadComplete={(objectKey) => onUploadComplete(key, objectKey)}
            onUploadError={onUploadError}
            language={language}
            disabled={disabled}
          />
        ))}
        <p className="text-xs text-muted-foreground text-center">
          {t.supportedFormats}
        </p>
      </div>
    );
  }
);

MultiQualityVideoUploader.displayName = 'MultiQualityVideoUploader';
