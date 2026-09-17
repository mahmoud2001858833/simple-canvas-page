import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CourseCommunityChat } from '@/components/community/CourseCommunityChat';
import { CourseCommunitySettingsDialog } from '@/components/community/CourseCommunitySettingsDialog';
import { CommunitySettings, fetchCommunitySettings } from '@/services/courseCommunityService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  MessagesSquare,
  Search,
  BookOpen,
  MessageCircle,
  Settings,
  Sparkles,
  Lock,
  Megaphone,
} from 'lucide-react';
import { toast } from 'sonner';

interface InstructorCourseItem {
  id: string;
  title: string;
  title_ar: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
}

export const InstructorCommunitiesManagement: React.FC = () => {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState<InstructorCourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseForChat, setSelectedCourseForChat] = useState<InstructorCourseItem | null>(null);
  const [selectedCourseForSettings, setSelectedCourseForSettings] = useState<InstructorCourseItem | null>(null);
  const [courseSettings, setCourseSettings] = useState<CommunitySettings | null>(null);

  useEffect(() => {
    if (user) {
      fetchInstructorCourses();
    }
  }, [user]);

  const fetchInstructorCourses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, title_ar, thumbnail_url, is_active')
        .eq('instructor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (err: any) {
      console.error('Error fetching instructor courses for community:', err);
      toast.error('فشل تحميل دوراتك');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSettings = async (course: InstructorCourseItem) => {
    try {
      const stgs = await fetchCommunitySettings(course.id);
      setCourseSettings(stgs);
      setSelectedCourseForSettings(course);
    } catch (err) {
      toast.error('تعذر تحميل إعدادات الدورة');
    }
  };

  const filtered = courses.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.title?.toLowerCase().includes(q) ||
      (c.title_ar && c.title_ar.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900/10 via-purple-900/5 to-transparent p-5 rounded-2xl border border-indigo-100 dark:border-indigo-950">
        <div>
          <div className="flex items-center gap-2">
            <MessagesSquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              مجتمعات وقروبات دوراتي (Course Communities)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إدارة كاملة لقروبات شات دوراتك: إرسال الإعلانات، إنشاء استطلاعات الرأي والتصويت، التحكم بإرسال رسائل وصور الطلاب، وتثبيت التنبيهات.
          </p>
        </div>

        <Badge variant="outline" className="bg-white dark:bg-slate-900 text-xs px-3 py-1 border-indigo-200">
          دوراتك: {courses.length}
        </Badge>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="ابحث في دوراتك..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 text-xs sm:text-sm bg-white dark:bg-slate-900 text-right"
            dir="rtl"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={fetchInstructorCourses}
          className="text-xs shrink-0"
        >
          تحديث
        </Button>
      </div>

      {/* Grid of Courses */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="animate-pulse bg-slate-100 dark:bg-slate-800 h-44 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900">
          <MessageCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold">لم يتم العثور على أي دورات تابعة لك حالياً</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col justify-between"
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-6 h-6 text-indigo-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {c.title_ar || c.title}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 truncate mt-0.5">
                      قروب شات الدورة المباشر
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-2 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    صلاحيات إدارة المعلم
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {c.is_active ? 'دورة نشطة' : 'غير نشطة'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={() => setSelectedCourseForChat(c)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold gap-1.5"
                  >
                    <MessagesSquare className="w-3.5 h-3.5" />
                    دخول القروب والشات 💬
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenSettings(c)}
                    className="text-xs px-2.5"
                    title="إعدادات وصلاحيات القروب"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Chat Dialog */}
      {selectedCourseForChat && (
        <Dialog open={!!selectedCourseForChat} onOpenChange={() => setSelectedCourseForChat(null)}>
          <DialogContent className="max-w-4xl p-2 sm:p-4 bg-white dark:bg-slate-900 text-right" dir="rtl">
            <DialogHeader className="px-2 text-right">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MessagesSquare className="w-5 h-5 text-indigo-600" />
                <span>قروب شات الدورة: {selectedCourseForChat.title_ar || selectedCourseForChat.title}</span>
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 text-[10px]">
                  👨‍🏫 وضع المعلم
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="mt-2">
              <CourseCommunityChat
                courseId={selectedCourseForChat.id}
                courseTitle={selectedCourseForChat.title_ar || selectedCourseForChat.title}
                instructorId={user?.id}
                instructorName={profile?.full_name_ar || profile?.full_name || 'المعلم'}
                thumbnailUrl={selectedCourseForChat.thumbnail_url}
                className="h-[620px]"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Direct Settings Dialog */}
      {selectedCourseForSettings && courseSettings && (
        <CourseCommunitySettingsDialog
          open={!!selectedCourseForSettings}
          onOpenChange={() => setSelectedCourseForSettings(null)}
          settings={courseSettings}
          courseId={selectedCourseForSettings.id}
          courseTitle={selectedCourseForSettings.title_ar || selectedCourseForSettings.title}
          currentUserId={user?.id || ''}
          onSettingsSaved={(newStgs) => setCourseSettings(newStgs)}
        />
      )}
    </div>
  );
};
