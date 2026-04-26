import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, X, CheckCircle, AlertCircle, Loader2, Film } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface VideoQuality {
  id: string;
  label: string;
  labelAr: string;
  field: 'video_url' | 'video_url_480p' | 'video_url_720p' | 'video_url_1080p';
}

const VIDEO_QUALITIES: VideoQuality[] = [
  { id: 'default', label: 'Default', labelAr: 'افتراضي', field: 'video_url' },
  { id: '480p', label: '480p SD', labelAr: '480p جودة منخفضة', field: 'video_url_480p' },
  { id: '720p', label: '720p HD', labelAr: '720p جودة عالية', field: 'video_url_720p' },
  { id: '1080p', label: '1080p Full HD', labelAr: '1080p جودة عالية جداً', field: 'video_url_1080p' },
];

interface BunnyVideoUploaderProps {
  courseId: string;
  lessonId: string;
  existingUrls?: {
    video_url?: string | null;
    video_url_480p?: string | null;
    video_url_720p?: string | null;
    video_url_1080p?: string | null;
  };
  onUploadComplete: (quality: string, path: string) => void;
  onError?: (error: string) => void;
}

interface UploadState {
  file: File | null;
  progress: number;
  status: 'idle' | 'uploading-temp' | 'uploading-bunny' | 'success' | 'error';
  error?: string;
}

const texts = {
  en: {
    title: 'Upload Videos',
    dragDrop: 'Drag & drop video or click to select',
    uploadingTemp: 'Uploading to server...',
    uploadingBunny: 'Transferring to storage...',
    uploaded: 'Uploaded',
    upload: 'Upload',
    cancel: 'Cancel',
    remove: 'Remove',
    supportedFormats: 'Supported formats: MP4, WebM, MOV',
    maxSize: 'Max size: 2GB per file',
    existingVideo: 'Current video',
  },
  ar: {
    title: 'رفع الفيديوهات',
    dragDrop: 'اسحب وأفلت الفيديو أو انقر للاختيار',
    uploadingTemp: 'جاري الرفع للسيرفر...',
    uploadingBunny: 'جاري النقل للتخزين...',
    uploaded: 'تم الرفع',
    upload: 'رفع',
    cancel: 'إلغاء',
    remove: 'إزالة',
    supportedFormats: 'الصيغ المدعومة: MP4, WebM, MOV',
    maxSize: 'الحد الأقصى: 2 جيجابايت لكل ملف',
    existingVideo: 'الفيديو الحالي',
  },
};

export const BunnyVideoUploader: React.FC<BunnyVideoUploaderProps> = ({
  courseId,
  lessonId,
  existingUrls = {},
  onUploadComplete,
  onError,
}) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const t = texts[language];
  const isRTL = language === 'ar';

  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>(() => {
    const initial: Record<string, UploadState> = {};
    VIDEO_QUALITIES.forEach((q) => {
      initial[q.id] = { file: null, progress: 0, status: 'idle' };
    });
    return initial;
  });

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const abortControllerRefs = useRef<Record<string, AbortController | null>>({});

  const updateUploadState = (qualityId: string, updates: Partial<UploadState>) => {
    setUploadStates((prev) => ({
      ...prev,
      [qualityId]: { ...prev[qualityId], ...updates },
    }));
  };

  const handleFileSelect = (qualityId: string, file: File) => {
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      const error = 'Invalid file type. Please use MP4, WebM, or MOV.';
      updateUploadState(qualityId, { error, status: 'error' });
      onError?.(error);
      return;
    }

    // Validate file size (2GB max)
    const maxSize = 2 * 1024 * 1024 * 1024;
    if (file.size > maxSize) {
      const error = 'File too large. Maximum size is 2GB.';
      updateUploadState(qualityId, { error, status: 'error' });
      onError?.(error);
      return;
    }

    updateUploadState(qualityId, { file, status: 'idle', error: undefined, progress: 0 });
  };

  const handleUpload = useCallback(async (qualityId: string) => {
    const state = uploadStates[qualityId];
    if (!state.file || !user) return;

    const abortController = new AbortController();
    abortControllerRefs.current[qualityId] = abortController;

    try {
      // ========== STEP 1: Upload to Supabase temp storage ==========
      updateUploadState(qualityId, { status: 'uploading-temp', progress: 0 });

      const tempFileName = `${user.id}/${Date.now()}_${qualityId}.mp4`;
      
      console.log('[BunnyVideoUploader] Step 1: Uploading to temp storage:', tempFileName);

      // Use XMLHttpRequest for progress tracking on temp upload
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Upload to temp-uploads bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('temp-uploads')
        .upload(tempFileName, state.file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('[BunnyVideoUploader] Temp upload error:', uploadError);
        throw new Error(`Failed to upload temp file: ${uploadError.message}`);
      }

      console.log('[BunnyVideoUploader] Temp upload complete:', uploadData.path);
      updateUploadState(qualityId, { progress: 50 });

      // ========== STEP 2: Call Edge Function to transfer to Bunny ==========
      updateUploadState(qualityId, { status: 'uploading-bunny', progress: 50 });

      console.log('[BunnyVideoUploader] Step 2: Calling Edge Function with temp path');

      const { data: bunnyResponse, error: bunnyError } = await supabase.functions.invoke(
        'upload-to-bunny',
        {
          body: {
            tempFilePath: uploadData.path,
            courseId,
            lessonId,
            quality: qualityId,
          },
        }
      );

      if (bunnyError) {
        console.error('[BunnyVideoUploader] Edge function error:', bunnyError);
        throw new Error(`Failed to transfer to Bunny: ${bunnyError.message}`);
      }

      if (!bunnyResponse?.success || !bunnyResponse?.videoPath) {
        throw new Error(bunnyResponse?.error || 'Unknown error during transfer');
      }

      console.log('[BunnyVideoUploader] Transfer complete! Path:', bunnyResponse.videoPath);

      updateUploadState(qualityId, { status: 'success', progress: 100 });
      onUploadComplete(qualityId, bunnyResponse.videoPath);
      toast.success(isRTL ? 'تم رفع الفيديو بنجاح' : 'Video uploaded successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      console.error('[BunnyVideoUploader] Upload error:', error);
      updateUploadState(qualityId, { status: 'error', error: errorMessage });
      onError?.(errorMessage);
      toast.error(errorMessage);
    } finally {
      abortControllerRefs.current[qualityId] = null;
    }
  }, [uploadStates, courseId, lessonId, user, onUploadComplete, onError, isRTL]);

  const handleCancel = (qualityId: string) => {
    abortControllerRefs.current[qualityId]?.abort();
    updateUploadState(qualityId, { status: 'idle', progress: 0 });
  };

  const handleRemove = (qualityId: string) => {
    updateUploadState(qualityId, { file: null, status: 'idle', progress: 0, error: undefined });
    if (fileInputRefs.current[qualityId]) {
      fileInputRefs.current[qualityId]!.value = '';
    }
  };

  const getExistingUrl = (quality: VideoQuality): string | null => {
    return existingUrls[quality.field] || null;
  };

  const getStatusText = (status: UploadState['status']) => {
    switch (status) {
      case 'uploading-temp':
        return t.uploadingTemp;
      case 'uploading-bunny':
        return t.uploadingBunny;
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t.title}</h3>
      
      <div className="grid gap-4">
        {VIDEO_QUALITIES.map((quality) => {
          const state = uploadStates[quality.id];
          const existingUrl = getExistingUrl(quality);
          const isUploading = state.status === 'uploading-temp' || state.status === 'uploading-bunny';

          return (
            <div
              key={quality.id}
              className="border rounded-lg p-4 bg-card"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">
                  {isRTL ? quality.labelAr : quality.label}
                </span>
                {existingUrl && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {t.existingVideo}
                  </span>
                )}
              </div>

              {/* File Input Area */}
              {!state.file && !isUploading && (
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRefs.current[quality.id]?.click()}
                >
                  <input
                    ref={(el) => (fileInputRefs.current[quality.id] = el)}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(quality.id, file);
                    }}
                  />
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t.dragDrop}</p>
                </div>
              )}

              {/* File Preview - Idle or Error state */}
              {state.file && (state.status === 'idle' || state.status === 'error') && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Film className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">
                        {state.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(state.file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpload(quality.id)}
                    >
                      {t.upload}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(quality.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Success state */}
              {state.status === 'success' && state.file && (
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">
                        {state.file.name}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {t.uploaded}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">{getStatusText(state.status)}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancel(quality.id)}
                    >
                      {t.cancel}
                    </Button>
                  </div>
                  <Progress value={state.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {state.progress}%
                  </p>
                </div>
              )}

              {/* Error State */}
              {state.status === 'error' && state.error && (
                <div className="flex items-center gap-2 text-destructive text-sm mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{state.error}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t.supportedFormats} • {t.maxSize}
      </p>
    </div>
  );
};
