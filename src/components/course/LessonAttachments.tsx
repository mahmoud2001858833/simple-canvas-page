import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileText, HelpCircle, Download, Eye, Lock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface LessonAttachmentsProps {
  lessonId: string;
  isRTL: boolean;
  isEnrolled?: boolean;
}

export const LessonAttachments = ({ lessonId, isRTL, isEnrolled = false }: LessonAttachmentsProps) => {
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

  if (attachments.length === 0) return null;

  const getPreviewUrl = (fileUrl: string, fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    if (imageExts.includes(ext)) return fileUrl;
    // Use Google Docs Viewer for PDF/Office files
    return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
  };

  const handlePreview = (fileUrl: string, fileName: string) => {
    const url = getPreviewUrl(fileUrl, fileName);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(fileUrl, '_blank');
    }
  };

  const renderList = (items: typeof attachments) => (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          {isRTL ? 'لا توجد ملفات' : 'No files'}
        </p>
      ) : (
        items.map((att) => (
          <div
            key={att.id}
            className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors group"
          >
            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{att.file_name}</p>
              {att.file_size && (
                <p className="text-xs text-muted-foreground">
                  {(att.file_size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {isEnrolled ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handlePreview(att.file_url, att.file_name)}
                    title={isRTL ? 'معاينة' : 'Preview'}
                  >
                    <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(att.file_url, att.file_name)}
                    title={isRTL ? 'تنزيل' : 'Download'}
                  >
                    <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Lock className="w-4 h-4" />
                  <span className="text-xs">{isRTL ? 'اشترك للتنزيل' : 'Enroll to download'}</span>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const hasFiles = files.length > 0;
  const hasQuestions = questions.length > 0;

  // If only one category, show without tabs
  if (hasFiles && !hasQuestions) {
    return (
      <div className="mt-6 border rounded-lg p-4 bg-card">
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          {isRTL ? 'ملفات مرفقة' : 'Attached Files'}
        </h3>
        {renderList(files)}
      </div>
    );
  }

  if (!hasFiles && hasQuestions) {
    return (
      <div className="mt-6 border rounded-lg p-4 bg-card">
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-primary" />
          {isRTL ? 'أسئلة مرفقة' : 'Practice Questions'}
        </h3>
        {renderList(questions)}
      </div>
    );
  }

  return (
    <div className="mt-6 border rounded-lg p-4 bg-card">
      <Tabs defaultValue="files" dir={isRTL ? 'rtl' : 'ltr'}>
        <TabsList className="w-full">
          <TabsTrigger value="files" className="flex-1 gap-1">
            <FileText className="w-4 h-4" />
            {isRTL ? 'ملفات الشرح' : 'Lesson Files'}
            <span className="text-xs bg-primary/10 text-primary rounded-full px-1.5">{files.length}</span>
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex-1 gap-1">
            <HelpCircle className="w-4 h-4" />
            {isRTL ? 'الأسئلة' : 'Questions'}
            <span className="text-xs bg-primary/10 text-primary rounded-full px-1.5">{questions.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="files" className="mt-3">
          {renderList(files)}
        </TabsContent>
        <TabsContent value="questions" className="mt-3">
          {renderList(questions)}
        </TabsContent>
      </Tabs>
    </div>
  );
};
