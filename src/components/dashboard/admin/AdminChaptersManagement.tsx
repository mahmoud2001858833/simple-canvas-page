import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Plus, Edit, Trash2, GripVertical, FolderOpen, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { LessonsManagement } from './LessonsManagement';

interface AdminChaptersManagementProps {
  courseId: string;
  courseTitle: string;
  onBack: () => void;
}

export const AdminChaptersManagement = ({ courseId, courseTitle, onBack }: AdminChaptersManagementProps) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [selectedChapter, setSelectedChapter] = useState<{ id: string; title: string } | null>(null);

  const t = isRTL ? {
    back: 'رجوع للكورسات',
    chaptersFor: 'فصول:',
    newChapter: 'فصل جديد',
    editChapter: 'تعديل الفصل',
    titleEn: 'العنوان (إنجليزي)',
    titleAr: 'العنوان (عربي)',
    save: 'حفظ',
    cancel: 'إلغاء',
    noChapters: 'لا توجد فصول بعد',
    chapterCreated: 'تم إنشاء الفصل',
    chapterUpdated: 'تم تحديث الفصل',
    chapterDeleted: 'تم حذف الفصل',
    lessons: 'درس',
    createFirst: 'أنشئ فصلاً لتنظيم دروس الكورس',
  } : {
    back: 'Back to Courses',
    chaptersFor: 'Chapters for:',
    newChapter: 'New Chapter',
    editChapter: 'Edit Chapter',
    titleEn: 'Title (English)',
    titleAr: 'Title (Arabic)',
    save: 'Save',
    cancel: 'Cancel',
    noChapters: 'No chapters yet',
    chapterCreated: 'Chapter created',
    chapterUpdated: 'Chapter updated',
    chapterDeleted: 'Chapter deleted',
    lessons: 'lessons',
    createFirst: 'Create a chapter to organize your course lessons',
  };

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ['admin-chapters', courseId],
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

  const { data: lessonCounts = {} } = useQuery({
    queryKey: ['admin-chapter-lesson-counts', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('chapter_id')
        .eq('course_id', courseId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach(l => {
        if (l.chapter_id) {
          counts[l.chapter_id] = (counts[l.chapter_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const maxOrder = chapters.length ? Math.max(...chapters.map(c => c.sort_order)) : 0;
      const { data, error } = await supabase.from('chapters').insert({
        course_id: courseId,
        title,
        title_ar: titleAr,
        sort_order: maxOrder + 1,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-chapters', courseId] });
      toast.success(t.chapterCreated);
      const newTitle = isRTL ? (data.title_ar || data.title) : (data.title || data.title_ar);
      resetForm();
      setSelectedChapter({ id: data.id, title: newTitle });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('chapters')
        .update({ title, title_ar: titleAr })
        .eq('id', editingChapter.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-chapters', courseId] });
      toast.success(t.chapterUpdated);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('lessons').update({ chapter_id: null }).eq('chapter_id', id);
      const { error } = await supabase.from('chapters').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-chapters', courseId] });
      queryClient.invalidateQueries({ queryKey: ['admin-chapter-lesson-counts', courseId] });
      toast.success(t.chapterDeleted);
    },
  });

  const resetForm = () => {
    setTitle('');
    setTitleAr('');
    setEditingChapter(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (chapter: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChapter(chapter);
    setTitle(chapter.title);
    setTitleAr(chapter.title_ar);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingChapter) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  // If a chapter is selected, show lessons for that chapter
  if (selectedChapter) {
    return (
      <LessonsManagement
        courseId={courseId}
        courseTitle={`${courseTitle} - ${selectedChapter.title}`}
        chapterId={selectedChapter.id}
        onBack={() => setSelectedChapter(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 me-2" />{t.back}
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">{t.chaptersFor}</p>
            <h1 className="text-xl font-bold">{courseTitle}</h1>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="btn-gold">
          <Plus className="w-4 h-4 me-2" />{t.newChapter}
        </Button>
      </div>

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
        ) : chapters.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">{t.noChapters}</p>
            <p className="text-sm mt-1">{t.createFirst}</p>
          </div>
        ) : (
          chapters.map((chapter, index) => {
            const count = lessonCounts[chapter.id] || 0;
            const chapterTitle = isRTL ? (chapter.title_ar || chapter.title) : (chapter.title || chapter.title_ar);
            return (
              <div
                key={chapter.id}
                className="card-premium p-4 flex items-center gap-4 group cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedChapter({ id: chapter.id, title: chapterTitle })}
              >
                <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab opacity-50 group-hover:opacity-100" />
                <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{chapterTitle}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <BookOpen className="w-3 h-3 me-1" />
                      {count} {t.lessons}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={(e) => handleEdit(chapter, e)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(chapter.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingChapter ? t.editChapter : t.newChapter}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.titleEn}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t.titleAr}</Label>
              <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} dir="rtl" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm}>{t.cancel}</Button>
              <Button onClick={handleSubmit} className="btn-gold" disabled={createMutation.isPending || updateMutation.isPending}>
                {t.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
