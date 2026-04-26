import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, GripVertical, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

interface ChapterManagerProps {
  courseId: string;
}

export const ChapterManager = ({ courseId }: ChapterManagerProps) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');

  const { data: chapters = [], isLoading } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const maxOrder = chapters.length ? Math.max(...chapters.map(c => c.sort_order)) : 0;
      const { error } = await supabase.from('chapters').insert({
        course_id: courseId,
        title,
        title_ar: titleAr,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', courseId] });
      toast.success(isRTL ? 'تم إنشاء الفصل' : 'Chapter created');
      resetForm();
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
      queryClient.invalidateQueries({ queryKey: ['chapters', courseId] });
      toast.success(isRTL ? 'تم تحديث الفصل' : 'Chapter updated');
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Unlink lessons first
      await supabase.from('lessons').update({ chapter_id: null }).eq('chapter_id', id);
      const { error } = await supabase.from('chapters').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', courseId] });
      queryClient.invalidateQueries({ queryKey: ['instructor-lessons', courseId] });
      toast.success(isRTL ? 'تم حذف الفصل' : 'Chapter deleted');
    },
  });

  const resetForm = () => {
    setTitle('');
    setTitleAr('');
    setEditingChapter(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (chapter: any) => {
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          {isRTL ? 'الفصول' : 'Chapters'}
        </h3>
        <Button size="sm" variant="outline" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="w-3 h-3 me-1" />
          {isRTL ? 'فصل جديد' : 'New Chapter'}
        </Button>
      </div>

      {chapters.map((chapter) => (
        <div key={chapter.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">
            {isRTL ? (chapter.title_ar || chapter.title) : (chapter.title || chapter.title_ar)}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(chapter)}>
            <Edit className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(chapter.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}

      {chapters.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground text-center py-2">
          {isRTL ? 'لا توجد فصول بعد' : 'No chapters yet'}
        </p>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingChapter ? (isRTL ? 'تعديل الفصل' : 'Edit Chapter') : (isRTL ? 'فصل جديد' : 'New Chapter')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'العنوان (إنجليزي)' : 'Title (English)'}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'العنوان (عربي)' : 'Title (Arabic)'}</Label>
              <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} dir="rtl" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {isRTL ? 'حفظ' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
