import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { CourseCommunityChat } from "@/components/community/CourseCommunityChat";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, Loader2, Sparkles } from "lucide-react";

export const CourseCommunityPage = () => {
  const { id: courseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { dir } = useLanguage();
  const isRTL = dir === "rtl";

  // Fetch course details
  const { data: course, isLoading } = useQuery({
    queryKey: ["course-community-page", courseId],
    queryFn: async () => {
      if (!courseId) throw new Error("Course ID required");

      const { data, error } = await supabase
        .from("courses")
        .select(`
          id,
          title,
          title_ar,
          instructor_id,
          thumbnail_url,
          profiles:instructor_id (
            id,
            full_name,
            full_name_ar,
            avatar_url
          )
        `)
        .eq("id", courseId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {isRTL ? "جاري تحميل مجتمع الدورة..." : "Loading course community..."}
        </p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4 p-4 text-center">
        <h2 className="text-xl font-bold">
          {isRTL ? "تعذر العثور على الدورة المطلوبة" : "Course not found"}
        </h2>
        <Button onClick={() => navigate("/courses")} variant="outline">
          {isRTL ? "العودة لقائمة الدورات" : "Back to courses"}
        </Button>
      </div>
    );
  }

  const courseTitle = isRTL ? course.title_ar || course.title : course.title;
  const instructor = (course as any).profiles;
  const instructorName = instructor
    ? (isRTL ? instructor.full_name_ar || instructor.full_name : instructor.full_name)
    : "";

  return (
    <div dir={dir} className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Header Navigation */}
      <header className="h-14 border-b border-border/80 bg-card/80 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/courses/${courseId}`)}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0 px-2"
            title={isRTL ? "العودة لصفحة الدورة" : "Back to course"}
          >
            {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            <span className="hidden sm:inline">{isRTL ? "صفحة الدورة" : "Course Details"}</span>
          </Button>

          <div className="h-4 w-px bg-border/80 hidden sm:block" />

          {course.thumbnail_url && (
            <img
              src={course.thumbnail_url}
              alt={courseTitle}
              className="w-8 h-8 rounded-lg object-cover border border-border/60 shrink-0 hidden xs:block"
            />
          )}

          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate text-foreground flex items-center gap-2">
              <span className="truncate">{courseTitle}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary shrink-0 hidden md:inline-flex">
                مجتمع وقروب الدورة 💬
              </Badge>
            </h1>
            {instructorName && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                <GraduationCap className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="truncate">{instructorName}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/courses/${courseId}`)}
            className="text-xs h-8 gap-1.5 border-primary/20 hover:bg-primary/5 text-primary"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isRTL ? "محتوى الدروس" : "Lessons"}</span>
          </Button>
        </div>
      </header>

      {/* Main Chat Canvas (Full Height) */}
      <main className="flex-1 overflow-hidden relative">
        <CourseCommunityChat
          courseId={course.id}
          courseTitle={courseTitle}
          instructorId={course.instructor_id}
          instructorName={instructorName}
          thumbnailUrl={course.thumbnail_url}
          className="h-full border-0 rounded-none shadow-none max-w-none"
        />
      </main>
    </div>
  );
};

export default CourseCommunityPage;
