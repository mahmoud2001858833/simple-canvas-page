import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Package, Sparkles, Check, Search, BookOpen, AlertCircle,
  ShoppingBag, ShieldCheck, CheckCircle2, ArrowRight, ArrowLeft,
  DollarSign, Percent, Loader2, Filter, School, GraduationCap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getCustomBundleSettings,
  processBundleCheckout,
  DEFAULT_BUNDLE_SETTINGS,
} from "@/services/bundleService";

export const BuildYourBundle = () => {
  const { dir } = useLanguage();
  const isRTL = dir === "rtl";
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [unlockedCourses, setUnlockedCourses] = useState<any[]>([]);

  // 1. Fetch custom bundle settings from platform_settings
  const { data: bundleSettings = DEFAULT_BUNDLE_SETTINGS } = useQuery({
    queryKey: ["platform-custom-bundle-settings"],
    queryFn: getCustomBundleSettings,
  });

  const minCourses = bundleSettings.min_courses || 4;
  const discountRate = bundleSettings.discount_percentage || 25;

  // 2. Fetch all available active courses
  const { data: courses = [], isLoading: isLoadingCourses } = useQuery({
    queryKey: ["all-available-courses-for-custom-bundle"],
    queryFn: async () => {
      const { data: coursesData, error } = await supabase
        .from("courses")
        .select(`
          id,
          title,
          title_ar,
          price,
          original_price,
          thumbnail_url,
          instructor_id,
          instructor_commission,
          major_id,
          is_active,
          is_approved,
          approval_status,
          majors (
            id,
            name,
            name_ar,
            colleges (
              id,
              name,
              name_ar
            )
          )
        `)
        .order("title_ar", { ascending: true });

      if (error) {
        console.error("Error fetching courses for custom bundle:", error);
        throw error;
      }

      // Fetch instructor profiles separately
      const instructorIds = Array.from(
        new Set((coursesData || []).map((c: any) => c.instructor_id).filter(Boolean) as string[])
      );

      let instructorMap: Record<string, { full_name?: string; full_name_ar?: string }> = {};
      if (instructorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, full_name_ar")
          .in("id", instructorIds);

        (profiles || []).forEach((p: any) => {
          instructorMap[p.id] = { full_name: p.full_name, full_name_ar: p.full_name_ar };
        });
      }

      return (coursesData || []).map((c: any) => {
        const major = c.majors as any;
        const college = major?.colleges;
        const instructor = c.instructor_id ? instructorMap[c.instructor_id] : null;
        return {
          ...c,
          colleges: college || null,
          majors: major || null,
          profiles: instructor || { full_name: "معلم معتمد", full_name_ar: "معلم معتمد" },
        };
      });
    },
  });

  // 3. Fetch user existing enrollments to badge already owned courses
  const { data: userEnrollments = [] } = useQuery({
    queryKey: ["user-enrolled-courses", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id, status, paid_percentage")
        .eq("user_id", user.id);

      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user,
  });

  const enrolledCourseIds = useMemo(() => {
    return new Set(
      userEnrollments
        .filter((e: any) => e.status === "active" || e.paid_percentage >= 100)
        .map((e: any) => e.course_id)
    );
  }, [userEnrollments]);

  // Filter courses by search
  const filteredCourses = useMemo(() => {
    if (!search.trim()) return courses;
    const q = search.toLowerCase();
    return courses.filter((c: any) =>
      (c.title_ar && c.title_ar.toLowerCase().includes(q)) ||
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.colleges?.name_ar && c.colleges.name_ar.toLowerCase().includes(q)) ||
      (c.majors?.name_ar && c.majors.name_ar.toLowerCase().includes(q))
    );
  }, [courses, search]);

  // Selected courses list
  const selectedCourses = useMemo(() => {
    return courses.filter((c: any) => selectedCourseIds.includes(c.id));
  }, [courses, selectedCourseIds]);

  // Count & Discount check
  const selectedCount = selectedCourses.length;
  const isDiscountQualified = selectedCount >= minCourses;
  const progressPercent = Math.min(100, (selectedCount / minCourses) * 100);

  // Financial Calculations
  const originalTotal = useMemo(() => {
    return selectedCourses.reduce((sum, c: any) => sum + (Number(c.price) || 0), 0);
  }, [selectedCourses]);

  const discountAmount = useMemo(() => {
    if (!isDiscountQualified) return 0;
    return Math.round(originalTotal * (discountRate / 100) * 100) / 100;
  }, [originalTotal, isDiscountQualified, discountRate]);

  const finalTotal = useMemo(() => {
    if (!isDiscountQualified) return originalTotal;
    return Math.max(0, Math.round((originalTotal - discountAmount) * 100) / 100);
  }, [originalTotal, discountAmount, isDiscountQualified]);

  // Toggle course selection
  const toggleCourse = (courseId: string) => {
    if (enrolledCourseIds.has(courseId)) {
      toast.info(isRTL ? "أنت مسجل بالفعل في هذه المادة" : "You are already enrolled in this course");
      return;
    }
    if (selectedCourseIds.includes(courseId)) {
      setSelectedCourseIds(prev => prev.filter(id => id !== courseId));
    } else {
      setSelectedCourseIds(prev => [...prev, courseId]);
    }
  };

  // Handle Checkout Execution
  const handleExecutePurchase = async () => {
    if (!user) {
      toast.error(isRTL ? "يرجى تسجيل الدخول أولاً" : "Please log in first");
      return;
    }
    if (selectedCourses.length === 0) return;

    setIsProcessing(true);
    try {
      const coursesPayload = selectedCourses.map((c: any) => ({
        id: c.id,
        title: c.title,
        title_ar: c.title_ar,
        price: c.price,
        instructor_id: c.instructor_id,
        instructor_commission: c.instructor_commission,
      }));

      const res = await processBundleCheckout({
        userId: user.id,
        userEmail: user.email,
        bundleTitle: `Custom Student Bundle (${selectedCourses.length} Courses)`,
        bundleTitleAr: `بكج طالب مخصص (${selectedCourses.length} مواد)`,
        totalPrice: finalTotal,
        originalPrice: originalTotal,
        discountPercentage: isDiscountQualified ? discountRate : 0,
        courses: coursesPayload,
        paymentMethod: "online",
        isCustomBundle: true,
      });

      if (res.success) {
        setUnlockedCourses(coursesPayload);
        setPurchaseComplete(true);
        queryClient.invalidateQueries({ queryKey: ["my-courses"] });
        queryClient.invalidateQueries({ queryKey: ["user-enrolled-courses"] });
        queryClient.invalidateQueries({ queryKey: ["enrollments"] });
        toast.success(
          isRTL
            ? `مبروك! تم تفعيل الـ ${selectedCourses.length} مواد بنجاح!`
            : `Congratulations! ${selectedCourses.length} courses unlocked!`
        );
      }
    } catch (e: any) {
      toast.error(e.message || (isRTL ? "فشل إتمام الشراء" : "Purchase failed"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8" dir={dir}>
      {/* Top Banner & Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-6 md:p-10 text-white shadow-xl">
        <div className="absolute top-0 end-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              {isRTL ? `عرض التوفير الذكي: خصم ${discountRate}%` : `Smart Savings: ${discountRate}% OFF`}
            </div>

            <h1 className="text-2xl md:text-4xl font-black text-white">
              {isRTL ? "أنشئ بكجك الدراسي ووفّر 25% فوري!" : "Build Your Bundle & Save 25% Instantly!"}
            </h1>

            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              {isRTL
                ? `اختر ${minCourses} مواد أو أكثر من أي كلية، وسيطبق النظام تلقائياً خصماً بنسبة ${discountRate}% على كل مادة مختارة، مع فتح فوري لكافة المقررات في حسابك.`
                : `Pick ${minCourses} or more courses, and automatically receive a ${discountRate}% discount per course, with instant activation across all selected courses.`}
            </p>
          </div>

          {/* Golden Badge Counter */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl text-center min-w-[200px] shrink-0">
            <span className="text-xs text-amber-300 font-semibold block uppercase tracking-wider">
              {isRTL ? "المواد المحددة حالياً" : "Selected Courses"}
            </span>
            <div className="text-4xl font-black text-white mt-1">
              {selectedCount} <span className="text-xl text-amber-400 font-bold">/ {minCourses}</span>
            </div>
            <span className="text-[11px] text-slate-300 mt-1 block">
              {isDiscountQualified
                ? (isRTL ? "🎉 مؤهل لخصم 25%!" : "🎉 25% Discount Active!")
                : (isRTL ? `متبقي ${Math.max(0, minCourses - selectedCount)} مواد لتفعيل الخصم` : `${Math.max(0, minCourses - selectedCount)} more needed`)}
            </span>
          </div>
        </div>

        {/* Progress Tracker Bar */}
        <div className="mt-8 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-300">
            <span>
              {isDiscountQualified
                ? (isRTL ? "✓ تم استيفاء شروط الخصم الذهبي بنجاح" : "✓ Gold discount unlocked")
                : (isRTL ? `التقدم نحو تفعيل خصم الـ ${discountRate}%:` : `Progress to unlock ${discountRate}% off:`)}
            </span>
            <span className="font-bold text-amber-400">
              {selectedCount} {isRTL ? "من أصل" : "of"} {minCourses} {isRTL ? "مواد" : "courses"}
            </span>
          </div>
          <Progress
            value={progressPercent}
            className="h-2.5 bg-white/20"
          />
        </div>
      </div>

      {/* Main Layout: Course Browser + Sticky Order Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Course Browser (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search bar */}
          <div className="flex items-center gap-3 bg-card p-3 rounded-2xl border shadow-sm">
            <Search className="w-5 h-5 text-muted-foreground ms-2" />
            <Input
              placeholder={isRTL ? "ابحث عن مادة، تخصص، أو كلية..." : "Search by course title, major, or college..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-none shadow-none focus-visible:ring-0 text-sm"
            />
            {selectedCourseIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCourseIds([])}
                className="text-xs text-muted-foreground hover:text-destructive shrink-0"
              >
                {isRTL ? "إلغاء التحديد" : "Clear"}
              </Button>
            )}
          </div>

          {/* Courses Grid */}
          {isLoadingCourses ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-44 rounded-2xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : filteredCourses.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {isRTL ? "لم يتم العثور على مقررات مطابقة للبحث" : "No courses match your search"}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredCourses.map((course: any) => {
                const isSelected = selectedCourseIds.includes(course.id);
                const isEnrolled = enrolledCourseIds.has(course.id);
                const coursePrice = Number(course.price) || 0;
                const discountedPrice = Math.round(coursePrice * (1 - discountRate / 100) * 100) / 100;

                return (
                  <div
                    key={course.id}
                    onClick={() => !isEnrolled && toggleCourse(course.id)}
                    className={`group relative p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                      isEnrolled
                        ? "bg-muted/30 border-border/40 opacity-70 cursor-not-allowed"
                        : isSelected
                        ? "bg-amber-500/10 border-amber-500/70 shadow-md ring-2 ring-amber-500/30"
                        : "bg-card border-border/70 hover:border-amber-500/40 hover:shadow-sm"
                    }`}
                  >
                    <div>
                      {/* Checkbox Icon & Price badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
                            isSelected
                              ? "bg-amber-600 border-amber-600 text-white shadow"
                              : "border-muted-foreground/30 bg-background"
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4" />}
                        </div>

                        {isEnrolled ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            {isRTL ? "أنت مسجل بالفعل" : "Enrolled"}
                          </Badge>
                        ) : isSelected && isDiscountQualified ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground line-through">
                              {coursePrice} ر.س
                            </span>
                            <Badge className="bg-amber-500 text-white font-bold border-none text-xs">
                              {discountedPrice} ر.س
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-foreground">
                            {coursePrice > 0 ? `${coursePrice} ر.س` : (isRTL ? "مجاني" : "Free")}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-sm text-foreground line-clamp-2 group-hover:text-amber-600 transition-colors">
                        {isRTL ? course.title_ar : course.title}
                      </h3>

                      {/* Department / College tag */}
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                        {course.colleges?.name_ar && (
                          <span className="truncate max-w-[140px]">
                            {isRTL ? course.colleges.name_ar : course.colleges.name}
                          </span>
                        )}
                        {course.majors?.name_ar && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">
                              {isRTL ? course.majors.name_ar : course.majors.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Teacher tag */}
                    {course.profiles?.full_name_ar && (
                      <div className="pt-3 mt-3 border-t text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>{course.profiles.full_name_ar}</span>
                        {isSelected && (
                          <span className="text-amber-600 font-semibold text-[10px]">
                            {isRTL ? "✓ مضافة للباقة" : "Selected"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Bundle Summary Bar (1 col) */}
        <div className="lg:col-span-1 sticky top-24 space-y-4">
          <Card className="border-2 border-amber-500/30 shadow-xl overflow-hidden rounded-3xl bg-card">
            {/* Header */}
            <div className="p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      {isRTL ? "ملخص باقتك المخصصة" : "Your Bundle Summary"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {selectedCount} {isRTL ? "مواد مختارة" : "courses chosen"}
                    </p>
                  </div>
                </div>

                <Badge
                  variant={isDiscountQualified ? "default" : "secondary"}
                  className={isDiscountQualified ? "bg-amber-500 text-white font-bold" : ""}
                >
                  {isDiscountQualified
                    ? (isRTL ? `خصم ${discountRate}% مفعل!` : `${discountRate}% Active`)
                    : (isRTL ? `اختر ${minCourses} مواد` : `Pick ${minCourses}`)}
                </Badge>
              </div>
            </div>

            <CardContent className="p-5 space-y-5">
              {/* Selected courses mini list */}
              {selectedCourses.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs space-y-2">
                  <Package className="w-8 h-8 mx-auto opacity-30 text-amber-500" />
                  <p>{isRTL ? `انقر على المقررات لإضافتها لبكجك (${minCourses} مواد على الأقل لتفعيل الخصم)` : `Click courses to add them to your bundle (at least ${minCourses} to activate discount)`}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedCourses.map((c: any) => {
                    const singlePrice = Number(c.price) || 0;
                    const singleDiscounted = isDiscountQualified
                      ? Math.round(singlePrice * (1 - discountRate / 100) * 100) / 100
                      : singlePrice;

                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between text-xs p-2 rounded-xl bg-muted/40 border"
                      >
                        <span className="font-medium truncate max-w-[160px]" title={c.title_ar}>
                          {isRTL ? c.title_ar : c.title}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isDiscountQualified && (
                            <span className="text-[10px] text-muted-foreground line-through">
                              {singlePrice}
                            </span>
                          )}
                          <span className="font-bold text-amber-600">
                            {singleDiscounted} ر.س
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Financial Calculation Breakdown */}
              <div className="p-4 rounded-2xl bg-muted/30 border space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{isRTL ? "إجمالي السعر الأصلي:" : "Original Total:"}</span>
                  <span className={isDiscountQualified ? "line-through" : "font-semibold text-foreground"}>
                    {originalTotal} ر.س
                  </span>
                </div>

                {isDiscountQualified ? (
                  <div className="flex items-center justify-between text-emerald-600 font-semibold">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {isRTL ? `خصم البكج (${discountRate}%):` : `Bundle Discount (${discountRate}%):`}
                    </span>
                    <span>- {discountAmount} ر.س</span>
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-800 text-[11px] leading-relaxed">
                    {isRTL
                      ? `أضف ${Math.max(0, minCourses - selectedCount)} مواد إضافية لتحصل على خصم ${discountRate}% وتوفير ${Math.round(originalTotal * (discountRate / 100))} ر.س فوري!`
                      : `Add ${Math.max(0, minCourses - selectedCount)} more courses to unlock ${discountRate}% off!`}
                  </div>
                )}

                <div className="pt-2 border-t flex items-baseline justify-between">
                  <span className="font-bold text-sm text-foreground">
                    {isRTL ? "المبلغ المطلوب سداده:" : "Total to Pay:"}
                  </span>
                  <div className="text-end">
                    <div className="text-2xl font-black text-amber-600">
                      {finalTotal} <span className="text-xs font-bold">ر.س</span>
                    </div>
                    {isDiscountQualified && (
                      <span className="text-[10px] text-emerald-600 font-bold block">
                        {isRTL ? `وفرت ${discountAmount} ر.س 🎉` : `You saved ${discountAmount} SAR 🎉`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <Button
                onClick={() => setIsConfirmOpen(true)}
                disabled={selectedCount === 0}
                className="w-full h-12 rounded-xl font-bold bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-lg gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                {isDiscountQualified
                  ? (isRTL ? `إتمام شراء البكج وتفعيل الـ ${selectedCount} مواد` : `Buy Bundle & Unlock ${selectedCount} Courses`)
                  : (isRTL ? `شراء الـ ${selectedCount} مواد الآن` : `Buy ${selectedCount} Courses Now`)}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation & Checkout Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-lg" dir={dir}>
          {purchaseComplete ? (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                <Check className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-foreground">
                  {isRTL ? "تم تفعيل بكجك بنجاح! 🎉" : "Your Bundle is Live! 🎉"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  {isRTL
                    ? `تم قيد جميع المواد الـ ${selectedCourses.length} بحسابك وسدادها بأسعار البكج المخفضة، وفتح جميع الدروس فوراً.`
                    : `All ${selectedCourses.length} courses are now fully active and unlocked in your account.`}
                </p>
              </div>

              <div className="bg-muted/30 p-4 rounded-2xl border text-start space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase">
                  {isRTL ? "المقررات المفعلة:" : "Unlocked Courses:"}
                </p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {unlockedCourses.map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isRTL ? c.title_ar : c.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 justify-center">
                <Button
                  onClick={() => {
                    setIsConfirmOpen(false);
                    navigate("/dashboard?tab=courses");
                  }}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold px-8 h-11"
                >
                  {isRTL ? "الانتقال لدوراتي والبدء بالدراسة 🚀" : "Go to My Courses 🚀"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-5">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-600" />
                  {isRTL ? "تأكيد شراء البكج المخصص" : "Confirm Custom Bundle Purchase"}
                </DialogTitle>
                <DialogDescription>
                  {isRTL
                    ? `أنت على وشك شراء باقة مخصصة تضم ${selectedCourses.length} مواد دراسية.`
                    : `You are about to purchase a custom package of ${selectedCourses.length} courses.`}
                </DialogDescription>
              </DialogHeader>

              {/* Items List */}
              <div className="border rounded-2xl p-4 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                  <span>{isRTL ? "المواد المختارة:" : "Selected Courses:"}</span>
                  <span>{selectedCourses.length} {isRTL ? "مواد" : "courses"}</span>
                </div>

                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {selectedCourses.map((c: any) => {
                    const price = Number(c.price) || 0;
                    const discounted = isDiscountQualified ? Math.round(price * (1 - discountRate / 100) * 100) / 100 : price;

                    return (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-xl bg-background border text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-semibold truncate">{isRTL ? c.title_ar : c.title}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ms-2">
                          {isDiscountQualified && (
                            <span className="text-[10px] text-muted-foreground line-through">
                              {price}
                            </span>
                          )}
                          <span className="font-bold text-amber-600">{discounted} ر.س</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{isRTL ? "المجموع قبل الخصم:" : "Total Before Discount:"}</span>
                  <span className={isDiscountQualified ? "line-through" : ""}>{originalTotal} ر.س</span>
                </div>

                {isDiscountQualified && (
                  <div className="flex items-center justify-between text-emerald-600 font-medium">
                    <span>{isRTL ? `وفرت (${discountRate}%):` : `Savings (${discountRate}%):`}</span>
                    <span>- {discountAmount} ر.س</span>
                  </div>
                )}

                <div className="pt-2 border-t flex items-baseline justify-between">
                  <span className="font-bold text-sm text-foreground">
                    {isRTL ? "المبلغ الإجمالي النهائي:" : "Final Total Payable:"}
                  </span>
                  <span className="text-2xl font-black text-amber-600">
                    {finalTotal} <span className="text-xs font-semibold">ر.س</span>
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground leading-relaxed p-3 bg-muted/40 rounded-xl border">
                {isRTL
                  ? "✓ سيتم تسجيل كل مادة في الدفتر المحاسبي بسعرها المخفض، واحتساب مستحقات معلم كل مادة، وفتح المحتوى الأكاديمي كاملاً فور التأكيد."
                  : "✓ Each course will be recorded in the accounting ledger at its discounted rate and fully unlocked."}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setIsConfirmOpen(false)}
                  disabled={isProcessing}
                >
                  {isRTL ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  onClick={handleExecutePurchase}
                  disabled={isProcessing}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isRTL ? "جاري تفعيل البكج..." : "Unlocking bundle..."}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      {isRTL ? "تأكيد الدفع وتفعيل المواد الآن" : "Confirm & Unlock"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
