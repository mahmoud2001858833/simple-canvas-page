import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChapterFileUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  courseId: string;
  onSuccess: () => void;
}

export const ChapterFileUploader = ({ open, onOpenChange, chapterId, courseId, onSuccess }: ChapterFileUploaderProps) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const t = isRTL ? {
    uploadFile: 'رفع ملف',
    titleEn: 'العنوان (إنجليزي)',
    titleAr: 'العنوان (عربي)',
    selectFile: 'اختر ملف',
    upload: 'رفع',
    cancel: 'إلغاء',
    uploading: 'جاري الرفع...',
    success: 'تم رفع الملف بنجاح',
    error: 'حدث خطأ أثناء الرفع',
  } : {
    uploadFile: 'Upload File',
    titleEn: 'Title (English)',
    titleAr: 'Title (Arabic)',
    selectFile: 'Select File',
    upload: 'Upload',
    cancel: 'Cancel',
    uploading: 'Uploading...',
    success: 'File uploaded successfully',
    error: 'Error uploading file',
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `chapter-files/${courseId}/${chapterId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('lesson-files').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('lesson-files').getPublicUrl(path);

      const { error: dbError } = await supabase.from('chapter_files' as any).insert({
        chapter_id: chapterId,
        course_id: courseId,
        title: title || file.name,
        title_ar: titleAr || file.name,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
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
          <DialogTitle>{t.uploadFile}</DialogTitle>
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
            <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
            {file && <p className="text-xs text-muted-foreground">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>}
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
