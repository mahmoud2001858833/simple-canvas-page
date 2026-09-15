import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Package, Sparkles, Check, ArrowRight, ArrowLeft, ShieldCheck,
  BookOpen, Users, ShoppingBag, Clock, CreditCard, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getActiveBundles, processBundleCheckout, CourseBundle } from "@/services/bundleService";

export const BundlesSection = () => {
  const { dir } = useLanguage();
  const isRTL = dir === "rtl";
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedBundle, setSelectedBundle] = useState<CourseBundle | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [unlockedCourses, setUnlockedCourses] = useState<{ id: string; title: string; title_ar: string }[]>([]);

  // Fetch active public bundles
  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ["active-course-bundles"],
    queryFn: getActiveBundles,
  });

  // Handle bundle click
  const handleOpenPurchase = (bundle: CourseBundle) => {
    if (!user) {
      toast.info(
        isRTL
          ? "يرجى تسجيل الدخول أولاً لإتمام الاشتراك بالباقة"
          : "Please log in first to purchase this bundle"
      );
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + "#bundles")}`);
      return;
    }
    setSelectedBundle(bundle);
    setPurchaseSuccess(false);
  };

  // Confirm checkout
  const handleConfirmPurchase = async () => {
    if (!user || !selectedBundle) return;
    setIsPurchasing(true);

    try {
      const coursesToUnlock = (selectedBundle.courses || []).map(c => ({
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
        bundleId: selectedBundle.id,
        bundleTitle: selectedBundle.title,
        bundleTitleAr: selectedBundle.title_ar,
        totalPrice: selectedBundle.price,
        originalPrice: selectedBundle.original_price || selectedBundle.price,
        discountPercentage: selectedBundle.discount_percentage || 0,
        courses: coursesToUnlock,
        paymentMethod: "online",
        isCustomBundle: false,
      });

      if (res.success) {
        setUnlockedCourses(coursesToUnlock);
        setPurchaseSuccess(true);
        queryClient.invalidateQueries({ queryKey: ["my-courses"] });
        queryClient.invalidateQueries({ queryKey: ["enrollments"] });
        queryClient.invalidateQueries({ queryKey: ["active-course-bundles"] });
        toast.success(
          isRTL
            ? `تم تفعيل كافة مقررات باقة "${selectedBundle.title_ar}" بنجاح!`
            : `All courses in "${selectedBundle.title}" unlocked successfully!`
        );
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? "فشل إتمام العملية" : "Purchase failed"));
    } finally {
      setIsPurchasing(false);
    }
  };

  if (!isLoading && bundles.length === 0) {
    return null; // Don't render section if no active bundles
  }

  return (
    <section id="bundles" className="py-20 bg-gradient-to-b from-background via-muted/30 to-background relative overflow-hidden" dir={dir}>
      {/* Background Glow */}
      <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            {isRTL ? "باقات التوفير الحصرية" : "Exclusive Value Bundles"}
          </div>

          <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">
            {isRTL ? "باقات المقررات الشاملة" : "Complete Course Bundles"}
          </h2>

          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            {isRTL
              ? "اشترك في باقة مقرراتك الدراسية بخصومات استثنائية ووفر مئات الريالات، مع فتح فوري وشامل لجميع الشروحات والاختبارات والملازم."
              : "Enroll in comprehensive semester bundles with exceptional discounts and unlock all lessons, exams, and materials instantly."}
          </p>
        </div>

        {/* Bundles Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-96 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {bundles.map((bundle) => {
              const coursesCount = bundle.courses?.length || 0;
              const savings = Math.max(0, (bundle.original_price || 0) - bundle.price);

              return (
                <Card
                  key={bundle.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/70 bg-card/80 backdrop-blur-xl shadow-lg hover:shadow-2xl hover:border-amber-500/40 transition-all duration-300"
                >
                  <div>
                    {/* Thumbnail Cover */}
                    <div className="relative h-48 w-full overflow-hidden bg-slate-950">
                      {bundle.thumbnail_url ? (
                        <img
                          src={bundle.thumbnail_url}
                          alt={bundle.title_ar}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 text-white p-6">
                          <Package className="w-14 h-14 text-amber-400 mb-2 opacity-90 group-hover:scale-110 transition-transform duration-300" />
                          <span className="text-xs font-semibold tracking-wider text-amber-200/80 uppercase">
                            {isRTL ? "باقة مقررات دراسية" : "Academic Bundle"}
                          </span>
                        </div>
                      )}

                      {/* Overlays */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      {/* Top Badges */}
                      <div className="absolute top-4 start-4 flex items-center gap-2">
                        {bundle.discount_percentage ? (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs px-3 py-1 border-none shadow-lg">
                            {isRTL ? `خصم ${bundle.discount_percentage}%` : `${bundle.discount_percentage}% OFF`}
                          </Badge>
                        ) : null}

                        {savings > 0 && (
                          <Badge variant="secondary" className="bg-emerald-600/90 text-white font-semibold text-xs border-none backdrop-blur-md">
                            {isRTL ? `توفير ${savings} ر.س` : `Save ${savings} SAR`}
                          </Badge>
                        )}
                      </div>

                      {/* Bottom Info on Image */}
                      <div className="absolute bottom-3 start-4 end-4 flex items-center justify-between text-xs text-white/95">
                        <span className="flex items-center gap-1.5 font-medium bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full">
                          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                          {coursesCount} {isRTL ? "مقررات معتمدة" : "courses"}
                        </span>

                        {bundle.valid_days && (
                          <span className="flex items-center gap-1 text-[11px] text-white/80">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {isRTL ? `صلاحية ${bundle.valid_days} يوم` : `${bundle.valid_days} days`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <CardContent className="p-6 space-y-5">
                      <div>
                        <h3 className="text-xl font-bold text-foreground group-hover:text-amber-600 transition-colors line-clamp-1">
                          {isRTL ? bundle.title_ar : bundle.title}
                        </h3>
                        {bundle.description_ar && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                            {isRTL ? bundle.description_ar : bundle.description}
                          </p>
                        )}
                      </div>

                      {/* Courses List */}
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                          {isRTL ? "المقررات المشمولة في هذا البكج:" : "Courses included in this bundle:"}
                        </p>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {bundle.courses?.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between text-xs bg-muted/40 hover:bg-muted/70 p-2 rounded-xl border border-border/40 transition-colors"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="font-medium truncate" title={c.title_ar || c.title}>
                                  {isRTL ? c.title_ar : c.title}
                                </span>
                              </div>
                              {c.instructor_name && (
                                <span className="text-[10px] text-muted-foreground shrink-0 ms-2">
                                  {c.instructor_name}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  {/* Card Footer */}
                  <div className="p-6 pt-0 space-y-4">
                    <div className="pt-4 border-t flex items-end justify-between">
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">
                          {isRTL ? "سعر الباقة الإجمالي:" : "Total Bundle Price:"}
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-3xl font-black text-foreground">
                            {bundle.price}
                          </span>
                          <span className="text-sm font-bold text-amber-600">
                            ر.س
                          </span>
                          {bundle.original_price && bundle.original_price > bundle.price && (
                            <span className="text-sm text-muted-foreground line-through ms-1 font-medium">
                              {bundle.original_price} ر.س
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-end">
                        <span className="text-[11px] font-semibold text-emerald-600 block">
                          {isRTL ? "✓ فتح فوري لكافة المواد" : "Instant Access"}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleOpenPurchase(bundle)}
                      className="w-full h-12 rounded-xl font-bold text-base bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-lg shadow-amber-600/20 gap-2 group-hover:scale-[1.01] transition-transform"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {isRTL ? "اشترك بالباقة وافتح كافة المواد" : "Enroll & Unlock All Courses"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Secondary Callout: Build Your Own Bundle Banner */}
        <div className="mt-16 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 end-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 max-w-2xl text-center md:text-start">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                {isRTL ? "ميزة خاصة بالطلاب" : "Student Exclusive"}
              </div>
              <h3 className="text-2xl md:text-4xl font-black text-white">
                {isRTL ? "تريد اختيار موادك بنفسك؟ أنشئ بكجك الخاص!" : "Want custom courses? Build Your Own Bundle!"}
              </h3>
              <p className="text-sm md:text-base text-slate-300 leading-relaxed">
                {isRTL
                  ? "اختر 4 مواد دراسية أو أكثر من أي كلية أو تخصص، وسيطبق النظام خصماً فورياً بنسبة 25% على كل مادة تلقائياً داخل لوحة تحكم الطالب."
                  : "Choose 4 or more courses from any department and get an automatic 25% discount per course right in your student dashboard."}
              </p>
            </div>

            <Button
              onClick={() => {
                if (!user) {
                  navigate(`/auth?redirect=${encodeURIComponent("/dashboard?tab=build-bundle")}`);
                } else {
                  navigate("/dashboard?tab=build-bundle");
                }
              }}
              className="h-14 px-8 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-base shadow-xl hover:scale-105 transition-all shrink-0 gap-2"
            >
              <Package className="w-5 h-5" />
              {isRTL ? "ابدأ بإنشاء بكجك الآن 🎁" : "Build Your Bundle Now 🎁"}
              {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Purchase Confirmation / Success Modal */}
      <Dialog open={!!selectedBundle} onOpenChange={(open) => !open && setSelectedBundle(null)}>
        <DialogContent className="max-w-xl" dir={dir}>
          {purchaseSuccess ? (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-foreground">
                  {isRTL ? "مبروك! تم تفعيل الباقة بنجاح 🎉" : "Congratulations! Bundle Unlocked 🎉"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  {isRTL
                    ? `أصبحت جميع مواد باقة "${selectedBundle?.title_ar}" متاحة لك بالكامل الآن بنسبة وصول 100%.`
                    : `All courses in "${selectedBundle?.title}" are now fully accessible in your dashboard.`}
                </p>
              </div>

              <div className="bg-muted/40 p-4 rounded-2xl border text-start space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase">
                  {isRTL ? "المواد المفعلة في حسابك:" : "Courses unlocked in your account:"}
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
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
                    setSelectedBundle(null);
                    navigate("/dashboard?tab=courses");
                  }}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold px-8 h-11"
                >
                  {isRTL ? "الانتقال لدوراتي والبدء بالدراسة" : "Go to My Courses"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            selectedBundle && (
              <div className="space-y-5">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <Package className="w-5 h-5 text-amber-600" />
                    {isRTL ? "تأكيد الاشتراك في الباقة" : "Confirm Bundle Purchase"}
                  </DialogTitle>
                  <DialogDescription>
                    {isRTL
                      ? `أنت على وشك الاشتراك في "${selectedBundle.title_ar}" وفتح جميع المقررات المشمولة دفعة واحدة.`
                      : `You are subscribing to "${selectedBundle.title}" and unlocking all bundled courses.`}
                  </DialogDescription>
                </DialogHeader>

                {/* Courses to unlock */}
                <div className="border rounded-2xl p-4 bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase">
                    <span>{isRTL ? "المقررات المشمولة:" : "Included Courses:"}</span>
                    <span>{selectedBundle.courses?.length || 0} {isRTL ? "مواد" : "courses"}</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selectedBundle.courses?.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-xl bg-background border text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-semibold truncate">{isRTL ? c.title_ar : c.title}</span>
                        </div>
                        <span className="text-muted-foreground text-[11px] shrink-0 ms-2">
                          {c.price ? `${c.price} ر.س` : "مجاني"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{isRTL ? "السعر الأصلي للمواد مجتمعة:" : "Original Combined Price:"}</span>
                    <span className="line-through">{selectedBundle.original_price || selectedBundle.price} ر.س</span>
                  </div>

                  {selectedBundle.discount_percentage ? (
                    <div className="flex items-center justify-between text-xs text-emerald-600 font-medium">
                      <span>{isRTL ? `خصم الباقة (${selectedBundle.discount_percentage}%):` : `Bundle Discount (${selectedBundle.discount_percentage}%):`}</span>
                      <span>- {Math.max(0, (selectedBundle.original_price || 0) - selectedBundle.price)} ر.س</span>
                    </div>
                  ) : null}

                  <div className="pt-2 border-t flex items-baseline justify-between">
                    <span className="font-bold text-sm text-foreground">
                      {isRTL ? "المبلغ الإجمالي للدفع:" : "Total Payable:"}
                    </span>
                    <span className="text-2xl font-black text-amber-600">
                      {selectedBundle.price} <span className="text-xs font-semibold">ر.س</span>
                    </span>
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedBundle(null)}
                    disabled={isPurchasing}
                  >
                    {isRTL ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button
                    onClick={handleConfirmPurchase}
                    disabled={isPurchasing}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2"
                  >
                    {isPurchasing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isRTL ? "جاري تفعيل المقررات..." : "Activating courses..."}
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        {isRTL ? "تأكيد الدفع وتفعيل المواد فوراً" : "Confirm & Unlock Courses"}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};
