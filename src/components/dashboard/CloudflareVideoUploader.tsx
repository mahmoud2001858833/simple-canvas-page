import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, CheckCircle, AlertCircle, Video, RotateCcw, Pause, Play } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CloudflareVideoUploaderProps {
  onUploadComplete: (videoKey: string) => void;
  currentVideoKey?: string;
  disabled?: boolean;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk (edge function body limit)
const DIRECT_UPLOAD_THRESHOLD = 100 * 1024 * 1024; // 100MB

// Format file size for display
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

interface UploadPart {
  partNumber: number;
  etag: string;
}

interface MultipartSession {
  uploadId: string;
  key: string;
  parts: UploadPart[];
}

const CloudflareVideoUploader: React.FC<CloudflareVideoUploaderProps> = ({
  onUploadComplete,
  currentVideoKey,
  disabled = false,
}) => {
  const { language } = useLanguage();
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<string>('');
  const [estimatedTime, setEstimatedTime] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multipartSessionRef = useRef<MultipartSession | null>(null);
  const lastChunkIndexRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSpeedCheckRef = useRef<{ time: number; bytes: number }>({ time: 0, bytes: 0 });

  const texts = {
    ar: {
      selectVideo: 'اختر فيديو',
      uploadVideo: 'رفع الفيديو',
      uploading: 'جاري الرفع...',
      uploadSuccess: 'تم رفع الفيديو بنجاح',
      uploadError: 'فشل رفع الفيديو',
      invalidFile: 'يرجى اختيار ملف فيديو صالح (MP4, WebM, MOV)',
      fileTooLarge: 'حجم الملف كبير جداً (الحد الأقصى 10GB)',
      currentVideo: 'فيديو حالي موجود',
      removeFile: 'إزالة الملف',
      dragDrop: 'اسحب وأفلت الفيديو هنا أو',
      browse: 'تصفح',
      chunk: 'جزء',
      of: 'من',
      pause: 'إيقاف مؤقت',
      resume: 'استئناف',
      retry: 'إعادة المحاولة',
      paused: 'متوقف مؤقتاً',
      resuming: 'استئناف من الجزء',
      speed: 'السرعة',
      directUpload: 'رفع مباشر',
      chunkedUpload: 'رفع مجزأ',
      remaining: 'المتبقي',
    },
    en: {
      selectVideo: 'Select Video',
      uploadVideo: 'Upload Video',
      uploading: 'Uploading...',
      uploadSuccess: 'Video uploaded successfully',
      uploadError: 'Failed to upload video',
      invalidFile: 'Please select a valid video file (MP4, WebM, MOV)',
      fileTooLarge: 'File too large (max 10GB)',
      currentVideo: 'Current video exists',
      removeFile: 'Remove file',
      dragDrop: 'Drag and drop video here or',
      browse: 'Browse',
      chunk: 'Chunk',
      of: 'of',
      pause: 'Pause',
      resume: 'Resume',
      retry: 'Retry',
      paused: 'Paused',
      resuming: 'Resuming from chunk',
      speed: 'Speed',
      directUpload: 'Direct upload',
      chunkedUpload: 'Chunked upload',
      remaining: 'Remaining',
    },
  };

  const t = texts[language] || texts.en;

  const getEdgeFunctionUrl = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/upload-video-cloudflare`;
  };

  const validateFile = (file: File): boolean => {
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
    const maxSize = 10 * 1024 * 1024 * 1024; // 10GB

    if (!validTypes.includes(file.type)) {
      setError(t.invalidFile);
      return false;
    }

    if (file.size > maxSize) {
      setError(t.fileTooLarge);
      return false;
    }

    setError(null);
    return true;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
      resetUploadState();
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
      resetUploadState();
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const resetUploadState = () => {
    setUploadProgress(0);
    setCurrentChunk(0);
    setTotalChunks(0);
    setUploadedBytes(0);
    setUploadSpeed('');
    setEstimatedTime('');
    setError(null);
    setIsPaused(false);
    isPausedRef.current = false;
    lastChunkIndexRef.current = 0;
    multipartSessionRef.current = null;
  };

  const calculateSpeed = useCallback((currentBytes: number, totalBytes: number) => {
    const now = Date.now();
    const timeDiff = (now - lastSpeedCheckRef.current.time) / 1000;
    
    if (timeDiff >= 1) {
      const bytesDiff = currentBytes - lastSpeedCheckRef.current.bytes;
      const speed = bytesDiff / timeDiff;
      setUploadSpeed(formatFileSize(speed) + '/s');
      
      // Calculate remaining time
      const remainingBytes = totalBytes - currentBytes;
      if (speed > 0) {
        const remainingSeconds = remainingBytes / speed;
        if (remainingSeconds < 60) {
          setEstimatedTime(`${Math.ceil(remainingSeconds)}s`);
        } else if (remainingSeconds < 3600) {
          setEstimatedTime(`${Math.ceil(remainingSeconds / 60)}m`);
        } else {
          setEstimatedTime(`${Math.ceil(remainingSeconds / 3600)}h`);
        }
      }
      
      lastSpeedCheckRef.current = { time: now, bytes: currentBytes };
    }
  }, []);

  // Start multipart upload
  const startMultipartUpload = async (filename: string): Promise<{ uploadId: string; key: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(`${getEdgeFunctionUrl()}?action=start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to start upload: ${errorText}`);
    }

    return response.json();
  };

  // Upload a single part
  const uploadPart = async (
    chunk: Blob,
    partNumber: number,
    uploadId: string,
    key: string,
    signal?: AbortSignal
  ): Promise<{ etag: string; partNumber: number }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const formData = new FormData();
    formData.append('file', chunk);
    formData.append('uploadId', uploadId);
    formData.append('partNumber', partNumber.toString());
    formData.append('key', key);

    console.log(`[Upload] Uploading part ${partNumber}`);

    const response = await fetch(`${getEdgeFunctionUrl()}?action=part`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: formData,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload part ${partNumber}: ${errorText}`);
    }

    return response.json();
  };

  // Complete multipart upload
  const completeMultipartUpload = async (
    uploadId: string,
    key: string,
    parts: UploadPart[]
  ): Promise<{ key: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    console.log('[Upload] Completing multipart upload with', parts.length, 'parts');

    const response = await fetch(`${getEdgeFunctionUrl()}?action=complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uploadId, key, parts }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to complete upload: ${errorText}`);
    }

    return response.json();
  };

  // Direct upload for small files
  const directUpload = async (file: File, signal?: AbortSignal): Promise<{ key: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Generate a unique key for the video before upload
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
    const generatedKey = `videos/${timestamp}-${randomStr}-${safeFileName}`;

    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('key', generatedKey);

    console.log('[Upload] Direct upload:', formatFileSize(file.size), 'key:', generatedKey);

    const response = await fetch(`${getEdgeFunctionUrl()}?action=direct`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: formData,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${errorText}`);
    }

    // Handle both JSON and plain text responses
    const responseText = await response.text();
    console.log('[Upload] Response:', responseText);
    
    // Try to parse as JSON, otherwise use generated key
    try {
      if (responseText && responseText.startsWith('{')) {
        const result = JSON.parse(responseText);
        if (result.key) {
          return result;
        }
      }
    } catch {
      console.log('[Upload] Response is not JSON, using generated key');
    }
    
    // Return the generated key if server returned "OK" or non-JSON response
    return { key: generatedKey };
  };

  const handleUpload = async (resumeFromChunk: number = 0) => {
    if (!selectedFile) return;

    // Verify authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Not authenticated');
      return;
    }

    // Verify user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (!roleData || !['admin', 'instructor'].includes(roleData.role)) {
      setError('Only admins and instructors can upload videos');
      return;
    }

    setIsUploading(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setError(null);
    lastSpeedCheckRef.current = { time: Date.now(), bytes: 0 };

    const fileSize = selectedFile.size;
    const useDirectUpload = fileSize < DIRECT_UPLOAD_THRESHOLD;

    try {
      abortControllerRef.current = new AbortController();

      if (useDirectUpload) {
        // === DIRECT UPLOAD for files < 100MB ===
        console.log(`[DirectUpload] Starting: ${formatFileSize(fileSize)}`);
        setTotalChunks(1);
        setCurrentChunk(1);

        const result = await directUpload(selectedFile, abortControllerRef.current.signal);

        setUploadProgress(100);
        setUploadedBytes(fileSize);

        if (result?.key) {
          console.log('[DirectUpload] Complete, key:', result.key);
          onUploadComplete(result.key);
          toast.success(t.uploadSuccess);
          setSelectedFile(null);
          resetUploadState();
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          throw new Error('No video key received');
        }

      } else {
        // === MULTIPART UPLOAD for files >= 100MB ===
        const totalChunksCount = Math.ceil(fileSize / CHUNK_SIZE);
        setTotalChunks(totalChunksCount);

        console.log(`[MultipartUpload] Starting: ${totalChunksCount} parts, ${formatFileSize(fileSize)}`);

        // Start or resume multipart upload
        if (resumeFromChunk === 0 || !multipartSessionRef.current) {
          const { uploadId, key } = await startMultipartUpload(selectedFile.name);
          multipartSessionRef.current = { uploadId, key, parts: [] };
          console.log('[MultipartUpload] Started, uploadId:', uploadId, 'key:', key);
        } else {
          toast.info(`${t.resuming} ${resumeFromChunk + 1}`);
        }

        const session = multipartSessionRef.current;

        // Upload all parts
        for (let i = resumeFromChunk; i < totalChunksCount; i++) {
          if (isPausedRef.current) {
            console.log(`[MultipartUpload] Paused at part ${i + 1}`);
            lastChunkIndexRef.current = i;
            return;
          }

          setCurrentChunk(i + 1);
          
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, fileSize);
          const chunk = selectedFile.slice(start, end);
          const partNumber = i + 1; // R2 part numbers start from 1

          const { etag } = await uploadPart(
            chunk,
            partNumber,
            session.uploadId,
            session.key,
            abortControllerRef.current.signal
          );

          // Store the part info
          session.parts.push({ partNumber, etag });

          const bytesUploaded = end;
          setUploadedBytes(bytesUploaded);
          setUploadProgress(Math.round((bytesUploaded / fileSize) * 100));
          calculateSpeed(bytesUploaded, fileSize);

          lastChunkIndexRef.current = i + 1;
        }

        // Complete the multipart upload
        const result = await completeMultipartUpload(
          session.uploadId,
          session.key,
          session.parts
        );

        if (result?.key) {
          console.log('[MultipartUpload] Complete, key:', result.key);
          onUploadComplete(result.key);
          toast.success(t.uploadSuccess);
          setSelectedFile(null);
          resetUploadState();
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          throw new Error('No video key received');
        }
      }

    } catch (err) {
      if (isPausedRef.current) return;
      
      // Check if aborted
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[Upload] Aborted by user');
        return;
      }
      
      console.error('[Upload] Error:', err);
      const errorMessage = err instanceof Error ? err.message : t.uploadError;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      if (!isPausedRef.current) {
        setIsUploading(false);
        abortControllerRef.current = null;
      }
    }
  };

  const handlePause = () => {
    console.log('[Upload] Pausing');
    setIsPaused(true);
    isPausedRef.current = true;
    setIsUploading(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleResume = () => {
    console.log(`[Upload] Resuming from part ${lastChunkIndexRef.current}`);
    handleUpload(lastChunkIndexRef.current);
  };

  const handleRetry = () => {
    setError(null);
    handleUpload(lastChunkIndexRef.current);
  };

  const removeSelectedFile = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSelectedFile(null);
    resetUploadState();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isDirectUpload = selectedFile && selectedFile.size < DIRECT_UPLOAD_THRESHOLD;

  return (
    <div className="space-y-4">
      {/* Current Video Indicator */}
      {currentVideoKey && !selectedFile && (
        <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg border border-border">
          <CheckCircle className="h-5 w-5 text-primary" />
          <span className="text-sm text-muted-foreground">{t.currentVideo}</span>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}
          ${error ? 'border-destructive bg-destructive/5' : 'border-muted-foreground/25'}
        `}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="hidden"
        />

        {selectedFile ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Video className="h-8 w-8 text-primary" />
              <div className="text-start">
                <p className="font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                  <span className="mx-2">•</span>
                  <span className={isDirectUpload ? 'text-green-500' : 'text-blue-500'}>
                    {isDirectUpload ? t.directUpload : t.chunkedUpload}
                  </span>
                </p>
              </div>
            </div>
            {!isUploading && !isPaused && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); removeSelectedFile(); }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              {t.dragDrop} <span className="text-primary font-medium">{t.browse}</span>
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center justify-between gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          {lastChunkIndexRef.current > 0 && (
            <Button variant="outline" size="sm" onClick={handleRetry} className="flex-shrink-0">
              <RotateCcw className="h-4 w-4 me-1" />
              {t.retry}
            </Button>
          )}
        </div>
      )}

      {/* Upload Progress */}
      {(isUploading || isPaused) && (
        <div className="space-y-3 p-4 bg-accent/30 rounded-lg border border-border">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              {isPaused ? (
                <span className="text-warning font-medium">{t.paused}</span>
              ) : (
                <span className="text-muted-foreground">{t.uploading}</span>
              )}
              {totalChunks > 1 && (
                <span className="text-muted-foreground">
                  {t.chunk} {currentChunk} {t.of} {totalChunks}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {uploadSpeed && (
                <span className="text-xs text-muted-foreground">
                  {t.speed}: {uploadSpeed}
                </span>
              )}
              {estimatedTime && (
                <span className="text-xs text-muted-foreground">
                  {t.remaining}: {estimatedTime}
                </span>
              )}
              <span className="font-medium">{uploadProgress}%</span>
            </div>
          </div>

          <Progress value={uploadProgress} className="h-2" />

          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>{formatFileSize(uploadedBytes)} / {selectedFile && formatFileSize(selectedFile.size)}</span>
            <div className="flex gap-2">
              {isUploading && totalChunks > 1 && (
                <Button variant="outline" size="sm" onClick={handlePause}>
                  <Pause className="h-4 w-4 me-1" />
                  {t.pause}
                </Button>
              )}
              {isPaused && (
                <Button variant="outline" size="sm" onClick={handleResume}>
                  <Play className="h-4 w-4 me-1" />
                  {t.resume}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && !isUploading && !isPaused && (
        <Button
          onClick={() => handleUpload(0)}
          disabled={disabled}
          className="w-full"
        >
          <Upload className="h-4 w-4 me-2" />
          {t.uploadVideo}
        </Button>
      )}
    </div>
  );
};

export default CloudflareVideoUploader;
