import { useState, useRef, useCallback, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  VIDEO_CONSTRAINTS, 
  validateVideoFile, 
  formatFileSize,
  getVideoAcceptString 
} from '@/lib/videoValidation';
import { Upload, Video, X, CheckCircle, AlertCircle, Pause, Play, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VideoUploaderProps {
  onUploadComplete: (videoUrl: string) => void;
  existingVideoUrl?: string;
  courseId?: string;
  lessonId?: string;
}

interface UploadState {
  status: 'idle' | 'uploading' | 'paused' | 'completed' | 'error';
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export const VideoUploader = ({ 
  onUploadComplete, 
  existingVideoUrl,
  courseId,
  lessonId 
}: VideoUploaderProps) => {
  const { dir } = useLanguage();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadStartTimeRef = useRef<number>(0);
  const lastProgressTimeRef = useRef<number>(0);
  const lastUploadedBytesRef = useRef<number>(0);
  
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingVideoUrl || null);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    remainingTime: 0,
  });

  // Store chunks for resume functionality
  const [uploadedChunks, setUploadedChunks] = useState<number>(0);
  const [filePath, setFilePath] = useState<string>('');

  const texts = {
    ar: {
      dropHere: 'اسحب الفيديو هنا',
      orClick: 'أو اضغط للاختيار',
      maxSize: `الحد الأقصى: ${VIDEO_CONSTRAINTS.maxSizeLabel}`,
      allowedTypes: `الأنواع: ${VIDEO_CONSTRAINTS.allowedExtensions.map(e => e.toUpperCase()).join(', ')}`,
      uploading: 'جاري الرفع...',
      uploadComplete: 'تم الرفع بنجاح',
      uploadError: 'فشل الرفع',
      removeFile: 'إزالة الملف',
      uploadButton: 'رفع الفيديو',
      changeVideo: 'تغيير الفيديو',
      currentVideo: 'الفيديو الحالي',
      pause: 'إيقاف مؤقت',
      resume: 'استئناف',
      retry: 'إعادة المحاولة',
      paused: 'متوقف مؤقتاً',
      speed: 'السرعة',
      remaining: 'المتبقي',
      uploaded: 'تم رفع',
      of: 'من',
    },
    en: {
      dropHere: 'Drop video here',
      orClick: 'or click to select',
      maxSize: `Maximum: ${VIDEO_CONSTRAINTS.maxSizeLabel}`,
      allowedTypes: `Types: ${VIDEO_CONSTRAINTS.allowedExtensions.map(e => e.toUpperCase()).join(', ')}`,
      uploading: 'Uploading...',
      uploadComplete: 'Upload complete',
      uploadError: 'Upload failed',
      removeFile: 'Remove file',
      uploadButton: 'Upload Video',
      changeVideo: 'Change Video',
      currentVideo: 'Current video',
      pause: 'Pause',
      resume: 'Resume',
      retry: 'Retry',
      paused: 'Paused',
      speed: 'Speed',
      remaining: 'Remaining',
      uploaded: 'Uploaded',
      of: 'of',
    },
  };

  const t = texts[language];

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond >= 1024 * 1024) {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    } else if (bytesPerSecond >= 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    }
    return `${bytesPerSecond.toFixed(0)} B/s`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return language === 'ar' ? `${Math.ceil(seconds)} ثانية` : `${Math.ceil(seconds)}s`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.ceil(seconds % 60);
      return language === 'ar' ? `${mins} دقيقة ${secs} ثانية` : `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return language === 'ar' ? `${hours} ساعة ${mins} دقيقة` : `${hours}h ${mins}m`;
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, []);

  const handleFileSelection = (file: File) => {
    setError(null);
    setUploadedChunks(0);
    setFilePath('');
    setUploadState({
      status: 'idle',
      progress: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      remainingTime: 0,
    });
    
    const validation = validateVideoFile(file);
    if (!validation.valid) {
      setError(validation.error?.[language] || 'Invalid file');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const updateProgress = (uploadedBytes: number, totalBytes: number) => {
    const now = Date.now();
    const timeDiff = (now - lastProgressTimeRef.current) / 1000; // seconds
    const bytesDiff = uploadedBytes - lastUploadedBytesRef.current;
    
    let speed = 0;
    if (timeDiff > 0.1) { // Update speed every 100ms minimum
      speed = bytesDiff / timeDiff;
      lastProgressTimeRef.current = now;
      lastUploadedBytesRef.current = uploadedBytes;
    }

    const remainingBytes = totalBytes - uploadedBytes;
    const remainingTime = speed > 0 ? remainingBytes / speed : 0;

    setUploadState(prev => ({
      ...prev,
      progress: Math.round((uploadedBytes / totalBytes) * 100),
      uploadedBytes,
      totalBytes,
      speed: speed > 0 ? speed : prev.speed,
      remainingTime: speed > 0 ? remainingTime : prev.remainingTime,
    }));
  };

  const handleUpload = async (resumeFromChunk: number = 0) => {
    if (!selectedFile) return;

    const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
    const totalBytes = selectedFile.size;
    
    // Generate file path if not resuming
    let currentFilePath = filePath;
    if (!currentFilePath) {
      const timestamp = Date.now();
      const extension = selectedFile.name.split('.').pop();
      const basePath = courseId && lessonId 
        ? `${courseId}/${lessonId}` 
        : courseId 
          ? `${courseId}` 
          : 'uploads';
      currentFilePath = `${basePath}/${timestamp}.${extension}`;
      setFilePath(currentFilePath);
    }

    abortControllerRef.current = new AbortController();
    uploadStartTimeRef.current = Date.now();
    lastProgressTimeRef.current = Date.now();
    lastUploadedBytesRef.current = resumeFromChunk * CHUNK_SIZE;

    setUploadState({
      status: 'uploading',
      progress: Math.round((resumeFromChunk * CHUNK_SIZE / totalBytes) * 100),
      uploadedBytes: resumeFromChunk * CHUNK_SIZE,
      totalBytes,
      speed: 0,
      remainingTime: 0,
    });
    setError(null);

    try {
      // For smaller files, upload directly with XMLHttpRequest for real progress
      if (selectedFile.size <= CHUNK_SIZE * 2) {
        await uploadWithProgress(selectedFile, currentFilePath, totalBytes);
      } else {
        // For larger files, upload in chunks
        for (let chunkIndex = resumeFromChunk; chunkIndex < totalChunks; chunkIndex++) {
          // Check if paused
          if (abortControllerRef.current?.signal.aborted) {
            setUploadState(prev => ({ ...prev, status: 'paused' }));
            return;
          }

          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
          const chunk = selectedFile.slice(start, end);

          // Upload chunk
          const chunkPath = chunkIndex === totalChunks - 1 
            ? currentFilePath 
            : `${currentFilePath}.part${chunkIndex}`;

          const { error: uploadError } = await supabase.storage
            .from('course-videos')
            .upload(chunkPath, chunk, {
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadError) throw uploadError;

          setUploadedChunks(chunkIndex + 1);
          updateProgress(end, totalBytes);
        }
      }

      // Upload complete
      setUploadState(prev => ({
        ...prev,
        status: 'completed',
        progress: 100,
        uploadedBytes: totalBytes,
      }));

      setUploadedUrl(currentFilePath);
      onUploadComplete(currentFilePath);
      toast.success(t.uploadComplete);
      setSelectedFile(null);

    } catch (err: any) {
      if (err.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        setUploadState(prev => ({ ...prev, status: 'paused' }));
      } else {
        console.error('Upload error:', err);
        setError(err.message || t.uploadError);
        setUploadState(prev => ({ ...prev, status: 'error' }));
        toast.error(t.uploadError);
      }
    }
  };

  const uploadWithProgress = (file: File, path: string, totalBytes: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          updateProgress(event.loaded, event.total);
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      // Store reference for abort
      abortControllerRef.current = {
        abort: () => xhr.abort(),
        signal: { aborted: false } as AbortSignal,
      } as AbortController;

      // Use Supabase storage API endpoint directly
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      xhr.open('POST', `${supabaseUrl}/storage/v1/object/course-videos/${path}`);
      xhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`);
      xhr.setRequestHeader('x-upsert', 'false');
      
      // Get the session for auth
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        }
        xhr.send(file);
      });
    });
  };

  const handlePause = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploadState(prev => ({ ...prev, status: 'paused' }));
  };

  const handleResume = () => {
    handleUpload(uploadedChunks);
  };

  const handleRetry = () => {
    setUploadedChunks(0);
    handleUpload(0);
  };

  const handleRemoveFile = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSelectedFile(null);
    setError(null);
    setUploadedChunks(0);
    setFilePath('');
    setUploadState({
      status: 'idle',
      progress: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      remainingTime: 0,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isUploading = uploadState.status === 'uploading';
  const isPaused = uploadState.status === 'paused';
  const isError = uploadState.status === 'error';

  return (
    <div className="space-y-4">
      {/* Current Video Indicator */}
      {uploadedUrl && !selectedFile && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30">
          <CheckCircle className="w-5 h-5 text-success" />
          <span className="text-sm text-success">{t.currentVideo}</span>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && !isPaused && fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200",
          !isUploading && !isPaused && "cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          error && "border-destructive bg-destructive/5",
          (isUploading || isPaused) && "pointer-events-none"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={getVideoAcceptString()}
          onChange={handleFileInput}
          className="hidden"
          disabled={isUploading || isPaused}
        />

        <div className="flex flex-col items-center justify-center text-center">
          {selectedFile ? (
            <>
              <Video className="w-12 h-12 text-primary mb-3" />
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatFileSize(selectedFile.size)}
              </p>
              {!isUploading && !isPaused && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                  className="mt-2 text-destructive hover:text-destructive"
                >
                  <X className="w-4 h-4 me-1" />
                  {t.removeFile}
                </Button>
              )}
            </>
          ) : (
            <>
              <Upload className={cn(
                "w-12 h-12 mb-3 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
              <p className="font-medium text-foreground">{t.dropHere}</p>
              <p className="text-sm text-muted-foreground">{t.orClick}</p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                <span className="px-2 py-1 rounded-md bg-muted">{t.maxSize}</span>
                <span className="px-2 py-1 rounded-md bg-muted">{t.allowedTypes}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Upload Progress - Enhanced */}
      {(isUploading || isPaused) && (
        <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
          {/* Progress Header */}
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-sm font-medium",
              isPaused ? "text-warning" : "text-primary"
            )}>
              {isPaused ? t.paused : t.uploading}
            </span>
            <span className="text-lg font-bold text-foreground">
              {uploadState.progress}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <Progress 
              value={uploadState.progress} 
              className={cn(
                "h-3",
                isPaused && "[&>div]:bg-warning"
              )} 
            />
            {isPaused && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Pause className="w-4 h-4 text-warning" />
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">{t.uploaded}</p>
              <p className="font-medium">
                {formatFileSize(uploadState.uploadedBytes)} {t.of} {formatFileSize(uploadState.totalBytes)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">{t.speed}</p>
              <p className="font-medium">
                {isPaused ? '-' : formatSpeed(uploadState.speed)}
              </p>
            </div>
          </div>

          {/* Remaining Time */}
          {!isPaused && uploadState.remainingTime > 0 && (
            <div className="text-sm text-muted-foreground">
              {t.remaining}: {formatTime(uploadState.remainingTime)}
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-2">
            {isUploading && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePause}
                className="flex-1"
              >
                <Pause className="w-4 h-4 me-2" />
                {t.pause}
              </Button>
            )}
            {isPaused && (
              <>
                <Button
                  type="button"
                  onClick={handleResume}
                  className="flex-1 btn-gold"
                >
                  <Play className="w-4 h-4 me-2" />
                  {t.resume}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRemoveFile}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error with Retry */}
      {isError && (
        <Button
          type="button"
          variant="outline"
          onClick={handleRetry}
          className="w-full"
        >
          <RefreshCw className="w-4 h-4 me-2" />
          {t.retry}
        </Button>
      )}

      {/* Upload Button */}
      {selectedFile && uploadState.status === 'idle' && (
        <Button
          type="button"
          onClick={() => handleUpload(0)}
          className="w-full btn-gold"
          disabled={!!error}
        >
          <Upload className="w-4 h-4 me-2" />
          {uploadedUrl ? t.changeVideo : t.uploadButton}
        </Button>
      )}
    </div>
  );
};
