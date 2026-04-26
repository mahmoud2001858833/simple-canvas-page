import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  CheckCircle, 
  Loader2,
  FileVideo,
  AlertCircle,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DIRECT_UPLOAD_THRESHOLD = 100 * 1024 * 1024; // 100MB
const SMALL_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk for small files
const LARGE_CHUNK_SIZE = 20 * 1024 * 1024; // 20MB per chunk for large files

interface DualVideoUploaderProps {
  onUploadComplete: (videoKey: string) => void;
  currentVideoKey?: string;
  disabled?: boolean;
}

interface UploadState {
  file: File | null;
  progress: number;
  status: 'idle' | 'uploading' | 'completed' | 'error';
  error?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const texts = {
  ar: {
    smallVideos: 'فيديوهات 100MB وأقل',
    largeVideos: 'فيديوهات أكبر من 100MB',
    smallDesc: 'رفع مباشر وسريع للملفات الصغيرة',
    largeDesc: 'رفع متعدد الأجزاء للملفات الكبيرة',
    dropHere: 'اسحب الفيديو هنا أو اضغط للاختيار',
    uploading: 'جاري الرفع...',
    uploaded: 'تم الرفع بنجاح',
    currentVideo: 'الفيديو الحالي',
    cancel: 'إلغاء',
    fileTooLarge: 'الملف كبير جداً لهذا الحقل',
    fileTooSmall: 'الملف صغير جداً لهذا الحقل',
    supportedFormats: 'MP4, WebM, MOV',
    maxSize: 'الحد الأقصى',
    minSize: 'الحد الأدنى',
    directUpload: 'رفع مباشر',
    multipartUpload: 'رفع متعدد الأجزاء',
  },
  en: {
    smallVideos: 'Videos 100MB or less',
    largeVideos: 'Videos larger than 100MB',
    smallDesc: 'Fast direct upload for small files',
    largeDesc: 'Multipart upload for large files',
    dropHere: 'Drop video here or click to select',
    uploading: 'Uploading...',
    uploaded: 'Upload complete',
    currentVideo: 'Current video',
    cancel: 'Cancel',
    fileTooLarge: 'File too large for this field',
    fileTooSmall: 'File too small for this field',
    supportedFormats: 'MP4, WebM, MOV',
    maxSize: 'Max size',
    minSize: 'Min size',
    directUpload: 'Direct upload',
    multipartUpload: 'Multipart upload',
  },
};

// Small file uploader (≤100MB) - Multipart upload with 10MB chunks
const SmallFileUploader = ({
  onUploadComplete,
  language,
  disabled,
}: {
  onUploadComplete: (key: string) => void;
  language: 'ar' | 'en';
  disabled?: boolean;
}) => {
  const [state, setState] = useState<UploadState>({
    file: null,
    progress: 0,
    status: 'idle',
  });
  const [isDragging, setIsDragging] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const t = texts[language];

  const getEdgeFunctionUrl = (action: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/upload-video-cloudflare?action=${action}`;
  };

  const validateFile = (file: File): boolean => {
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      toast.error(language === 'ar' ? 'صيغة غير مدعومة' : 'Unsupported format');
      return false;
    }
    if (file.size > DIRECT_UPLOAD_THRESHOLD) {
      toast.error(t.fileTooLarge);
      return false;
    }
    return true;
  };

  const handleFileSelection = async (file: File) => {
    if (!validateFile(file)) return;
    
    const controller = new AbortController();
    setAbortController(controller);
    setState({ file, progress: 0, status: 'uploading' });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };

      // Start multipart upload
      const startResponse = await fetch(getEdgeFunctionUrl('start'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
        signal: controller.signal,
      });

      if (!startResponse.ok) {
        const errData = await startResponse.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to start upload');
      }
      const { uploadId, key } = await startResponse.json();

      // Upload parts with 10MB chunks
      const totalParts = Math.ceil(file.size / SMALL_CHUNK_SIZE);
      const parts: { partNumber: number; etag: string }[] = [];

      for (let i = 0; i < totalParts; i++) {
        const start = i * SMALL_CHUNK_SIZE;
        const end = Math.min(start + SMALL_CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const partFormData = new FormData();
        partFormData.append('file', chunk);
        partFormData.append('uploadId', uploadId);
        partFormData.append('key', key);
        partFormData.append('partNumber', (i + 1).toString());

        const partResponse = await fetch(getEdgeFunctionUrl('part'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: partFormData,
          signal: controller.signal,
        });

        if (!partResponse.ok) {
          const errData = await partResponse.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to upload part ${i + 1}`);
        }
        const { etag } = await partResponse.json();
        parts.push({ partNumber: i + 1, etag });

        setState(prev => ({ ...prev, progress: Math.round(((i + 1) / totalParts) * 100) }));
      }

      // Complete upload
      const completeResponse = await fetch(getEdgeFunctionUrl('complete'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uploadId,
          key,
          parts,
        }),
        signal: controller.signal,
      });

      if (!completeResponse.ok) {
        const errData = await completeResponse.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to complete upload');
      }

      setState(prev => ({ ...prev, status: 'completed', progress: 100 }));
      onUploadComplete(key);
      toast.success(t.uploaded);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setState({ file: null, progress: 0, status: 'idle' });
      } else {
        setState(prev => ({ ...prev, status: 'error', error: error.message }));
        toast.error(error.message);
      }
    }
  };

  const handleCancel = () => {
    abortController?.abort();
    setState({ file: null, progress: 0, status: 'idle' });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelection(file);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileVideo className="w-5 h-5 text-primary" />
          <div>
            <Label className="font-medium">{t.smallVideos}</Label>
            <p className="text-xs text-muted-foreground">{t.smallDesc}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {t.maxSize}: 100MB
        </Badge>
      </div>

      {state.status === 'uploading' ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm">{t.uploading}</span>
            <span className="text-sm font-medium ms-auto">{state.progress}%</span>
          </div>
          <Progress value={state.progress} className="h-2" />
          {state.file && (
            <p className="text-xs text-muted-foreground truncate">
              {state.file.name} ({formatFileSize(state.file.size)})
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="w-3 h-3 me-1" />
            {t.cancel}
          </Button>
        </div>
      ) : state.status === 'completed' ? (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-400">{t.uploaded}</span>
        </div>
      ) : (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => {
            if (disabled) return;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'video/mp4,video/webm,video/quicktime';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFileSelection(file);
            };
            input.click();
          }}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t.dropHere}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.supportedFormats}</p>
        </div>
      )}
    </div>
  );
};

// Large file uploader (>100MB) - Multipart upload with 20MB chunks
const LargeFileUploader = ({
  onUploadComplete,
  language,
  disabled,
}: {
  onUploadComplete: (key: string) => void;
  language: 'ar' | 'en';
  disabled?: boolean;
}) => {
  const [state, setState] = useState<UploadState>({
    file: null,
    progress: 0,
    status: 'idle',
  });
  const [isDragging, setIsDragging] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const t = texts[language];

  const getEdgeFunctionUrl = (action: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/upload-video-cloudflare?action=${action}`;
  };

  const validateFile = (file: File): boolean => {
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      toast.error(language === 'ar' ? 'صيغة غير مدعومة' : 'Unsupported format');
      return false;
    }
    if (file.size <= DIRECT_UPLOAD_THRESHOLD) {
      toast.error(t.fileTooSmall);
      return false;
    }
    return true;
  };

  const handleFileSelection = async (file: File) => {
    if (!validateFile(file)) return;
    
    const controller = new AbortController();
    setAbortController(controller);
    setState({ file, progress: 0, status: 'uploading' });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      };

      // Start multipart upload
      const startResponse = await fetch(getEdgeFunctionUrl('start'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
        signal: controller.signal,
      });

      if (!startResponse.ok) {
        const errData = await startResponse.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to start upload');
      }
      const { uploadId, key } = await startResponse.json();

      // Upload parts
      const totalParts = Math.ceil(file.size / LARGE_CHUNK_SIZE);
      const parts: { partNumber: number; etag: string }[] = [];

      for (let i = 0; i < totalParts; i++) {
        const start = i * LARGE_CHUNK_SIZE;
        const end = Math.min(start + LARGE_CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const partFormData = new FormData();
        partFormData.append('file', chunk);
        partFormData.append('uploadId', uploadId);
        partFormData.append('key', key);
        partFormData.append('partNumber', (i + 1).toString());

        const partResponse = await fetch(getEdgeFunctionUrl('part'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: partFormData,
          signal: controller.signal,
        });

        if (!partResponse.ok) {
          const errData = await partResponse.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to upload part ${i + 1}`);
        }
        const { etag } = await partResponse.json();
        parts.push({ partNumber: i + 1, etag });

        setState(prev => ({ ...prev, progress: Math.round(((i + 1) / totalParts) * 100) }));
      }

      // Complete upload
      const completeResponse = await fetch(getEdgeFunctionUrl('complete'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uploadId,
          key,
          parts,
        }),
        signal: controller.signal,
      });

      if (!completeResponse.ok) {
        const errData = await completeResponse.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to complete upload');
      }

      setState(prev => ({ ...prev, status: 'completed', progress: 100 }));
      onUploadComplete(key);
      toast.success(t.uploaded);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setState({ file: null, progress: 0, status: 'idle' });
      } else {
        setState(prev => ({ ...prev, status: 'error', error: error.message }));
        toast.error(error.message);
      }
    }
  };

  const handleCancel = () => {
    abortController?.abort();
    setState({ file: null, progress: 0, status: 'idle' });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelection(file);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileVideo className="w-5 h-5 text-orange-500" />
          <div>
            <Label className="font-medium">{t.largeVideos}</Label>
            <p className="text-xs text-muted-foreground">{t.largeDesc}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs border-orange-200 text-orange-600">
          {t.minSize}: 100MB+
        </Badge>
      </div>

      {state.status === 'uploading' ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <span className="text-sm">{t.uploading}</span>
            <span className="text-sm font-medium ms-auto">{state.progress}%</span>
          </div>
          <Progress value={state.progress} className="h-2" />
          {state.file && (
            <p className="text-xs text-muted-foreground truncate">
              {state.file.name} ({formatFileSize(state.file.size)})
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="w-3 h-3 me-1" />
            {t.cancel}
          </Button>
        </div>
      ) : state.status === 'completed' ? (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-400">{t.uploaded}</span>
        </div>
      ) : (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
            isDragging ? "border-orange-500 bg-orange-50/50 dark:bg-orange-950/20" : "border-muted-foreground/25 hover:border-orange-400/50 hover:bg-muted/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => {
            if (disabled) return;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'video/mp4,video/webm,video/quicktime';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFileSelection(file);
            };
            input.click();
          }}
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-orange-400" />
          <p className="text-sm text-muted-foreground">{t.dropHere}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.supportedFormats}</p>
        </div>
      )}
    </div>
  );
};

// Main component
const DualVideoUploader = ({ onUploadComplete, currentVideoKey, disabled }: DualVideoUploaderProps) => {
  const { dir } = useLanguage();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const t = texts[language];

  return (
    <div className="space-y-4">
      {currentVideoKey && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm">{t.currentVideo}:</span>
            <code className="text-xs bg-background px-2 py-1 rounded truncate max-w-[200px]">
              {currentVideoKey}
            </code>
          </div>
        </div>
      )}

      <SmallFileUploader
        onUploadComplete={onUploadComplete}
        language={language}
        disabled={disabled}
      />

      <LargeFileUploader
        onUploadComplete={onUploadComplete}
        language={language}
        disabled={disabled}
      />
    </div>
  );
};

export default DualVideoUploader;
