import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import DualVideoUploader from '@/components/dashboard/DualVideoUploader';
import { VideoDurationDetector } from '@/components/dashboard/VideoDurationDetector';
import { LessonFileUploader } from '@/components/dashboard/LessonFileUploader';
import { ChapterFileUploader } from '@/components/dashboard/ChapterFileUploader';
import { QuizPdfUploader } from '@/components/dashboard/QuizPdfUploader';
import { QuizEditor } from '@/components/dashboard/QuizEditor';
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Video, 
  FileVideo,
  GripVertical,
  Eye,
  Clock,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  X,
  FileText,
  ClipboardList,
  Upload,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { triggerTranscriptGeneration } from '@/lib/generateTranscript';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu as DropdownMenuRoot,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

const CLOUDFLARE_WORKER_URL = 'https://ancient-king-9e42.mhawish-alaa.workers.dev';

interface LessonsManagementProps {
  courseId: string;
  courseTitle: string;
  chapterId?: string;
  onBack: () => void;
}

export const LessonsManagement = ({ courseId, courseTitle, chapterId, onBack }: LessonsManagementProps) => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: '',
    title_ar: '',
    description: '',
    duration_minutes: '',
    video_url: '',
    video_url_480p: '',
    video_url_720p: '',
    video_url_1080p: '',
    is_preview: false,
    is_live: false,
    live_url: '',
  });

  // Content type dialogs
  const [showFileUploader, setShowFileUploader] = useState(false);
  const [showQuizPdf, setShowQuizPdf] = useState(false);
  const [showQuizEditor, setShowQuizEditor] = useState(false);

  // Video preview state
  const [showPreview, setShowPreview] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isPreviewMuted, setIsPreviewMuted] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const getVideoUrl = (videoKey: string) => {
    if (!videoKey) return null;
    if (videoKey.startsWith('http://') || videoKey.startsWith('https://')) {
      return videoKey;
    }
    const key = videoKey.startsWith('videos/') ? videoKey : `videos/${videoKey}`;
    return `${CLOUDFLARE_WORKER_URL}/video/${key}`;
  };

  const togglePreviewPlay = () => {
    if (previewVideoRef.current) {
      if (isPreviewPlaying) {
        previewVideoRef.current.pause();
      } else {
        previewVideoRef.current.play();
      }
      setIsPreviewPlaying(!isPreviewPlaying);
    }
  };

  const togglePreviewMute = () => {
    if (previewVideoRef.current) {
      previewVideoRef.current.muted = !isPreviewMuted;
      setIsPreviewMuted(!isPreviewMuted);
    }
  };

  const toggleFullscreen = () => {
    if (previewVideoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        previewVideoRef.current.requestFullscreen();
      }
    }
  };

  const texts = {
    ar: {
      back: 'رجوع للدورات',
      lessonsFor: 'دروس:',
      newLesson: 'درس جديد',
      editLesson: 'تعديل الدرس',
      titleEn: 'العنوان (إنجليزي)',
      titleAr: 'العنوان (عربي)',
      description: 'الوصف',
      duration: 'المدة (دقائق)',
      video: 'الفيديو',
      isPreview: 'معاينة مجانية',
      isLive: 'بث مباشر',
      liveUrl: 'رابط البث',
      save: 'حفظ',
      cancel: 'إلغاء',
      noLessons: 'لا توجد دروس بعد',
      lessonCreated: 'تم إنشاء الدرس',
      lessonUpdated: 'تم تحديث الدرس',
      lessonDeleted: 'تم حذف الدرس',
      minutes: 'دقيقة',
      preview: 'معاينة',
      live: 'مباشر',
      hasVideo: 'يوجد فيديو',
      noVideo: 'بدون فيديو',
      previewVideo: 'معاينة الفيديو',
      closePreview: 'إغلاق المعاينة',
      videoPreviewTitle: 'معاينة الفيديو قبل الحفظ',
    },
    en: {
      back: 'Back to Courses',
      lessonsFor: 'Lessons for:',
      newLesson: 'New Lesson',
      editLesson: 'Edit Lesson',
      titleEn: 'Title (English)',
      titleAr: 'Title (Arabic)',
      description: 'Description',
      duration: 'Duration (minutes)',
      video: 'Video',
      isPreview: 'Free Preview',
      isLive: 'Live Session',
      liveUrl: 'Live URL',
      save: 'Save',
      cancel: 'Cancel',
      noLessons: 'No lessons yet',
      lessonCreated: 'Lesson created',
      lessonUpdated: 'Lesson updated',
      lessonDeleted: 'Lesson deleted',
      minutes: 'min',
      preview: 'Preview',
      live: 'Live',
      hasVideo: 'Has video',
      noVideo: 'No video',
      previewVideo: 'Preview Video',
      closePreview: 'Close Preview',
      videoPreviewTitle: 'Video Preview Before Saving',
    },
  };

  const t = texts[language];

  const { data: lessons, isLoading } = useQuery({
    queryKey: ['admin-lessons', courseId, chapterId],
    queryFn: async () => {
      let query = supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId);
      
      if (chapterId) {
        query = query.eq('chapter_id', chapterId);
      }
      
      const { data, error } = await query.order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch unassigned lessons (chapter_id is null) for this course
  const { data: unassignedLessons = [] } = useQuery({
    queryKey: ['admin-unassigned-lessons', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .is('chapter_id', null)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!chapterId, // Only fetch when viewing a specific chapter
  });

  const assignToChapterMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await supabase
        .from('lessons')
        .update({ chapter_id: chapterId })
        .eq('id', lessonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons', courseId] });
      queryClient.invalidateQueries({ queryKey: ['admin-unassigned-lessons', courseId] });
      queryClient.invalidateQueries({ queryKey: ['admin-chapter-lesson-counts', courseId] });
      toast.success(language === 'ar' ? 'تم ربط الدرس بالفصل' : 'Lesson assigned to chapter');
    },
  });

  const assignAllToChapterMutation = useMutation({
    mutationFn: async () => {
      const ids = unassignedLessons.map(l => l.id);
      const { error } = await supabase
        .from('lessons')
        .update({ chapter_id: chapterId })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons', courseId] });
      queryClient.invalidateQueries({ queryKey: ['admin-unassigned-lessons', courseId] });
      queryClient.invalidateQueries({ queryKey: ['admin-chapter-lesson-counts', courseId] });
      toast.success(language === 'ar' ? 'تم ربط جميع الدروس بالفصل' : 'All lessons assigned to chapter');
    },
  });

  // Fetch chapter files
  const { data: chapterFiles = [] } = useQuery({
    queryKey: ['admin-chapter-files', courseId, chapterId],
    queryFn: async () => {
      if (!chapterId) return [];
      const { data, error } = await supabase.from('chapter_files' as any).select('*').eq('chapter_id', chapterId).order('sort_order');
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!chapterId,
  });

  // Fetch quizzes
  const { data: chapterQuizzes = [] } = useQuery({
    queryKey: ['admin-chapter-quizzes', courseId, chapterId],
    queryFn: async () => {
      if (!chapterId) return [];
      const { data, error } = await supabase.from('quizzes' as any).select('*').eq('chapter_id', chapterId).order('sort_order');
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!chapterId,
  });

  const deleteChapterFile = async (id: string) => {
    await supabase.from('chapter_files' as any).delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['admin-chapter-files', courseId, chapterId] });
    toast.success(language === 'ar' ? 'تم حذف الملف' : 'File deleted');
  };

  const deleteQuiz = async (id: string) => {
    await supabase.from('quiz_attempts' as any).delete().eq('quiz_id', id);
    await supabase.from('quiz_options' as any).delete().match({}).in('question_id', 
      (await supabase.from('quiz_questions' as any).select('id').eq('quiz_id', id)).data?.map((q: any) => q.id) || []
    );
    await supabase.from('quiz_questions' as any).delete().eq('quiz_id', id);
    await supabase.from('quizzes' as any).delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['admin-chapter-quizzes', courseId, chapterId] });
    toast.success(language === 'ar' ? 'تم حذف الكويز' : 'Quiz deleted');
  };

  const invalidateContent = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-chapter-files', courseId, chapterId] });
    queryClient.invalidateQueries({ queryKey: ['admin-chapter-quizzes', courseId, chapterId] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const maxOrder = lessons?.length ? Math.max(...lessons.map(l => l.sort_order || 0)) : 0;
      const { data: created, error } = await supabase.from('lessons').insert([{
        ...data,
        course_id: courseId,
        chapter_id: chapterId || null,
        duration_minutes: parseInt(data.duration_minutes) || 0,
        sort_order: maxOrder + 1,
      }]).select().single();
      if (error) throw error;
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons', courseId] });
      toast.success(t.lessonCreated);
      // Switch to edit mode so file uploader works
      setEditingLesson(created);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('lessons')
        .update({
          ...data,
          duration_minutes: parseInt(data.duration_minutes) || 0,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons', courseId] });
      toast.success(t.lessonUpdated);
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lessons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lessons', courseId] });
      toast.success(t.lessonDeleted);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      title_ar: '',
      description: '',
      duration_minutes: '',
      video_url: '',
      video_url_480p: '',
      video_url_720p: '',
      video_url_1080p: '',
      is_preview: false,
      is_live: false,
      live_url: '',
    });
    setEditingLesson(null);
  };

  const handleEdit = (lesson: any) => {
    setEditingLesson(lesson);
    setFormData({
      title: lesson.title,
      title_ar: lesson.title_ar,
      description: lesson.description || '',
      duration_minutes: lesson.duration_minutes?.toString() || '',
      video_url: lesson.video_url || '',
      video_url_480p: lesson.video_url_480p || '',
      video_url_720p: lesson.video_url_720p || '',
      video_url_1080p: lesson.video_url_1080p || '',
      is_preview: lesson.is_preview || false,
      is_live: lesson.is_live || false,
      live_url: lesson.live_url || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingLesson) {
      updateMutation.mutate({ id: editingLesson.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 me-2" />
            {t.back}
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">{t.lessonsFor}</p>
            <h1 className="text-xl font-bold">{courseTitle}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="btn-gold" onClick={async () => {
            const maxOrder = lessons?.length ? Math.max(...lessons.map(l => l.sort_order || 0)) : 0;
            const { data: created, error } = await supabase.from('lessons').insert([{
              course_id: courseId,
              chapter_id: chapterId || null,
              title: '',
              title_ar: '',
              sort_order: maxOrder + 1,
              duration_minutes: 0,
            }]).select().single();
            if (error) {
              toast.error(language === 'ar' ? 'حدث خطأ' : 'Error creating lesson');
              return;
            }
            queryClient.invalidateQueries({ queryKey: ['admin-lessons', courseId] });
            setEditingLesson(created);
            resetForm();
            setIsDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 me-2" />
            {t.newLesson}
          </Button>
          
          {chapterId && (
            <>
              <Button variant="outline" onClick={() => setShowFileUploader(true)}>
                <FileText className="w-4 h-4 me-2" />
                {language === 'ar' ? 'إضافة ملف' : 'Add File'}
              </Button>
              <DropdownMenuRoot>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <ClipboardList className="w-4 h-4 me-2" />
                    {language === 'ar' ? 'إضافة امتحان' : 'Add Quiz'}
                    <ChevronDown className="w-4 h-4 ms-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setShowQuizPdf(true)}>
                    <FileText className="w-4 h-4 me-2" />
                    {language === 'ar' ? 'امتحان PDF' : 'PDF Quiz'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowQuizEditor(true)}>
                    <ClipboardList className="w-4 h-4 me-2" />
                    {language === 'ar' ? 'امتحان إلكتروني' : 'Interactive Quiz'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuRoot>
            </>
          )}
        </div>
      </div>

      {/* Lessons List */}
      <div className="space-y-3">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="card-premium p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-6 h-6" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-5 w-20 ms-auto" />
              </div>
            </div>
          ))
        ) : lessons?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t.noLessons}</p>
          </div>
        ) : (
          lessons?.map((lesson, index) => (
            <div
              key={lesson.id}
              className="card-premium p-4 flex items-center gap-4 group"
            >
              <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab opacity-50 group-hover:opacity-100" />
              
              <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                {index + 1}
              </span>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">
                  {language === 'ar' ? lesson.title_ar : lesson.title}
                </h3>
                <div className="flex flex-wrap gap-2 mt-1">
                  {lesson.duration_minutes > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {lesson.duration_minutes} {t.minutes}
                    </span>
                  )}
                  {lesson.is_preview && (
                    <Badge variant="secondary" className="text-xs">
                      <Eye className="w-3 h-3 me-1" />
                      {t.preview}
                    </Badge>
                  )}
                  {lesson.is_live && (
                    <Badge className="bg-destructive text-xs">
                      {t.live}
                    </Badge>
                  )}
                </div>
              </div>

              <Badge variant={lesson.video_url ? 'default' : 'outline'} className="text-xs">
                {lesson.video_url ? t.hasVideo : t.noVideo}
              </Badge>

              <div className="flex items-center gap-1">
                {lesson.video_url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/instructor/video-editor/${lesson.id}`)}
                    title={language === 'ar' ? 'تعديل الفيديو' : 'Edit Video'}
                  >
                    <FileVideo className="w-4 h-4 text-primary" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => handleEdit(lesson)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(lesson.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Unassigned Lessons */}
      {chapterId && unassignedLessons.length > 0 && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Video className="w-4 h-4" />
              {language === 'ar' ? `دروس غير مربوطة بفصل (${unassignedLessons.length})` : `Unassigned Lessons (${unassignedLessons.length})`}
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => assignAllToChapterMutation.mutate()}
              disabled={assignAllToChapterMutation.isPending}
            >
              <Plus className="w-3 h-3 me-1" />
              {language === 'ar' ? 'ربط الكل بهذا الفصل' : 'Assign all to this chapter'}
            </Button>
          </div>
          {unassignedLessons.map((lesson, index) => (
            <div
              key={lesson.id}
              className="card-premium p-4 flex items-center gap-4 group border-dashed"
            >
              <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">
                  {language === 'ar'
                    ? (lesson.title_ar || lesson.title || `${language === 'ar' ? 'درس' : 'Lesson'} ${index + 1}`)
                    : (lesson.title || lesson.title_ar || `Lesson ${index + 1}`)}
                </h3>
                <div className="flex flex-wrap gap-2 mt-1">
                  {lesson.video_url && (
                    <Badge variant="default" className="text-xs">{language === 'ar' ? 'يوجد فيديو' : 'Has video'}</Badge>
                  )}
                  {lesson.duration_minutes > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {lesson.duration_minutes} {language === 'ar' ? 'دقيقة' : 'min'}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => assignToChapterMutation.mutate(lesson.id)}
                disabled={assignToChapterMutation.isPending}
              >
                <Plus className="w-3 h-3 me-1" />
                {language === 'ar' ? 'ربط بهذا الفصل' : 'Assign here'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {chapterId && chapterFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {language === 'ar' ? 'الملفات' : 'Files'}
          </h3>
          {chapterFiles.map((file: any) => (
            <div key={file.id} className="card-premium p-3 flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{language === 'ar' ? file.title_ar : file.title}</p>
                <p className="text-xs text-muted-foreground">{file.file_name}</p>
              </div>
              <Badge variant="outline" className="text-xs">{language === 'ar' ? 'ملف' : 'File'}</Badge>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteChapterFile(file.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Quizzes */}
      {chapterId && chapterQuizzes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            {language === 'ar' ? 'الكويزات' : 'Quizzes'}
          </h3>
          {chapterQuizzes.map((quiz: any) => (
            <div key={quiz.id} className="card-premium p-3 flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-purple-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{language === 'ar' ? quiz.title_ar : quiz.title}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {quiz.quiz_type === 'pdf' ? 'PDF' : (language === 'ar' ? 'إلكتروني' : 'Interactive')}
              </Badge>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteQuiz(quiz.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLesson ? t.editLesson : t.newLesson}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Titles */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.titleEn}</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.titleAr}</Label>
                <Input
                  value={formData.title_ar}
                  onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                  dir="rtl"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>{t.description}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>{t.duration}</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  min={0}
                />
                <VideoDurationDetector onDetected={(m) => setFormData({ ...formData, duration_minutes: String(m) })} />
              </div>
            </div>

            {/* Video Upload - Dual uploader */}
            <div className="space-y-2">
              <Label>{t.video}</Label>
              <DualVideoUploader
                onUploadComplete={async (videoKey) => {
                  setFormData(prev => ({ ...prev, video_url: videoKey }));
                  // Save video_url directly to DB to prevent race conditions with concurrent uploads
                  if (editingLesson) {
                    const { error } = await supabase.from('lessons').update({ video_url: videoKey }).eq('id', editingLesson.id);
                    if (error) {
                      console.error('Failed to save video URL:', error);
                      toast.error(language === 'ar' ? 'خطأ في حفظ رابط الفيديو' : 'Failed to save video URL');
                    } else {
                      toast.success(language === 'ar' ? 'تم حفظ رابط الفيديو' : 'Video URL saved');
                      queryClient.invalidateQueries({ queryKey: ['admin-lessons', courseId] });
                    }
                  }
                }}
                currentVideoKey={formData.video_url}
                disabled={false}
              />
              
              {/* Video Preview Button */}
              {formData.video_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPreview(true);
                    setIsPreviewPlaying(false);
                  }}
                  className="mt-2"
                >
                  <Eye className="w-4 h-4 me-2" />
                  {t.previewVideo}
                </Button>
              )}
            </div>

            {/* File Attachments */}
            {editingLesson ? (
              <LessonFileUploader lessonId={editingLesson.id} />
            ) : (
              <div className="border rounded-lg p-4 bg-card space-y-3 opacity-60">
                <p className="text-sm font-semibold">📎 {language === 'ar' ? 'المرفقات' : 'Attachments'}</p>
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'جاري تجهيز الدرس...' : 'Preparing lesson...'}
                </p>
              </div>
            )}

            {/* Toggles */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_preview}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_preview: checked })}
                />
                <Label>{t.isPreview}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_live}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_live: checked })}
                />
                <Label>{t.isLive}</Label>
              </div>
            </div>

            {/* Live URL (if live) */}
            {formData.is_live && (
              <div className="space-y-2">
                <Label>{t.liveUrl}</Label>
                <Input
                  value={formData.live_url}
                  onChange={(e) => setFormData({ ...formData, live_url: e.target.value })}
                  placeholder="https://zoom.us/j/..."
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {t.cancel}
              </Button>
              <Button 
                onClick={handleSubmit} 
                className="btn-gold"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
                  </span>
                ) : t.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={(open) => {
        setShowPreview(open);
        if (!open && previewVideoRef.current) {
          previewVideoRef.current.pause();
          setIsPreviewPlaying(false);
        }
      }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center justify-between">
              <span>{t.videoPreviewTitle}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative bg-black aspect-video group">
            {formData.video_url && (
              <video
                ref={previewVideoRef}
                src={getVideoUrl(formData.video_url) || ''}
                className="w-full h-full"
                onPlay={() => setIsPreviewPlaying(true)}
                onPause={() => setIsPreviewPlaying(false)}
                onEnded={() => setIsPreviewPlaying(false)}
                playsInline
              />
            )}
            
            {/* Video Controls Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white"
                  onClick={togglePreviewPlay}
                >
                  {isPreviewPlaying ? (
                    <Pause className="w-8 h-8" />
                  ) : (
                    <Play className="w-8 h-8" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={togglePreviewMute}
                >
                  {isPreviewMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={toggleFullscreen}
                >
                  <Maximize className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="p-4 pt-2 flex justify-end">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              <X className="w-4 h-4 me-2" />
              {t.closePreview}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Content Type Dialogs */}
      {chapterId && (
        <>
          <ChapterFileUploader
            open={showFileUploader}
            onOpenChange={setShowFileUploader}
            chapterId={chapterId}
            courseId={courseId}
            onSuccess={invalidateContent}
          />
          <QuizPdfUploader
            open={showQuizPdf}
            onOpenChange={setShowQuizPdf}
            chapterId={chapterId}
            courseId={courseId}
            onSuccess={invalidateContent}
          />
          <QuizEditor
            open={showQuizEditor}
            onOpenChange={setShowQuizEditor}
            chapterId={chapterId}
            courseId={courseId}
            onSuccess={invalidateContent}
          />
        </>
      )}
    </div>
  );
};
