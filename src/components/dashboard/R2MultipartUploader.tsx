import { useState, useRef, useCallback, forwardRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  VIDEO_CONSTRAINTS, 
  validateVideoFile, 
  formatFileSize,
} from '@/lib/videoValidation';
import { Upload, Video, X, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// Optimal chunk size: 10MB (R2 supports 5MB minimum, 5GB maximum per part)
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CONCURRENT_UPLOADS = 3; // Parallel uploads for speed
const MAX_RETRIES = 3;

interface R2MultipartUploaderProps {
  onUploadComplete: (objectKey: string) => void;
  existingVideoUrl?: string;
  courseId?: string;
  lessonId?: string;
}

interface UploadState {
  status: 'idle' | 'initializing' | 'uploading' | 'completing' | 'completed' | 'error' | 'paused';
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  speed: number;
  remainingTime: number;
  currentPart: number;
  totalParts: number;
  uploadedParts: number;
}

interface UploadPart {
  partNumber: number;
  etag: string;
}

interface UploadSession {
  uploadId: string;
  objectKey: string;
  parts: UploadPart[];
  totalParts: number;
}

export const R2MultipartUploader = forwardRef<HTMLDivElement, R2MultipartUploaderProps>(({ 
  onUploadComplete, 
  existingVideoUrl,
  courseId,
}, ref) => {
  const { dir } = useLanguage();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadSessionRef = useRef<UploadSession | null>(null);
  const speedHistoryRef = useRef<number[]>([]);
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
    currentPart: 0,
    totalParts: 0,
    uploadedParts: 0,
  });

  const texts = {
    ar: {
      dropHere: 'اسحب الفيديو هنا',
      orClick: 'أو اضغط للاختيار',
      maxSize: `الحد الأقصى: ${VIDEO_CONSTRAINTS.maxSizeLabel}`,
      allowedTypes: `الأنواع: MP4, WEBM`,
      initializing: 'جاري تهيئة الرفع...',
      uploading: 'جاري الرفع...',
      completing: 'جاري إنهاء الرفع...',
      uploadComplete: 'تم الرفع بنجاح',
      uploadError: 'فشل الرفع',
      removeFile: 'إزالة الملف',
      uploadButton: 'رفع الفيديو',
      currentVideo: 'الفيديو الحالي',
      speed: 'السرعة',
      remaining: 'المتبقي',
      uploaded: 'تم رفع',
      of: 'من',
      cancel: 'إلغاء الرفع',
      pause: 'إيقاف مؤقت',
      resume: 'استئناف',
      retry: 'إعادة المحاولة',
      part: 'جزء',
      parts: 'أجزاء',
    },
    en: {
      dropHere: 'Drop video here',
      orClick: 'or click to select',
      maxSize: `Maximum: ${VIDEO_CONSTRAINTS.maxSizeLabel}`,
      allowedTypes: `Types: MP4, WEBM`,
      initializing: 'Initializing upload...',
      uploading: 'Uploading...',
      completing: 'Completing upload...',
      uploadComplete: 'Upload complete',
      uploadError: 'Upload failed',
      removeFile: 'Remove file',
      uploadButton: 'Upload Video',
      currentVideo: 'Current video',
      speed: 'Speed',
      remaining: 'Remaining',
      uploaded: 'Uploaded',
      of: 'of',
      cancel: 'Cancel upload',
      pause: 'Pause',
      resume: 'Resume',
      retry: 'Retry',
      part: 'Part',
      parts: 'Parts',
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
    if (!seconds || !isFinite(seconds) || seconds <= 0) {
      return language === 'ar' ? 'جاري الحساب...' : 'Calculating...';
    }
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
    setUploadState({
      status: 'idle',
      progress: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      remainingTime: 0,
      currentPart: 0,
      totalParts: 0,
      uploadedParts: 0,
    });
    
    const validation = validateVideoFile(file);
    if (!validation.valid) {
      setError(validation.error?.[language] || 'Invalid file');
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['mp4', 'webm'].includes(extension || '')) {
      setError(language === 'ar' 
        ? 'يُسمح فقط بملفات MP4 و WEBM' 
        : 'Only MP4 and WEBM files are allowed');
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

  const updateProgress = (uploadedBytes: number, totalBytes: number, currentPart: number, totalParts: number, uploadedParts: number) => {
    const now = Date.now();
    const timeDiff = (now - lastProgressTimeRef.current) / 1000;
    const bytesDiff = uploadedBytes - lastUploadedBytesRef.current;
    
    let speed = 0;
    if (timeDiff > 0.3 && bytesDiff > 0) {
      speed = bytesDiff / timeDiff;
      
      speedHistoryRef.current.push(speed);
      if (speedHistoryRef.current.length > 10) {
        speedHistoryRef.current.shift();
      }
      speed = speedHistoryRef.current.reduce((a, b) => a + b, 0) / speedHistoryRef.current.length;
      
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
      currentPart,
      totalParts,
      uploadedParts,
    }));
  };

  const callMultipartApi = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('r2-multipart', {
      body,
    });

    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error || 'API call failed');
    
    return data;
  };

  const uploadPartWithRetry = async (
    file: File,
    partNumber: number,
    signedUrl: string,
    signal: AbortSignal
  ): Promise<string> => {
    const start = (partNumber - 1) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (signal.aborted) throw new Error('Upload cancelled');

        const response = await fetch(signedUrl, {
          method: 'PUT',
          body: chunk,
          signal,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }

        const etag = response.headers.get('etag');
        if (!etag) {
          throw new Error('No ETag in response');
        }

        return etag.replace(/"/g, '');
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error');
        if (signal.aborted) throw lastError;
        
        console.warn(`Part ${partNumber} attempt ${attempt + 1} failed:`, lastError.message);
        
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Upload failed after retries');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const totalBytes = selectedFile.size;
    const totalParts = Math.ceil(totalBytes / CHUNK_SIZE);
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    lastProgressTimeRef.current = Date.now();
    lastUploadedBytesRef.current = 0;
    speedHistoryRef.current = [];

    setUploadState({
      status: 'initializing',
      progress: 0,
      uploadedBytes: 0,
      totalBytes,
      speed: 0,
      remainingTime: 0,
      currentPart: 0,
      totalParts,
      uploadedParts: 0,
    });
    setError(null);

    try {
      // Step 1: Create multipart upload
      console.log(`Starting multipart upload: ${totalParts} parts for ${formatFileSize(totalBytes)}`);
      
      const createResponse = await callMultipartApi({
        action: 'create',
        fileName: selectedFile.name,
        contentType: selectedFile.type || 'video/mp4',
      });

      const { uploadId, objectKey } = createResponse;
      console.log(`Created multipart upload: ${uploadId}`);

      uploadSessionRef.current = {
        uploadId,
        objectKey,
        parts: [],
        totalParts,
      };

      setUploadState(prev => ({ ...prev, status: 'uploading' }));

      // Step 2: Upload parts with concurrency
      const uploadedParts: UploadPart[] = [];
      let uploadedBytes = 0;
      
      // Process parts in batches for parallel upload
      for (let i = 0; i < totalParts; i += MAX_CONCURRENT_UPLOADS) {
        if (signal.aborted) throw new Error('Upload cancelled');

        const batch = [];
        const batchEnd = Math.min(i + MAX_CONCURRENT_UPLOADS, totalParts);

        for (let j = i; j < batchEnd; j++) {
          const partNumber = j + 1;
          
          batch.push(
            (async () => {
              // Get signed URL for this part
              const signResponse = await callMultipartApi({
                action: 'sign',
                uploadId,
                objectKey,
                partNumber,
              });

              const { signedUrl } = signResponse;

              // Upload the part
              const etag = await uploadPartWithRetry(selectedFile, partNumber, signedUrl, signal);
              
              return { partNumber, etag };
            })()
          );
        }

        // Wait for batch to complete
        const batchResults = await Promise.all(batch);
        
        for (const result of batchResults) {
          uploadedParts.push(result);
          uploadedBytes += Math.min(CHUNK_SIZE, totalBytes - (result.partNumber - 1) * CHUNK_SIZE);
          updateProgress(uploadedBytes, totalBytes, result.partNumber, totalParts, uploadedParts.length);
        }
      }

      // Step 3: Complete multipart upload
      setUploadState(prev => ({ ...prev, status: 'completing' }));
      
      console.log(`Completing multipart upload with ${uploadedParts.length} parts`);

      const completeResponse = await callMultipartApi({
        action: 'complete',
        uploadId,
        objectKey,
        parts: uploadedParts.sort((a, b) => a.partNumber - b.partNumber),
      });

      console.log('Upload completed:', completeResponse);

      setUploadState(prev => ({
        ...prev,
        status: 'completed',
        progress: 100,
        uploadedBytes: totalBytes,
        uploadedParts: totalParts,
      }));

      setUploadedUrl(objectKey);
      onUploadComplete(objectKey);
      toast.success(t.uploadComplete);
      setSelectedFile(null);
      uploadSessionRef.current = null;

    } catch (err: unknown) {
      console.error('Upload error:', err);
      
      if (err instanceof Error && err.message !== 'Upload cancelled') {
        setError(err.message || t.uploadError);
        setUploadState(prev => ({ ...prev, status: 'error' }));
        toast.error(t.uploadError);

        // Try to abort the multipart upload on error
        if (uploadSessionRef.current) {
          try {
            await callMultipartApi({
              action: 'abort',
              uploadId: uploadSessionRef.current.uploadId,
              objectKey: uploadSessionRef.current.objectKey,
            });
          } catch (abortErr) {
            console.warn('Failed to abort multipart upload:', abortErr);
          }
        }
      }
    }
  };

  const handleCancel = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Abort the multipart upload on R2
    if (uploadSessionRef.current) {
      try {
        await callMultipartApi({
          action: 'abort',
          uploadId: uploadSessionRef.current.uploadId,
          objectKey: uploadSessionRef.current.objectKey,
        });
      } catch (err) {
        console.warn('Failed to abort multipart upload:', err);
      }
      uploadSessionRef.current = null;
    }

    setUploadState({
      status: 'idle',
      progress: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      remainingTime: 0,
      currentPart: 0,
      totalParts: 0,
      uploadedParts: 0,
    });
  };

  const handleRemoveFile = () => {
    handleCancel();
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isUploading = ['initializing', 'uploading', 'completing'].includes(uploadState.status);

  const getStatusText = () => {
    switch (uploadState.status) {
      case 'initializing': return t.initializing;
      case 'uploading': return t.uploading;
      case 'completing': return t.completing;
      default: return '';
    }
  };

  return (
    <div ref={ref} className="space-y-4">
      {uploadedUrl && !selectedFile && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30">
          <CheckCircle className="w-5 h-5 text-success" />
          <span className="text-sm text-success">{t.currentVideo}</span>
          <span className="text-xs text-muted-foreground truncate ms-2 max-w-[200px]">
            {uploadedUrl}
          </span>
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200",
          !isUploading && "cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          error && "border-destructive bg-destructive/5",
          isUploading && "pointer-events-none"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.webm,video/mp4,video/webm"
          onChange={handleFileInput}
          className="hidden"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center justify-center text-center">
          {selectedFile ? (
            <>
              <Video className="w-12 h-12 text-primary mb-3" />
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatFileSize(selectedFile.size)}
                {uploadState.totalParts > 0 && (
                  <span className="ms-2">
                    ({uploadState.totalParts} {uploadState.totalParts === 1 ? t.part : t.parts})
                  </span>
                )}
              </p>
              {!isUploading && uploadState.status !== 'completed' && (
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

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <span className="text-sm text-destructive">{error}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUpload}
            className="ms-auto"
          >
            <RefreshCw className="w-4 h-4 me-1" />
            {t.retry}
          </Button>
        </div>
      )}

      {isUploading && (
        <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-primary flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {getStatusText()}
              {uploadState.status === 'uploading' && uploadState.totalParts > 1 && (
                <span className="text-xs text-muted-foreground">
                  ({t.part} {uploadState.uploadedParts}/{uploadState.totalParts})
                </span>
              )}
            </span>
            <span className="text-lg font-bold text-foreground">
              {uploadState.progress}%
            </span>
          </div>

          <Progress value={uploadState.progress} className="h-3" />

          <div className="flex flex-wrap justify-between text-xs text-muted-foreground gap-2">
            <span>
              {t.uploaded}: {formatFileSize(uploadState.uploadedBytes)} {t.of} {formatFileSize(uploadState.totalBytes)}
            </span>
            {uploadState.speed > 0 && (
              <span>
                {t.speed}: {formatSpeed(uploadState.speed)}
              </span>
            )}
            {uploadState.remainingTime > 0 && (
              <span>
                {t.remaining}: {formatTime(uploadState.remainingTime)}
              </span>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="w-full"
          >
            <X className="w-4 h-4 me-1" />
            {t.cancel}
          </Button>
        </div>
      )}

      {selectedFile && !isUploading && uploadState.status !== 'completed' && (
        <Button
          type="button"
          onClick={handleUpload}
          className="w-full btn-gold"
          disabled={isUploading}
        >
          <Upload className="w-4 h-4 me-2" />
          {t.uploadButton}
        </Button>
      )}
    </div>
  );
});

R2MultipartUploader.displayName = 'R2MultipartUploader';
