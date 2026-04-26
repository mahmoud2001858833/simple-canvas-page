import { useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  VIDEO_CONSTRAINTS, 
  validateVideoFile, 
  formatFileSize,
} from '@/lib/videoValidation';
import { Upload, Video, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Direct upload to Cloudflare Worker - NO SECRETS NEEDED
// Worker handles R2 storage via env.MY_BUCKET binding
const R2_WORKER_URL = 'https://alkaser-upload.jowmahmoud6.workers.dev';

// Optimal chunk size for large files (50MB)
// Cloudflare Workers can handle up to 100MB request bodies
const CHUNK_SIZE = 50 * 1024 * 1024;

// Max concurrent chunk uploads
const MAX_CONCURRENT = 3;

interface R2VideoUploaderProps {
  onUploadComplete: (objectKey: string) => void;
  existingVideoUrl?: string;
  courseId?: string;
  lessonId?: string;
}

interface UploadState {
  status: 'idle' | 'uploading' | 'completed' | 'error';
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  speed: number;
  remainingTime: number;
  currentChunk?: number;
  totalChunks?: number;
}

export const R2VideoUploader = ({ 
  onUploadComplete, 
  existingVideoUrl,
  courseId,
}: R2VideoUploaderProps) => {
  const { dir } = useLanguage();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastProgressTimeRef = useRef<number>(0);
  const lastUploadedBytesRef = useRef<number>(0);
  const speedHistoryRef = useRef<number[]>([]);
  const uploadedChunksRef = useRef<Set<number>>(new Set());
  
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

  const texts = {
    ar: {
      dropHere: 'اسحب الفيديو هنا',
      orClick: 'أو اضغط للاختيار',
      maxSize: `الحد الأقصى: ${VIDEO_CONSTRAINTS.maxSizeLabel}`,
      allowedTypes: `الأنواع: MP4, WEBM`,
      uploading: 'جاري الرفع...',
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
      chunk: 'جزء',
    },
    en: {
      dropHere: 'Drop video here',
      orClick: 'or click to select',
      maxSize: `Maximum: ${VIDEO_CONSTRAINTS.maxSizeLabel}`,
      allowedTypes: `Types: MP4, WEBM`,
      uploading: 'Uploading...',
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
      chunk: 'Chunk',
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

  const updateProgress = (uploadedBytes: number, totalBytes: number, currentChunk?: number, totalChunks?: number) => {
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
      currentChunk,
      totalChunks,
    }));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const totalBytes = selectedFile.size;
    
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = selectedFile.name.split('.').pop();
    const basePath = courseId ? `courses/${courseId}` : 'uploads';
    const fileName = `${basePath}/${timestamp}-${randomId}.${extension}`;

    lastProgressTimeRef.current = Date.now();
    lastUploadedBytesRef.current = 0;
    speedHistoryRef.current = [];
    uploadedChunksRef.current = new Set();

    setUploadState({
      status: 'uploading',
      progress: 0,
      uploadedBytes: 0,
      totalBytes,
      speed: 0,
      remainingTime: 0,
    });
    setError(null);

    try {
      abortControllerRef.current = new AbortController();
      
      // Use chunked upload for large files
      const objectKey = totalBytes > CHUNK_SIZE 
        ? await uploadInChunks(selectedFile, fileName, totalBytes)
        : await uploadDirect(selectedFile, fileName, totalBytes);
      
      setUploadState(prev => ({
        ...prev,
        status: 'completed',
        progress: 100,
        uploadedBytes: totalBytes,
      }));

      setUploadedUrl(objectKey);
      onUploadComplete(objectKey);
      toast.success(t.uploadComplete);
      setSelectedFile(null);

    } catch (err: any) {
      console.error('Upload error:', err);
      if (err.name !== 'AbortError') {
        setError(err.message || t.uploadError);
        setUploadState(prev => ({ ...prev, status: 'error' }));
        toast.error(t.uploadError);
      }
    }
  };

  // Upload large files in chunks
  const uploadInChunks = async (file: File, fileName: string, totalBytes: number): Promise<string> => {
    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
    let totalUploaded = 0;
    
    console.log(`📤 Starting chunked upload: ${totalChunks} chunks, ${formatFileSize(totalBytes)}`);

    // Upload chunks sequentially to maintain order
    let lastResult: { success?: boolean; objectKey?: string } = {};
    
    for (let i = 0; i < totalChunks; i++) {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Upload cancelled');
      }

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalBytes);
      const chunk = file.slice(start, end);
      
      const formData = new FormData();
      formData.append('file', chunk, fileName);
      formData.append('fileName', fileName);
      formData.append('chunkIndex', i.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('contentType', file.type || 'video/mp4');
      
      console.log(`📦 Uploading chunk ${i + 1}/${totalChunks}: ${formatFileSize(chunk.size)}`);
      
      const response = await fetch(R2_WORKER_URL, {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Chunk ${i + 1} failed:`, errorText);
        throw new Error(`Chunk ${i + 1} upload failed: ${response.status}`);
      }

      lastResult = await response.json();
      console.log(`✅ Chunk ${i + 1} complete:`, lastResult);
      
      uploadedChunksRef.current.add(i);
      totalUploaded += chunk.size;
      updateProgress(totalUploaded, totalBytes, i + 1, totalChunks);
      
      // If last chunk returned the objectKey, we're done
      if (lastResult?.success && lastResult?.objectKey && i === totalChunks - 1) {
        return lastResult.objectKey;
      }
    }

    // All chunks uploaded - request finalization
    console.log('📝 Finalizing upload...');
    const finalizeResponse = await fetch(R2_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'finalize',
        fileName,
        totalChunks,
      }),
      signal: abortControllerRef.current?.signal,
    });

    if (!finalizeResponse.ok) {
      throw new Error('Failed to finalize upload');
    }

    const finalResult = await finalizeResponse.json();
    if (!finalResult.success || !finalResult.objectKey) {
      throw new Error(finalResult.error || 'Finalization failed');
    }

    console.log('🎉 Upload complete:', finalResult.objectKey);
    return finalResult.objectKey;
  };

  // Direct upload for small files (using FormData)
  const uploadDirect = async (file: File, fileName: string, totalBytes: number): Promise<string> => {
    console.log(`📤 Direct upload: ${formatFileSize(totalBytes)}`);
    
    const formData = new FormData();
    formData.append('file', file, fileName);
    formData.append('fileName', fileName);
    formData.append('contentType', file.type || 'video/mp4');

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          updateProgress(event.loaded, event.total);
        }
      });

      xhr.addEventListener('load', () => {
        console.log('📥 Response:', xhr.status, xhr.responseText);
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success && response.objectKey) {
              resolve(response.objectKey);
            } else {
              reject(new Error(response.error || 'Upload failed'));
            }
          } catch (e) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error(language === 'ar' 
          ? 'خطأ في الاتصال' 
          : 'Connection error'));
      });
      
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('POST', R2_WORKER_URL);
      xhr.send(formData);
      
      // Handle abort
      abortControllerRef.current?.signal.addEventListener('abort', () => xhr.abort());
    });
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploadState({
      status: 'idle',
      progress: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      remainingTime: 0,
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

  const isUploading = uploadState.status === 'uploading';

  return (
    <div className="space-y-4">
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
              </p>
              {!isUploading && (
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
        </div>
      )}

      {isUploading && (
        <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-primary flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t.uploading}
              {uploadState.totalChunks && uploadState.totalChunks > 1 && (
                <span className="text-xs text-muted-foreground">
                  ({t.chunk} {uploadState.currentChunk}/{uploadState.totalChunks})
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
            <span>
              {t.speed}: {formatSpeed(uploadState.speed)}
            </span>
            <span>
              {t.remaining}: {formatTime(uploadState.remainingTime)}
            </span>
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
};
