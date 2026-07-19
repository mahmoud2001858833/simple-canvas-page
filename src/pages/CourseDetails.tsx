import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  Users,
  Star,
  Play,
  Lock,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  BookOpen,
  Video,
  Calendar,
  ShoppingCart,
  FolderOpen,
  FileText,
  CreditCard,
  ClipboardList,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { OnboardingTooltip } from "@/components/onboarding/OnboardingTooltip";
import { CourseReviews } from "@/components/course/CourseReviews";
import { CourseDetailsCard } from "@/components/course/CourseDetailsCard";
import { CourseChat } from "@/components/course/CourseChat";
import { CourseDiscussions } from "@/components/course/CourseDiscussions";
import { MessageSquare } from "lucide-react";

// Onboarding steps for Course Details page
const courseDetailsOnboardingSteps = [
  {
    id: "course-info",
    title: "Course Information",
    title_ar: "معلومات الدورة",
    description: "View course details including duration, number of students, and lessons",
    description_ar: "شاهد تفاصيل الدورة بما في ذلك المدة وعدد الطلاب والدروس",
    target: "[data-onboarding='course-info']",
    placement: "bottom" as const,
  },
  {
    id: "course-enroll",
    title: "Enrollment Card",
    title_ar: "بطاقة الاشتراك",
    description: "See the price and enroll in the course from here",
    description_ar: "شاهد السعر واشترك في الدورة من هنا",
    target: "[data-onboarding='course-enroll']",
    placement: "left" as const,
  },
  {
    id: "course-content",
    title: "Course Content",
    title_ar: "محتوى الدورة",
    description: "Browse all lessons in this course. Free preview lessons are marked",
    description_ar: "تصفح جميع الدروس في هذا الدورة. الدروس المجانية معلمة",
    target: "[data-onboarding='course-content']",
    placement: "top" as const,
  },
  {
    id: "course-instructor",
    title: "Instructor",
    title_ar: "المدرب",
    description: "Learn more about your instructor",
    description_ar: "تعرف على مدربك أكثر",
    target: "[data-onboarding='course-instructor']",
    placement: "left" as const,
  },
];

// Helper: get lesson title in its original language (fallback)
const getLessonTitle = (lesson: any) => {
  if (lesson.title_ar && lesson.title_ar.trim()) return lesson.title_ar;
  if (lesson.title && lesson.title.trim()) return lesson.title;
  return lesson.title_ar || lesson.title || '';
};

const CourseDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const { user, role } = useAuth();
  const { startOnboarding, state } = useOnboarding();
  const isRTL = language === "ar";

  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const isAdminOrInstructor = role === 'admin' || role === 'instructor';

  useEffect(() => {
    if (user && state.hasSeenWelcome && !state.completedSteps.includes("course-info")) {
      const timer = setTimeout(() => {
        startOnboarding(courseDetailsOnboardingSteps);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, state.hasSeenWelcome, state.completedSteps, startOnboarding]);

  // Determine if id param is a UUID or a slug
  const isUUID = id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) : false;

  // Fetch course details (supports both UUID and slug)
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course", id],
    queryFn: async () => {
      let query = supabase
        .from("courses")
        .select(`*, majors ( id, name, name_ar, colleges ( id, name, name_ar, universities ( id, name, name_ar ) ) )`);

      if (isUUID) {
        query = query.eq("id", id);
      } else {
        query = query.eq("slug", id);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Use resolved course UUID for all sub-queries
  const courseUUID = course?.id;

  // Fetch lessons
  const { data: lessons = [] } = useQuery({
    queryKey: ["lessons", courseUUID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("course_id", courseUUID!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!courseUUID,
  });

  // Fetch chapters
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", courseUUID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("course_id", courseUUID!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!courseUUID,
  });

  // Fetch chapter files
  const { data: chapterFiles = [] } = useQuery({
    queryKey: ["chapter-files", courseUUID],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapter_files" as any).select("*").eq("course_id", courseUUID!).order("sort_order");
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!courseUUID,
  });

  // Fetch quizzes
  const { data: quizzes = [] } = useQuery({
    queryKey: ["quizzes", courseUUID],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes" as any).select("*").eq("course_id", courseUUID!).order("sort_order");
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!courseUUID,
  });

  // Fetch attachments count
  const { data: attachmentsCount = 0 } = useQuery({
    queryKey: ["attachments-count", id],
    queryFn: async () => {
      const lessonIds = lessons.map(l => l.id);
      if (lessonIds.length === 0) return 0;
      const { count, error } = await supabase
        .from("lesson_attachments")
        .select("*", { count: "exact", head: true })
        .in("lesson_id", lessonIds);
      if (error) return 0;
      return count || 0;
    },
    enabled: lessons.length > 0,
  });

  // Fetch enrollment status
  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", courseUUID, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("course_id", courseUUID!)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!courseUUID && !!user,
  });

  // Fetch lesson progress
  const { data: lessonProgress = [] } = useQuery({
    queryKey: ["lesson-progress", courseUUID, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const lessonIds = lessons.map((l) => l.id);
      if (lessonIds.length === 0) return [];
      const { data, error } = await supabase
        .from("lesson_progress")
        .select("*")
        .eq("user_id", user.id)
        .in("lesson_id", lessonIds);
      if (error) throw error;
      return data;
    },
    enabled: !!courseUUID && !!user && lessons.length > 0,
  });

  // Fetch enrollment count (only for admin/instructor)
  const { data: enrollmentCount = 0 } = useQuery({
    queryKey: ["enrollment-count", courseUUID],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("course_id", courseUUID!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!courseUUID && isAdminOrInstructor,
  });

  // Fetch average rating
  const { data: avgRating } = useQuery({
    queryKey: ["course-avg-rating", courseUUID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_reviews")
        .select("rating")
        .eq("course_id", courseUUID!);
      if (error) throw error;
      if (!data || data.length === 0) return { avg: 0, count: 0 };
      const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
      return { avg, count: data.length };
    },
    enabled: !!courseUUID,
  });

  // Fetch instructor profile
  const { data: instructor } = useQuery({
    queryKey: ["instructor", course?.instructor_id],
    queryFn: async () => {
      if (!course?.instructor_id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", course.instructor_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!course?.instructor_id,
  });

  // Enroll mutation
  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error("Not authenticated");
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({ user_id: user.id, course_id: id, amount: course?.price || 0, payment_method: "online", status: "pending" })
        .select()
        .single();
      if (paymentError) throw paymentError;

      const { error: updateError } = await supabase
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", payment.id);
      if (updateError) throw updateError;

      const { error: enrollError } = await supabase.from("enrollments").insert({
        user_id: user.id, course_id: id, status: "active",
      });
      if (enrollError) throw enrollError;
      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment", id] });
      setShowEnrollDialog(false);
      toast.success(isRTL ? "تم الاشتراك بنجاح!" : "Enrolled successfully!");
    },
    onError: (error) => {
      console.error("Enrollment error:", error);
      toast.error(isRTL ? "حدث خطأ أثناء الاشتراك" : "Enrollment failed");
    },
  });

  const handleEnroll = async () => {
    if (!user) { navigate("/login"); return; }
    setShowEnrollDialog(true);
  };

  const confirmEnroll = async () => {
    setIsEnrolling(true);
    await enrollMutation.mutateAsync();
    setIsEnrolling(false);
  };

  // Calculate progress
  const completedLessons = lessonProgress.filter((p) => p.completed).length;
  const progressPercent = lessons.length > 0 ? (completedLessons / lessons.length) * 100 : 0;
  const totalDuration = lessons.reduce((acc, lesson) => acc + (lesson.duration_minutes || 0), 0);

  // Chapter-based installment access logic
  const paidPercentage = (enrollment as any)?.paid_percentage ?? 100;
  const chaptersWithContent = chapters.filter(ch => lessons.some(l => (l as any).chapter_id === ch.id));
  const totalChaptersCount = chaptersWithContent.length || 1;
  const accessibleChapterCount = Math.ceil((paidPercentage / 100) * totalChaptersCount);
  
  // Get accessible chapter IDs based on sort order
  const sortedChapters = [...chaptersWithContent].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const accessibleChapterIds = new Set(sortedChapters.slice(0, accessibleChapterCount).map(ch => ch.id));

  // Admin: free access to everything. Instructor: free access to own courses only.
  const hasStaffFreeAccess = role === 'admin'
    || (role === 'instructor' && !!user && !!(course as any)?.instructor_id && (course as any).instructor_id === user.id);

  const isChapterAccessible = (chapterId: string | null) => {
    if (hasStaffFreeAccess) return true;
    if (!enrollment || enrollment.status !== 'active') return false;
    if (paidPercentage >= 100) return true;
    if (!chapterId) return true; // lessons without chapters are always accessible
    return accessibleChapterIds.has(chapterId);
  };

  const isLessonAccessible = (lesson: any, _index: number) => {
    if (lesson.is_preview) return true;
    if (hasStaffFreeAccess) return true;
    if (!enrollment || enrollment.status !== 'active') return false;
    if (paidPercentage >= 100) return true;
    return isChapterAccessible(lesson.chapter_id);
  };

  const getLessonProgressData = (lessonId: string) => {
    return lessonProgress.find((p) => p.lesson_id === lessonId);
  };

  // Group lessons by chapter
  const groupedContent = () => {
    const groups: { chapter: any | null; lessons: { lesson: any; globalIndex: number }[] }[] = [];
    const chapterMap = new Map<string, { lesson: any; globalIndex: number }[]>();
    const noChapter: { lesson: any; globalIndex: number }[] = [];

    lessons.forEach((lesson, globalIndex) => {
      const chId = (lesson as any).chapter_id;
      if (chId) {
        if (!chapterMap.has(chId)) chapterMap.set(chId, []);
        chapterMap.get(chId)!.push({ lesson, globalIndex });
      } else {
        noChapter.push({ lesson, globalIndex });
      }
    });

    chapters.forEach(ch => {
      groups.push({ chapter: ch, lessons: chapterMap.get(ch.id) || [] });
    });

    if (noChapter.length > 0) {
      groups.push({ chapter: null, lessons: noChapter });
    }

    return groups;
  };

  if (courseLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <GraduationCap className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">{isRTL ? "الدورة غير موجود" : "Course Not Found"}</h1>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/courses">{isRTL ? "العودة للدورات" : "Back to Courses"}</Link>
        </Button>
      </div>
    );
  }

  const groups = groupedContent();

  return (
    <>
    <OnboardingTooltip />
    <div className={`min-h-screen bg-background ${isRTL ? "rtl" : "ltr"}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-12">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => navigate("/courses")}
          >
            {isRTL ? (
              <><ArrowRight className="h-4 w-4 ml-2" />العودة للدورات</>
            ) : (
              <><ArrowLeft className="h-4 w-4 mr-2" />Back to Courses</>
            )}
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Course Info */}
            <div className="lg:col-span-2" data-onboarding="course-info">
              <div className="flex flex-wrap gap-2 mb-4">
                {course.is_featured && (
                  <Badge className="bg-yellow-500">
                    <Star className="h-3 w-3 mr-1" />{isRTL ? "مميز" : "Featured"}
                  </Badge>
                )}
                {(course.majors as any) && (
                  <Badge variant="secondary">
                    {isRTL ? (course.majors as any).name_ar : (course.majors as any).name}
                  </Badge>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                {isRTL ? course.title_ar : course.title}
              </h1>

              <p className="text-lg opacity-90 mb-6">
                {isRTL ? course.description_ar : course.description}
              </p>

              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span>{course.duration_hours} {isRTL ? "ساعة" : "hours"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  <span>{lessons.length} {isRTL ? "درس" : "lessons"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  <span>{totalDuration} {isRTL ? "دقيقة" : "min"}</span>
                </div>
                {avgRating && avgRating.count > 0 && (
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span>{avgRating.avg.toFixed(1)} ({avgRating.count})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Enrollment Card */}
            <div className="lg:col-span-1">
              <Card className="bg-background text-foreground sticky top-4" data-onboarding="course-enroll">
                {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt={isRTL ? course.title_ar : course.title} className="w-full h-48 object-cover rounded-t-lg" />
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center rounded-t-lg">
                    <GraduationCap className="h-16 w-16 text-primary/40" />
                  </div>
                )}

                <CardContent className="pt-6">
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-3xl font-bold text-primary">{course.price} {isRTL ? "ر.س" : "SAR"}</span>
                    {course.original_price && course.original_price > (course.price || 0) && (
                      <span className="text-lg text-muted-foreground line-through">{course.original_price}</span>
                    )}
                  </div>

                  {/* Installment info */}
                  {enrollment?.status === 'active' && paidPercentage < 100 && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        {isRTL ? `المدفوع: ${paidPercentage}% - متاح ${accessibleChapterCount} من ${totalChaptersCount} فصل` : `Paid: ${paidPercentage}% - ${accessibleChapterCount} of ${totalChaptersCount} chapters available`}
                      </p>
                      <Button size="sm" className="mt-2 w-full" onClick={() => navigate(`/checkout/${id}`)}>
                        <CreditCard className="h-4 w-4 mr-2" />
                        {isRTL ? 'ادفع القسط التالي' : 'Pay Next Installment'}
                      </Button>
                    </div>
                  )}

                  {enrollment?.status === "active" ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">{isRTL ? "أنت مشترك في هذا الدورة" : "You're enrolled"}</span>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>{isRTL ? "التقدم" : "Progress"}</span>
                          <span>{completedLessons}/{lessons.length}</span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                      </div>
                      <Button className="w-full" size="lg" asChild>
                        <Link to={`/courses/${id}/lessons/${lessons[0]?.id}`}>
                          <Play className="h-4 w-4 mr-2" />{isRTL ? "متابعة التعلم" : "Continue Learning"}
                        </Link>
                      </Button>
                      {course?.instructor_id && (
                        <Button variant="outline" className="w-full" onClick={() => setShowChat(true)}>
                          <MessageSquare className="h-4 w-4 me-2" />
                          {isRTL ? 'تواصل مع المعلم' : 'Contact Instructor'}
                        </Button>
                      )}
                    </div>
                  ) : (course?.price === 0 || course?.price === null) ? (
                    <Button className="w-full" size="lg" onClick={() => { if (!user) { navigate("/login"); return; } handleEnroll(); }} disabled={isEnrolling}>
                      <GraduationCap className="h-4 w-4 mr-2" />
                      {isEnrolling ? (isRTL ? "جاري التسجيل..." : "Enrolling...") : (isRTL ? "سجّل مجاناً" : "Enroll for Free")}
                    </Button>
                  ) : (
                    <Button className="w-full" size="lg" onClick={() => { if (!user) { navigate("/login"); return; } navigate(`/checkout/${id}`); }}>
                      <ShoppingCart className="h-4 w-4 mr-2" />{isRTL ? "اشتري الآن" : "Buy Now"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Course Content - grouped by chapters */}
            <Card data-onboarding="course-content">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />{isRTL ? "محتوى الدورة" : "Course Content"}
                  {lessons.length > 0 && (
                    <Badge variant="secondary" className="text-xs ms-2">
                      {(() => {
                        const chaptersWithLessons = chapters.filter(ch => 
                          lessons.some(l => (l as any).chapter_id === ch.id)
                        ).length;
                        return chaptersWithLessons > 0 ? `${chaptersWithLessons} ${isRTL ? "فصل" : "chapters"} • ` : '';
                      })()}
                      {lessons.length} {isRTL ? "درس" : "lessons"}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lessons.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {isRTL ? "لم تتم إضافة دروس بعد" : "No lessons added yet"}
                  </p>
                ) : (
                  <Accordion type="multiple" defaultValue={groups.filter(g => g.lessons.length > 0).map(g => g.chapter?.id || 'no-chapter')} className="w-full space-y-2">
                    {groups
                      .filter(group => group.lessons.length > 0)
                      .map((group) => {
                      const chapterLessonsCount = group.lessons.length;
                      const chapterCompletedCount = group.lessons.filter(({ lesson }) => getLessonProgressData(lesson.id)?.completed).length;
                      const chapterDuration = group.lessons.reduce((sum, { lesson }) => sum + (lesson.duration_minutes || 0), 0);
                      const chapterAccessible = isChapterAccessible(group.chapter?.id || null);

                      return (
                        <AccordionItem
                          key={group.chapter?.id || 'no-chapter'}
                          value={group.chapter?.id || 'no-chapter'}
                          className={`border rounded-lg px-1 overflow-hidden`}
                        >
                          <AccordionTrigger className="hover:no-underline py-4">
                            <div className="flex items-center gap-3 text-start w-full">
                              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${chapterAccessible ? 'bg-primary/10' : 'bg-muted'}`}>
                                {chapterAccessible ? (
                                  <FolderOpen className="h-5 w-5 text-primary" />
                                ) : (
                                  <Lock className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm">
                                  {group.chapter
                                    ? (isRTL ? (group.chapter.title_ar || group.chapter.title) : (group.chapter.title || group.chapter.title_ar))
                                    : (isRTL ? 'دروس عامة' : 'General Lessons')}
                                </h3>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                  <span>{chapterLessonsCount} {isRTL ? "درس" : "lessons"}</span>
                                  {chapterDuration > 0 && <span>{chapterDuration} {isRTL ? "دقيقة" : "min"}</span>}
                                  {enrollment && chapterCompletedCount > 0 && (
                                    <span className="text-green-600">{chapterCompletedCount}/{chapterLessonsCount} {isRTL ? "مكتمل" : "done"}</span>
                                  )}
                                  {!chapterAccessible && (
                                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                      <Lock className="h-3 w-3 mr-1" />
                                      {isRTL ? 'يتطلب دفع' : 'Requires Payment'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-3">
                            {/* Show pay button for locked chapters */}
                            {!chapterAccessible && enrollment?.status === 'active' && (
                              <div className="mx-3 mb-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                                  {isRTL 
                                    ? 'هذا الفصل مقفل. ادفع القسط التالي لفتحه.'
                                    : 'This chapter is locked. Pay the next installment to unlock it.'}
                                </p>
                                <Button size="sm" className="w-full" onClick={() => navigate(`/checkout/${id}`)}>
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  {isRTL ? 'ادفع للمتابعة' : 'Pay to Continue'}
                                </Button>
                              </div>
                            )}
                            <div className="space-y-1 pt-1">
                              {group.lessons.map(({ lesson, globalIndex }) => {
                                const progress = getLessonProgressData(lesson.id);
                                const accessible = isLessonAccessible(lesson, globalIndex);
                                const title = getLessonTitle(lesson);

                                return (
                                  <div
                                    key={lesson.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                      accessible ? 'hover:bg-muted/60 cursor-pointer' : 'cursor-default'
                                    }`}
                                    onClick={() => {
                                      if (accessible) {
                                        navigate(`/courses/${id}/lessons/${lesson.id}`);
                                      } else if (!user) {
                                        toast.info(isRTL ? 'سجّل دخولك أولاً ثم اشترِ الدورة لمشاهدة هذا الدرس' : 'Please login and purchase the course to watch this lesson');
                                        navigate('/login');
                                      } else if (!enrollment) {
                                        toast.info(isRTL ? 'اشترِ الدورة لمشاهدة هذا الدرس' : 'Purchase the course to watch this lesson');
                                        navigate(`/checkout/${id}`);
                                      } else if (enrollment?.status === 'active') {
                                        navigate(`/checkout/${id}`);
                                      }
                                    }}
                                  >
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                      progress?.completed ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
                                    }`}>
                                      {progress?.completed ? <CheckCircle className="h-4 w-4" /> : globalIndex + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium truncate">
                                          {title || (isRTL ? `الدرس ${globalIndex + 1}` : `Lesson ${globalIndex + 1}`)}
                                        </span>
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0 bg-primary/10 text-primary">
                                          <Video className="h-2.5 w-2.5 me-0.5" />
                                          {isRTL ? "درس" : "Lesson"}
                                        </Badge>
                                        {lesson.is_preview && (
                                          <Badge variant="outline" className="text-xs flex-shrink-0 text-green-600 border-green-300">{isRTL ? "معاينة مجانية" : "Free Preview"}</Badge>
                                        )}
                                      </div>
                                      {lesson.duration_minutes > 0 && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                          <Video className="h-3 w-3" />{lesson.duration_minutes} {isRTL ? "دقيقة" : "min"}
                                        </span>
                                      )}
                                    </div>
                                    {accessible ? (
                                      <Play className="h-4 w-4 text-primary flex-shrink-0" />
                                    ) : (
                                      <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                  </div>
                                );
                              })}

                              {/* Chapter Files */}
                              {group.chapter && chapterFiles.filter((f: any) => f.chapter_id === group.chapter.id).map((file: any) => {
                                const fileAccessible = enrollment?.status === "active" || hasStaffFreeAccess;
                                return (
                                  <div key={`file-${file.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                      <FileText className="h-4 w-4 text-blue-600" />
                                    </div>
                                     <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium truncate">{isRTL ? file.title_ar : file.title}</span>
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                          <FileText className="h-2.5 w-2.5 me-0.5" />
                                          {isRTL ? "ملف" : "File"}
                                        </Badge>
                                      </div>
                                     </div>
                                    {fileAccessible ? (
                                      <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                                        <Download className="h-4 w-4 text-primary" />
                                      </a>
                                    ) : (
                                      <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                  </div>
                                );
                              })}

                              {/* Quizzes */}
                              {group.chapter && quizzes.filter((q: any) => q.chapter_id === group.chapter.id).map((quiz: any) => {
                                const quizAccessible = enrollment?.status === "active" || hasStaffFreeAccess;
                                return (
                                  <div
                                    key={`quiz-${quiz.id}`}
                                    className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60 ${quizAccessible ? 'cursor-pointer' : ''}`}
                                    onClick={() => {
                                      if (!quizAccessible) return;
                                      if (quiz.quiz_type === 'pdf' && quiz.file_url) {
                                        window.open(quiz.file_url, '_blank');
                                      } else if (quiz.quiz_type === 'interactive') {
                                        navigate(`/quiz/${quiz.id}`);
                                      }
                                    }}
                                  >
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                      <ClipboardList className="h-4 w-4 text-purple-600" />
                                    </div>
                                     <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium truncate">{isRTL ? quiz.title_ar : quiz.title}</span>
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                          <ClipboardList className="h-2.5 w-2.5 me-0.5" />
                                          {isRTL ? "امتحان" : "Quiz"}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {quiz.quiz_type === 'pdf' ? 'PDF' : (isRTL ? 'كويز إلكتروني' : 'Interactive Quiz')}
                                      </p>
                                     </div>
                                    {quizAccessible ? (
                                      <ClipboardList className="h-4 w-4 text-primary flex-shrink-0" />
                                    ) : (
                                      <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>

            {/* Reviews Section */}
            <CourseReviews courseId={id!} isRTL={isRTL} />

            {/* Course Forum */}
            {(enrollment?.status === "active" || hasStaffFreeAccess) && (
              <Card>
                <CardContent className="pt-6">
                  <CourseDiscussions courseId={id!} isInstructor={isAdminOrInstructor} />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Instructor Card */}
            {instructor && (
              <Card data-onboarding="course-instructor">
                <CardHeader>
                  <CardTitle className="text-lg">{isRTL ? "المدرس" : "Instructor"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      {instructor.avatar_url ? (
                        <img src={instructor.avatar_url} alt={instructor.full_name || ""} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <GraduationCap className="h-8 w-8 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{isRTL ? instructor.full_name_ar || instructor.full_name : instructor.full_name}</p>
                      <p className="text-sm text-muted-foreground">{isRTL ? "مدرس" : "Instructor"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Enhanced Course Details Card */}
            <CourseDetailsCard
              course={course}
              lessons={lessons}
              chaptersCount={chapters.length}
              attachmentsCount={attachmentsCount}
              totalDuration={totalDuration}
            />
          </div>
        </div>
      </div>

      {/* Enrollment Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? "تأكيد الاشتراك" : "Confirm Enrollment"}</DialogTitle>
            <DialogDescription>
              {isRTL ? `هل تريد الاشتراك في "${course.title_ar}"؟` : `Do you want to enroll in "${course.title}"?`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <span>{isRTL ? "سعر الدورة" : "Course Price"}</span>
              <span className="font-bold text-lg">{course.price} {isRTL ? "ر.س" : "SAR"}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrollDialog(false)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={confirmEnroll} disabled={isEnrolling}>
              {isEnrolling ? (isRTL ? "جاري الاشتراك..." : "Enrolling...") : (isRTL ? "تأكيد الاشتراك" : "Confirm Enrollment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Course Chat */}
      {course?.instructor_id && (
        <CourseChat
          open={showChat}
          onOpenChange={setShowChat}
          courseId={id!}
          instructorId={course.instructor_id}
          courseName={isRTL ? course.title_ar : course.title}
        />
      )}
    </div>
    </>
  );
};

export default CourseDetails;
