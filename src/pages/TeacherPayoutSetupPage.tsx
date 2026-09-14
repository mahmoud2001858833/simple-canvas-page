import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  Loader2,
  ShieldCheck,
  Send,
  Coins,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  requestPayoutModel,
  getTeacherPayoutSettings,
  PayoutType,
} from '@/lib/teacherLifecycleService';

export const TeacherPayoutSetupPage: React.FC = () => {
  const { user } = useAuth();
  const { dir } = useLanguage();
  const navigate = useNavigate();

  const [selectedType, setSelectedType] = useState<PayoutType>('percentage');
  const [fixedAmount, setFixedAmount] = useState<string>('');
  const [percentageRate, setPercentageRate] = useState<string>('60');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      if (!user) return;
      try {
        const existing = await getTeacherPayoutSettings(user.id);
        if (existing) {
          setSelectedType(existing.requested_type);
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

    // Basic sanity checks
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
        toast.error('يرجى تحديد النسبة المئوية للنموذج الهجين');
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

      toast.success('تم إرسال طلب النموذج المالي للإدارة بنجاح! سيتم مراجعته وموافاتك بالعرض الرسمي.');
      setTimeout(() => {
        navigate('/instructor');
      }, 1200);
    } catch (err) {
      toast.error('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة ثانية');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100" dir={dir}>
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">جاري تجهيز خيارات العوائد المالية...</p>
      </div>
    );
  }

  const payoutOptions = [
    {
      id: 'percentage' as const,
      title: 'نسبة محددة من مبيعات الدورة (Percentage Share)',
      subtitle: 'الخيار الأكثر مرونة وتصاعداً في الأرباح',
      icon: Percent,
      color: 'emerald',
      description:
        'نسبة مئوية متفق عليها يتم اقتطاعها تلقائياً وتحويلها لحسابك من كل اشتراك طالب في الدورة. ترتفع أرباحك مباشرة كلما زادت مبيعات دوراتك.',
      badge: 'الخيار الموصى به',
    },
    {
      id: 'fixed_per_course' as const,
      title: 'مبلغ محدد عن الدورة كاملة (Fixed Per Course)',
      subtitle: 'عوائد مضمونة ومباشرة لإنتاج المحتوى',
      icon: Banknote,
      color: 'amber',
      description:
        'مبلغ مقطوع ثابت متفق عليه يُدفع لك كاملاً مقابل إنتاج وتسليم ورفع الدورة متضمنة الاختبارات والمواد الملحقة، بغض النظر عن حجم المبيعات اللاحقة.',
      badge: 'دخل مقطوع ثابت',
    },
    {
      id: 'hybrid' as const,
      title: 'نموذج هجين (مبلغ مقطوع + نسبة أرباح)',
      subtitle: 'أفضل توازن بين الدخل المبدئي والنمو المستمر',
      icon: Layers,
      color: 'blue',
      description:
        'مبلغ أساسي مقدم يغطي تكاليف إعداد الدورة وتصويرها، بالإضافة إلى نسبة مئوية مستمرة من مبيعات الطلاب لتحفيز استمرارية الدعم والتطوير.',
      badge: 'تكامل العوائد',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden" dir={dir}>
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12 relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Coins className="w-3.5 h-3.5" />
            الهيكل المالي وعوائد الشراكة الأكاديمية
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            اختيار نموذج توزيع واستحقاق الأرباح
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto mt-2 text-sm md:text-base">
            حدد نموذج العوائد المفضل لك لإنتاج وتدريس دوراتك في منصة جسوركم. سيتم مراجعة طلبك والتنسيق معك عبر غرفة المفاوضة لاعتماد الاتفاق النهائي.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 3 Interactive Cards */}
          <div className="grid md:grid-cols-3 gap-5">
            {payoutOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedType === opt.id;

              return (
                <div
                  key={opt.id}
                  onClick={() => setSelectedType(opt.id)}
                  className={`cursor-pointer rounded-2xl border p-6 flex flex-col justify-between transition-all relative overflow-hidden text-start ${
                    isSelected
                      ? 'bg-slate-900 border-amber-500 shadow-2xl shadow-amber-500/10 ring-2 ring-amber-500/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 end-3 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <Badge
                        className={`text-[11px] ${
                          isSelected ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-none'
                        }`}
                      >
                        {opt.badge}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white leading-snug">{opt.title}</h3>
                      <p className="text-xs text-amber-400/80 font-medium mt-1">{opt.subtitle}</p>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">{opt.description}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400">حالة التحديد</span>
                    <span className={`text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-slate-500'}`}>
                      {isSelected ? 'تم الاختيار' : 'انقر للتحديد'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conditional Proposal Inputs */}
          <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-4 text-start">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">تفاصيل ومقترح العرض المالي المطلوب</h3>
              </div>

              <div className="grid md:grid-cols-2 gap-6 text-start">
                {(selectedType === 'fixed_per_course' || selectedType === 'hybrid') && (
                  <div className="space-y-2">
                    <Label htmlFor="fixedAmount" className="text-slate-300 font-medium">
                      المبلغ المقطوع المقترح للدورة كاملة (ريال سعودي) <span className="text-amber-400">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="fixedAmount"
                        type="number"
                        min="1"
                        placeholder="مثال: 3000"
                        value={fixedAmount}
                        onChange={(e) => setFixedAmount(e.target.value)}
                        className="bg-slate-950/70 border-slate-800 text-white focus:border-amber-500 h-11 font-mono text-base ps-14"
                      />
                      <span className="absolute start-3 top-3 text-xs text-slate-400 font-medium pointer-events-none">
                        ر.س
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">القيمة المقترحة لإنتاج ورفع المقرر كاملاً.</p>
                  </div>
                )}

                {(selectedType === 'percentage' || selectedType === 'hybrid') && (
                  <div className="space-y-2">
                    <Label htmlFor="percentageRate" className="text-slate-300 font-medium">
                      نسبة العمولة المقترحة من المبيعات (%) <span className="text-amber-400">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="percentageRate"
                        type="number"
                        min="1"
                        max="100"
                        placeholder="مثال: 60"
                        value={percentageRate}
                        onChange={(e) => setPercentageRate(e.target.value)}
                        className="bg-slate-950/70 border-slate-800 text-white focus:border-amber-500 h-11 font-mono text-base ps-10"
                      />
                      <span className="absolute start-3 top-3 text-xs text-slate-400 font-bold pointer-events-none">
                        %
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">النسبة المئوية المقترحة لاقتطاعها من كل اشتراك طالب.</p>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-start">
                <Label htmlFor="notes" className="text-slate-300 font-medium">
                  ملاحظات أو مقترحات إضافية للإدارة الأكاديمية (اختياري)
                </Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="اكتب هنا أي متطلبات إنتاجية، معدات خاصة، أو تفضيلات تتعلق بجدول رفع الدروس والمقررات..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-slate-950/70 border-slate-800 text-white focus:border-amber-500 text-sm leading-relaxed"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-3 text-start">
                <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <strong>خطوة المراجعة والتفاوض:</strong> فور إرسالك للاقتراح، ستقوم إدارة جسوركم بدراسة المقترح وتقديم
                  العرض المالي الرسمي. ستتمكن من مراجعته وقبوله أو تقديم عرض مقابل مباشرة عبر لوحة التحكم.
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-9 h-12 shadow-lg shadow-amber-500/20 text-base"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin me-2" />
                      جاري الإرسال للمراجعة...
                    </>
                  ) : (
                    <>
                      إرسال للمراجعة والدخول للوحة التحكم
                      <Send className="w-4 h-4 ms-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
};

export default TeacherPayoutSetupPage;
