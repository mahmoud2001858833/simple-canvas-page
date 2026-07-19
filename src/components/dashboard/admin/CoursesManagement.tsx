import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Edit, Trash2, Star, Video, Loader2, Users, Upload, Sparkles, ImageIcon, X, QrCode, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { CoursesTableSkeleton } from '@/components/ui/skeletons';
import { AdminChaptersManagement } from './AdminChaptersManagement';
import { CourseEnrollmentsDialog } from './CourseEnrollmentsDialog';
import { CourseQRCode } from '@/components/dashboard/CourseQRCode';
import { CourseAdTemplate } from '@/components/dashboard/CourseAdTemplate';

export const CoursesManagement = () => {
  const [selectedCourse, setSelectedCourse] = useState<{ id: string; title: string } | null>(null);
  const [enrollmentsDialogCourse, setEnrollmentsDialogCourse] = useState<{ id: string; title: string } | null>(null);
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [aiImagePrompt, setAiImagePrompt] = useState('');
  const [qrCourse, setQrCourse] = useState<{ id: string; title: string; slug?: string } | null>(null);
  const [adCourse, setAdCourse] = useState<{
    id: string; title: string; slug?: string; price?: number; duration?: number;
    instructor?: string; thumbnail?: string; university?: string; college?: string;
    major?: string; studyYear?: string; subjectName?: string; subjectCode?: string;
  } | null>(null);

  const [selectedUniversityId, setSelectedUniversityId] = useState<string>('');
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('');

  const [formData, setFormData] = useState({
    title: '',
    title_ar: '',
    description: '',
    description_ar: '',
    price: '',
    duration_hours: '',
    is_featured: false,
    is_active: true,
    category: 'academic',
    instructor_id: '',
    instructor_commission: '30',
    major_id: '',
    study_year: '',
    subject_name: '',
    subject_code: '',
  });

  const { data: courses, isLoading } = useQuery({
    queryKey: ['admin-courses', search],
    queryFn: async () => {
      let query = supabase
        .from('courses')
        .select(`
          *,
          enrollments(id),
          majors(name, name_ar, colleges(name, name_ar, universities(name, name_ar)))
        `)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`title.ilike.%${search}%,title_ar.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch instructor profiles separately if needed
      const coursesWithInstructors = await Promise.all(
        (data || []).map(async (course) => {
          if (course.instructor_id) {
            const { data: instructor } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', course.instructor_id)
              .single();
            return { ...course, instructor };
          }
          return { ...course, instructor: null };
        })
      );
      
      return coursesWithInstructors;
    },
  });

  // Fetch instructors for dropdown
  const { data: instructors } = useQuery({
    queryKey: ['instructors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instructor');

      if (error) throw error;

      const instructorProfiles = await Promise.all(
        (data || []).map(async (role) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, full_name_ar, email')
            .eq('id', role.user_id)
            .single();
          return profile;
        })
      );

      return instructorProfiles.filter(Boolean);
    },
  });

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
  const { data: majors } = useQuery({
    queryKey: ['majors', selectedCollegeId],
    queryFn: async () => {
      if (!selectedCollegeId) return [];
      const { data, error } = await supabase.from('majors').select('*').eq('college_id', selectedCollegeId).eq('is_active', true).order('name_ar');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCollegeId,
  });

  const createCourseMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('courses').insert([{
        ...data,
        price: parseFloat(data.price) || 0,
        duration_hours: parseInt(data.duration_hours) || 0,
        instructor_id: data.instructor_id || null,
        instructor_commission: parseFloat(data.instructor_commission) || 30,
        major_id: data.major_id || null,
        study_year: data.study_year || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast.success(language === 'ar' ? 'تم إنشاء الدورة بنجاح' : 'Course created successfully');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
    },
  });

  const updateCourseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('courses')
        .update({
          ...data,
          price: parseFloat(data.price) || 0,
          duration_hours: parseInt(data.duration_hours) || 0,
          instructor_id: data.instructor_id || null,
          instructor_commission: parseFloat(data.instructor_commission) || 30,
          major_id: data.major_id || null,
          study_year: data.study_year || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast.success(language === 'ar' ? 'تم تحديث الدورة' : 'Course updated');
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('Starting course deletion for:', id);
      
      // Use the SECURITY DEFINER function to delete course and all related data
      const { data, error } = await supabase.rpc('delete_course_cascade', {
        course_uuid: id
      });
      
      if (error) {
        console.error('Course delete error:', error);
        throw error;
      }
      
      console.log('Course deleted successfully:', id);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success(language === 'ar' ? 'تم حذف الدورة بنجاح' : 'Course deleted successfully');
      setDeletingCourseId(null);
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast.error(language === 'ar' ? 'فشل حذف الدورة' : 'Failed to delete course');
      setDeletingCourseId(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('courses')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      title_ar: '',
      description: '',
      description_ar: '',
      price: '',
      duration_hours: '',
      is_featured: false,
      is_active: true,
      category: 'academic',
      instructor_id: '',
      instructor_commission: '30',
      major_id: '',
      study_year: '',
      subject_name: '',
      subject_code: '',
    });
    setEditingCourse(null);
    setThumbnailUrl(null);
    setSelectedUniversityId('');
    setSelectedCollegeId('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingImage(true);
    try {
      const fileName = `course-thumbnails/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file, { contentType: file.type, upsert: false });
      
      if (uploadError) throw uploadError;
      
      const { data: publicUrlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);
      
      setThumbnailUrl(publicUrlData.publicUrl);
      toast.success(language === 'ar' ? 'تم رفع الصورة بنجاح' : 'Image uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(language === 'ar' ? 'فشل رفع الصورة' : 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleGenerateAIImage = async () => {
    if (!formData.title && !formData.title_ar) {
      toast.error(language === 'ar' ? 'أدخل عنوان الدورة أولاً' : 'Enter course title first');
      return;
    }
    
    setIsGeneratingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-course-image', {
        body: {
          title: formData.title || formData.title_ar,
          description: formData.description || formData.description_ar,
          customPrompt: aiImagePrompt || undefined,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setThumbnailUrl(data.imageUrl);
      setAiImagePrompt('');
      toast.success(language === 'ar' ? 'تم إنشاء الصورة بالذكاء الاصطناعي' : 'AI image generated successfully');
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast.error(error?.message || (language === 'ar' ? 'فشل إنشاء الصورة' : 'Failed to generate image'));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleEdit = async (course: any) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      title_ar: course.title_ar,
      description: course.description || '',
      description_ar: course.description_ar || '',
      price: course.price?.toString() || '',
      duration_hours: course.duration_hours?.toString() || '',
      is_featured: course.is_featured,
      is_active: course.is_active,
      category: course.category || 'academic',
      instructor_id: course.instructor_id || '',
      instructor_commission: course.instructor_commission?.toString() || '30',
      major_id: course.major_id || '',
      study_year: course.study_year || '',
      subject_name: course.subject_name || '',
      subject_code: course.subject_code || '',
    });
    setThumbnailUrl(course.thumbnail_url || null);
    
    // Resolve university and college from major_id
    if (course.major_id) {
      const { data: major } = await supabase.from('majors').select('college_id').eq('id', course.major_id).single();
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

  const handleSubmit = () => {
    const submitData = { ...formData, thumbnail_url: thumbnailUrl };
    if (editingCourse) {
      updateCourseMutation.mutate({ id: editingCourse.id, data: submitData });
    } else {
      createCourseMutation.mutate(submitData);
    }
  };

  // If a course is selected, show chapters management (then lessons inside each chapter)
  if (selectedCourse) {
    return (
      <AdminChaptersManagement
        courseId={selectedCourse.id}
        courseTitle={selectedCourse.title}
        onBack={() => setSelectedCourse(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {language === 'ar' ? 'إدارة الدورات' : 'Courses Management'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'إنشاء وإدارة الدورات' : 'Create and manage courses'}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="btn-gold">
              <Plus className="w-4 h-4 me-2" />
              {language === 'ar' ? 'دورة جديد' : 'New Course'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCourse 
                  ? (language === 'ar' ? 'تعديل الدورة' : 'Edit Course')
                  : (language === 'ar' ? 'دورة جديد' : 'New Course')}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'العنوان (إنجليزي)' : 'Title (English)'}</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'العنوان (عربي)' : 'Title (Arabic)'}</Label>
                  <Input
                    value={formData.title_ar}
                    onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'الوصف (إنجليزي)' : 'Description (English)'}</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}</Label>
                  <Textarea
                    value={formData.description_ar}
                    onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                    rows={3}
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'اسم المادة' : 'Subject Name'}</Label>
                  <Input
                    value={formData.subject_name}
                    onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
                    placeholder={language === 'ar' ? 'مثال: الرياضيات' : 'e.g. Mathematics'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'رمز المادة' : 'Subject Code'}</Label>
                  <Input
                    value={formData.subject_code}
                    onChange={(e) => setFormData({ ...formData, subject_code: e.target.value })}
                    placeholder={language === 'ar' ? 'مثال: MATH101' : 'e.g. MATH101'}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'السعر (ر.س)' : 'Price (SAR)'}</Label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'المدة (ساعات)' : 'Duration (hours)'}</Label>
                  <Input
                    type="number"
                    value={formData.duration_hours}
                    onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                  />
                </div>
              </div>

              {/* Instructor Selection */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'المعلم المسؤول' : 'Assigned Instructor'}</Label>
                  <Select
                    value={formData.instructor_id}
                    onValueChange={(value) => setFormData({ ...formData, instructor_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'ar' ? 'اختر المعلم' : 'Select Instructor'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{language === 'ar' ? 'بدون معلم' : 'No Instructor'}</SelectItem>
                      {instructors?.map((instructor: any) => (
                        <SelectItem key={instructor.id} value={instructor.id}>
                          {language === 'ar' 
                            ? instructor.full_name_ar || instructor.full_name 
                            : instructor.full_name} ({instructor.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'نسبة عمولة المعلم (%)' : 'Instructor Commission (%)'}</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.instructor_commission}
                    onChange={(e) => setFormData({ ...formData, instructor_commission: e.target.value })}
                    placeholder="30"
                  />
                </div>
              </div>

              {/* University, College, Major, Study Year */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
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
                <div className="space-y-2">
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
                <div className="space-y-2">
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
                      {majors?.map((major: any) => (
                        <SelectItem key={major.id} value={major.id}>
                          {language === 'ar' ? major.name_ar : major.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
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

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  {language === 'ar' ? 'صورة الدورة' : 'Course Thumbnail'}
                </Label>
                
                {thumbnailUrl ? (
                  <div className="relative group rounded-xl overflow-hidden border border-border">
                    <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-48 object-cover" />
                    <button
                      type="button"
                      onClick={() => setThumbnailUrl(null)}
                      className="absolute top-2 end-2 bg-destructive text-destructive-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Upload Button */}
                    <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isUploadingImage}
                      />
                      {isUploadingImage ? (
                        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                      ) : (
                        <Upload className="w-8 h-8 text-muted-foreground" />
                      )}
                      <span className="text-sm text-muted-foreground font-medium text-center">
                        {language === 'ar' ? 'رفع صورة' : 'Upload Image'}
                      </span>
                    </label>

                    {/* AI Generate Section */}
                    <div className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-primary/30 rounded-xl">
                      <Sparkles className="w-6 h-6 text-primary" />
                      <span className="text-sm text-primary font-medium text-center">
                        {language === 'ar' ? 'إنشاء بالذكاء الاصطناعي' : 'Generate with AI'}
                      </span>
                      <Input
                        value={aiImagePrompt}
                        onChange={(e) => setAiImagePrompt(e.target.value)}
                        placeholder={language === 'ar' ? 'اكتب وصف الصورة المطلوبة...' : 'Describe the image you want...'}
                        className="text-xs h-8"
                        dir={language === 'ar' ? 'rtl' : 'ltr'}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleGenerateAIImage}
                        disabled={isGeneratingImage}
                        className="w-full border-primary/30 text-primary hover:bg-primary/10"
                      >
                        {isGeneratingImage ? (
                          <Loader2 className="w-4 h-4 animate-spin me-1" />
                        ) : (
                          <Sparkles className="w-4 h-4 me-1" />
                        )}
                        {isGeneratingImage 
                          ? (language === 'ar' ? 'جاري الإنشاء...' : 'Generating...') 
                          : (language === 'ar' ? 'إنشاء' : 'Generate')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                  />
                  <Label>{language === 'ar' ? 'مميز' : 'Featured'}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>{language === 'ar' ? 'نشط' : 'Active'}</Label>
                </div>
              </div>

              <Button onClick={handleSubmit} className="btn-gold w-full">
                {editingCourse 
                  ? (language === 'ar' ? 'تحديث' : 'Update')
                  : (language === 'ar' ? 'إنشاء' : 'Create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-10"
        />
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <CoursesTableSkeleton rows={6} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'الدورة' : 'Course'}</TableHead>
                <TableHead>{language === 'ar' ? 'المدرس' : 'Instructor'}</TableHead>
                <TableHead>{language === 'ar' ? 'السعر' : 'Price'}</TableHead>
                <TableHead>{language === 'ar' ? 'التسجيلات' : 'Enrollments'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses?.map((course: any) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-10 bg-gradient-gold rounded-lg flex items-center justify-center flex-shrink-0">
                        {course.is_featured && <Star className="w-5 h-5 text-primary-foreground" />}
                      </div>
                      <div>
                        <div className="font-medium">
                          {language === 'ar' ? course.title_ar : course.title}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {course.duration_hours} {language === 'ar' ? 'ساعة' : 'hours'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {course.instructor?.full_name || '-'}
                  </TableCell>
                  <TableCell>
                    {course.price > 0 ? `${course.price} ر.س` : (language === 'ar' ? 'مجاني' : 'Free')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {course.enrollments?.length || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={course.is_active}
                      onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: course.id, isActive: checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setQrCourse({
                          id: course.id,
                          title: language === 'ar' ? course.title_ar : course.title,
                          slug: course.slug,
                        })}
                        title={language === 'ar' ? 'رابط وباركود' : 'Link & QR Code'}
                      >
                        <QrCode className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setAdCourse({
                          id: course.id,
                          title: language === 'ar' ? course.title_ar : course.title,
                          slug: course.slug,
                          price: course.price,
                          duration: course.duration_hours,
                          instructor: course.instructor?.full_name,
                          thumbnail: course.thumbnail_url,
                          university: language === 'ar' ? course.majors?.colleges?.universities?.name_ar : course.majors?.colleges?.universities?.name,
                          college: language === 'ar' ? course.majors?.colleges?.name_ar : course.majors?.colleges?.name,
                          major: language === 'ar' ? course.majors?.name_ar : course.majors?.name,
                          studyYear: course.study_year,
                          subjectName: course.subject_name,
                          subjectCode: course.subject_code,
                        })}
                        title={language === 'ar' ? 'صورة إعلان' : 'Ad Image'}
                        className="text-amber-500"
                      >
                        <Megaphone className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setEnrollmentsDialogCourse({ 
                          id: course.id, 
                          title: language === 'ar' ? course.title_ar : course.title 
                        })}
                        title={language === 'ar' ? 'عرض المسجلين' : 'View Enrollments'}
                        className="text-primary"
                      >
                        <Users className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setSelectedCourse({ 
                          id: course.id, 
                          title: language === 'ar' ? course.title_ar : course.title 
                        })}
                        title={language === 'ar' ? 'إدارة الدروس' : 'Manage Lessons'}
                      >
                        <Video className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(course)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        disabled={deleteCourseMutation.isPending}
                        onClick={() => setDeletingCourseId(course.id)}
                      >
                        {deleteCourseMutation.isPending && deletingCourseId === course.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCourseId} onOpenChange={(open) => !open && setDeletingCourseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'تأكيد حذف الدورة' : 'Confirm Course Deletion'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? 'هل أنت متأكد من حذف هذا الدورة؟ سيتم حذف جميع الدروس والتسجيلات المرتبطة به. لا يمكن التراجع عن هذا الإجراء.'
                : 'Are you sure you want to delete this course? All associated lessons and enrollments will be deleted. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingCourseId && deleteCourseMutation.mutate(deletingCourseId)}
            >
              {deleteCourseMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin me-2" />
              ) : null}
              {language === 'ar' ? 'حذف الدورة' : 'Delete Course'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Course Enrollments Dialog */}
      {enrollmentsDialogCourse && (
        <CourseEnrollmentsDialog
          isOpen={!!enrollmentsDialogCourse}
          onClose={() => setEnrollmentsDialogCourse(null)}
          courseId={enrollmentsDialogCourse.id}
          courseTitle={enrollmentsDialogCourse.title}
        />
      )}

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
          instructorName={adCourse.instructor}
          thumbnailUrl={adCourse.thumbnail}
          universityName={adCourse.university}
          collegeName={adCourse.college}
          majorName={adCourse.major}
          studyYear={adCourse.studyYear}
          subjectName={adCourse.subjectName}
          subjectCode={adCourse.subjectCode}
        />
      )}
    </div>
  );
};
