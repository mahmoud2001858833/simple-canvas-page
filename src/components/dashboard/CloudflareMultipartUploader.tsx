import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { validateVideoFile, getVideoAcceptString, formatFileSize } from '@/lib/videoValidation';

// ==================== Constants ====================
const WORKER_URL = 'https://alkaser-upload.jowmahmoud6.workers.dev';
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_RETRIES = 3;

// ==================== Types ====================
interface CloudflareMultipartUploaderProps {
  onUploadComplete: (videoKey: string) => void;
  onUploadError?: (error: string) => void;
  currentVideoUrl?: string;
  language?: 'ar' | 'en';
  disabled?: boolean;
}

export interface CloudflareMultipartUploaderRef {
  reset: () => void;
}

interface UploadPart {
  partNumber: number;
  etag: string;
}

interface UploadState {
  status: 'idle' | 'initializing' | 'uploading' | 'completing' | 'completed' | 'error' | 'cancelled';
  progress: number;
  speed: number;
  remainingTime: number;
  currentPart: number;
  totalParts: number;
  error?: string;
}

// ==================== Texts ====================
const texts = {
  ar: {
    dropzone: 'اسحب وأفلت الفيديو هنا',
    or: 'أو',
    browse: 'اختر ملف',
    uploading: 'جاري الرفع...',
    initializing: 'جاري تهيئة الرفع...',
    completing: 'جاري إنهاء الرفع...',
    completed: 'تم الرفع بنجاح!',
    error: 'حدث خطأ',
    cancel: 'إلغاء',
    retry: 'إعادة المحاولة',
    remove: 'إزالة',
    speed: 'السرعة',
    remaining: 'الوقت المتبقي',
    part: 'الجزء',
    of: 'من',
    currentVideo: 'الفيديو الحالي',
  },
  en: {
    dropzone: 'Drag and drop video here',
    or: 'or',
    browse: 'Browse files',
    uploading: 'Uploading...',
    initializing: 'Initializing upload...',
    completing: 'Completing upload...',
    completed: 'Upload completed!',
    error: 'Error occurred',
    cancel: 'Cancel',
    retry: 'Retry',
    remove: 'Remove',
    speed: 'Speed',
    remaining: 'Time remaining',
    part: 'Part',
    of: 'of',
    currentVideo: 'Current video',
  },
};

// ==================== Component ====================
export const CloudflareMultipartUploader = forwardRef<CloudflareMultipartUploaderRef, CloudflareMultipartUploaderProps>(
  ({ onUploadComplete, onUploadError, currentVideoUrl, language = 'ar', disabled = false }, ref) => {
    const t = texts[language];
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const uploadStartTimeRef = useRef<number>(0);
    const uploadedBytesRef = useRef<number>(0);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadState, setUploadState] = useState<UploadState>({
      status: 'idle',
      progress: 0,
      speed: 0,
      remainingTime: 0,
      currentPart: 0,
      totalParts: 0,
    });

    // ==================== Reset ====================
    const reset = useCallback(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setSelectedFile(null);
      setUploadState({
        status: 'idle',
        progress: 0,
        speed: 0,
        remainingTime: 0,
        currentPart: 0,
        totalParts: 0,
      });
      uploadedBytesRef.current = 0;
    }, []);

    useImperativeHandle(ref, () => ({ reset }));

    // ==================== File Selection ====================
    const handleFileSelection = useCallback((file: File) => {
      const validation = validateVideoFile(file);
      if (!validation.valid && validation.error) {
        setUploadState(prev => ({
          ...prev,
          status: 'error',
          error: validation.error[language],
        }));
        onUploadError?.(validation.error[language]);
        return;
      }

      setSelectedFile(file);
      setUploadState({
        status: 'idle',
        progress: 0,
        speed: 0,
        remainingTime: 0,
        currentPart: 0,
        totalParts: Math.ceil(file.size / CHUNK_SIZE),
      });
    }, [language, onUploadError]);

    // ==================== Drag & Drop ====================
    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelection(files[0]);
      }
    }, [disabled, handleFileSelection]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelection(files[0]);
      }
      e.target.value = '';
    }, [handleFileSelection]);

    // ==================== Progress Update ====================
    const updateProgress = useCallback((uploadedBytes: number, totalBytes: number, currentPart: number, totalParts: number) => {
      const elapsed = (Date.now() - uploadStartTimeRef.current) / 1000;
      const speed = elapsed > 0 ? uploadedBytes / elapsed : 0;
      const remainingBytes = totalBytes - uploadedBytes;
      const remainingTime = speed > 0 ? remainingBytes / speed : 0;

      setUploadState(prev => ({
        ...prev,
        progress: (uploadedBytes / totalBytes) * 100,
        speed,
        remainingTime,
        currentPart,
        totalParts,
      }));
    }, []);

    // ==================== API Calls ====================
    
    // 1️⃣ START UPLOAD
    const startUpload = async (file: File): Promise<{ uploadId: string; key: string }> => {
      const response = await fetch(`${WORKER_URL}/upload/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'video/mp4',
        }),
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to start upload: ${errorText}`);
      }

      return await response.json();
    };

    // 2️⃣ UPLOAD PART
    const uploadPart = async (
      chunk: Blob,
      uploadId: string,
      key: string,
      partNumber: number
    ): Promise<UploadPart> => {
      const url = `${WORKER_URL}/upload/part?uploadId=${encodeURIComponent(uploadId)}&key=${encodeURIComponent(key)}&partNumber=${partNumber}`;

      const response = await fetch(url, {
        method: 'PUT',
        body: chunk, // Binary مباشرة - بدون FormData
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload part ${partNumber}: ${errorText}`);
      }

      return await response.json();
    };

    // 3️⃣ COMPLETE UPLOAD
    const completeUpload = async (
      uploadId: string,
      key: string,
      parts: UploadPart[]
    ): Promise<void> => {
      const response = await fetch(`${WORKER_URL}/upload/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          key,
          parts: parts.sort((a, b) => a.partNumber - b.partNumber),
        }),
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to complete upload: ${errorText}`);
      }
    };

    // ==================== Upload Part with Retry ====================
    const uploadPartWithRetry = async (
      chunk: Blob,
      uploadId: string,
      key: string,
      partNumber: number
    ): Promise<UploadPart> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          return await uploadPart(chunk, uploadId, key, partNumber);
        } catch (error) {
          lastError = error as Error;
          
          if (abortControllerRef.current?.signal.aborted) {
            throw error;
          }

          if (attempt < MAX_RETRIES - 1) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          }
        }
      }

      throw lastError;
    };

    // ==================== Main Upload Function ====================
    const handleUpload = async () => {
      if (!selectedFile) return;

      abortControllerRef.current = new AbortController();
      uploadStartTimeRef.current = Date.now();
      uploadedBytesRef.current = 0;

      try {
        // 1️⃣ START
        setUploadState(prev => ({ ...prev, status: 'initializing' }));
        console.log('[Multipart] Starting upload for:', selectedFile.name);
        
        const { uploadId, key } = await startUpload(selectedFile);
        console.log('[Multipart] Upload started:', { uploadId, key });

        // 2️⃣ UPLOAD PARTS
        setUploadState(prev => ({ ...prev, status: 'uploading' }));
        
        const totalParts = Math.ceil(selectedFile.size / CHUNK_SIZE);
        const parts: UploadPart[] = [];

        for (let i = 0; i < totalParts; i++) {
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Upload cancelled');
          }

          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
          const chunk = selectedFile.slice(start, end);
          const partNumber = i + 1;

          console.log(`[Multipart] Uploading part ${partNumber}/${totalParts}`);
          
          const result = await uploadPartWithRetry(chunk, uploadId, key, partNumber);
          parts.push(result);

          uploadedBytesRef.current = end;
          updateProgress(end, selectedFile.size, partNumber, totalParts);

          console.log(`[Multipart] Part ${partNumber} completed:`, result.etag);
        }

        // 3️⃣ COMPLETE
        setUploadState(prev => ({ ...prev, status: 'completing' }));
        console.log('[Multipart] Completing upload with parts:', parts.length);
        
        await completeUpload(uploadId, key, parts);

        // Success!
        setUploadState(prev => ({
          ...prev,
          status: 'completed',
          progress: 100,
        }));

        console.log('[Multipart] Upload completed successfully:', key);
        onUploadComplete(key);

      } catch (error) {
        if (abortControllerRef.current?.signal.aborted) {
          setUploadState(prev => ({ ...prev, status: 'cancelled' }));
          console.log('[Multipart] Upload cancelled');
        } else {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          setUploadState(prev => ({
            ...prev,
            status: 'error',
            error: errorMessage,
          }));
          console.error('[Multipart] Upload error:', error);
          onUploadError?.(errorMessage);
        }
      }
    };

    // ==================== Cancel ====================
    const handleCancel = useCallback(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setUploadState(prev => ({ ...prev, status: 'cancelled' }));
    }, []);

    // ==================== Format Helpers ====================
    const formatSpeed = (bytesPerSecond: number): string => {
      if (bytesPerSecond >= 1024 * 1024) {
        return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
      }
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    };

    const formatTime = (seconds: number): string => {
      if (seconds < 60) return `${Math.round(seconds)}s`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
      return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    };

    // ==================== Render ====================
    const isUploading = ['initializing', 'uploading', 'completing'].includes(uploadState.status);

    return (
      <div className="w-full space-y-4">
        {/* Current Video */}
        {currentVideoUrl && !selectedFile && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Video className="h-5 w-5 text-primary" />
            <span className="text-sm truncate flex-1">{t.currentVideo}</span>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </div>
        )}

        {/* Dropzone */}
        {!selectedFile && (
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !disabled && fileInputRef.current?.click()}
          >
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">{t.dropzone}</p>
            <p className="text-sm text-muted-foreground mb-3">{t.or}</p>
            <Button type="button" variant="outline" size="sm" disabled={disabled}>
              {t.browse}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={getVideoAcceptString()}
              onChange={handleFileInput}
              className="hidden"
              disabled={disabled}
            />
          </div>
        )}

        {/* Selected File & Upload Progress */}
        {selectedFile && (
          <div className="border rounded-lg p-4 space-y-4">
            {/* File Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Video className="h-8 w-8 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>

              {!isUploading && uploadState.status !== 'completed' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={reset}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Status */}
            {uploadState.status === 'initializing' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t.initializing}</span>
              </div>
            )}

            {uploadState.status === 'uploading' && (
              <div className="space-y-2">
                <Progress value={uploadState.progress} className="h-2" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{uploadState.progress.toFixed(1)}%</span>
                  <span>
                    {t.part} {uploadState.currentPart} {t.of} {uploadState.totalParts}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t.speed}: {formatSpeed(uploadState.speed)}</span>
                  <span>{t.remaining}: {formatTime(uploadState.remainingTime)}</span>
                </div>
              </div>
            )}

            {uploadState.status === 'completing' && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t.completing}</span>
              </div>
            )}

            {uploadState.status === 'completed' && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span>{t.completed}</span>
              </div>
            )}

            {uploadState.status === 'error' && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span>{uploadState.error || t.error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {uploadState.status === 'idle' && (
                <Button type="button" onClick={handleUpload} className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  {t.uploading.replace('...', '')}
                </Button>
              )}

              {isUploading && (
                <Button type="button" variant="destructive" onClick={handleCancel} className="flex-1">
                  <X className="h-4 w-4 mr-2" />
                  {t.cancel}
                </Button>
              )}

              {(uploadState.status === 'error' || uploadState.status === 'cancelled') && (
                <>
                  <Button type="button" onClick={handleUpload} className="flex-1">
                    {t.retry}
                  </Button>
                  <Button type="button" variant="outline" onClick={reset}>
                    {t.remove}
                  </Button>
                </>
              )}

              {uploadState.status === 'completed' && (
                <Button type="button" variant="outline" onClick={reset} className="flex-1">
                  {t.remove}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

CloudflareMultipartUploader.displayName = 'CloudflareMultipartUploader';
