import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useCloudflareVideoUrl } from "@/hooks/useCloudflareVideoUrl";
import { useVideoProtectionSetting } from "@/hooks/useScreenRecordingProtection";
import { ProtectedVideoPlayer, ProtectedVideoPlayerRef } from "@/components/video/ProtectedVideoPlayer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  CheckCircle,
  Circle,
  Lock,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Video,
  Clock,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Volume2,
  VolumeX,
  Loader2,
  Shield,
  Settings,
  Sparkles,
  StickyNote,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { OnboardingTooltip } from "@/components/onboarding/OnboardingTooltip";
import { LessonAttachments } from "@/components/course/LessonAttachments";
import { LessonAIAssistant } from "@/components/video/LessonAIAssistant";
import { VideoNotesPanel } from "@/components/video/VideoNotesPanel";
import { CourseRatingDialog } from "@/components/course/CourseRatingDialog";
import { trackXapi } from "@/lib/xapi";

// Onboarding steps for Lesson Viewer page
const lessonOnboardingSteps = [
  {
    id: "lesson-video",
    title: "Video Player",
    title_ar: "مشغل الفيديو",
    description: "Watch the lesson video here. You can pause, seek, and control volume",
    description_ar: "شاهد فيديو الدرس هنا. يمكنك الإيقاف والتقديم والتحكم بالصوت",
    target: "[data-onboarding='lesson-video']",
    placement: "bottom" as const,
  },
  {
    id: "lesson-progress",
    title: "Your Progress",
    title_ar: "تقدمك",
    description: "Track your course progress here. Complete lessons to move forward",
    description_ar: "تتبع تقدمك في الدورة هنا. أكمل الدروس للتقدم",
    target: "[data-onboarding='lesson-progress']",
    placement: "left" as const,
  },
  {
    id: "lesson-list",
    title: "Lessons List",
    title_ar: "قائمة الدروس",
    description: "Navigate between lessons using this sidebar. Completed lessons are marked with a checkmark",
    description_ar: "تنقل بين الدروس باستخدام هذا الشريط الجانبي. الدروس المكتملة معلمة بعلامة صح",
    target: "[data-onboarding='lesson-list']",
    placement: "left" as const,
  },
  {
    id: "lesson-complete",
    title: "Mark Complete",
    title_ar: "تحديد كمكتمل",
    description: "Click this button to manually mark the lesson as complete",
    description_ar: "اضغط على هذا الزر لتحديد الدرس كمكتمل يدوياً",
    target: "[data-onboarding='lesson-complete']",
    placement: "bottom" as const,
  },
];

const LessonViewer = () => {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const { user, role } = useAuth();
  const { startOnboarding, state } = useOnboarding();
  const isRTL = language === "ar";

  const videoRef = useRef<HTMLVideoElement>(null);
  const protectedPlayerRef = useRef<ProtectedVideoPlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Video protection - only watermark, no screen recording detection
  const { isEnabled: isProtectionEnabled, isLoading: isProtectionLoading } = useVideoProtectionSetting();
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);



  useEffect(() => {
    if (user && state.hasSeenWelcome && !state.completedSteps.includes("lesson-video")) {
      const timer = setTimeout(() => {
        startOnboarding(lessonOnboardingSteps);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, state.hasSeenWelcome, state.completedSteps, startOnboarding]);

  // Fetch course
  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // Fetch instructor name (for the intro board)
  const { data: instructorProfile } = useQuery({
    queryKey: ["course-instructor", (course as any)?.instructor_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, full_name_ar")
        .eq("id", (course as any).instructor_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!(course as any)?.instructor_id,
  });

  // Fetch all lessons with chapter info for proper ordering
  const { data: lessons = [] } = useQuery({
    queryKey: ["lessons", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*, chapters:chapter_id(sort_order)")
        .eq("course_id", courseId)
        .order("sort_order");
      if (error) throw error;
      // Sort by chapter sort_order first, then lesson sort_order
      return (data || []).sort((a, b) => {
        const aChapterOrder = (a as any).chapters?.sort_order ?? 9999;
        const bChapterOrder = (b as any).chapters?.sort_order ?? 9999;
        if (aChapterOrder !== bChapterOrder) return aChapterOrder - bChapterOrder;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
    },
    enabled: !!courseId,
  });

  // Fetch chapters for installment gating
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // Current lesson
  const currentLesson = lessons.find((l) => l.id === lessonId);
  const currentIndex = lessons.findIndex((l) => l.id === lessonId);
  const previousLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  // Fetch enrollment
  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", courseId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("course_id", courseId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId && !!user,
  });

  // Server-side authorization: active enrollment + successful payment
  const { data: paidAccess = false } = useQuery({
    queryKey: ["course-access", courseId, user?.id],
    queryFn: async () => {
      if (!user || !courseId) return false;
      const { data, error } = await supabase.rpc("user_has_course_access", {
        _user_id: user.id,
        _course_id: courseId,
      });
      if (error) throw error;
      return !!data;
    },
    enabled: !!courseId && !!user,
  });


  // Chapter-based installment access logic
  // Monthly installment: access expires at the end of each paid month
  const enrollmentExpired = !!(enrollment as any)?.expires_at
    && new Date((enrollment as any).expires_at).getTime() < Date.now();
  const paidPercentage = (enrollment as any)?.paid_percentage ?? 100;
  const chaptersWithContent = chapters.filter(ch => lessons.some(l => (l as any).chapter_id === ch.id));
  const totalChaptersCount = chaptersWithContent.length || 1;
  const accessibleChapterCount = Math.ceil((paidPercentage / 100) * totalChaptersCount);
  const sortedChapters = [...chaptersWithContent].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const accessibleChapterIds = new Set(sortedChapters.slice(0, accessibleChapterCount).map(ch => ch.id));

  // Admin: free access to everything. Instructor: free access to own courses only.
  const hasStaffFreeAccess = role === 'admin'
    || (role === 'instructor' && !!user && !!(course as any)?.instructor_id && (course as any).instructor_id === user.id);

  // Check access - preview lessons are accessible to everyone (even without login)
  const hasAccess = (() => {
    if (currentLesson?.is_preview) return true;
    if (hasStaffFreeAccess) return true;
    if (!enrollment || enrollment.status !== 'active') return false;
    if (enrollmentExpired) return false;
    if (!paidAccess) return false;

    if (paidPercentage >= 100) return true;
    const chapterId = (currentLesson as any)?.chapter_id;
    if (!chapterId) return true; // lessons without chapter are accessible
    return accessibleChapterIds.has(chapterId);
  })();

  // NELC xAPI: learner initialized the course session
  useEffect(() => {
    if (!user || !courseId || !hasAccess) return;
    trackXapi({ verb: "initialized", courseId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, courseId, hasAccess]);

  // Fetch video URL using Cloudflare Worker
  // For preview lessons, allow access even without user login
  const { 
    videoUrl: signedUrl, 
    isLoading: isVideoLoading, 
    error: videoError,
  } = useCloudflareVideoUrl({
    lessonId: lessonId,
    enabled: !!lessonId && hasAccess && !!currentLesson?.video_url,
  });

  // Fetch lesson progress
  const { data: lessonProgress } = useQuery({
    queryKey: ["lesson-progress", lessonId, user?.id],
    queryFn: async () => {
      if (!user || !lessonId) return null;
      const { data, error } = await supabase
        .from("lesson_progress")
        .select("*")
        .eq("lesson_id", lessonId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId && !!user,
  });

  // Fetch all lesson progress for sidebar
  const { data: allProgress = [] } = useQuery({
    queryKey: ["all-lesson-progress", courseId, user?.id],
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
    enabled: !!courseId && !!user && lessons.length > 0,
  });

  // Save progress mutation
  const saveProgressMutation = useMutation({
    mutationFn: async ({
      progressPercent,
      lastPosition,
      completed,
    }: {
      progressPercent: number;
      lastPosition: number;
      completed: boolean;
    }) => {
      if (!user || !lessonId) throw new Error("Not authenticated");

      const progressData = {
        user_id: user.id,
        lesson_id: lessonId,
        progress_percent: Math.round(progressPercent),
        last_position: Math.round(lastPosition),
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (lessonProgress) {
        const { error } = await supabase
          .from("lesson_progress")
          .update(progressData)
          .eq("id", lessonProgress.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("lesson_progress")
          .insert(progressData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-progress", lessonId] });
      queryClient.invalidateQueries({ queryKey: ["all-lesson-progress", courseId] });
    },
  });

  // Mark as complete mutation
  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      await saveProgressMutation.mutateAsync({
        progressPercent: 100,
        lastPosition: duration,
        completed: true,
      });
    },
    onSuccess: () => {
      toast.success(isRTL ? "تم إكمال الدرس!" : "Lesson completed!");

      // NELC xAPI: lesson video watched + lesson completed
      trackXapi({
        verb: "watched",
        courseId,
        lessonId,
        objectName: currentLesson?.title || currentLesson?.title_ar,
        durationSeconds: Math.round(duration || 0),
        completion: true,
      });
      trackXapi({
        verb: "completed",
        courseId,
        lessonId,
        objectName: currentLesson?.title || currentLesson?.title_ar,
        durationSeconds: Math.round(duration || 0),
      });

      // Update enrollment progress
      if (enrollment) {
        const completedCount = allProgress.filter((p) => p.completed).length + 1;
        const progressPercent = Math.round((completedCount / lessons.length) * 100);
        
        supabase
          .from("enrollments")
          .update({ progress: progressPercent })
          .eq("id", enrollment.id)
          .then(() => {
            // NELC xAPI: overall course progress
            trackXapi({
              verb: "progressed",
              courseId,
              score: { scaled: progressPercent / 100 },
              completion: progressPercent >= 100,
            });

            // Show rating dialog when course is 100% complete
            if (progressPercent >= 100) {
              trackXapi({ verb: "completed", courseId });
              setTimeout(() => setShowRatingDialog(true), 1000);
            }
          });
      }
    },
  });


  // Video event handlers
  const handleTimeUpdate = () => {
    const video = protectedPlayerRef.current?.video || videoRef.current;
    if (video) {
      const current = video.currentTime;
      const total = video.duration;
      setCurrentTime(current);

      // Auto-save progress every 10 seconds
      if (Math.round(current) % 10 === 0 && current > 0) {
        const progressPercent = (current / total) * 100;
        saveProgressMutation.mutate({
          progressPercent,
          lastPosition: current,
          completed: progressPercent >= 50,
        });
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsVideoBuffering(false);
      
      // Resume from last position
      if (lessonProgress?.last_position) {
        videoRef.current.currentTime = lessonProgress.last_position;
      }
    }
  };

  const handleVideoWaiting = () => {
    setIsVideoBuffering(true);
  };

  const handleVideoCanPlay = () => {
    setIsVideoBuffering(false);
  };

  const handlePlayClick = () => {
    setShowThumbnail(false);
    togglePlay();
  };

  const handleEnded = () => {
    setIsPlaying(false);
    markCompleteMutation.mutate();
  };

  const togglePlay = () => {
    const video = protectedPlayerRef.current?.video || videoRef.current;
    if (video) {
      if (video.paused) {
        video.play().catch((err) => {
          console.error('Play failed:', err);
          setIsPlaying(false);
        });
      } else {
        video.pause();
      }
    }
  };

  const toggleMute = () => {
    const video = protectedPlayerRef.current?.video || videoRef.current;
    if (video) {
      video.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    const video = protectedPlayerRef.current?.video || videoRef.current;
    if (video) {
      video.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? (e as any).changedTouches?.[0]?.clientX : e.clientX;
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const newTime = ratio * duration;
    const video = protectedPlayerRef.current?.video || videoRef.current;
    if (video && duration > 0) {
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  // Prevent right-click on video
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.info(isRTL ? "تحميل الفيديو غير مسموح" : "Video download is not allowed");
  };

  const goToLesson = (lesson: typeof currentLesson) => {
    if (lesson) {
      navigate(`/courses/${courseId}/lessons/${lesson.id}`);
    }
  };

  const isLessonAccessible = (lesson: any, _index: number) => {
    if (lesson.is_preview) return true;
    if (hasStaffFreeAccess) return true;
    if (!enrollment || enrollment.status !== 'active') return false;
    if (enrollmentExpired) return false;
    if (paidPercentage >= 100) return true;
    const chapterId = (lesson as any).chapter_id;
    if (!chapterId) return true;
    return accessibleChapterIds.has(chapterId);
  };

  const getLessonProgress = (lessonId: string) => {
    return allProgress.find((p) => p.lesson_id === lessonId);
  };

  // Calculate overall progress
  const completedLessons = allProgress.filter((p) => p.completed).length;
  const overallProgress = lessons.length > 0 ? (completedLessons / lessons.length) * 100 : 0;

  if (!currentLesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Video className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">
            {isRTL ? "الدرس غير موجود" : "Lesson Not Found"}
          </h1>
          <Button asChild variant="outline" className="mt-4">
            <Link to={`/courses/${courseId}`}>
              {isRTL ? "العودة للدورة" : "Back to Course"}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    const isLockedByInstallment = enrollment?.status === 'active' && paidPercentage < 100;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">
            {isLockedByInstallment
              ? (isRTL ? "هذا الفصل مقفل" : "This Chapter is Locked")
              : (isRTL ? "هذا الدرس للمشتركين فقط" : "This Lesson is for Enrolled Students")
            }
          </h1>
          <p className="text-muted-foreground mb-4">
            {isLockedByInstallment
              ? (isRTL ? "ادفع القسط التالي لفتح هذا الفصل" : "Pay the next installment to unlock this chapter")
              : (isRTL ? "اشترك في الدورة للوصول لهذا الدرس" : "Enroll in the course to access this lesson")
            }
          </p>
          <Button asChild>
            <Link to={isLockedByInstallment ? `/checkout/${courseId}` : `/courses/${courseId}`}>
              {isLockedByInstallment
                ? (isRTL ? "ادفع للمتابعة" : "Pay to Continue")
                : (isRTL ? "اشترك الآن" : "Enroll Now")
              }
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      
      <OnboardingTooltip />
      <div
        className={`min-h-screen bg-background ${isRTL ? "rtl" : "ltr"}`}
        dir={isRTL ? "rtl" : "ltr"}
      >
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/courses/${courseId}`)}
              >
                {isRTL ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                <span className="ml-2">
                  {isRTL ? "العودة للدورة" : "Back to Course"}
                </span>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? course?.title_ar : course?.title}
                </p>
                <h1 className="font-semibold">
                  {currentLesson.title_ar?.trim() ? currentLesson.title_ar : currentLesson.title}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Security badge */}
              {signedUrl && (
                <Badge variant="outline" className="hidden md:flex items-center gap-1 text-green-600 border-green-200">
                  <Shield className="h-3 w-3" />
                  {isRTL ? "محمي" : "Protected"}
                </Badge>
              )}

              <div className="hidden md:flex items-center gap-2" data-onboarding="lesson-progress">
                <span className="text-sm text-muted-foreground">
                  {completedLessons}/{lessons.length}
                </span>
                <Progress value={overallProgress} className="w-24 h-2" />
              </div>

              {!lessonProgress?.completed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markCompleteMutation.mutate()}
                  disabled={markCompleteMutation.isPending}
                  data-onboarding="lesson-complete"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isRTL ? "تحديد كمكتمل" : "Mark Complete"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Video Player */}
        <div className="flex-1">
          <div
            className="relative bg-black aspect-video"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            onContextMenu={handleContextMenu}
            data-onboarding="lesson-video"
          >
            {/* Course Thumbnail as background */}
            {course?.thumbnail_url && showThumbnail && !isPlaying && (
              <div 
                className="absolute inset-0 bg-cover bg-center z-0"
                style={{ backgroundImage: `url(${course.thumbnail_url})` }}
              >
                <div className="absolute inset-0 bg-black/40" />
              </div>
            )}

            {isVideoLoading ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-white relative z-10">
                {course?.thumbnail_url && (
                  <div 
                    className="absolute inset-0 bg-cover bg-center -z-10"
                    style={{ backgroundImage: `url(${course.thumbnail_url})` }}
                  >
                    <div className="absolute inset-0 bg-black/60" />
                  </div>
                )}
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                  <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 text-lg font-medium">{isRTL ? "جاري تحميل الفيديو..." : "Loading video..."}</p>
              </div>
            ) : videoError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-white relative z-10">
                {course?.thumbnail_url && (
                  <div 
                    className="absolute inset-0 bg-cover bg-center -z-10"
                    style={{ backgroundImage: `url(${course.thumbnail_url})` }}
                  >
                    <div className="absolute inset-0 bg-black/70" />
                  </div>
                )}
                <Lock className="h-12 w-12 mb-4 text-red-400" />
                <p className="text-red-400">{videoError}</p>
              </div>
            ) : signedUrl ? (
              <>
                {/* Click overlay to toggle play/pause */}
                <div 
                  className="absolute inset-0 z-[15] cursor-pointer"
                  onClick={(e) => {
                    // Don't toggle if clicking on controls area (bottom 80px)
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const clickY = e.clientY - rect.top;
                    if (clickY > rect.height - 80) return;
                    handlePlayClick();
                  }}
                />

                <ProtectedVideoPlayer
                  ref={protectedPlayerRef}
                  src={signedUrl}
                  poster={course?.thumbnail_url}
                  protectionEnabled={isProtectionEnabled}
                  lessonId={lessonId}
                  introTitle={
                    isRTL
                      ? (currentLesson.title_ar?.trim() ? currentLesson.title_ar : currentLesson.title)
                      : (currentLesson.title || currentLesson.title_ar)
                  }
                  introSubtitle={isRTL ? course?.title_ar || course?.title : course?.title || course?.title_ar}
                  introInstructor={
                    isRTL
                      ? ((instructorProfile as any)?.full_name_ar || (instructorProfile as any)?.full_name)
                      : ((instructorProfile as any)?.full_name || (instructorProfile as any)?.full_name_ar)
                  }
                  className={`w-full h-full relative z-10 ${showThumbnail && !isPlaying ? 'opacity-0' : 'opacity-100'}`}
                  onTimeUpdate={() => {
                    if (protectedPlayerRef.current?.video) {
                      const video = protectedPlayerRef.current.video;
                      setCurrentTime(video.currentTime);
                      handleTimeUpdate();
                    }
                  }}
                  onLoadedMetadata={() => {
                    if (protectedPlayerRef.current?.video) {
                      const video = protectedPlayerRef.current.video;
                      videoRef.current = video;
                      setDuration(video.duration);
                      setIsVideoBuffering(false);
                      if (lessonProgress?.last_position) {
                        video.currentTime = lessonProgress.last_position;
                      }
                    }
                  }}
                  onEnded={handleEnded}
                  onPlay={() => { setIsPlaying(true); setShowThumbnail(false); }}
                  onPause={() => setIsPlaying(false)}
                  onWaiting={handleVideoWaiting}
                  onCanPlay={handleVideoCanPlay}
                  onContextMenu={handleContextMenu}
                />

                {/* Buffering indicator */}
                {isVideoBuffering && isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center z-30">
                    <div className="w-16 h-16 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                  </div>
                )}

                {/* Video Controls Bar */}
                <div
                  className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 z-20 ${
                    showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                >
                  {/* Gradient background */}
                  <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-3 px-4">
                    {/* Progress Bar */}
                    <div 
                      className="group relative w-full h-3 bg-white/20 rounded-full cursor-pointer mb-3 hover:h-4 transition-all duration-200 touch-none"
                      onClick={handleProgressBarClick}
                      onTouchStart={handleProgressBarClick}
                    >
                      {/* Progress fill */}
                      <div 
                        className="absolute inset-y-0 left-0 bg-primary rounded-full pointer-events-none"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                      {/* Thumb indicator */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-lg pointer-events-none -ml-2"
                        style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>

                    {/* Controls Row */}
                    <div className="flex items-center justify-between gap-2">
                      {/* Left: Play, Skip, Volume, Time */}
                      <div className="flex items-center gap-1 sm:gap-2">
                        {/* Play/Pause - Main button */}
                        <button
                          onClick={togglePlay}
                          className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-white/15 transition-colors"
                          title={isPlaying ? (isRTL ? 'إيقاف' : 'Pause') : (isRTL ? 'تشغيل' : 'Play')}
                        >
                          {isPlaying ? (
                            <Pause className="h-6 w-6 fill-white" />
                          ) : (
                            <Play className="h-6 w-6 fill-white" />
                          )}
                        </button>

                        {/* Skip Back 10s */}
                        <button
                          className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors"
                          onClick={() => { const v = protectedPlayerRef.current?.video || videoRef.current; if (v) v.currentTime -= 10; }}
                          title={isRTL ? 'رجوع 10 ثواني' : 'Back 10s'}
                        >
                          <SkipBack className="h-5 w-5" />
                        </button>

                        {/* Skip Forward 10s */}
                        <button
                          className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors"
                          onClick={() => { const v = protectedPlayerRef.current?.video || videoRef.current; if (v) v.currentTime += 10; }}
                          title={isRTL ? 'تقديم 10 ثواني' : 'Forward 10s'}
                        >
                          <SkipForward className="h-5 w-5" />
                        </button>

                        {/* Volume */}
                        <div className="group/vol relative flex items-center">
                          <button
                            className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors"
                            onClick={toggleMute}
                            title={isMuted ? (isRTL ? 'تشغيل الصوت' : 'Unmute') : (isRTL ? 'كتم الصوت' : 'Mute')}
                          >
                            {isMuted || volume === 0 ? (
                              <VolumeX className="h-5 w-5" />
                            ) : (
                              <Volume2 className="h-5 w-5" />
                            )}
                          </button>
                          <div className="hidden sm:block w-0 group-hover/vol:w-20 overflow-hidden transition-all duration-300">
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={isMuted ? 0 : volume}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setVolume(val);
                                const v = protectedPlayerRef.current?.video || videoRef.current;
                                if (v) {
                                  v.volume = val;
                                  v.muted = val === 0;
                                  setIsMuted(val === 0);
                                }
                              }}
                              className="w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                            />
                          </div>
                        </div>

                        {/* Time Display */}
                        <span className="text-white/90 text-xs sm:text-sm font-mono tabular-nums ml-1">
                          {formatTime(currentTime)} <span className="text-white/50">/</span> {formatTime(duration)}
                        </span>
                      </div>

                      {/* Right: Fullscreen */}
                      <div className="flex items-center gap-1">
                        {/* Playback Speed */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-9 px-2 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors text-xs sm:text-sm font-medium">
                              <Settings className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">
                                {(protectedPlayerRef.current?.video || videoRef.current)?.playbackRate === 1 ? '' : `${(protectedPlayerRef.current?.video || videoRef.current)?.playbackRate}x`}
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[120px]">
                            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                              <DropdownMenuItem
                                key={speed}
                                onClick={() => {
                                  const v = protectedPlayerRef.current?.video || videoRef.current;
                                  if (v) v.playbackRate = speed;
                                }}
                                className={(protectedPlayerRef.current?.video || videoRef.current)?.playbackRate === speed ? 'bg-primary/10 font-bold' : ''}
                              >
                                {speed === 1 ? (isRTL ? 'عادي' : 'Normal') : `${speed}x`}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Notes Toggle */}
                        <button
                          className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${
                            isNotesOpen 
                              ? 'bg-amber-500 text-white scale-110' 
                              : 'text-white/80 hover:text-white hover:bg-white/15'
                          }`}
                          onClick={(e) => { e.stopPropagation(); setIsNotesOpen(!isNotesOpen); }}
                          title={isRTL ? 'ملاحظاتي' : 'My Notes'}
                        >
                          <StickyNote className="h-5 w-5" />
                        </button>

                        {/* AI Assistant Toggle */}
                        {(course as any)?.ai_enabled && (
                          <button
                            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${
                              isAIOpen 
                                ? 'bg-primary text-primary-foreground scale-110' 
                                : 'text-white/80 hover:text-white hover:bg-white/15'
                            }`}
                            onClick={(e) => { e.stopPropagation(); setIsAIOpen(!isAIOpen); }}
                            title={isRTL ? 'المساعد الذكي' : 'AI Assistant'}
                          >
                            <Sparkles className="h-5 w-5" />
                          </button>
                        )}

                        {/* Fullscreen */}
                        <button
                          className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors"
                          onClick={() => {
                            const container = document.querySelector('[data-onboarding="lesson-video"]');
                            if (container) {
                              if (document.fullscreenElement) {
                                document.exitFullscreen();
                              } else {
                                container.requestFullscreen?.();
                              }
                            }
                          }}
                          title={isRTL ? 'ملء الشاشة' : 'Fullscreen'}
                        >
                          <Maximize className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Center Play button overlay */}
                {!isPlaying && (
                  <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer z-[18]"
                    onClick={handlePlayClick}
                  >
                    <div className="w-20 h-20 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-2xl hover:scale-110 hover:bg-primary transition-all duration-200">
                      <Play className="h-9 w-9 text-primary-foreground fill-primary-foreground ml-1" />
                    </div>
                  </div>
                )}
              </>
            ) : currentLesson.video_url ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-white relative z-10">
                {course?.thumbnail_url && (
                  <div 
                    className="absolute inset-0 bg-cover bg-center -z-10"
                    style={{ backgroundImage: `url(${course.thumbnail_url})` }}
                  >
                    <div className="absolute inset-0 bg-black/60" />
                  </div>
                )}
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                  <Play className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 text-lg font-medium">{isRTL ? "جاري تحضير الفيديو..." : "Preparing video..."}</p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white relative z-10">
                {course?.thumbnail_url && (
                  <div 
                    className="absolute inset-0 bg-cover bg-center -z-10"
                    style={{ backgroundImage: `url(${course.thumbnail_url})` }}
                  >
                    <div className="absolute inset-0 bg-black/70" />
                  </div>
                )}
                <Video className="h-16 w-16 mb-4 opacity-50" />
                <p>{isRTL ? "لم تتم إضافة فيديو بعد" : "No video available"}</p>
              </div>
            )}
          </div>

          {/* Video Notes Panel */}
          {isNotesOpen && lessonId && (
            <div className="p-4">
              <VideoNotesPanel
                lessonId={lessonId}
                currentTime={currentTime}
                onSeek={(seconds) => {
                  const video = protectedPlayerRef.current?.video || videoRef.current;
                  if (video) {
                    video.currentTime = seconds;
                    setCurrentTime(seconds);
                  }
                }}
                isOpen={isNotesOpen}
                onClose={() => setIsNotesOpen(false)}
              />
            </div>
          )}

          {/* Lesson Info */}
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              {lessonProgress?.completed && (
                <Badge className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {isRTL ? "مكتمل" : "Completed"}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {currentLesson.duration_minutes} {isRTL ? "دقيقة" : "min"}
              </span>
            </div>

            <h2 className="text-2xl font-bold mb-4">
              {currentLesson.title_ar?.trim() ? currentLesson.title_ar : currentLesson.title}
            </h2>

            {currentLesson.description && (
              <p className="text-muted-foreground">{currentLesson.description}</p>
            )}

            {/* Lesson Attachments */}
            <LessonAttachments lessonId={lessonId!} isRTL={isRTL} isEnrolled={(!!enrollment && enrollment.status === "active") || hasStaffFreeAccess} />

            {/* AI Assistant */}
            {(course as any)?.ai_enabled && (
              <div className="mt-6">
                <LessonAIAssistant 
                  lessonId={lessonId!} 
                  lessonTitle={currentLesson.title_ar?.trim() ? currentLesson.title_ar : currentLesson.title}
                  isRTL={isRTL}
                  externalOpen={isAIOpen}
                  onOpenChange={setIsAIOpen}
                />
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                disabled={!previousLesson}
                onClick={() => goToLesson(previousLesson)}
              >
                {isRTL ? (
                  <>
                    <ChevronRight className="h-4 w-4 mr-2" />
                    {isRTL ? "الدرس السابق" : "Previous"}
                  </>
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </>
                )}
              </Button>

              <Button
                disabled={!nextLesson}
                onClick={() => goToLesson(nextLesson)}
              >
                {isRTL ? (
                  <>
                    {isRTL ? "الدرس التالي" : "Next"}
                    <ChevronLeft className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar - Lesson List */}
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l bg-card" data-onboarding="lesson-list">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {isRTL ? "محتوى الدورة" : "Course Content"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {completedLessons}/{lessons.length}{" "}
              {isRTL ? "درس مكتمل" : "completed"}
            </p>
          </div>

          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="p-2">
              {(() => {
                // Group lessons by chapter, maintaining chapter sort order
                const sortedChaptersList = [...chapters].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                const unassignedLessons = lessons.filter(l => !(l as any).chapter_id);
                let globalIndex = 0;

                return (
                  <>
                    {sortedChaptersList.map((chapter) => {
                      const chapterLessons = lessons
                        .filter(l => (l as any).chapter_id === chapter.id)
                        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                      if (chapterLessons.length === 0) return null;

                      return (
                        <div key={chapter.id} className="mb-2">
                          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {isRTL ? chapter.title_ar : chapter.title}
                          </div>
                          {chapterLessons.map((lesson) => {
                            globalIndex++;
                            const progress = getLessonProgress(lesson.id);
                            const accessible = isLessonAccessible(lesson, globalIndex - 1);
                            const isCurrent = lesson.id === lessonId;

                            return (
                              <button
                                key={lesson.id}
                                onClick={() => accessible && goToLesson(lesson)}
                                disabled={!accessible}
                                className={`w-full text-start p-3 rounded-lg mb-1 transition-colors ${
                                  isCurrent
                                    ? "bg-primary/10 border border-primary/20"
                                    : accessible
                                    ? "hover:bg-muted"
                                    : "opacity-50 cursor-not-allowed"
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                      progress?.completed
                                        ? "bg-green-100 text-green-600"
                                        : isCurrent
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {progress?.completed ? (
                                      <CheckCircle className="h-4 w-4" />
                                    ) : !accessible ? (
                                      <Lock className="h-3 w-3" />
                                    ) : (
                                      globalIndex
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : ""}`}>
                                      {lesson.title_ar?.trim() ? lesson.title_ar : lesson.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {lesson.duration_minutes} {isRTL ? "دقيقة" : "min"}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}

                    {/* Unassigned lessons */}
                    {unassignedLessons.length > 0 && (
                      <div className="mb-2">
                        {chapters.length > 0 && (
                          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {isRTL ? 'دروس عامة' : 'General Lessons'}
                          </div>
                        )}
                        {unassignedLessons.map((lesson) => {
                          globalIndex++;
                          const progress = getLessonProgress(lesson.id);
                          const accessible = isLessonAccessible(lesson, globalIndex - 1);
                          const isCurrent = lesson.id === lessonId;

                          return (
                            <button
                              key={lesson.id}
                              onClick={() => accessible && goToLesson(lesson)}
                              disabled={!accessible}
                              className={`w-full text-start p-3 rounded-lg mb-1 transition-colors ${
                                isCurrent
                                  ? "bg-primary/10 border border-primary/20"
                                  : accessible
                                  ? "hover:bg-muted"
                                  : "opacity-50 cursor-not-allowed"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                    progress?.completed
                                      ? "bg-green-100 text-green-600"
                                      : isCurrent
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {progress?.completed ? (
                                    <CheckCircle className="h-4 w-4" />
                                  ) : !accessible ? (
                                    <Lock className="h-3 w-3" />
                                  ) : (
                                    globalIndex
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : ""}`}>
                                    {lesson.title_ar?.trim() ? lesson.title_ar : lesson.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {lesson.duration_minutes} {isRTL ? "دقيقة" : "min"}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>

    {/* Course Rating Dialog */}
    {courseId && (
      <CourseRatingDialog
        open={showRatingDialog}
        onOpenChange={setShowRatingDialog}
        courseId={courseId}
        isRTL={isRTL}
      />
    )}
    </>
  );
};

export default LessonViewer;
