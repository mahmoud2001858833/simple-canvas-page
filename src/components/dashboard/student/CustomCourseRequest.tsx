import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Upload, X, FileText, Loader2, Sparkles, Brain, 
  Image as ImageIcon, File, CheckCircle2, AlertCircle,
  BookOpen, GraduationCap, Building2, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIClassification {
  university?: string;
  university_en?: string;
  college?: string;
  major?: string;
  subject?: string;
  keywords: string[];
  content_type: string;
  confidence: number;
}

interface UploadedFile {
  file: File;
  progress: number;
  uploaded: boolean;
  url?: string;
  id?: string;
  preview?: string;
  analyzing?: boolean;
  classification?: AIClassification;
  error?: string;
  category: 'image' | 'file'; // New: file category
}

export const CustomCourseRequest = () => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'recorded'>('recorded');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const texts = {
    ar: {
      title: 'طلب كورس مخصص',
      subtitle: 'أرسل صور المادة الدراسية وسيقوم الذكاء الاصطناعي بتحليلها',
      courseTitle: 'عنوان الكورس المطلوب',
      courseTitlePlaceholder: 'مثال: شرح مقرر الرياضيات 101',
      description: 'وصف المتطلبات',
      descriptionPlaceholder: 'اشرح ما تحتاجه بالتفصيل...',
      deliveryMethod: 'طريقة التقديم',
      recorded: 'فيديو مسجل',
      uploadCourseImage: 'رفع صورة المادة',
      uploadCourseFile: 'رفع ملف المادة',
      courseImageHint: 'صور الكتب، المحاضرات، الملخصات',
      courseFileHint: 'PDF، Word، PowerPoint',
      uploadFiles: 'رفع صور المادة الدراسية',
      uploadHint: 'ارفع صور، PDF، Word أو PowerPoint',
      dragDrop: 'اسحب الملفات هنا أو انقر للرفع',
      submit: 'إرسال الطلب',
      submitting: 'جاري الإرسال...',
      successMessage: 'تم إرسال طلبك بنجاح! سنتواصل معك قريباً',
      errorMessage: 'حدث خطأ أثناء إرسال الطلب',
      maxFiles: 'الحد الأقصى 10 ملفات',
      maxSize: 'الحد الأقصى 10MB لكل ملف',
      analyzing: 'جاري التحليل...',
      analysisComplete: 'تم التحليل',
      analysisFailed: 'فشل التحليل',
      aiPowered: 'مدعوم بالذكاء الاصطناعي',
      university: 'الجامعة',
      college: 'الكلية',
      major: 'التخصص',
      subject: 'المادة',
      contentType: 'نوع المحتوى',
      confidence: 'دقة التحليل',
      keywords: 'الكلمات المفتاحية',
      contentTypes: {
        exam: 'اختبار',
        lecture_notes: 'ملاحظات محاضرة',
        slides: 'شرائح عرض',
        summary: 'ملخص',
        assignment: 'واجب',
        book: 'كتاب',
        other: 'أخرى',
      },
      dropHere: 'أفلت الملفات هنا',
      browseFiles: 'تصفح الملفات',
      browseImages: 'تصفح الصور',
      orDragDrop: 'أو اسحب وأفلت',
      supportedFormats: 'PNG, JPG, PDF, DOCX, PPTX',
      imageFormats: 'PNG, JPG, JPEG, WEBP',
      fileFormats: 'PDF, DOCX, PPTX',
      courseImage: 'صورة المادة',
      courseFile: 'ملف المادة',
    },
    en: {
      title: 'Request Custom Course',
      subtitle: 'Upload study material images and AI will analyze them',
      courseTitle: 'Requested Course Title',
      courseTitlePlaceholder: 'Example: Math 101 Explanation',
      description: 'Requirements Description',
      descriptionPlaceholder: 'Describe what you need in detail...',
      deliveryMethod: 'Delivery Method',
      recorded: 'Recorded Video',
      uploadCourseImage: 'Upload Course Image',
      uploadCourseFile: 'Upload Course File',
      courseImageHint: 'Book, lecture, summary images',
      courseFileHint: 'PDF, Word, PowerPoint',
      uploadFiles: 'Upload Study Material Images',
      uploadHint: 'Upload images, PDF, Word or PowerPoint',
      dragDrop: 'Drag files here or click to upload',
      submit: 'Submit Request',
      submitting: 'Submitting...',
      successMessage: 'Your request has been submitted successfully!',
      errorMessage: 'An error occurred while submitting',
      maxFiles: 'Maximum 10 files',
      maxSize: 'Maximum 10MB per file',
      analyzing: 'Analyzing...',
      analysisComplete: 'Analysis complete',
      analysisFailed: 'Analysis failed',
      aiPowered: 'AI-Powered',
      university: 'University',
      college: 'College',
      major: 'Major',
      subject: 'Subject',
      contentType: 'Content Type',
      confidence: 'Analysis Confidence',
      keywords: 'Keywords',
      contentTypes: {
        exam: 'Exam',
        lecture_notes: 'Lecture Notes',
        slides: 'Slides',
        summary: 'Summary',
        assignment: 'Assignment',
        book: 'Book',
        other: 'Other',
      },
      dropHere: 'Drop files here',
      browseFiles: 'Browse Files',
      browseImages: 'Browse Images',
      orDragDrop: 'or drag and drop',
      supportedFormats: 'PNG, JPG, PDF, DOCX, PPTX',
      imageFormats: 'PNG, JPG, JPEG, WEBP',
      fileFormats: 'PDF, DOCX, PPTX',
      courseImage: 'Course Image',
      courseFile: 'Course File',
    },
  };

  const t = texts[language];

  const isImageFile = (file: File) => {
    return file.type.startsWith('image/');
  };

  const createPreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (!isImageFile(file)) {
        resolve(undefined);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (selectedFiles: FileList | null, category: 'image' | 'file') => {
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      if (files.length + newFiles.length >= 10) break;
      const file = selectedFiles[i];
      if (file.size > 10 * 1024 * 1024) {
        toast.error(language === 'ar' ? 'الملف كبير جداً' : 'File too large');
        continue;
      }
      const preview = await createPreview(file);
      newFiles.push({ file, progress: 0, uploaded: false, preview, category });
    }
    setFiles([...files, ...newFiles]);
  };

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files, 'image');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files, 'file');
  };

  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImage(true);
  };

  const handleImageDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImage(false);
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImage(false);
    handleFileChange(e.dataTransfer.files, 'image');
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    handleFileChange(e.dataTransfer.files, 'file');
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return ImageIcon;
    if (file.type.includes('pdf')) return FileText;
    return File;
  };

  const uploadAndAnalyzeFile = async (
    fileItem: UploadedFile, 
    index: number, 
    requestId: string
  ): Promise<{ url: string; fileId: string } | null> => {
    const file = fileItem.file;
    const filePath = `${user?.id}/${requestId}/${Date.now()}_${file.name}`;
    
    // Update progress
    setFiles(prev => prev.map((f, idx) => 
      idx === index ? { ...f, progress: 30 } : f
    ));

    const { error, data } = await supabase.storage
      .from('request-files')
      .upload(filePath, file);

    if (error) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map((f, idx) => 
        idx === index ? { ...f, error: 'Upload failed' } : f
      ));
      return null;
    }

    // Update progress
    setFiles(prev => prev.map((f, idx) => 
      idx === index ? { ...f, progress: 60 } : f
    ));

    const { data: urlData } = supabase.storage
      .from('request-files')
      .getPublicUrl(filePath);

    // Save file reference with category
    const { data: fileRecord, error: fileError } = await supabase
      .from('request_files')
      .insert({
        request_id: requestId,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_category: fileItem.category,
      })
      .select()
      .single();

    if (fileError) {
      console.error('File record error:', fileError);
      return null;
    }

    // Update progress and mark as uploaded
    setFiles(prev => prev.map((f, idx) => 
      idx === index ? { 
        ...f, 
        progress: 100, 
        uploaded: true, 
        url: urlData.publicUrl, 
        id: fileRecord.id,
        analyzing: true 
      } : f
    ));

    return { url: urlData.publicUrl, fileId: fileRecord.id };
  };

  const analyzeFiles = async (requestId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-request-files`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ requestId }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Update files with classifications
        if (data.results) {
          setFiles(prev => prev.map(f => {
            const result = data.results.find((r: any) => r.fileId === f.id);
            if (result) {
              return { 
                ...f, 
                analyzing: false, 
                classification: result.classification 
              };
            }
            return { ...f, analyzing: false };
          }));
        }

        toast.success(language === 'ar' ? 'تم تحليل الملفات بنجاح!' : 'Files analyzed successfully!');
      } else if (response.status === 429) {
        toast.error(language === 'ar' ? 'الرجاء المحاولة لاحقاً' : 'Please try again later');
        setFiles(prev => prev.map(f => ({ ...f, analyzing: false })));
      } else if (response.status === 402) {
        toast.error(language === 'ar' ? 'الرجاء إضافة رصيد' : 'Please add credits');
        setFiles(prev => prev.map(f => ({ ...f, analyzing: false })));
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setFiles(prev => prev.map(f => ({ ...f, analyzing: false, error: 'Analysis failed' })));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error(language === 'ar' ? 'يجب تسجيل الدخول أولاً' : 'Please login first');
      return;
    }

    if (!title.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال عنوان الكورس' : 'Please enter course title');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the request
      const { data: request, error: requestError } = await supabase
        .from('custom_course_requests')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          delivery_method: deliveryMethod,
          status: 'pending',
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Upload files
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          await uploadAndAnalyzeFile(files[i], i, request.id);
        }
        
        // Trigger AI analysis
        await analyzeFiles(request.id);
      }

      toast.success(t.successMessage);
      
      // Reset form
      setTitle('');
      setDescription('');
      setDeliveryMethod('recorded');
      setFiles([]);
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(t.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getContentTypeLabel = (type: string) => {
    return t.contentTypes[type as keyof typeof t.contentTypes] || type;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const deliveryOptions = [
    { value: 'recorded', label: t.recorded, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl font-bold text-foreground">{t.title}</h2>
          <Badge variant="secondary" className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-purple-600 border-purple-200">
            <Sparkles className="w-3 h-3 me-1" />
            {t.aiPowered}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1">{t.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dual Upload Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Course Image Upload */}
          <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-900/10 dark:to-blue-900/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-500" />
                <span>{t.uploadCourseImage}</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t.courseImageHint}</p>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleImageDragOver}
                onDragLeave={handleImageDragLeave}
                onDrop={handleImageDrop}
                onClick={() => imageInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
                  ${isDraggingImage 
                    ? 'border-primary bg-primary/5 scale-[1.02]' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'}
                  ${files.length >= 10 ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  multiple
                  onChange={handleImageInputChange}
                  disabled={files.length >= 10}
                  className="hidden"
                  accept=".png,.jpg,.jpeg,.webp"
                />
                
                <div className="flex flex-col items-center gap-2">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center transition-colors
                    ${isDraggingImage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                  `}>
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  
                  {isDraggingImage ? (
                    <p className="text-sm font-medium text-primary">{t.dropHere}</p>
                  ) : (
                    <>
                      <Button type="button" variant="outline" size="sm" className="pointer-events-none">
                        {t.browseImages}
                      </Button>
                      <p className="text-xs text-muted-foreground">{t.imageFormats}</p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Course File Upload */}
          <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-blue-50/50 to-green-50/50 dark:from-blue-900/10 dark:to-green-900/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <span>{t.uploadCourseFile}</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t.courseFileHint}</p>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={handleFileDragOver}
                onDragLeave={handleFileDragLeave}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
                  ${isDraggingFile 
                    ? 'border-primary bg-primary/5 scale-[1.02]' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'}
                  ${files.length >= 10 ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileInputChange}
                  disabled={files.length >= 10}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                />
                
                <div className="flex flex-col items-center gap-2">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center transition-colors
                    ${isDraggingFile ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                  `}>
                    <FileText className="w-6 h-6" />
                  </div>
                  
                  {isDraggingFile ? (
                    <p className="text-sm font-medium text-primary">{t.dropHere}</p>
                  ) : (
                    <>
                      <Button type="button" variant="outline" size="sm" className="pointer-events-none">
                        {t.browseFiles}
                      </Button>
                      <p className="text-xs text-muted-foreground">{t.fileFormats}</p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Info */}
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>{t.maxFiles}</span>
          <span>•</span>
          <span>{t.maxSize}</span>
        </div>

        {/* Uploaded Files Grid */}
        <AnimatePresence>
          {files.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-500" />
                  <span>{language === 'ar' ? 'الملفات المرفوعة' : 'Uploaded Files'}</span>
                  <Badge variant="secondary">{files.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid gap-4 md:grid-cols-2"
                >
                  {files.map((fileItem, index) => {
                    const FileIconComponent = getFileIcon(fileItem.file);
                    
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="relative bg-background rounded-xl border overflow-hidden"
                      >
                        {/* File Header */}
                        <div className="flex items-start gap-3 p-4">
                          {/* Preview or Icon */}
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            {fileItem.preview ? (
                              <img 
                                src={fileItem.preview} 
                                alt={fileItem.file.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FileIconComponent className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                            
                            {/* Status Overlay */}
                            {fileItem.analyzing && (
                              <div className="absolute inset-0 bg-purple-500/80 flex items-center justify-center">
                                <Brain className="w-6 h-6 text-white animate-pulse" />
                              </div>
                            )}
                            {fileItem.uploaded && !fileItem.analyzing && fileItem.classification && (
                              <div className="absolute inset-0 bg-green-500/80 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-white" />
                              </div>
                            )}
                            {fileItem.error && (
                              <div className="absolute inset-0 bg-destructive/80 flex items-center justify-center">
                                <AlertCircle className="w-6 h-6 text-white" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            
                            {/* Category Badge */}
                            <Badge 
                              variant="outline" 
                              className={`mt-1 text-xs ${
                                fileItem.category === 'image' 
                                  ? 'border-purple-300 text-purple-600 bg-purple-50' 
                                  : 'border-blue-300 text-blue-600 bg-blue-50'
                              }`}
                            >
                              {fileItem.category === 'image' 
                                ? (language === 'ar' ? t.courseImage : t.courseImage)
                                : (language === 'ar' ? t.courseFile : t.courseFile)
                              }
                            </Badge>
                            
                            {/* Progress Bar */}
                            {!fileItem.uploaded && fileItem.progress > 0 && (
                              <Progress value={fileItem.progress} className="h-1 mt-2" />
                            )}
                            
                            {/* Status Badge */}
                            <div className="mt-2">
                              {fileItem.analyzing && (
                                <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                  <Loader2 className="w-3 h-3 me-1 animate-spin" />
                                  {t.analyzing}
                                </Badge>
                              )}
                              {fileItem.uploaded && !fileItem.analyzing && fileItem.classification && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                  <CheckCircle2 className="w-3 h-3 me-1" />
                                  {t.analysisComplete}
                                </Badge>
                              )}
                              {fileItem.error && (
                                <Badge variant="destructive">
                                  <AlertCircle className="w-3 h-3 me-1" />
                                  {t.analysisFailed}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(index)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* AI Classification Results */}
                        <AnimatePresence>
                          {fileItem.classification && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="border-t bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-900/10 dark:to-blue-900/10 p-4"
                            >
                              <div className="grid gap-2 text-sm">
                                {fileItem.classification.university && (
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-purple-500" />
                                    <span className="text-muted-foreground">{t.university}:</span>
                                    <span className="font-medium">{fileItem.classification.university}</span>
                                  </div>
                                )}
                                {fileItem.classification.college && (
                                  <div className="flex items-center gap-2">
                                    <GraduationCap className="w-4 h-4 text-blue-500" />
                                    <span className="text-muted-foreground">{t.college}:</span>
                                    <span className="font-medium">{fileItem.classification.college}</span>
                                  </div>
                                )}
                                {fileItem.classification.major && (
                                  <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-green-500" />
                                    <span className="text-muted-foreground">{t.major}:</span>
                                    <span className="font-medium">{fileItem.classification.major}</span>
                                  </div>
                                )}
                                {fileItem.classification.subject && (
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-orange-500" />
                                    <span className="text-muted-foreground">{t.subject}:</span>
                                    <span className="font-medium">{fileItem.classification.subject}</span>
                                  </div>
                                )}
                                
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {getContentTypeLabel(fileItem.classification.content_type)}
                                  </Badge>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${getConfidenceColor(fileItem.classification.confidence)}`}
                                  >
                                    {Math.round(fileItem.classification.confidence * 100)}% {t.confidence}
                                  </Badge>
                                </div>

                                {fileItem.classification.keywords?.length > 0 && (
                                  <div className="flex items-start gap-2 mt-1">
                                    <Tag className="w-4 h-4 text-muted-foreground mt-0.5" />
                                    <div className="flex flex-wrap gap-1">
                                      {fileItem.classification.keywords.slice(0, 5).map((kw, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">
                                          {kw}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </CardContent>
            </Card>
          )}
        </AnimatePresence>

        {/* Course Title */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.courseTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.courseTitlePlaceholder}
              className="w-full"
              required
            />
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.description}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.descriptionPlaceholder}
              className="min-h-[120px]"
            />
          </CardContent>
        </Card>

        {/* Delivery Method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.deliveryMethod}</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={deliveryMethod}
              onValueChange={(value) => setDeliveryMethod(value as typeof deliveryMethod)}
              className="grid gap-4"
            >
              {deliveryOptions.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={option.value}
                  className={`
                    flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                    ${deliveryMethod === option.value 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'}
                  `}
                >
                  <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    ${deliveryMethod === option.value 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'}
                  `}>
                    <option.icon className="w-6 h-6" />
                  </div>
                  <span className={`font-medium ${
                    deliveryMethod === option.value ? 'text-primary' : 'text-foreground'
                  }`}>
                    {option.label}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          className="w-full bg-gradient-gold hover:opacity-90 text-lg py-6"
          disabled={isSubmitting || files.some(f => f.analyzing)}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 me-2 animate-spin" />
              {t.submitting}
            </>
          ) : (
            t.submit
          )}
        </Button>
      </form>
    </div>
  );
};