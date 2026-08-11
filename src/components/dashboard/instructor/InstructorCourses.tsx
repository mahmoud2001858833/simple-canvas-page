import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InstructorCoursesSkeleton } from '@/components/ui/skeletons';
import LazyImage from '@/components/ui/LazyImage';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BookOpen, Users, Clock, Plus, Edit, Eye, ArrowLeft, Video, Upload, X, Loader2, ImageIcon, QrCode, Sparkles, Link2, Megaphone, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { InstructorChapters } from './InstructorChapters';
import { CourseQRCode } from '@/components/dashboard/CourseQRCode';
import { CourseAdTemplate } from '@/components/dashboard/CourseAdTemplate';

interface Course {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  thumbnail_url: string | null;
  price: number | null;
  duration_hours: number | null;
  is_active: boolean;
  is_featured: boolean;
  enrollments_count?: number;
}

interface InstructorCoursesProps {
  limit?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

export const InstructorCourses = ({ limit, showViewAll, onViewAll }: InstructorCoursesProps) => {
  const { dir } = useLanguage();
  const { user } = useAuth();
  const language = dir === 'rtl' ? 'ar' : 'en';

  // learning_outcomes columns are text[] NOT NULL — always send an array
  const toOutcomesArray = (value: string): string[] =>
    (value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const fromOutcomesArray = (value: unknown): string =>
    Array.isArray(value) ? value.join('\n') : (typeof value === 'string' ? value : '');

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<{ id: string; title: string } | null>(null);
  const [translating, setTranslating] = useState<'ar' | 'en' | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    title_ar: '',
    description: '',
    description_ar: '',
    price: 0,
    duration_hours: 0,
    is_active: false,
    is_featured: false,
    ai_enabled: false,
    thumbnail_url: '',
    major_id: '',
    study_year: '',
    subject_name: '',
    subject_code: '',
    learning_outcomes: '',
    learning_outcomes_ar: '',
    price_includes_tax: false,
    expected_students: 0,
  });
  const [selectedUniversityId, setSelectedUniversityId] = useState<string>('');
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiImagePrompt, setAiImagePrompt] = useState('');
  const [qrCourse, setQrCourse] = useState<{ id: string; title: string; slug?: string } | null>(null);
  // Live (Zoom) course creation
  const [liveMode, setLiveMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'live'>('info');
  const [liveUrl, setLiveUrl] = useState('');
  const [liveDate, setLiveDate] = useState('');

  const [adCourse, setAdCourse] = useState<{
    id: string; title: string; slug?: string; price?: number; duration?: number;
    thumbnail?: string; university?: string; college?: string; major?: string;
    studyYear?: string; subjectName?: string; subjectCode?: string;
  } | null>(null);

  // Fetch universities
  const { data: universities } = useQuery({
    queryKey: ['universities'],
    queryFn: async () => {
      const { data, error } = await supabase.from('universities').select('*').eq('is_active', true).order('name_ar');
      if (error) throw error;
      return data;
    },
  });

  // Fetch colleges based on selected university
  const { data: colleges } = useQuery({
    queryKey: ['colleges', selectedUniversityId],
    queryFn: async () => {
      if (!selectedUniversityId) return [];
      const { data, error } = await supabase.from('colleges').select('*').eq('university_id', selectedUniversityId).eq('is_active', true).order('name_ar');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedUniversityId,
  });

  // Fetch majors based on selected college
  const { data: majorsData } = useQuery({
    queryKey: ['majors', selectedCollegeId],
    queryFn: async () => {
      if (!selectedCollegeId) return [];
      const { data, error } = await supabase.from('majors').select('*').eq('college_id', selectedCollegeId).eq('is_active', true).order('name_ar');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCollegeId,
  });

  const texts = {
    ar: {
      title: 'دوراتي',
      viewAll: 'عرض الكل',
      addCourse: 'إضافة دورة',
      editCourse: 'تعديل الدورة',
      noCourses: 'لا توجد دورات بعد',
      students: 'طالب',
      hours: 'ساعة',
      active: 'نشط',
      inactive: 'غير نشط',
      featured: 'مميز',
      courseTitle: 'عنوان الدورة (إنجليزي)',
      courseTitleAr: 'عنوان الدورة (عربي)',
      courseDesc: 'الوصف (إنجليزي)',
      courseDescAr: 'الوصف (عربي)',
      price: 'السعر (ر.س)',
      duration: 'المدة (ساعات)',
      isActive: 'نشط',
      isFeatured: 'مميز',
      save: 'حفظ',
      cancel: 'إلغاء',
      successAdd: 'تم إضافة الدورة بنجاح',
      successEdit: 'تم تحديث الدورة بنجاح',
      error: 'حدث خطأ',
      manageLessons: 'إدارة الدروس',
      courseImage: 'صورة الدورة',
      uploadImage: 'رفع صورة',
      uploading: 'جاري الرفع...',
      removeImage: 'إزالة الصورة',
      generateAI: 'إنشاء بالذكاء الاصطناعي',
      generatingAI: 'جاري الإنشاء...',
      aiPromptPlaceholder: 'وصف إضافي للصورة (اختياري)',
      qrCode: 'رابط وباركود',
      copyLink: 'نسخ الرابط',
    },
    en: {
      title: 'My Courses',
      viewAll: 'View All',
      addCourse: 'Add Course',
      editCourse: 'Edit Course',
      noCourses: 'No courses yet',
      students: 'students',
      hours: 'hours',
      active: 'Active',
      inactive: 'Inactive',
      featured: 'Featured',
      courseTitle: 'Course Title (English)',
      courseTitleAr: 'Course Title (Arabic)',
      courseDesc: 'Description (English)',
      courseDescAr: 'Description (Arabic)',
      price: 'Price (SAR)',
      duration: 'Duration (hours)',
      isActive: 'Active',
      isFeatured: 'Featured',
      save: 'Save',
      cancel: 'Cancel',
      successAdd: 'Course added successfully',
      successEdit: 'Course updated successfully',
      error: 'An error occurred',
      manageLessons: 'Manage Lessons',
      courseImage: 'Course Image',
      uploadImage: 'Upload Image',
      uploading: 'Uploading...',
      removeImage: 'Remove Image',
      generateAI: 'Generate with AI',
      generatingAI: 'Generating...',
      aiPromptPlaceholder: 'Additional image description (optional)',
      qrCode: 'Link & QR Code',
      copyLink: 'Copy Link',
    },
  };

  const t = texts[language];

  const fetchCourses = async () => {
    try {
      let query = supabase
        .from('courses')
        .select('*, majors(name, name_ar, colleges(name, name_ar, universities(name, name_ar)))')
        .eq('instructor_id', user?.id)
        .order('created_at', { ascending: false });

      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;

      // Get enrollment counts
      const coursesWithCounts = await Promise.all(
        (data || []).map(async (course) => {
          const { count } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id);
          return { ...course, enrollments_count: count || 0 };
        })
      );

      setCourses(coursesWithCounts);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchCourses();
  }, [user]);

  // If a course is selected, show chapters management
  if (selectedCourse) {
    return (
      <InstructorChapters
        courseId={selectedCourse.id}
        courseTitle={selectedCourse.title}
        onBack={() => setSelectedCourse(null)}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.title_ar.trim()) {
      setActiveTab('info');
      toast.error(language === 'ar' ? 'يرجى إدخال عنوان الدورة بالعربية والإنجليزية' : 'Please enter the course title in Arabic and English');
      return;
    }
    if (liveMode && !liveUrl.trim()) {
      setActiveTab('live');
      toast.error(language === 'ar' ? 'يرجى إدخال رابط الزوم' : 'Please enter the Zoom link');
      return;
    }

    try {

      if (editingCourse) {
        const { error } = await supabase
          .from('courses')
          .update({
            title: formData.title,
            title_ar: formData.title_ar,
            description: formData.description,
            description_ar: formData.description_ar,
            price: formData.price,
            duration_hours: formData.duration_hours,
            is_active: formData.is_active,
            is_featured: formData.is_featured,
            ai_enabled: formData.ai_enabled,
            thumbnail_url: formData.thumbnail_url || null,
            major_id: formData.major_id || null,
            study_year: formData.study_year || null,
            subject_name: formData.subject_name || null,
            subject_code: formData.subject_code || null,
            learning_outcomes: toOutcomesArray(formData.learning_outcomes),
            learning_outcomes_ar: toOutcomesArray(formData.learning_outcomes_ar),

            price_includes_tax: formData.price_includes_tax,
            expected_students: formData.expected_students || null,
          } as any)
          .eq('id', editingCourse.id);

        if (error) throw error;
        toast.success(t.successEdit);
      } else {
        // Generate slug from title
        const slug = formData.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim() + '-' + Date.now().toString(36);

        const { data: newCourse, error } = await supabase
          .from('courses')
          .insert({
            instructor_id: user?.id,
            title: formData.title,
            title_ar: formData.title_ar,
            description: formData.description,
            description_ar: formData.description_ar,
            price: formData.price,
            duration_hours: formData.duration_hours,
            is_active: formData.is_active,
            is_featured: formData.is_featured,
            ai_enabled: formData.ai_enabled,
            thumbnail_url: formData.thumbnail_url || null,
            major_id: formData.major_id || null,
            study_year: formData.study_year || null,
            subject_name: formData.subject_name || null,
            subject_code: formData.subject_code || null,
            learning_outcomes: toOutcomesArray(formData.learning_outcomes),
            learning_outcomes_ar: toOutcomesArray(formData.learning_outcomes_ar),

            price_includes_tax: formData.price_includes_tax,
            expected_students: formData.expected_students || null,
            slug: slug,
          } as any)
          .select()
          .single();

        if (error) throw error;

        // Live course: create the first live session lesson with the Zoom link
        if (liveMode && newCourse) {
          const { error: lessonError } = await supabase.from('lessons').insert({
            course_id: newCourse.id,
            title: formData.title,
            title_ar: formData.title_ar,
            description: formData.description || null,
            is_live: true,
            live_url: liveUrl.trim(),
            live_date: liveDate ? new Date(liveDate).toISOString() : null,
            sort_order: 1,
          } as any);
          if (lessonError) {
            console.error('Error creating live session:', lessonError);
            toast.error(language === 'ar' ? 'تم إنشاء الدورة لكن تعذّر حفظ جلسة البث' : 'Course created but the live session could not be saved');
          }
        }

        toast.success(t.successAdd);

        // Navigate to chapters page for the new course
        setIsDialogOpen(false);
        setEditingCourse(null);
        resetForm();
        fetchCourses();
        if (newCourse) {
          setSelectedCourse({
            id: newCourse.id,
            title: language === 'ar' ? newCourse.title_ar : newCourse.title,
          });
        }
        return;

      }

      setIsDialogOpen(false);
      setEditingCourse(null);
      resetForm();
      fetchCourses();
    } catch (error) {
      console.error('Error saving course:', error);
      toast.error(t.error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      title_ar: '',
      description: '',
      description_ar: '',
      price: 0,
      duration_hours: 0,
      is_active: true,
      is_featured: false,
      ai_enabled: false,
      thumbnail_url: '',
      major_id: '',
      study_year: '',
      subject_name: '',
      subject_code: '',
      learning_outcomes: '',
      learning_outcomes_ar: '',
      price_includes_tax: false,
      expected_students: 0,
    });
    setSelectedUniversityId('');
    setSelectedCollegeId('');
    setLiveUrl('');
    setLiveDate('');
    setActiveTab('info');
  };


  const openEditDialog = async (course: Course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      title_ar: course.title_ar,
      description: course.description || '',
      description_ar: course.description_ar || '',
      price: course.price || 0,
      duration_hours: course.duration_hours || 0,
      is_active: course.is_active ?? true,
      is_featured: course.is_featured ?? false,
      ai_enabled: (course as any).ai_enabled ?? false,
      thumbnail_url: course.thumbnail_url || '',
      major_id: (course as any).major_id || '',
      study_year: (course as any).study_year || '',
      subject_name: (course as any).subject_name || '',
      subject_code: (course as any).subject_code || '',
      learning_outcomes: fromOutcomesArray((course as any).learning_outcomes),
      learning_outcomes_ar: fromOutcomesArray((course as any).learning_outcomes_ar),

      price_includes_tax: (course as any).price_includes_tax ?? false,
      expected_students: (course as any).expected_students || 0,
    });

    
    // Resolve university and college from major_id
    if ((course as any).major_id) {
      const { data: major } = await supabase.from('majors').select('college_id').eq('id', (course as any).major_id).single();
      if (major?.college_id) {
        setSelectedCollegeId(major.college_id);
        const { data: college } = await supabase.from('colleges').select('university_id').eq('id', major.college_id).single();
        if (college?.university_id) {
          setSelectedUniversityId(college.university_id);
        }
      }
    } else {
      setSelectedUniversityId('');
      setSelectedCollegeId('');
    }
    
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى اختيار صورة' : 'Please select an image');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `course-${Date.now()}.${fileExt}`;
      // First folder must be the user id to satisfy storage policies
      const filePath = `${user?.id}/course-thumbnails/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, thumbnail_url: publicUrl }));
      toast.success(language === 'ar' ? 'تم رفع الصورة بنجاح' : 'Image uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error(
        (language === 'ar' ? 'فشل في رفع الصورة: ' : 'Failed to upload image: ') +
          (error?.message || ''),
      );
    } finally {
      setIsUploading(false);
    }
  };


  const handleGenerateAIImage = async () => {
    if (!formData.title) {
      toast.error(language === 'ar' ? 'يرجى إدخال عنوان الدورة أولاً' : 'Please enter course title first');
      return;
    }
    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-course-image', {
        body: {
          title: formData.title,
          description: formData.description,
          customPrompt: aiImagePrompt || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.imageUrl) {
        setFormData(prev => ({ ...prev, thumbnail_url: data.imageUrl }));
        setAiImagePrompt('');
        toast.success(language === 'ar' ? 'تم إنشاء الصورة بنجاح!' : 'Image generated successfully!');
      }
    } catch (error: any) {
      console.error('Error generating AI image:', error);
      toast.error(
        (language === 'ar' ? 'فشل في إنشاء الصورة: ' : 'Failed to generate image: ') +
          (error?.message || ''),
      );
    } finally {
      setIsGeneratingAI(false);
    }
  };


  if (loading) {
    return <InstructorCoursesSkeleton rows={limit || 3} />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t.title}</CardTitle>
        <div className="flex gap-2">
          {showViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              {t.viewAll}
              <ArrowLeft className={`w-4 h-4 ${dir === 'rtl' ? 'mr-2' : 'ml-2 rotate-180'}`} />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-primary/40"
            onClick={() => {
              setEditingCourse(null);
              resetForm();
              setLiveMode(true);
              setActiveTab('info');
              setIsDialogOpen(true);
            }}
          >
            <Radio className="w-4 h-4 me-2" />
            {language === 'ar' ? 'دورة مباشرة' : 'Live course'}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingCourse(null);
              setLiveMode(false);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-gold" onClick={() => { setLiveMode(false); setActiveTab('info'); }}>
                <Plus className="w-4 h-4 me-2" />
                {t.addCourse}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCourse
                    ? t.editCourse
                    : liveMode
                      ? (language === 'ar' ? 'إنشاء دورة مباشرة' : 'Create live course')
                      : t.addCourse}
                </DialogTitle>
              </DialogHeader>

              {liveMode && !editingCourse && (
                <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted mt-2">
                  <Button
                    type="button"
                    variant={activeTab === 'info' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('info')}
                  >
                    {language === 'ar' ? 'المعلومات' : 'Information'}
                  </Button>
                  <Button
                    type="button"
                    variant={activeTab === 'live' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('live')}
                  >
                    <Radio className="w-4 h-4 me-2" />
                    {language === 'ar' ? 'رابط الزوم' : 'Zoom link'}
                  </Button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                {liveMode && !editingCourse && activeTab === 'live' && (
                  <div className="space-y-4 p-4 rounded-xl border border-primary/30 bg-primary/5">
                    <div>
                      <Label>{language === 'ar' ? 'رابط الزوم / البث المباشر' : 'Zoom / live stream link'}</Label>
                      <Input
                        value={liveUrl}
                        onChange={(e) => setLiveUrl(e.target.value)}
                        placeholder="https://zoom.us/j/123456789"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label>{language === 'ar' ? 'موعد البث' : 'Live session date'}</Label>
                      <Input
                        type="datetime-local"
                        value={liveDate}
                        onChange={(e) => setLiveDate(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar'
                        ? 'سيتم إنشاء جلسة مباشرة داخل الدورة بهذا الرابط، ويظهر للطلاب المسجلين فقط.'
                        : 'A live session will be created inside the course with this link, visible to enrolled students only.'}
                    </p>
                  </div>
                )}

                <div className={liveMode && !editingCourse && activeTab === 'live' ? 'hidden' : 'space-y-4'}>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t.courseTitle}</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t.courseTitleAr}</Label>
                    <Input
                      value={formData.title_ar}
                      onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                      dir="rtl"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label>{t.courseDesc}</Label>
                    <Button
                      type="button" size="sm" variant="outline" className="h-7 text-xs"
                      disabled={!formData.description_ar || translating === 'en'}
                      onClick={async () => {
                        setTranslating('en');
                        try {
                          const { data, error } = await supabase.functions.invoke('translate-course-description', {
                            body: { text: formData.description_ar, sourceLang: 'ar', targetLang: 'en' },
                          });
                          if (error) throw error;
                          if (data?.translated) setFormData({ ...formData, description: data.translated });
                        } catch { toast.error(language === 'ar' ? 'فشل الترجمة' : 'Translation failed'); }
                        finally { setTranslating(null); }
                      }}
                    >{translating === 'en' ? '...' : (language === 'ar' ? 'ترجم من العربية' : 'Translate from Arabic')}</Button>
                  </div>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>{t.courseDescAr}</Label>
                    <Button
                      type="button" size="sm" variant="outline" className="h-7 text-xs"
                      disabled={!formData.description || translating === 'ar'}
                      onClick={async () => {
                        setTranslating('ar');
                        try {
                          const { data, error } = await supabase.functions.invoke('translate-course-description', {
                            body: { text: formData.description, sourceLang: 'en', targetLang: 'ar' },
                          });
                          if (error) throw error;
                          if (data?.translated) setFormData({ ...formData, description_ar: data.translated });
                        } catch { toast.error(language === 'ar' ? 'فشل الترجمة' : 'Translation failed'); }
                        finally { setTranslating(null); }
                      }}
                    >{translating === 'ar' ? '...' : (language === 'ar' ? 'ترجم من الإنجليزية' : 'Translate from English')}</Button>
                  </div>
                  <Textarea
                    value={formData.description_ar}
                    onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                    dir="rtl"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>{language === 'ar' ? 'اسم المادة' : 'Subject Name'}</Label>
                    <Input
                      value={formData.subject_name}
                      onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
                      placeholder={language === 'ar' ? 'مثال: الرياضيات' : 'e.g. Mathematics'}
                    />
                  </div>
                  <div>
                    <Label>{language === 'ar' ? 'رمز المادة' : 'Subject Code'}</Label>
                    <Input
                      value={formData.subject_code}
                      onChange={(e) => setFormData({ ...formData, subject_code: e.target.value })}
                      placeholder={language === 'ar' ? 'مثال: MATH101' : 'e.g. MATH101'}
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t.price}</Label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      min={0}
                    />
                  </div>
                  <div>
                    <Label>{t.duration}</Label>
                    <Input
                      type="number"
                      value={formData.duration_hours}
                      onChange={(e) => setFormData({ ...formData, duration_hours: Number(e.target.value) })}
                      min={0}
                    />
                  </div>
                </div>

                {/* Pricing details */}
                <div className="rounded-xl border border-border p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>{language === 'ar' ? 'السعر شامل ضريبة القيمة المضافة (15%)' : 'Price includes VAT (15%)'}</Label>
                      <p className="text-xs text-muted-foreground">
                        {language === 'ar'
                          ? 'فعّل الخيار إذا كان السعر المدخل شاملاً للضريبة.'
                          : 'Enable if the entered price already includes VAT.'}
                      </p>
                    </div>
                    <Switch
                      checked={formData.price_includes_tax}
                      onCheckedChange={(v) => setFormData({ ...formData, price_includes_tax: v })}
                    />
                  </div>

                  <div>
                    <Label>{language === 'ar' ? 'عدد الطلاب المتوقع' : 'Expected students'}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.expected_students}
                      onChange={(e) => setFormData({ ...formData, expected_students: Number(e.target.value) })}
                    />
                  </div>

                  {/* Earnings calculator */}
                  {(() => {
                    const gross = Number(formData.price) || 0;
                    const net = formData.price_includes_tax ? gross / 1.15 : gross;
                    const vat = formData.price_includes_tax ? gross - net : gross * 0.15;
                    const commissionRate = 0.7;
                    const perStudent = net * commissionRate;
                    const total = perStudent * (Number(formData.expected_students) || 0);
                    const fmt = (n: number) => `${n.toFixed(2)} ${language === 'ar' ? 'ر.س' : 'SAR'}`;
                    return (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        <div className="rounded-lg bg-muted/50 p-3">
                          <div className="text-muted-foreground text-xs mb-1">{language === 'ar' ? 'السعر قبل الضريبة' : 'Price before VAT'}</div>
                          <div className="font-semibold">{fmt(net)}</div>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <div className="text-muted-foreground text-xs mb-1">{language === 'ar' ? 'ضريبة القيمة المضافة' : 'VAT'}</div>
                          <div className="font-semibold">{fmt(vat)}</div>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <div className="text-muted-foreground text-xs mb-1">{language === 'ar' ? 'أرباحك لكل طالب (70%)' : 'Your earnings per student (70%)'}</div>
                          <div className="font-semibold text-secondary">{fmt(perStudent)}</div>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <div className="text-muted-foreground text-xs mb-1">{language === 'ar' ? 'الأرباح المتوقعة' : 'Expected earnings'}</div>
                          <div className="font-semibold text-secondary">{fmt(total)}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Learning outcomes */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>{language === 'ar' ? 'مخرجات التعلم (عربي)' : 'Learning outcomes (Arabic)'}</Label>
                    <Textarea
                      rows={4}
                      value={formData.learning_outcomes_ar}
                      onChange={(e) => setFormData({ ...formData, learning_outcomes_ar: e.target.value })}
                      placeholder={language === 'ar' ? 'اكتب كل مخرج في سطر منفصل' : 'One outcome per line'}
                    />
                  </div>
                  <div>
                    <Label>{language === 'ar' ? 'مخرجات التعلم (إنجليزي)' : 'Learning outcomes (English)'}</Label>
                    <Textarea
                      rows={4}
                      value={formData.learning_outcomes}
                      onChange={(e) => setFormData({ ...formData, learning_outcomes: e.target.value })}
                      placeholder={language === 'ar' ? 'كل مخرج في سطر منفصل' : 'One outcome per line'}
                    />
                  </div>
                </div>


                
                {/* University, College, Major, Study Year */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>{language === 'ar' ? 'الجهة' : 'University'}</Label>
                    <Select
                      value={selectedUniversityId}
                      onValueChange={(value) => {
                        setSelectedUniversityId(value);
                        setSelectedCollegeId('');
                        setFormData({ ...formData, major_id: '' });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={language === 'ar' ? 'اختر الجهة' : 'Select University'} />
                      </SelectTrigger>
                      <SelectContent>
                        {universities?.map((uni: any) => (
                          <SelectItem key={uni.id} value={uni.id}>
                            {language === 'ar' ? uni.name_ar : uni.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{language === 'ar' ? 'الكلية' : 'College'}</Label>
                    <Select
                      value={selectedCollegeId}
                      onValueChange={(value) => {
                        setSelectedCollegeId(value);
                        setFormData({ ...formData, major_id: '' });
                      }}
                      disabled={!selectedUniversityId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={language === 'ar' ? 'اختر الكلية' : 'Select College'} />
                      </SelectTrigger>
                      <SelectContent>
                        {colleges?.map((col: any) => (
                          <SelectItem key={col.id} value={col.id}>
                            {language === 'ar' ? col.name_ar : col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>{language === 'ar' ? 'التخصص' : 'Major'}</Label>
                    <Select
                      value={formData.major_id}
                      onValueChange={(value) => setFormData({ ...formData, major_id: value })}
                      disabled={!selectedCollegeId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={language === 'ar' ? 'اختر التخصص' : 'Select Major'} />
                      </SelectTrigger>
                      <SelectContent>
                        {majorsData?.map((major: any) => (
                          <SelectItem key={major.id} value={major.id}>
                            {language === 'ar' ? major.name_ar : major.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{language === 'ar' ? 'السنة الدراسية' : 'Study Year'}</Label>
                    <Select
                      value={formData.study_year}
                      onValueChange={(value) => setFormData({ ...formData, study_year: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={language === 'ar' ? 'اختر السنة' : 'Select Year'} />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {language === 'ar' ? `سنة ${year}` : `Year ${year}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Course Image Upload */}
                <div>
                  <Label>{t.courseImage}</Label>
                  <div className="mt-2">
                    {formData.thumbnail_url ? (
                      <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                        <img
                          src={formData.thumbnail_url}
                          alt="Course thumbnail"
                          className="w-full h-full object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 end-2 h-8 w-8"
                          onClick={() => setFormData(prev => ({ ...prev, thumbnail_url: '' }))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex flex-col items-center justify-center py-2">
                            {isUploading ? (
                              <>
                                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mb-1" />
                                <p className="text-xs text-muted-foreground">{t.uploading}</p>
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-6 h-6 text-muted-foreground mb-1" />
                                <p className="text-xs text-muted-foreground">{t.uploadImage}</p>
                              </>
                            )}
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={isUploading || isGeneratingAI}
                          />
                        </label>

                        <div className="space-y-2">
                          <Input
                            placeholder={t.aiPromptPlaceholder}
                            value={aiImagePrompt}
                            onChange={(e) => setAiImagePrompt(e.target.value)}
                            disabled={isGeneratingAI}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full border-primary/50 hover:bg-primary/10"
                            onClick={handleGenerateAIImage}
                            disabled={isGeneratingAI || isUploading || !formData.title}
                          >
                            {isGeneratingAI ? (
                              <Loader2 className="w-4 h-4 animate-spin me-2" />
                            ) : (
                              <Sparkles className="w-4 h-4 me-2" />
                            )}
                            {isGeneratingAI ? t.generatingAI : t.generateAI}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>{t.isActive}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_featured}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                    />
                    <Label>{t.isFeatured}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.ai_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, ai_enabled: checked })}
                    />
                    <Label className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4" />
                      {language === 'ar' ? 'تفعيل الذكاء الاصطناعي' : 'Enable AI Assistant'}
                    </Label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t.cancel}
                  </Button>
                  <Button type="submit" className="bg-gradient-gold">
                    {t.save}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t.noCourses}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  {course.thumbnail_url ? (
                    <LazyImage
                      src={course.thumbnail_url}
                      alt={language === 'ar' ? course.title_ar : course.title}
                      className="w-full h-full object-cover"
                      containerClassName="w-full h-full"
                      blurAmount={10}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">
                    {language === 'ar' ? course.title_ar : course.title}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant={course.is_active ? 'default' : 'secondary'}>
                      {course.is_active ? t.active : t.inactive}
                    </Badge>
                    {course.is_featured && (
                      <Badge className="bg-gradient-gold text-primary-foreground">
                        {t.featured}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {course.enrollments_count} {t.students}
                    </span>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {course.duration_hours} {t.hours}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className="font-bold text-primary">
                    {course.price || 0} ر.س
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQrCourse({
                      id: course.id,
                      title: language === 'ar' ? course.title_ar : course.title,
                      slug: (course as any).slug,
                    })}
                    title={t.qrCode}
                  >
                    <QrCode className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAdCourse({
                      id: course.id,
                      title: language === 'ar' ? course.title_ar : course.title,
                      slug: (course as any).slug,
                      price: course.price || 0,
                      duration: course.duration_hours || 0,
                      thumbnail: course.thumbnail_url || undefined,
                      university: language === 'ar' ? (course as any).majors?.colleges?.universities?.name_ar : (course as any).majors?.colleges?.universities?.name,
                      college: language === 'ar' ? (course as any).majors?.colleges?.name_ar : (course as any).majors?.colleges?.name,
                      major: language === 'ar' ? (course as any).majors?.name_ar : (course as any).majors?.name,
                      studyYear: (course as any).study_year,
                      subjectName: (course as any).subject_name,
                      subjectCode: (course as any).subject_code,
                    })}
                    title={language === 'ar' ? 'صورة إعلان' : 'Ad Image'}
                    className="text-amber-500"
                  >
                    <Megaphone className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm"
                    className="btn-gold gap-1"
                    onClick={() => setSelectedCourse({ 
                      id: course.id, 
                      title: language === 'ar' ? course.title_ar : course.title 
                    })}
                  >
                    <Video className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'الفصول والدروس' : 'Chapters & Lessons'}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(course)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>

      {/* QR Code Dialog */}
      {qrCourse && (
        <CourseQRCode
          open={!!qrCourse}
          onOpenChange={() => setQrCourse(null)}
          courseId={qrCourse.id}
          courseTitle={qrCourse.title}
          slug={qrCourse.slug}
        />
      )}

      {/* Ad Template Dialog */}
      {adCourse && (
        <CourseAdTemplate
          open={!!adCourse}
          onOpenChange={() => setAdCourse(null)}
          courseId={adCourse.id}
          courseTitle={adCourse.title}
          slug={adCourse.slug}
          coursePrice={adCourse.price}
          courseDuration={adCourse.duration}
          thumbnailUrl={adCourse.thumbnail}
          universityName={adCourse.university}
          collegeName={adCourse.college}
          majorName={adCourse.major}
          studyYear={adCourse.studyYear}
          subjectName={adCourse.subjectName}
          subjectCode={adCourse.subjectCode}
        />
      )}
    </Card>
  );
};