import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Scissors,
  Type,
  Merge,
  Play,
  Pause,
  Save,
  Upload,
  X,
  Loader2,
  Eye,
  RotateCcw,
  FileVideo,
  ArrowLeft,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  AlertCircle,
  CheckCircle,
  Undo2,
  Redo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { processVideo, type TextOverlayOptions, type TrimOptions } from '@/lib/ffmpeg';
import VideoProcessingProgress from '@/components/dashboard/VideoProcessingProgress';

const CLOUDFLARE_WORKER_URL = 'https://ancient-king-9e42.mhawish-alaa.workers.dev';

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
}

interface EditorSnapshot {
  trimStart: number;
  trimEnd: number;
  textOverlays: TextOverlay[];
  mergeFileName: string | null;
}

const VideoEditor = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const isRTL = language === 'ar';

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [newText, setNewText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(28);
  const [textX, setTextX] = useState(50);
  const [textY, setTextY] = useState(50);
  const [mergeFile, setMergeFile] = useState<File | null>(null);
  const [mergePosition, setMergePosition] = useState<'before' | 'after'>('after');
  const [isSaving, setIsSaving] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [activeTab, setActiveTab] = useState('trim');
  const [videoError, setVideoError] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<EditorSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const pushSnapshot = useCallback(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    const snap: EditorSnapshot = {
      trimStart,
      trimEnd,
      textOverlays: [...textOverlays],
      mergeFileName: mergeFile?.name ?? null,
    };
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(snap);
      // Keep max 50 snapshots
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => {
      const newIdx = Math.min(prev + 1, 49);
      return newIdx;
    });
  }, [trimStart, trimEnd, textOverlays, mergeFile, historyIndex]);

  // Push initial snapshot when video loads
  useEffect(() => {
    if (duration > 0 && history.length === 0) {
      const initialSnap: EditorSnapshot = {
        trimStart: 0,
        trimEnd: duration,
        textOverlays: [],
        mergeFileName: null,
      };
      setHistory([initialSnap]);
      setHistoryIndex(0);
    }
  }, [duration]);

  const applySnapshot = useCallback((snap: EditorSnapshot) => {
    isUndoRedoRef.current = true;
    setTrimStart(snap.trimStart);
    setTrimEnd(snap.trimEnd);
    setTextOverlays(snap.textOverlays);
    if (!snap.mergeFileName) setMergeFile(null);
  }, []);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    applySnapshot(history[newIndex]);
    toast.info(isRTL ? 'تم التراجع' : 'Undone');
  }, [canUndo, historyIndex, history, applySnapshot, isRTL]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    applySnapshot(history[newIndex]);
    toast.info(isRTL ? 'تم الإعادة' : 'Redone');
  }, [canRedo, historyIndex, history, applySnapshot, isRTL]);


  const texts = {
    ar: {
      title: 'محرر الفيديو',
      back: 'العودة',
      lesson: 'الدرس',
      trim: 'قص الفيديو',
      addText: 'إضافة نص',
      merge: 'دمج فيديو',
      preview: 'معاينة',
      savePublish: 'حفظ التعديلات',
      saving: 'جاري الحفظ...',
      trimStart: 'نقطة البداية',
      trimEnd: 'نقطة النهاية',
      goToStart: 'الانتقال لنقطة البداية',
      goToEnd: 'الانتقال لنقطة النهاية',
      setStart: 'تحديد البداية من الوقت الحالي',
      setEnd: 'تحديد النهاية من الوقت الحالي',
      textContent: 'النص',
      textColorLabel: 'لون النص',
      textSizeLabel: 'حجم النص',
      textPosition: 'موضع النص',
      posX: 'أفقي',
      posY: 'عمودي',
      addTextBtn: 'إضافة النص',
      mergeVideo: 'رفع فيديو للدمج',
      mergeBefore: 'قبل الفيديو الحالي',
      mergeAfter: 'بعد الفيديو الحالي',
      noOverlays: 'لا توجد نصوص مضافة',
      reset: 'إعادة تعيين',
      durationAfterTrim: 'المدة بعد القص',
      noVideo: 'لا يوجد فيديو مرفق بهذا الدرس',
      videoLoadError: 'فشل في تحميل الفيديو',
      saved: 'تم حفظ التعديلات بنجاح',
      processing: 'جاري معالجة الفيديو...',
      loadingFFmpeg: 'جاري تحميل محرك المعالجة...',
      fetchingVideo: 'جاري تحميل الفيديو للمعالجة...',
      uploading: 'جاري رفع الفيديو المعدل...',
      noChanges: 'لم تقم بأي تعديلات',
      trimInfo: 'حدد نقطة البداية والنهاية لقص الفيديو. يمكنك استخدام أزرار التحديد لتعيين النقطة من الوقت الحالي.',
      textInfo: 'أضف نصوصاً تظهر فوق الفيديو مع التحكم بالموضع واللون والحجم.',
      mergeInfo: 'ارفع فيديو آخر لدمجه مع الفيديو الحالي قبله أو بعده.',
      previewTitle: 'معاينة الفيديو المعالج',
      previewDesc: 'راجع النتيجة قبل الرفع النهائي',
      confirmUpload: 'اعتماد ورفع الفيديو',
      discardPreview: 'تجاهل والعودة للتعديل',
      previewReady: 'تمت المعالجة! راجع الفيديو قبل الرفع.',
    },
    en: {
      title: 'Video Editor',
      back: 'Back',
      lesson: 'Lesson',
      trim: 'Trim Video',
      addText: 'Add Text',
      merge: 'Merge Video',
      preview: 'Preview',
      savePublish: 'Save Changes',
      saving: 'Saving...',
      trimStart: 'Start Point',
      trimEnd: 'End Point',
      goToStart: 'Go to start point',
      goToEnd: 'Go to end point',
      setStart: 'Set start from current time',
      setEnd: 'Set end from current time',
      textContent: 'Text',
      textColorLabel: 'Text Color',
      textSizeLabel: 'Text Size',
      textPosition: 'Text Position',
      posX: 'Horizontal',
      posY: 'Vertical',
      addTextBtn: 'Add Text',
      mergeVideo: 'Upload Video to Merge',
      mergeBefore: 'Before current video',
      mergeAfter: 'After current video',
      noOverlays: 'No text overlays added',
      reset: 'Reset',
      durationAfterTrim: 'Duration after trim',
      noVideo: 'No video attached to this lesson',
      videoLoadError: 'Failed to load video',
      saved: 'Changes saved successfully',
      processing: 'Processing video...',
      loadingFFmpeg: 'Loading processing engine...',
      fetchingVideo: 'Downloading video for processing...',
      uploading: 'Uploading processed video...',
      noChanges: 'No changes to apply',
      trimInfo: 'Set the start and end points to trim the video. Use the set buttons to mark from the current playback position.',
      textInfo: 'Add text overlays that appear on top of the video with control over position, color, and size.',
      mergeInfo: 'Upload another video to merge with the current one, either before or after it.',
      previewTitle: 'Preview Processed Video',
      previewDesc: 'Review the result before final upload',
      confirmUpload: 'Approve & Upload',
      discardPreview: 'Discard & Edit Again',
      previewReady: 'Processing complete! Review the video before uploading.',
    },
  };
  const t = texts[language];

  // Fetch lesson data
  const { data: lesson, isLoading: isLessonLoading } = useQuery({
    queryKey: ['video-editor-lesson', lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('*, courses(title, title_ar)')
        .eq('id', lessonId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId,
  });

  // Build video URL
  const videoUrl = (() => {
    if (!lesson?.video_url) return null;
    const key = lesson.video_url;
    if (key.startsWith('http')) return key;
    if (key.startsWith('videos/')) return `${CLOUDFLARE_WORKER_URL}/video/${key}`;
    return `${CLOUDFLARE_WORKER_URL}/video/videos/${key}`;
  })();

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      setTrimEnd(dur);
      setIsVideoLoaded(true);
      setVideoError(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleVideoError = () => {
    setVideoError(true);
    setIsVideoLoaded(false);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = newTime;
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addTextOverlay = () => {
    if (!newText.trim()) return;
    setTextOverlays(prev => {
      const next = [...prev, {
        id: Date.now().toString(),
        text: newText,
        x: textX,
        y: textY,
        color: textColor,
        fontSize: textSize,
      }];
      // Push snapshot after state update via setTimeout
      setTimeout(() => pushSnapshot(), 0);
      return next;
    });
    setNewText('');
  };

  const removeTextOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(o => o.id !== id));
    setTimeout(() => pushSnapshot(), 0);
  };

  const handleReset = () => {
    setTrimStart(0);
    setTrimEnd(duration);
    setTextOverlays([]);
    setMergeFile(null);
    setTimeout(() => pushSnapshot(), 0);
  };

  const hasChanges = trimStart > 0 || (trimEnd > 0 && trimEnd < duration) || textOverlays.length > 0 || mergeFile !== null;

  const handleSave = async () => {
    if (!hasChanges) {
      toast.info(t.noChanges);
      return;
    }

    if (!videoUrl) return;

    setIsSaving(true);
    setProcessingProgress(0);
    setProcessingMessage(t.fetchingVideo);

    try {
      // Step 1: Fetch the original video file
      setProcessingProgress(5);
      let inputFile: File;

      if (originalFile) {
        inputFile = originalFile;
      } else {
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error('Failed to fetch video');
        const blob = await response.blob();
        inputFile = new File([blob], 'input.mp4', { type: 'video/mp4' });
        setOriginalFile(inputFile);
      }

      // Step 2: Process with FFmpeg
      setProcessingMessage(t.loadingFFmpeg);
      setProcessingProgress(10);

      const trimOptions: TrimOptions | undefined = (trimStart > 0 || (trimEnd > 0 && trimEnd < duration))
        ? { startTime: trimStart, endTime: trimEnd }
        : undefined;

      const textOptions: TextOverlayOptions[] | undefined = textOverlays.length > 0
        ? textOverlays.map(o => ({ text: o.text, x: o.x, y: o.y, color: o.color, fontSize: o.fontSize }))
        : undefined;

      const processedBlob = await processVideo({
        inputFile,
        trim: trimOptions,
        textOverlays: textOptions,
        mergeFile: mergeFile || undefined,
        mergePosition,
        onProgress: (progress, message) => {
          setProcessingProgress(10 + Math.round(progress * 0.85));
          setProcessingMessage(message);
        },
      });

      // Step 3: Show preview instead of uploading directly
      setProcessingProgress(100);
      setProcessingMessage(t.previewReady);

      // Clean up old preview URL
      if (previewUrl) URL.revokeObjectURL(previewUrl);

      const url = URL.createObjectURL(processedBlob);
      setPreviewBlob(processedBlob);
      setPreviewUrl(url);
      setShowPreview(true);
      setIsSaving(false);
      toast.success(t.previewReady);

    } catch (error: any) {
      console.error('Error processing video:', error);
      toast.error(error.message || (isRTL ? 'فشل في معالجة الفيديو' : 'Failed to process video'));
      setIsSaving(false);
    } finally {
      setProcessingProgress(0);
      setProcessingMessage('');
    }
  };

  const handleDiscardPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(null);
    setPreviewUrl(null);
    setShowPreview(false);
  };

  const handleConfirmUpload = async () => {
    if (!previewBlob || !lessonId) return;

    setShowPreview(false);
    setIsSaving(true);
    setProcessingProgress(80);
    setProcessingMessage(t.uploading);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-video-cloudflare?action=start`;

      const startRes = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: 'edited_video.mp4', contentType: 'video/mp4' }),
      });

      if (!startRes.ok) throw new Error('Failed to start upload');
      const { uploadId, key } = await startRes.json();

      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB to stay within Edge Function body limits
      const totalParts = Math.ceil(previewBlob.size / CHUNK_SIZE);
      const parts: { partNumber: number; etag: string }[] = [];

      for (let i = 0; i < totalParts; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, previewBlob.size);
        const chunk = previewBlob.slice(start, end);

        const partFormData = new FormData();
        partFormData.append('file', chunk);
        partFormData.append('uploadId', uploadId);
        partFormData.append('key', key);
        partFormData.append('partNumber', (i + 1).toString());

        const partRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-video-cloudflare?action=part`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            body: partFormData,
          }
        );

        if (!partRes.ok) throw new Error(`Failed to upload part ${i + 1}`);
        const { etag } = await partRes.json();
        parts.push({ partNumber: i + 1, etag });

        setProcessingProgress(80 + Math.round(((i + 1) / totalParts) * 15));
      }

      const completeRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-video-cloudflare?action=complete`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uploadId, key, parts }),
        }
      );

      if (!completeRes.ok) throw new Error('Failed to complete upload');

      setProcessingProgress(97);
      const { error: updateError } = await supabase
        .from('lessons')
        .update({ video_url: key })
        .eq('id', lessonId);

      if (updateError) throw updateError;

      setProcessingProgress(100);
      setProcessingMessage(t.saved);
      toast.success(t.saved);

      // Clean up preview
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewBlob(null);
      setPreviewUrl(null);

      setTimeout(() => window.location.reload(), 1500);

    } catch (error: any) {
      console.error('Error uploading video:', error);
      toast.error(error.message || (isRTL ? 'فشل في رفع الفيديو' : 'Failed to upload video'));
      // Re-show preview so user can retry
      setShowPreview(true);
    } finally {
      setIsSaving(false);
      setProcessingProgress(0);
      setProcessingMessage('');
    }
  };

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Ctrl+Z / Cmd+Z for Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y for Redo
      if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
        return;
      }
      
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          skip(-5);
          break;
        case 'ArrowRight':
          skip(5);
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'i':
          setTrimStart(currentTime);
          setTimeout(() => pushSnapshot(), 0);
          toast.info(isRTL ? `تحديد البداية: ${formatTime(currentTime)}` : `Start set: ${formatTime(currentTime)}`);
          break;
        case 'o':
          setTrimEnd(currentTime);
          setTimeout(() => pushSnapshot(), 0);
          toast.info(isRTL ? `تحديد النهاية: ${formatTime(currentTime)}` : `End set: ${formatTime(currentTime)}`);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, isPlaying, isMuted, handleUndo, handleRedo, pushSnapshot]);

  if (isLessonLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <p className="text-lg">{isRTL ? 'الدرس غير موجود' : 'Lesson not found'}</p>
          <Button onClick={() => navigate(-1)}>{t.back}</Button>
        </div>
      </div>
    );
  }

  const lessonTitle = isRTL ? lesson.title_ar : lesson.title;
  const courseTitle = isRTL ? (lesson as any).courses?.title_ar : (lesson as any).courses?.title;

  return (
    <div className={`min-h-screen bg-background ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            {t.back}
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate flex items-center gap-2">
              <FileVideo className="w-5 h-5 text-primary shrink-0" />
              {t.title}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {courseTitle} → {lessonTitle}
            </p>
          </div>
          {hasChanges && (
            <Badge variant="secondary" className="text-xs animate-pulse">
              {isRTL ? 'تعديلات غير محفوظة' : 'Unsaved changes'}
            </Badge>
          )}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleUndo} disabled={!canUndo} title={isRTL ? 'تراجع (Ctrl+Z)' : 'Undo (Ctrl+Z)'}>
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRedo} disabled={!canRedo} title={isRTL ? 'إعادة (Ctrl+Shift+Z)' : 'Redo (Ctrl+Shift+Z)'}>
              <Redo2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="w-4 h-4 me-1" />
              {t.reset}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || !hasChanges} className="min-w-[120px]">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 me-1 animate-spin" />
                  {t.saving}
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 me-1" />
                  {t.preview}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Processing Overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center">
          <div className="w-full max-w-lg mx-4">
            <VideoProcessingProgress
              progress={processingProgress}
              message={processingMessage}
              isActive={isSaving}
              language={language}
            />
            <p className="text-xs text-muted-foreground text-center mt-3">
              {isRTL 
                ? 'يرجى عدم إغلاق الصفحة أثناء المعالجة'
                : 'Please do not close this page during processing'}
            </p>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewUrl && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <Card className="w-full max-w-5xl mx-auto shadow-2xl border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{t.previewTitle}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{t.previewDesc}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleDiscardPreview}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-black rounded-xl overflow-hidden aspect-video shadow-inner">
                <video
                  ref={previewVideoRef}
                  src={previewUrl}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  playsInline
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button variant="outline" size="lg" onClick={handleDiscardPreview}>
                  <RotateCcw className="w-4 h-4 me-2" />
                  {t.discardPreview}
                </Button>
                <Button size="lg" onClick={handleConfirmUpload} className="min-w-[180px]">
                  <Upload className="w-4 h-4 me-2" />
                  {t.confirmUpload}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video Player - 2/3 width */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="overflow-hidden">
              <div ref={containerRef} className="relative bg-black aspect-video">
                {!videoUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
                      <p className="text-muted-foreground">{t.noVideo}</p>
                    </div>
                  </div>
                ) : videoError ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
                      <p className="text-destructive">{t.videoLoadError}</p>
                      <p className="text-xs text-muted-foreground break-all max-w-md">{videoUrl}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="w-full h-full object-contain"
                      onLoadedMetadata={handleLoadedMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={() => setIsPlaying(false)}
                      onError={handleVideoError}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      playsInline
                      crossOrigin="anonymous"
                    />
                    {/* Text Overlays Preview */}
                    {textOverlays.map((overlay) => (
                      <div
                        key={overlay.id}
                        className="absolute pointer-events-none select-none"
                        style={{
                          left: `${overlay.x}%`,
                          top: `${overlay.y}%`,
                          transform: 'translate(-50%, -50%)',
                          color: overlay.color,
                          fontSize: `${overlay.fontSize}px`,
                          fontWeight: 'bold',
                          textShadow: '2px 2px 6px rgba(0,0,0,0.7)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {overlay.text}
                      </div>
                    ))}
                    {/* Trim markers overlay */}
                    {isVideoLoaded && duration > 0 && (trimStart > 0 || trimEnd < duration) && (
                      <div className="absolute bottom-12 left-0 right-0 h-1 bg-white/20">
                        <div
                          className="absolute h-full bg-primary/60"
                          style={{
                            left: `${(trimStart / duration) * 100}%`,
                            width: `${((trimEnd - trimStart) / duration) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Player Controls */}
              {videoUrl && !videoError && (
                <div className="p-3 space-y-2 bg-card">
                  {/* Progress bar */}
                  <Slider
                    value={[currentTime]}
                    max={duration || 1}
                    step={0.1}
                    onValueChange={([val]) => seekTo(val)}
                    className="w-full"
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => skip(-10)}>
                      <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={togglePlay}>
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => skip(10)}>
                      <SkipForward className="w-4 h-4" />
                    </Button>
                    <span className="text-xs font-mono text-muted-foreground min-w-[100px]">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    <div className="flex-1" />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMute}>
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <div className="w-20">
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.05}
                        onValueChange={([val]) => {
                          setVolume(val);
                          if (videoRef.current) videoRef.current.volume = val;
                          if (val > 0 && isMuted) setIsMuted(false);
                        }}
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen}>
                      <Maximize className="w-4 h-4" />
                    </Button>
                  </div>
                  {/* Keyboard shortcuts hint */}
                  <p className="text-[10px] text-muted-foreground text-center">
                    {isRTL
                      ? 'اختصارات: مسافة=تشغيل/إيقاف | ←→=تقديم/ترجيع | I=بداية القص | O=نهاية القص | Ctrl+Z=تراجع | Ctrl+Shift+Z=إعادة | F=شاشة كاملة | M=كتم'
                      : 'Shortcuts: Space=Play/Pause | ←→=Seek | I=Trim start | O=Trim end | Ctrl+Z=Undo | Ctrl+Shift+Z=Redo | F=Fullscreen | M=Mute'}
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* Editor Panel - 1/3 width */}
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="trim" className="text-xs">
                  <Scissors className="w-3.5 h-3.5 me-1" />
                  {isRTL ? 'قص' : 'Trim'}
                </TabsTrigger>
                <TabsTrigger value="text" className="text-xs">
                  <Type className="w-3.5 h-3.5 me-1" />
                  {isRTL ? 'نص' : 'Text'}
                </TabsTrigger>
                <TabsTrigger value="merge" className="text-xs">
                  <Merge className="w-3.5 h-3.5 me-1" />
                  {isRTL ? 'دمج' : 'Merge'}
                </TabsTrigger>
              </TabsList>

              {/* Trim Tab */}
              <TabsContent value="trim" className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground">{t.trimInfo}</p>

                <div className="space-y-4">
                  {/* Start Point */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{t.trimStart}</Label>
                      <Badge variant="outline" className="font-mono text-xs">
                        {formatTime(trimStart)}
                      </Badge>
                    </div>
                    <Slider
                      value={[trimStart]}
                      max={duration || 1}
                      step={0.1}
                      onValueChange={([val]) => {
                        setTrimStart(Math.min(val, trimEnd - 0.5));
                      }}
                      onValueCommit={() => pushSnapshot()}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => seekTo(trimStart)}>
                        <Eye className="w-3 h-3 me-1" />
                        {t.goToStart}
                      </Button>
                      <Button variant="secondary" size="sm" className="flex-1 text-xs" onClick={() => {
                        setTrimStart(currentTime);
                        setTimeout(() => pushSnapshot(), 0);
                        toast.info(`${t.trimStart}: ${formatTime(currentTime)}`);
                      }}>
                        {t.setStart}
                      </Button>
                    </div>
                  </div>

                  {/* End Point */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{t.trimEnd}</Label>
                      <Badge variant="outline" className="font-mono text-xs">
                        {formatTime(trimEnd)}
                      </Badge>
                    </div>
                    <Slider
                      value={[trimEnd]}
                      max={duration || 1}
                      step={0.1}
                      onValueChange={([val]) => {
                        setTrimEnd(Math.max(val, trimStart + 0.5));
                      }}
                      onValueCommit={() => pushSnapshot()}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => seekTo(trimEnd)}>
                        <Eye className="w-3 h-3 me-1" />
                        {t.goToEnd}
                      </Button>
                      <Button variant="secondary" size="sm" className="flex-1 text-xs" onClick={() => {
                        setTrimEnd(currentTime);
                        setTimeout(() => pushSnapshot(), 0);
                        toast.info(`${t.trimEnd}: ${formatTime(currentTime)}`);
                      }}>
                        {t.setEnd}
                      </Button>
                    </div>
                  </div>

                  {/* Duration info */}
                  <Card className="bg-muted/50">
                    <CardContent className="p-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm">
                        {t.durationAfterTrim}: <strong className="font-mono">{formatTime(trimEnd - trimStart)}</strong>
                      </span>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Text Tab */}
              <TabsContent value="text" className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground">{t.textInfo}</p>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">{t.textContent}</Label>
                    <Input
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      placeholder={isRTL ? 'أدخل النص هنا...' : 'Enter text here...'}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">{t.textColorLabel}</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="w-8 h-8 rounded border cursor-pointer"
                        />
                        <span className="text-xs font-mono">{textColor}</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">{t.textSizeLabel}: {textSize}px</Label>
                      <Slider
                        value={[textSize]}
                        min={12}
                        max={72}
                        step={2}
                        onValueChange={([val]) => setTextSize(val)}
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">{t.posX}: {textX}%</Label>
                      <Slider value={[textX]} max={100} onValueChange={([val]) => setTextX(val)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">{t.posY}: {textY}%</Label>
                      <Slider value={[textY]} max={100} onValueChange={([val]) => setTextY(val)} className="mt-1" />
                    </div>
                  </div>

                  <Button onClick={addTextOverlay} disabled={!newText.trim()} size="sm" className="w-full">
                    <Type className="w-4 h-4 me-1" />
                    {t.addTextBtn}
                  </Button>
                </div>

                <Separator />

                {textOverlays.length > 0 ? (
                  <div className="space-y-2">
                    {textOverlays.map((overlay) => (
                      <div key={overlay.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: overlay.color }} />
                        <span className="flex-1 text-sm truncate">{overlay.text}</span>
                        <Badge variant="secondary" className="text-[10px]">{overlay.fontSize}px</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTextOverlay(overlay.id)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">{t.noOverlays}</p>
                )}
              </TabsContent>

              {/* Merge Tab */}
              <TabsContent value="merge" className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground">{t.mergeInfo}</p>

                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button
                      variant={mergePosition === 'before' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setMergePosition('before')}
                    >
                      {texts[language].mergeBefore}
                    </Button>
                    <Button
                      variant={mergePosition === 'after' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setMergePosition('after')}
                    >
                      {texts[language].mergeAfter}
                    </Button>
                  </div>

                  {mergeFile ? (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <FileVideo className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{mergeFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(mergeFile.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setMergeFile(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                      <p className="text-sm text-muted-foreground">{t.mergeVideo}</p>
                      <p className="text-xs text-muted-foreground mt-1">MP4, WebM, MOV</p>
                      <input
                        type="file"
                        className="hidden"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={(e) => setMergeFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;
