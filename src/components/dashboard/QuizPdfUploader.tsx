import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface QuizPdfUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  courseId: string;
  onSuccess: () => void;
}

export const QuizPdfUploader = ({ open, onOpenChange, chapterId, courseId, onSuccess }: QuizPdfUploaderProps) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const t = isRTL ? {
    title: 'رفع كويز PDF',
    titleEn: 'العنوان (إنجليزي)',
    titleAr: 'العنوان (عربي)',
    selectFile: 'اختر ملف PDF',
    upload: 'رفع',
    cancel: 'إلغاء',
    uploading: 'جاري الرفع...',
    success: 'تم رفع الكويز بنجاح',
    error: 'حدث خطأ أثناء الرفع',
  } : {
    title: 'Upload PDF Quiz',
    titleEn: 'Title (English)',
    titleAr: 'Title (Arabic)',
    selectFile: 'Select PDF File',
    upload: 'Upload',
    cancel: 'Cancel',
    uploading: 'Uploading...',
    success: 'Quiz uploaded successfully',
    error: 'Error uploading quiz',
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const path = `quiz-files/${courseId}/${chapterId}/${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage.from('lesson-files').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('lesson-files').getPublicUrl(path);

      const { error: dbError } = await supabase.from('quizzes' as any).insert({
        chapter_id: chapterId,
        course_id: courseId,
        title: title || file.name,
        title_ar: titleAr || file.name,
        quiz_type: 'pdf',
        file_url: publicUrl,
        sort_order: 0,
      });
      if (dbError) throw dbError;

      toast.success(t.success);
      setTitle('');
      setTitleAr('');
      setFile(null);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(t.error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t.titleEn}</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t.titleAr}</Label>
            <Input value={titleAr} onChange={e => setTitleAr(e.target.value)} dir="rtl" />
          </div>
          <div className="space-y-2">
            <Label>{t.selectFile}</Label>
            <Input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
            <Button onClick={handleUpload} disabled={!file || uploading} className="btn-gold">
              {uploading ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t.uploading}</> : <><Upload className="w-4 h-4 me-2" />{t.upload}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
