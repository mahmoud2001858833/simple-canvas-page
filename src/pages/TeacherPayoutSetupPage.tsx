import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Banknote,
  Percent,
  Layers,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Send,
  Coins,
  Check,
  Mail,
  HelpCircle,
  Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  requestPayoutModel,
  getTeacherPayoutSettings,
  sendLifecycleEmail,
  PayoutType,
} from '@/lib/teacherLifecycleService';

export const TeacherPayoutSetupPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { dir } = useLanguage();
  const navigate = useNavigate();

  const [selectedType, setSelectedType] = useState<PayoutType>('percentage');
  const [fixedAmount, setFixedAmount] = useState<string>('5000');
  const [percentageRate, setPercentageRate] = useState<string>('80');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Completion modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      if (!user) return;
      try {
        const existing = await getTeacherPayoutSettings(user.id);
        if (existing) {
          setSelectedType(existing.requested_type || 'percentage');
          if (existing.fixed_amount) setFixedAmount(existing.fixed_amount.toString());
          if (existing.percentage_rate) setPercentageRate(existing.percentage_rate.toString());
          if (existing.notes) setNotes(existing.notes);
        }
      } catch (e) {
        console.error('Error loading payout settings:', e);
      } finally {
        setInitialLoading(false);
      }
    }
    loadSettings();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedType === 'fixed_per_course' && (!fixedAmount || Number(fixedAmount) <= 0)) {
      toast.error('يرجى تحديد المبلغ المقطوع المطلوب عن الدورة');
      return;
    }
    if (selectedType === 'percentage' && (!percentageRate || Number(percentageRate) <= 0 || Number(percentageRate) > 100)) {
      toast.error('يرجى تحديد نسبة مئوية صحيحة (بين 1% و 100%)');
      return;
    }
    if (selectedType === 'hybrid') {
      if (!fixedAmount || Number(fixedAmount) <= 0) {
        toast.error('يرجى تحديد المبلغ الأساسي للنموذج الهجين');
        return;
      }
      if (!percentageRate || Number(percentageRate) <= 0 || Number(percentageRate) > 100) {
        toast.error('يرجى تحديد نسبة الأرباح التكميلية');
        return;
      }
    }

    setLoading(true);
    try {
      await requestPayoutModel({
        teacherId: user.id,
        requestedType: selectedType,
        fixedAmount: fixedAmount ? Number(fixedAmount) : undefined,
        percentageRate: percentageRate ? Number(percentageRate) : undefined,
        notes: notes.trim(),
      });

      // Send confirmation email
      const userEmail = profile?.email || user.email || '';
      const userName = profile?.full_name || 'أستاذنا الفاضل';
      if (userEmail) {
        await sendLifecycleEmail({
          type: 'teacher_payout_submitted',
          toEmail: userEmail,
          toName: userName,
          fixedAmount: fixedAmount ? Number(fixedAmount) : undefined,
          percentageRate: percentageRate ? Number(percentageRate) : undefined,
          userId: user.id,
        }).catch(() => {});
      }

      setShowCompletionModal(true);
      toast.success('تم إرسال نموذج الأرباح إلى الإدارة ومزامنة دفتر الحسابات بنجاح');
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة ثانية');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800" dir={dir}>
        <Loader2 className="w-10 h-10 text-amber-600 animate-spin mb-4" />
        <p className="text-slate-600 font-semibold">جاري تجهيز خيارات العوائد المالية...</p>
      </div>
    );
  }

  const payoutOptions = [
    {
      id: 'percentage' as const,
      title: 'نسبة محددة من مبيعات الدورة (Percentage Share)',
      subtitle: 'النموذج الأكثر رواجاً وتصاعداً في الأرباح',
      icon: Percent,
      color: 'emerald',
      badge: 'الخيار الأكثر اختياراً (موصى به)',
      description:
        'نسبة مئوية متفق عليها يتم اقتطاعها تلقائياً وإيداعها في حسابك البنكي من كل اشتراك طالب في الدورة. ترتفع أرباحك مباشرة وبدون حد أقصى كلما زاد إقبال الطلاب.',
    },
    {
      id: 'fixed_per_course' as const,
      title: 'مبلغ مقطوع ثابت عن الدورة (Fixed Per Course)',
      subtitle: 'عوائد مضمونة ومباشرة لإنتاج المحتوى الأكاديمي',
      icon: Banknote,
      color: 'amber',
      badge: 'دخل مقطوع مضمون',
      description:
        'مبلغ مقطوع ثابت يُدفع لك كاملاً مقابل إعداد وتصوير وتسليم محتوى الدورة متضمنة المذكرات والاختبارات، بغض النظر عن عدد اشتراكات الطلاب اللاحقة.',
    },
    {
      id: 'hybrid' as const,
      title: 'نموذج هجين (مبلغ مقطوع + نسبة مبيعات)',
      subtitle: 'توازن مثالي بين الدخل المبدئي والنمو المستمر',
      icon: Layers,
      color: 'blue',
      badge: 'تكامل العوائد',
      description:
        'مبلغ أساسي مقدم يغطي تكاليف إعداد وتصوير المقرر، بالإضافة إلى نسبة مئوية مستمرة من اشتراكات الطلاب لتحفيز استمرار التحديث والدعم الأكاديمي.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 relative selection:bg-amber-100 selection:text-amber-900" dir={dir}>
      {/* Header Navbar */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-40 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 text-white font-black text-xl">
              ج
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-lg tracking-wide">منصة جسوركم</span>
                <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 text-xs font-semibold">
                  الخطوة 2 من 2
                </Badge>
              </div>
              <p className="text-xs text-slate-500 font-medium">هيكل العوائد المالية ونموذج الأرباح</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/teacher/onboarding')}
            className="border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium"
          >
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            الرجوع لبيانات البنك والعقد
          </Button>
        </div>
      </header>

      {/* Main Form Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Title & Introduction */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold mb-2 shadow-xs">
            <Coins className="w-3.5 h-3.5 text-amber-600" />
            تحديد نموذج الشراكة المالية المعتمد
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            اختيار نموذج توزيع واستحقاق الأرباح
          </h1>
          <p className="text-slate-600 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            حدد نموذج العوائد المفضل لك لإنتاج وتدريس دوراتك. ستصل النسبة المقترحة للإدارة فوراً لاعتمادها أو التنسيق بشأنها.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 3 Interactive Model Selection Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            {payoutOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedType === opt.id;

              return (
                <div
                  key={opt.id}
                  onClick={() => setSelectedType(opt.id)}
                  className={`cursor-pointer rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 relative text-start ${
                    isSelected
                      ? 'bg-white border-amber-500 shadow-md ring-2 ring-amber-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-4 end-4 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold ${
                          isSelected
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        {opt.badge}
                      </Badge>
                      <h3 className="font-bold text-slate-900 text-sm md:text-base pt-1">{opt.title}</h3>
                      <p className="text-xs text-slate-500 font-medium">{opt.subtitle}</p>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
                      {opt.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Model Customization Parameters Card */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-base md:text-lg font-bold text-slate-900">
                  تحديد تفاصيل وأرقام النموذج المالي المقترح
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="p-6 md:p-8 space-y-6">
              {/* If Percentage */}
              {(selectedType === 'percentage' || selectedType === 'hybrid') && (
                <div className="space-y-3 text-start">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-800 font-bold text-sm">
                      نسبة المعلم المقترحة من مبيعات الدورة (%):
                    </Label>
                    <span className="font-black text-amber-700 text-xl font-mono">{percentageRate}%</span>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex flex-wrap gap-2">
                    {['60', '70', '75', '80', '85', '90'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPercentageRate(val)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          percentageRate === val
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {val}%
                      </button>
                    ))}
                  </div>

                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={percentageRate}
                    onChange={(e) => setPercentageRate(e.target.value)}
                    className="bg-white border-slate-300 text-slate-900 focus:border-amber-500 h-11 font-mono text-base max-w-xs"
                    placeholder="80"
                  />
                  <p className="text-[11px] text-slate-500">
                    النسبة المعيارية الشائعة للمعلمين في جسوركم تتراوح بين 70% إلى 85%.
                  </p>
                </div>
              )}

              {/* If Fixed Per Course */}
              {(selectedType === 'fixed_per_course' || selectedType === 'hybrid') && (
                <div className="space-y-3 text-start pt-2">
                  <Label className="text-slate-800 font-bold text-sm">
                    {selectedType === 'hybrid' ? 'المبلغ المقطوع الأساسي (ر.س):' : 'المبلغ المقطوع المطلوب عن الدورة كاملة (ر.س):'}
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={500}
                      step={100}
                      value={fixedAmount}
                      onChange={(e) => setFixedAmount(e.target.value)}
                      className="bg-white border-slate-300 text-slate-900 focus:border-amber-500 h-11 font-mono text-base max-w-xs"
                      placeholder="5000"
                    />
                    <span className="text-slate-600 font-bold text-sm">ريال سعودي</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    يتم تحويل هذا المبلغ بعد استلام ومراجعة واعتماد ملفات وفيديوهات الدورة كاملة.
                  </p>
                </div>
              )}

              {/* Notes or Proposal Comments */}
              <div className="space-y-2 text-start pt-2">
                <Label className="text-slate-800 font-semibold text-xs md:text-sm">
                  ملاحظات إضافية أو مقترح خاص للإدارة المالية <span className="text-slate-400 font-normal">(اختياري)</span>
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="إذا كان لديك أي ترتيب خاص، تفاصيل إضافية عن حجم المقرر أو مواعيد رفعه، يرجى كتابتها هنا..."
                  className="bg-white border-slate-300 text-slate-900 focus:border-amber-500 min-h-[90px] text-sm"
                />
              </div>

              {/* Summary / Confirmation Callout */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-start">
                <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed space-y-1">
                  <p className="font-bold text-slate-900">المزامنة مع لوحة الأدمن ودفتر الحسابات:</p>
                  <p>
                    بمجرد النقر على زر الإرسال أدناه، سيتم تسجيل مقترحك في حسابك وعرضه فوراً أمام الإدارة المالية لاعتماده مباشرة أو موافاتك بالرد.
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/teacher/onboarding')}
                  className="border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  <ArrowRight className="ml-2 h-4 w-4" />
                  السابق
                </Button>

                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold px-8 h-12 text-base shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإرسال والمزامنة...
                    </>
                  ) : (
                    <>
                      إرسال وتأكيد النموذج المالي للإدارة
                      <Send className="mr-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </main>

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" dir={dir}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 md:p-8 shadow-2xl space-y-6 text-center"
          >
            <div className="h-16 w-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div className="space-y-2">
              <Badge className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1">
                تم استلام طلبك ومزامنته مع الإدارة
              </Badge>
              <h3 className="text-xl md:text-2xl font-black text-slate-900">
                تم اعتماد مقترحك بنجاح!
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                وصل مقترح النموذج المالي والنسبة المطلوبة إلى لوحة تحكم الإدارة المالية لمنصة جسوركم.
              </p>
            </div>

            {/* Email notice alert box */}
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-start flex items-start gap-3">
              <Mail className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <p className="font-bold">✉️ تم إرسال رسالة تأكيد إلى بريدك الإلكتروني:</p>
                <p className="font-mono text-[11px] text-amber-800">{user?.email}</p>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  تحتوي الرسالة على ملخص النموذج المالي المختار ومسار مراجعة العرض المالي.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={() => navigate('/instructor')}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold h-12 text-base shadow-md shadow-amber-500/20"
              >
                الدخول إلى لوحة تحكم المعلم
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default TeacherPayoutSetupPage;
