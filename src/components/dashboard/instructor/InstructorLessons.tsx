import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import DualVideoUploader from '@/components/dashboard/DualVideoUploader';
import { LessonFileUploader } from '@/components/dashboard/LessonFileUploader';
import { ChapterFileUploader } from '@/components/dashboard/ChapterFileUploader';
import { QuizPdfUploader } from '@/components/dashboard/QuizPdfUploader';
import { QuizEditor } from '@/components/dashboard/QuizEditor';
import { 
  ArrowLeft, Plus, Edit, Trash2, Video, GripVertical,
  Eye, Clock, FileVideo, FolderOpen, FileText, ClipboardList, Upload, ChevronDown, Sparkles, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { triggerTranscriptGeneration } from '@/lib/generateTranscript';
import { VideoDurationDetector } from '@/components/dashboard/VideoDurationDetector';
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

interface InstructorLessonsProps {
  courseId: string;
  courseTitle: string;
  chapterId?: string;
  chapterTitle?: string;
  onBack: () => void;
}

export const InstructorLessons = ({ courseId, courseTitle, chapterId, chapterTitle, onBack }: InstructorLessonsProps) => {
  const { dir } = useLanguage();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [draftLessonId, setDraftLessonId] = useState<string | null>(null);
  const [showFileUploader, setShowFileUploader] = useState(false);
  const [showQuizPdf, setShowQuizPdf] = useState(false);
  const [showQuizEditor, setShowQuizEditor] = useState(false);
  const [generatingTranscript, setGeneratingTranscript] = useState<string | null>(null);

  const handleGenerateTranscript = async (lessonId: string) => {
    setGeneratingTranscript(lessonId);
    try {
      await triggerTranscriptGeneration(lessonId);
      toast.success(language === 'ar' ? 'تم بدء توليد المحتوى الذكي' : 'AI content generation started');
    } catch {
      toast.error(language === 'ar' ? 'حدث خطأ' : 'Error generating transcript');
    } finally {
      setTimeout(() => setGeneratingTranscript(null), 2000);
    }
  };

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
    chapter_id: '',
  });

  const t = language === 'ar' ? {
    back: chapterId ? 'رجوع للفصول' : 'رجوع للدورات',
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
    chapter: 'الفصل',
    noChapter: 'بدون فصل',
  } : {
    back: chapterId ? 'Back to Chapters' : 'Back to Courses',
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
    chapter: 'Chapter',
    noChapter: 'No Chapter',
  };

  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', courseId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: lessons, isLoading } = useQuery({
    queryKey: ['instructor-lessons', courseId, chapterId],
    queryFn: async () => {
      let query = supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('sort_order', { ascending: true });
      if (chapterId) {
        query = query.eq('chapter_id', chapterId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch chapter files
  const { data: chapterFiles = [] } = useQuery({
    queryKey: ['instructor-chapter-files', courseId, chapterId],
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
    queryKey: ['instructor-chapter-quizzes', courseId, chapterId],
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
    queryClient.invalidateQueries({ queryKey: ['instructor-chapter-files', courseId, chapterId] });
    toast.success(language === 'ar' ? 'تم حذف الملف' : 'File deleted');
  };

  const deleteQuiz = async (id: string) => {
    await supabase.from('quizzes' as any).delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['instructor-chapter-quizzes', courseId, chapterId] });
    toast.success(language === 'ar' ? 'تم حذف الكويز' : 'Quiz deleted');
  };

  const invalidateContent = () => {
    queryClient.invalidateQueries({ queryKey: ['instructor-chapter-files', courseId, chapterId] });
    queryClient.invalidateQueries({ queryKey: ['instructor-chapter-quizzes', courseId, chapterId] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const maxOrder = lessons?.length ? Math.max(...lessons.map(l => l.sort_order || 0)) : 0;
      const insertData: any = {
        ...data,
        course_id: courseId,
        duration_minutes: parseInt(data.duration_minutes) || 0,
        sort_order: maxOrder + 1,
      };
      if (data.chapter_id) insertData.chapter_id = data.chapter_id;
      else delete insertData.chapter_id;
      
      const { data: created, error } = await supabase.from('lessons').insert([insertData]).select().single();
      if (error) throw error;
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['instructor-lessons', courseId, chapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapter-lesson-counts', courseId] });
      toast.success(t.lessonCreated);
      // Switch to edit mode so user can attach files
      setEditingLesson(created);
    },
    onError: (error: any) => {
      console.error('Create lesson error:', error);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء إنشاء الدرس' : 'Error creating lesson');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const updateData: any = {
        ...data,
        duration_minutes: parseInt(data.duration_minutes) || 0,
        chapter_id: data.chapter_id || null,
      };
      const { error } = await supabase.from('lessons').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['instructor-lessons', courseId, chapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapter-lesson-counts', courseId] });
      toast.success(t.lessonUpdated);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error('Update lesson error:', error);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء تحديث الدرس' : 'Error updating lesson');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lessons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-lessons', courseId, chapterId] });
      queryClient.invalidateQueries({ queryKey: ['chapter-lesson-counts', courseId] });
      toast.success(t.lessonDeleted);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '', title_ar: '', description: '', duration_minutes: '',
      video_url: '', video_url_480p: '', video_url_720p: '', video_url_1080p: '',
      is_preview: false, is_live: false, live_url: '', chapter_id: '',
    });
    setEditingLesson(null);
  };

  const handleEdit = (lesson: any) => {
    setEditingLesson(lesson);
    setFormData({
      title: lesson.title, title_ar: lesson.title_ar,
      description: lesson.description || '', duration_minutes: lesson.duration_minutes?.toString() || '',
      video_url: lesson.video_url || '', video_url_480p: lesson.video_url_480p || '',
      video_url_720p: lesson.video_url_720p || '', video_url_1080p: lesson.video_url_1080p || '',
      is_preview: lesson.is_preview || false, is_live: lesson.is_live || false,
      live_url: lesson.live_url || '', chapter_id: lesson.chapter_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingLesson) {
      updateMutation.mutate({ id: editingLesson.id, data: formData });
    }
  };


  const renderLessonItem = (lesson: any, index: number) => (
    <div key={lesson.id} className="card-premium p-4 flex items-center gap-4 group">
      <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab opacity-50 group-hover:opacity-100" />
      <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">
          {lesson.title_ar || lesson.title}
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
              <Eye className="w-3 h-3 me-1" />{t.preview}
            </Badge>
          )}
          {lesson.is_live && <Badge className="bg-destructive text-xs">{t.live}</Badge>}
        </div>
      </div>
      <Badge variant={lesson.video_url ? 'default' : 'outline'} className="text-xs">
        {lesson.video_url ? t.hasVideo : t.noVideo}
      </Badge>
      <div className="flex items-center gap-1">
        {lesson.video_url && (
          <>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => handleGenerateTranscript(lesson.id)}
              disabled={generatingTranscript === lesson.id}
              title={language === 'ar' ? 'توليد المحتوى الذكي' : 'Generate AI Content'}
            >
              {generatingTranscript === lesson.id ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <Sparkles className="w-4 h-4 text-primary" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate(`/instructor/video-editor/${lesson.id}`)}>
              <FileVideo className="w-4 h-4 text-primary" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={() => handleEdit(lesson)}>
          <Edit className="w-4 h-4" />
        </Button>
        {/* Delete restricted to admins per platform policy */}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 me-2" />{t.back}
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">
              {chapterTitle ? `${t.lessonsFor} ${chapterTitle}` : t.lessonsFor}
            </p>
            <h1 className="text-xl font-bold">{courseTitle}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button className="btn-gold" onClick={async () => {
            const maxOrder = lessons?.length ? Math.max(...lessons.map(l => l.sort_order || 0)) : 0;
            const { data: created, error } = await supabase.from('lessons').insert([{
              course_id: courseId,
              title: '',
              title_ar: '',
              sort_order: maxOrder + 1,
              duration_minutes: 0,
              chapter_id: chapterId || null,
            }]).select().single();
            if (error) {
              toast.error(language === 'ar' ? 'حدث خطأ' : 'Error creating lesson');
              return;
            }
            queryClient.invalidateQueries({ queryKey: ['instructor-lessons', courseId, chapterId] });
            setEditingLesson(created);
            setDraftLessonId(created.id);
            setFormData({
              title: '', title_ar: '', description: '', duration_minutes: '',
              video_url: '', video_url_480p: '', video_url_720p: '', video_url_1080p: '',
              is_preview: false, is_live: false, live_url: '', chapter_id: chapterId || '',
            });
            setIsDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 me-2" />
            {language === 'ar' ? 'درس جديد' : 'New Lesson'}
          </Button>
          
          {chapterId && (
            <DropdownMenuRoot>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Upload className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'إضافة محتوى' : 'Add Content'}
                  <ChevronDown className="w-4 h-4 ms-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setShowFileUploader(true)}>
                  <FileText className="w-4 h-4 me-2" />
                  {language === 'ar' ? 'رفع ملف' : 'Upload File'}
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ClipboardList className="w-4 h-4 me-2" />
                    {language === 'ar' ? 'إضافة كويز' : 'Add Quiz'}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setShowQuizPdf(true)}>
                      <FileText className="w-4 h-4 me-2" />
                      {language === 'ar' ? 'كويز PDF' : 'PDF Quiz'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowQuizEditor(true)}>
                      <ClipboardList className="w-4 h-4 me-2" />
                      {language === 'ar' ? 'كويز إلكتروني' : 'Interactive Quiz'}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenuRoot>
          )}
        </div>
      </div>

      {/* Lessons List */}
      <div className="space-y-2">
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
        ) : (lessons?.length || 0) === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t.noLessons}</p>
          </div>
        ) : (
          lessons?.map((lesson, i) => renderLessonItem(lesson, i))
        )}
      </div>

      {/* Chapter Files */}
      {chapterId && chapterFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />{language === 'ar' ? 'الملفات' : 'Files'}
          </h3>
          {chapterFiles.map((file: any) => (
            <div key={file.id} className="card-premium p-3 flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{language === 'ar' ? file.title_ar : file.title}</p>
              </div>
              <Badge variant="outline" className="text-xs">{language === 'ar' ? 'ملف' : 'File'}</Badge>
              {/* Delete restricted to admins per platform policy */}
            </div>
          ))}
        </div>
      )}

      {/* Quizzes */}
      {chapterId && chapterQuizzes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />{language === 'ar' ? 'الكويزات' : 'Quizzes'}
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
              {/* Delete restricted to admins per platform policy */}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLesson ? t.editLesson : t.newLesson}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Titles */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.titleEn}</Label>
                <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t.titleAr}</Label>
                <Input value={formData.title_ar} onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })} dir="rtl" />
              </div>
            </div>

            {/* Chapter Selection */}
            <div className="space-y-2">
              <Label>{t.chapter}</Label>
              <Select value={formData.chapter_id} onValueChange={(v) => setFormData({ ...formData, chapter_id: v === '__none__' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t.noChapter} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t.noChapter}</SelectItem>
                  {chapters.map(ch => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {language === 'ar' ? (ch.title_ar || ch.title) : (ch.title || ch.title_ar)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>{t.description}</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>{t.duration}</Label>
              <div className="flex gap-2">
                <Input type="number" value={formData.duration_minutes} onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })} min={0} />
                <VideoDurationDetector onDetected={(m) => setFormData({ ...formData, duration_minutes: String(m) })} />
              </div>
            </div>

            {/* Video Upload */}
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
                      queryClient.invalidateQueries({ queryKey: ['instructor-lessons', courseId, chapterId] });
                    }
                  }
                }}
                currentVideoKey={formData.video_url}
                disabled={false}
              />
            </div>

            {/* File Attachments - always visible */}
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
                <Switch checked={formData.is_preview} onCheckedChange={(checked) => setFormData({ ...formData, is_preview: checked })} />
                <Label>{t.isPreview}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.is_live} onCheckedChange={(checked) => setFormData({ ...formData, is_live: checked })} />
                <Label>{t.isLive}</Label>
              </div>
            </div>

            {formData.is_live && (
              <div className="space-y-2">
                <Label>{t.liveUrl}</Label>
                <Input value={formData.live_url} onChange={(e) => setFormData({ ...formData, live_url: e.target.value })} placeholder="https://zoom.us/j/..." />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={createMutation.isPending || updateMutation.isPending}>
                {t.cancel}
              </Button>
              <Button onClick={handleSubmit} className="btn-gold" disabled={createMutation.isPending || updateMutation.isPending}>
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
      {/* Content Type Dialogs */}
      {chapterId && (
        <>
          <ChapterFileUploader open={showFileUploader} onOpenChange={setShowFileUploader} chapterId={chapterId} courseId={courseId} onSuccess={invalidateContent} />
          <QuizPdfUploader open={showQuizPdf} onOpenChange={setShowQuizPdf} chapterId={chapterId} courseId={courseId} onSuccess={invalidateContent} />
          <QuizEditor open={showQuizEditor} onOpenChange={setShowQuizEditor} chapterId={chapterId} courseId={courseId} onSuccess={invalidateContent} />
        </>
      )}
    </div>
  );
};
