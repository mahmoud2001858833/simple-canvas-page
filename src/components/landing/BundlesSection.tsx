import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Package, Sparkles, Check, ArrowRight, ArrowLeft,
  BookOpen, Clock, ShoppingBag, ShieldCheck, CheckCircle2,
  Calendar, CreditCard, Coins
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getActiveBundles, CourseBundle } from "@/services/bundleService";
import { BundleCheckoutModal } from "@/components/bundle/BundleCheckoutModal";

export const BundlesSection = () => {
  const { dir } = useLanguage();
  const isRTL = dir === "rtl";
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedBundle, setSelectedBundle] = useState<CourseBundle | null>(null);

  // Fetch active bundles from DB
  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ["active-course-bundles"],
    queryFn: getActiveBundles,
  });

  // Handle bundle selection
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
                    {/* Installment Badge Callout */}
                    <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{isRTL ? "متاح تقسيط شهري:" : "Monthly installment:"}</span>
                      </div>
                      <span className="font-bold text-amber-600">
                        {Math.ceil(bundle.price / 3)} {isRTL ? "ر.س / شهرياً" : "SAR/mo"}
                      </span>
                    </div>

                    <div className="pt-2 border-t flex items-end justify-between">
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
                      className="w-full h-12 rounded-xl font-bold text-base bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 hover:from-slate-800 hover:to-slate-900 text-white shadow-lg shadow-slate-900/20 gap-2 group-hover:scale-[1.01] transition-transform"
                    >
                      <ShoppingBag className="w-4 h-4 text-amber-400" />
                      {isRTL ? "اشترك بالباقة (دفع كلي أو تقسيط)" : "Enroll (Full or Installments)"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Secondary Callout: Build Your Own Bundle Banner */}
        <div className="mt-16 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 end-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 max-w-2xl text-center md:text-start">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {isRTL ? "ميزة خاصة بالطلاب" : "Student Exclusive"}
              </div>
              <h3 className="text-2xl md:text-4xl font-black text-white">
                {isRTL ? "تريد اختيار موادك بنفسك؟ أنشئ بكجك الخاص!" : "Want custom courses? Build Your Own Bundle!"}
              </h3>
              <p className="text-sm md:text-base text-slate-300 leading-relaxed">
                {isRTL
                  ? "اختر 4 مواد دراسية أو أكثر من أي كلية أو تخصص، وسيطبق النظام خصماً فورياً بنسبة 25% على كل مادة تلقائياً مع خيارات الدفع الكلي أو التقسيط الميسر."
                  : "Choose 4 or more courses from any department and get an automatic 25% discount per course with full or installment payment options."}
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

      {/* Royal Bundle Checkout & Installments Modal */}
      {selectedBundle && (
        <BundleCheckoutModal
          isOpen={!!selectedBundle}
          onClose={() => setSelectedBundle(null)}
          bundleId={selectedBundle.id}
          bundleTitle={selectedBundle.title}
          bundleTitleAr={selectedBundle.title_ar}
          totalPrice={selectedBundle.price}
          originalPrice={selectedBundle.original_price || selectedBundle.price}
          discountPercentage={selectedBundle.discount_percentage || 0}
          courses={selectedBundle.courses || []}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["my-courses"] });
            queryClient.invalidateQueries({ queryKey: ["enrollments"] });
            queryClient.invalidateQueries({ queryKey: ["active-course-bundles"] });
          }}
        />
      )}
    </section>
  );
};

