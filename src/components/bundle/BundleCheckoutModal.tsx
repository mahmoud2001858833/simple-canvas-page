import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Package, Sparkles, Check, CreditCard, Building2,
  Calendar, ShieldCheck, CheckCircle2, Copy, Clock,
  ArrowRight, ArrowLeft, Loader2, BookOpen, AlertCircle,
  Percent, DollarSign, Wallet
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  processBundleCheckout,
  BundleCheckoutResult,
} from "@/services/bundleService";

export interface BundleCheckoutItem {
  id: string;
  title: string;
  title_ar: string;
  price: number | null;
  instructor_id?: string | null;
  instructor_name?: string;
  instructor_commission?: number | null;
  subject_code?: string;
  major_name?: string;
}

export interface BundleCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundleId?: string;
  bundleTitle: string;
  bundleTitleAr: string;
  totalPrice: number;
  originalPrice: number;
  discountPercentage: number;
  courses: BundleCheckoutItem[];
  isCustomBundle?: boolean;
  onSuccess?: (result: BundleCheckoutResult) => void;
}

export const BundleCheckoutModal = ({
  isOpen,
  onClose,
  bundleId,
  bundleTitle,
  bundleTitleAr,
  totalPrice,
  originalPrice,
  discountPercentage,
  courses,
  isCustomBundle = false,
  onSuccess,
}: BundleCheckoutModalProps) => {
  const { dir } = useLanguage();
  const isRTL = dir === "rtl";
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [paymentPlan, setPaymentPlan] = useState<"full" | "monthly">("full");
  const [installmentMonths, setInstallmentMonths] = useState<number>(3); // 2, 3, 4
  const [paymentMethod, setPaymentMethod] = useState<"online" | "bank_transfer" | "tabby">("online");
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<BundleCheckoutResult | null>(null);

  // Installment Calculations
  const monthlyAmount = useMemo(() => {
    return Math.ceil(totalPrice / installmentMonths);
  }, [totalPrice, installmentMonths]);

  const amountDueToday = paymentPlan === "full" ? totalPrice : monthlyAmount;
  const totalSavings = Math.max(0, originalPrice - totalPrice);

  // Bank Info for Alinma Transfer
  const bankInfo = {
    bankName: isRTL ? "مصرف الإنماء" : "Alinma Bank",
    accountHolder: isRTL ? "عمار سعيد ناشر الجدعاني" : "Ammar Saeed Nasher Aljadani",
    accountNumber: "68207056692000",
    iban: "SA3805000068207056692000",
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(isRTL ? `تم نسخ ${label}` : `${label} copied`);
  };

  // Execution
  const handleCheckout = async () => {
    if (!user) {
      toast.error(isRTL ? "يرجى تسجيل الدخول أولاً لإتمام الشراء" : "Please log in to checkout");
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (courses.length === 0) {
      toast.error(isRTL ? "لا توجد مواد محددة في هذا البكج" : "No courses selected");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await processBundleCheckout({
        userId: user.id,
        userEmail: user.email,
        bundleId,
        bundleTitle,
        bundleTitleAr,
        totalPrice,
        originalPrice,
        discountPercentage,
        courses: courses.map((c) => ({
          id: c.id,
          title: c.title,
          title_ar: c.title_ar,
          price: c.price,
          instructor_id: c.instructor_id || null,
          instructor_commission: c.instructor_commission ?? 30,
        })),
        paymentPlan,
        installmentMonths: paymentPlan === "monthly" ? installmentMonths : undefined,
        paymentMethod: paymentMethod === "tabby" ? "tabby" : paymentMethod,
        isCustomBundle,
      });

      if (res.success) {
        setCheckoutResult(res);
        if (onSuccess) onSuccess(res);

        if (paymentMethod === "bank_transfer") {
          toast.success(
            isRTL
              ? "تم تسجيل طلب الباقة بنجاح! يرجى إتمام التحويل البنكي وإرفاق الإيصال."
              : "Bundle order registered! Please submit your transfer receipt."
          );
        } else {
          toast.success(
            isRTL
              ? `تهانينا! تم تفعيل ${courses.length} مواد في باقتك بنجاح!`
              : `Congratulations! ${courses.length} bundle courses unlocked!`
          );
        }
      }
    } catch (err: any) {
      toast.error(err.message || (isRTL ? "فشل إتمام الشراء" : "Purchase failed"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinishAndNavigate = () => {
    onClose();
    if (checkoutResult?.isPending && checkoutResult.primaryPaymentId) {
      navigate(`/payment/pending?payment_id=${checkoutResult.primaryPaymentId}`);
    } else {
      navigate("/dashboard/student");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 border-0 rounded-3xl shadow-2xl bg-card"
        dir={dir}
      >
        {/* Royal Brand Header */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 p-6 md:p-8 text-white">
          <div className="absolute top-0 end-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 start-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {isRTL ? "بوابة الدفع والتقسيط الملكية" : "Royal Checkout & Installments"}
              </div>

              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs">
                {isRTL ? `خصم ${discountPercentage}%` : `${discountPercentage}% OFF`}
              </Badge>
            </div>

            <h2 className="text-xl md:text-2xl font-black text-white">
              {isRTL ? bundleTitleAr : bundleTitle}
            </h2>
            <p className="text-xs md:text-sm text-slate-300">
              {isRTL
                ? `باقة تشمل ${courses.length} مقرر دراسي مع كافة الشروحات والاختبارات والتواصل مع المعلمين.`
                : `Bundle covers ${courses.length} courses including all materials and direct teacher chat.`}
            </p>
          </div>
        </div>

        {/* Modal Body */}
        {checkoutResult ? (
          /* Success Screen */
          <div className="p-6 md:p-8 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-500/5">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-foreground">
                {checkoutResult.isPending
                  ? isRTL ? "تم إنشاء طلب الباقة بنجاح!" : "Order Placed Successfully!"
                  : isRTL ? "مبارك! تم تفعيل اشتراكك بالباقة!" : "Congratulations! Bundle Activated!"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {checkoutResult.isPending
                  ? isRTL
                    ? "تم حجز مقعدك بالباقة بانتظار التحويل البنكي. يرجى إرفاق إشعار التحويل لتأكيد التفعيل الفوري."
                    : "Your bundle is reserved. Please submit transfer receipt to complete activation."
                  : isRTL
                    ? `تم فتح الـ ${checkoutResult.unlockedCoursesCount} مواد بنجاح في حسابك ويمكنك البدء بالدراسة فوراً.`
                    : `${checkoutResult.unlockedCoursesCount} courses are now active and ready in your dashboard.`}
              </p>
            </div>

            {/* Unlocked Courses Summary */}
            <div className="bg-muted/40 rounded-2xl p-4 border text-start space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>{isRTL ? "المقررات المشمولة المفعّلة:" : "Included Courses:"}</span>
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                  {checkoutResult.unlockedCoursesCount} {isRTL ? "مواد" : "courses"}
                </Badge>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {courses.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-card border">
                    <span className="font-bold truncate max-w-[240px]">
                      {isRTL ? c.title_ar : c.title}
                    </span>
                    <span className="text-emerald-600 font-bold text-[11px]">
                      {checkoutResult.isPending ? (isRTL ? "بانتظار الإيصال" : "Pending") : (isRTL ? "✓ نشطة" : "Active")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleFinishAndNavigate}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl shadow-lg"
            >
              {checkoutResult.isPending
                ? (isRTL ? "المتابعة لإرفاق إيصال التحويل" : "Proceed to Attach Receipt")
                : (isRTL ? "الانتقال إلى لوحة تحكم الطالب والبدء" : "Go to Dashboard & Start Learning")}
            </Button>
          </div>
        ) : (
          /* Active Checkout Form */
          <div className="p-6 space-y-6">
            {/* Step 1: Payment Plan Selector */}
            <div className="space-y-3">
              <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                {isRTL ? "1. حدد خطة السداد (دفع كلي أو تقسيط ميسر):" : "1. Select Payment Plan:"}
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Full Payment */}
                <div
                  onClick={() => setPaymentPlan("full")}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    paymentPlan === "full"
                      ? "bg-amber-500/10 border-amber-500 shadow-md ring-2 ring-amber-500/20"
                      : "bg-card border-border hover:border-amber-500/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-sm text-foreground block">
                        {isRTL ? "دفع كلي كامل (100%)" : "Full Payment (100%)"}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5 block">
                        {isRTL ? "دفعة واحدة بأعلى توفير مع تفعيل فوري" : "One payment with instant full activation"}
                      </span>
                    </div>
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                      {isRTL ? "أفضل قيمة" : "Best Value"}
                    </Badge>
                  </div>

                  <div className="mt-4 pt-3 border-t flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">{isRTL ? "المطلوب اليوم:" : "Due Today:"}</span>
                    <span className="text-xl font-black text-foreground">
                      {totalPrice} <span className="text-xs font-normal">ر.س</span>
                    </span>
                  </div>
                </div>

                {/* Option 2: Monthly Installments */}
                <div
                  onClick={() => setPaymentPlan("monthly")}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    paymentPlan === "monthly"
                      ? "bg-amber-500/10 border-amber-500 shadow-md ring-2 ring-amber-500/20"
                      : "bg-card border-border hover:border-amber-500/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-sm text-foreground block">
                        {isRTL ? "تقسيط شهري ميسر" : "Monthly Installments"}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5 block">
                        {isRTL ? "قسّط باقتك على دفعات شهرية مريحة 0% فوائد" : "Split into easy monthly payments at 0% interest"}
                      </span>
                    </div>
                    <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50 text-[10px] font-bold shrink-0">
                      {isRTL ? "0% فوائد" : "0% Interest"}
                    </Badge>
                  </div>

                  <div className="mt-4 pt-3 border-t flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">{isRTL ? "القسط الشهري:" : "Monthly:"}</span>
                    <span className="text-xl font-black text-amber-600">
                      {monthlyAmount} <span className="text-xs font-normal">ر.س / شهر</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Installment Months Duration Selector */}
              {paymentPlan === "monthly" && (
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-800">
                    <span>{isRTL ? "اختر مدة التقسيط (عدد الأشهر):" : "Choose Installment Duration:"}</span>
                    <span className="text-amber-600">{monthlyAmount} ر.س / شهرياً</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[2, 3, 4].map((m) => {
                      const amount = Math.ceil(totalPrice / m);
                      const isSelected = installmentMonths === m;

                      return (
                        <Button
                          key={m}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => setInstallmentMonths(m)}
                          className={`flex flex-col h-auto py-2.5 rounded-xl ${
                            isSelected
                              ? "bg-amber-600 hover:bg-amber-700 text-white font-bold"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          <span className="text-xs font-bold">
                            {m} {isRTL ? "أشهر" : "Months"}
                          </span>
                          <span className="text-[10px] opacity-80 mt-0.5">
                            {amount} ر.س / شهر
                          </span>
                        </Button>
                      );
                    })}
                  </div>

                  {/* Installment Schedule Preview */}
                  <div className="text-[11px] text-muted-foreground space-y-1 pt-2 border-t border-amber-500/20">
                    <div className="flex justify-between">
                      <span>• {isRTL ? "الدفعة الأولى (مستحقة اليوم للتفعيل):" : "First payment (due today):"}</span>
                      <strong className="text-foreground">{monthlyAmount} ر.س</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>• {isRTL ? `الأقساط المتبقية (${installmentMonths - 1} دفعات):` : `Remaining (${installmentMonths - 1} installments):`}</span>
                      <span>{monthlyAmount} ر.س {isRTL ? "شهرياً" : "/month"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Payment Method Selector */}
            <div className="space-y-3">
              <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-600" />
                {isRTL ? "2. حدد طريقة الدفع:" : "2. Select Payment Method:"}
              </Label>

              <RadioGroup
                value={paymentMethod}
                onValueChange={(val) => setPaymentMethod(val as any)}
                className="space-y-2.5"
              >
                {/* Online Payment */}
                <div
                  onClick={() => setPaymentMethod("online")}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === "online"
                      ? "border-slate-900 bg-slate-900/5 shadow-sm"
                      : "border-border hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="online" id="method-online" />
                    <div>
                      <Label htmlFor="method-online" className="font-bold text-sm cursor-pointer block">
                        {isRTL ? "الدفع الإلكتروني الفوري (مدى / فيزا / ماستركارد / أبل باي)" : "Online Card (Mada / Visa / Apple Pay)"}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isRTL ? "تفعيل آلي وفوري لكافة المقررات خلال ثوانٍ" : "Instant automated activation"}
                      </p>
                    </div>
                  </div>
                  <CreditCard className="w-5 h-5 text-slate-700 shrink-0" />
                </div>

                {/* Tabby (Split in 4) */}
                <div
                  onClick={() => setPaymentMethod("tabby")}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === "tabby"
                      ? "border-emerald-600 bg-emerald-600/5 shadow-sm"
                      : "border-border hover:border-emerald-500"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="tabby" id="method-tabby" />
                    <div>
                      <Label htmlFor="method-tabby" className="font-bold text-sm cursor-pointer block text-emerald-800">
                        {isRTL ? "تابي (Tabby) - قسّمها على 4 دفعات" : "Tabby - Split in 4"}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isRTL ? "بدون أي فوائد وبدون أي رسوم تأخير قانونية" : "0% interest, no late fees"}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                    Tabby
                  </Badge>
                </div>

                {/* Bank Transfer */}
                <div
                  onClick={() => setPaymentMethod("bank_transfer")}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === "bank_transfer"
                      ? "border-blue-600 bg-blue-600/5 shadow-sm"
                      : "border-border hover:border-blue-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="bank_transfer" id="method-bank" />
                    <div>
                      <Label htmlFor="method-bank" className="font-bold text-sm cursor-pointer block">
                        {isRTL ? "تحويل بنكي مباشر (حساب مصرف الإنماء)" : "Bank Transfer (Alinma Bank)"}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isRTL ? "تحويل يدوي وإرفاق إيصال الدفع" : "Manual bank transfer & receipt upload"}
                      </p>
                    </div>
                  </div>
                  <Building2 className="w-5 h-5 text-blue-700 shrink-0" />
                </div>
              </RadioGroup>

              {/* Bank Details Box if Bank Transfer Selected */}
              {paymentMethod === "bank_transfer" && (
                <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-3">
                  <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold text-xs">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    {isRTL ? "بيانات الحساب البنكي الرسمي لمنصة جسوركم:" : "Official Bank Account Details:"}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border space-y-1">
                      <span className="text-[10px] text-muted-foreground block">{isRTL ? "البنك:" : "Bank:"}</span>
                      <strong className="font-bold text-foreground block">{bankInfo.bankName}</strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border space-y-1">
                      <span className="text-[10px] text-muted-foreground block">{isRTL ? "اسم المستفيد:" : "Beneficiary:"}</span>
                      <strong className="font-bold text-foreground block truncate">{bankInfo.accountHolder}</strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border sm:col-span-2 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">{isRTL ? "رقم الآيبان (IBAN):" : "IBAN:"}</span>
                        <code className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 select-all">
                          {bankInfo.iban}
                        </code>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(bankInfo.iban, "الآيبان")}
                        className="h-7 text-[11px] gap-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {isRTL ? "نسخ" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    ℹ️ {isRTL ? "بعد النقر على تأكيد الشراء، سيتم توجيهك لصفحة رفع الإيصال للتفعيل الفوري." : "After clicking confirm, you will be redirected to upload the receipt."}
                  </p>
                </div>
              )}
            </div>

            {/* Financial Summary Box */}
            <div className="p-4 rounded-2xl bg-muted/40 border space-y-2.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>{isRTL ? `قيمة المقررات (${courses.length} مواد منفصلة):` : `Courses value (${courses.length} items):`}</span>
                <span className="line-through">{originalPrice} ر.س</span>
              </div>

              <div className="flex justify-between text-emerald-600 font-bold">
                <span>{isRTL ? "وفرت مع الباقة:" : "Bundle Discount Savings:"}</span>
                <span>-{totalSavings} ر.س ({discountPercentage}%)</span>
              </div>

              <div className="pt-2 border-t flex justify-between items-baseline">
                <div>
                  <span className="font-black text-sm text-foreground block">
                    {isRTL ? "المبلغ المستحق سداده اليوم:" : "Total Due Today:"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {paymentPlan === "monthly"
                      ? (isRTL ? `قسط 1 من ${installmentMonths} أشهر` : `Installment 1 of ${installmentMonths} months`)
                      : (isRTL ? "سداد كامل القيمة المخفضة" : "Full discounted payment")}
                  </span>
                </div>

                <div className="text-end">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {amountDueToday} <span className="text-xs font-normal">ر.س</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleCheckout}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 hover:from-slate-800 hover:to-slate-900 text-white font-bold h-12 rounded-2xl shadow-xl gap-2 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isRTL ? "جاري معالجة الطلب..." : "Processing payment..."}
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  {paymentMethod === "bank_transfer"
                    ? (isRTL ? `تأكيد الطلب والتحويل بمبلغ ${amountDueToday} ر.س` : `Confirm Order for ${amountDueToday} SAR`)
                    : (isRTL ? `دفع ${amountDueToday} ر.س وتفعيل المقررات فوراً` : `Pay ${amountDueToday} SAR & Unlock Now`)}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
