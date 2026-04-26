import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Trash2, FileText, Loader2, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

interface LessonFileUploaderProps {
  lessonId: string;
}

export const LessonFileUploader = ({ lessonId }: LessonFileUploaderProps) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const queryClient = useQueryClient();
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingQuestion, setUploadingQuestion] = useState(false);

  const { data: attachments = [] } = useQuery({
    queryKey: ['lesson-attachments', lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_attachments')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId,
  });

  const files = attachments.filter(a => (a as Record<string, unknown>).file_category !== 'question');
  const questions = attachments.filter(a => (a as Record<string, unknown>).file_category === 'question');

  const deleteMutation = useMutation({
    mutationFn: async (attachment: any) => {
      const path = attachment.file_url.replace(/^.*lesson-files\//, '');
      await supabase.storage.from('lesson-files').remove([path]);
      const { error } = await supabase.from('lesson_attachments').delete().eq('id', attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-attachments', lessonId] });
      toast.success(isRTL ? 'تم حذف الملف' : 'File deleted');
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: 'file' | 'question') => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const setUploading = category === 'file' ? setUploadingFile : setUploadingQuestion;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const originalName = file.name || 'file';
        const extension = originalName.includes('.') ? originalName.split('.').pop() : undefined;
        const baseName = originalName.replace(/\.[^/.]+$/, '');
        const safeBaseName = baseName
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 80);
        const finalFileName = `${safeBaseName || 'file'}${extension ? `.${extension.toLowerCase()}` : ''}`;
        const filePath = `${lessonId}/${Date.now()}-${finalFileName}`;

        const { error: uploadError } = await supabase.storage
          .from('lesson-files')
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('lesson-files')
          .getPublicUrl(filePath);

        const maxOrder = attachments.length ? Math.max(...attachments.map(a => a.sort_order)) : 0;

        const { error: insertError } = await supabase.from('lesson_attachments').insert({
          lesson_id: lessonId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type || file.name.split('.').pop() || 'unknown',
          file_size: file.size,
          sort_order: maxOrder + 1,
          file_category: category,
        } as any);
        if (insertError) throw insertError;
      }
      queryClient.invalidateQueries({ queryKey: ['lesson-attachments', lessonId] });
      toast.success(isRTL ? 'تم رفع الملفات' : 'Files uploaded');
    } catch (err: any) {
      console.error('Upload error details:', err);
      const errorMsg = err?.message || err?.error_description || JSON.stringify(err);
      toast.error(isRTL ? `خطأ في رفع الملف: ${errorMsg}` : `Upload error: ${errorMsg}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const renderList = (items: any[], uploading: boolean, category: 'file' | 'question') => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          type="file"
          multiple
          onChange={(e) => handleUpload(e, category)}
          disabled={uploading}
          className="flex-1"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar,.png,.jpg,.jpeg"
        />
        {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
      </div>
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((att) => (
            <div key={att.id} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm flex-1 truncate">{att.file_name}</span>
              <span className="text-xs text-muted-foreground">
                {att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : ''}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => deleteMutation.mutate(att)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-card">
      <Label className="text-base font-semibold">
        {isRTL ? '📎 المرفقات' : '📎 Attachments'}
      </Label>
      <Tabs defaultValue="files" dir={isRTL ? 'rtl' : 'ltr'}>
        <TabsList className="w-full">
          <TabsTrigger value="files" className="flex-1 gap-1">
            <FileText className="w-4 h-4" />
            {isRTL ? 'ملفات الشرح' : 'Lesson Files'}
            {files.length > 0 && <span className="text-xs bg-primary/10 text-primary rounded-full px-1.5">{files.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex-1 gap-1">
            <HelpCircle className="w-4 h-4" />
            {isRTL ? 'الأسئلة' : 'Questions'}
            {questions.length > 0 && <span className="text-xs bg-primary/10 text-primary rounded-full px-1.5">{questions.length}</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="files" className="mt-3">
          {renderList(files, uploadingFile, 'file')}
        </TabsContent>
        <TabsContent value="questions" className="mt-3">
          {renderList(questions, uploadingQuestion, 'question')}
        </TabsContent>
      </Tabs>
    </div>
  );
};
