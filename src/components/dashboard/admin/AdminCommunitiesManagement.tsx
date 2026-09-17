import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CourseCommunityChat } from '@/components/community/CourseCommunityChat';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  MessagesSquare,
  Search,
  BookOpen,
  Users,
  ShieldCheck,
  Megaphone,
  Eye,
  Settings,
  Sparkles,
  Lock,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface CourseCommunityItem {
  id: string;
  title: string;
  title_ar: string | null;
  thumbnail_url: string | null;
  instructor_id: string | null;
  instructor_name?: string;
  is_active: boolean;
  message_count?: number;
}

export const AdminCommunitiesManagement: React.FC = () => {
  const [courses, setCourses] = useState<CourseCommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<CourseCommunityItem | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      // 1. Fetch all courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title, title_ar, thumbnail_url, instructor_id, is_active')
        .order('created_at', { ascending: false });

      if (coursesError) throw coursesError;

      // 2. Safely fetch instructor profiles without invalid schema joins
      const instructorIds = Array.from(
        new Set(
          (coursesData || [])
            .map((c: any) => c.instructor_id)
            .filter(Boolean)
        )
      );

      const profilesMap: Record<string, string> = {};
      if (instructorIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, full_name_ar')
          .in('id', instructorIds);

        (profs || []).forEach((p: any) => {
          profilesMap[p.id] = p.full_name_ar || p.full_name || 'معلم';
        });
      }

      const mapped: CourseCommunityItem[] = (coursesData || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        title_ar: c.title_ar,
        thumbnail_url: c.thumbnail_url,
        instructor_id: c.instructor_id,
        instructor_name: (c.instructor_id && profilesMap[c.instructor_id]) || 'غير محدد',
        is_active: c.is_active,
      }));

      setCourses(mapped);
    } catch (err: any) {
      console.error('Error fetching courses for admin community:', err);
      toast.error('فشل تحميل قائمة مجتمعات الدورات');
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.title?.toLowerCase().includes(q) ||
      (c.title_ar && c.title_ar.toLowerCase().includes(q)) ||
      (c.instructor_name && c.instructor_name.toLowerCase().includes(q))
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
              إدارة مجتمعات وقروبات الدورات (Community Hub)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            صلاحيات إدارية عليا وشاملة لمراقبة قروبات شات كافة الدورات، التفاعل كإدارة منصة، وتعديل الصلاحيات واستطلاعات الرأي.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-white dark:bg-slate-900 text-xs px-3 py-1 border-indigo-200">
            إجمالي الدورات: {courses.length}
          </Badge>
        </div>
      </div>

      {/* Quick search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="ابحث باسم الدورة أو اسم المعلم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 text-xs sm:text-sm bg-white dark:bg-slate-900 text-right"
            dir="rtl"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={fetchCourses}
          className="text-xs shrink-0"
        >
          تحديث
        </Button>
      </div>

      {/* Grid of Course Groups */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Card key={n} className="animate-pulse bg-slate-100 dark:bg-slate-800 h-44 rounded-xl" />
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <Card className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900">
          <MessageCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold">لم يتم العثور على أي دورات تطابق البحث</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((c) => (
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
                      المعلم: {c.instructor_name}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    تحكم إداري كامل
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {c.is_active ? 'دورة نشطة' : 'غير نشطة'}
                  </Badge>
                </div>

                <Button
                  type="button"
                  onClick={() => setSelectedCourse(c)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  دخول ومراقبة قروب الدورة
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Admin Community Viewer Modal */}
      {selectedCourse && (
        <Dialog open={!!selectedCourse} onOpenChange={() => setSelectedCourse(null)}>
          <DialogContent className="max-w-4xl p-2 sm:p-4 bg-white dark:bg-slate-900 text-right" dir="rtl">
            <DialogHeader className="px-2 text-right">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <span>قروب شات الدورة: {selectedCourse.title_ar || selectedCourse.title}</span>
                <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 text-[10px]">
                  وضع المشرف العام (Super Admin)
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="mt-2">
              <CourseCommunityChat
                courseId={selectedCourse.id}
                courseTitle={selectedCourse.title_ar || selectedCourse.title}
                instructorId={selectedCourse.instructor_id || undefined}
                instructorName={selectedCourse.instructor_name}
                thumbnailUrl={selectedCourse.thumbnail_url}
                className="h-[620px]"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
