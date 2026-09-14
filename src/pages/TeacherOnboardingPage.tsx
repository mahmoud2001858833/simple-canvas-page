import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Landmark,
  ShieldCheck,
  BookOpen,
  Play,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Building2,
  CreditCard,
  Tv,
  Lightbulb,
  Laptop,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  validateIBAN,
  formatIBAN,
  saveTeacherBankDetails,
  getTeacherBankDetails,
  signTeacherPolicyContract,
  getOnboardingResources,
  OnboardingResource,
  DEFAULT_TEACHER_POLICIES,
  DEFAULT_TEACHER_TIPS,
  DEFAULT_TEACHING_APPS,
  DEFAULT_TUTORIAL_VIDEOS,
  DEFAULT_OFFICIAL_TEMPLATE,
} from '@/lib/teacherLifecycleService';

export const TeacherOnboardingPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { dir } = useLanguage();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Step 1: Bank Details State
  const [accountNumber, setAccountNumber] = useState('');
  const [iban, setIban] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [ibanError, setIbanError] = useState<string | null>(null);

  // Step 2: Resources & Video State
  const [resources, setResources] = useState<OnboardingResource[]>([]);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string>('');
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string>('');
  const [hasDownloadedTemplate, setHasDownloadedTemplate] = useState(false);

  // Step 3: Policy Agreement & Digital Signature State
  const [hasAgreedPolicies, setHasAgreedPolicies] = useState(false);
  const [signedFullName, setSignedFullName] = useState('');
  const [signedEmail, setSignedEmail] = useState('');
  const [signedContractUrl, setSignedContractUrl] = useState<string | null>(null);

  // Initial Load
  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        // Set auto-filled name & email
        const name = profile?.full_name || user.user_metadata?.full_name || 'معلم جسوركم';
        const email = profile?.email || user.email || '';
        setSignedFullName(name);
        setSignedEmail(email);

        // Load existing bank details if any
        const existingBank = await getTeacherBankDetails(user.id);
        if (existingBank) {
          setAccountNumber(existingBank.account_number || '');
          setIban(existingBank.iban || '');
          setBankName(existingBank.bank_name || '');
          setBranchName(existingBank.branch_name || '');
          setSwiftCode(existingBank.swift_code || '');
        }

        // Load Resources
        const resList = await getOnboardingResources();
        setResources(resList);

        // Set initial active video (mandatory one)
        const mandatoryVid = resList.find((r) => r.type === 'video') || DEFAULT_TUTORIAL_VIDEOS[0];
        if (mandatoryVid) {
          setSelectedVideoUrl(mandatoryVid.url || DEFAULT_TUTORIAL_VIDEOS[0].url);
          setSelectedVideoTitle(mandatoryVid.title || DEFAULT_TUTORIAL_VIDEOS[0].title);
        }
      } catch (err) {
        console.error('Error loading onboarding data:', err);
      } finally {
        setInitialLoading(false);
      }
    }

    loadData();
  }, [user, profile]);

  // Handle Step 1: Submit Bank Details
  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!accountNumber.trim()) {
      toast.error('يرجى إدخال رقم الحساب البنكي');
      return;
    }

    const ibanCheck = validateIBAN(iban);
    if (!ibanCheck.isValid) {
      setIbanError(ibanCheck.message || 'رقم الآيبان غير صحيح');
      toast.error(ibanCheck.message || 'يرجى التحقق من صحة رقم الآيبان');
      return;
    }
    setIbanError(null);

    if (!bankName.trim()) {
      toast.error('يرجى تحديد اسم البنك');
      return;
    }

    setLoading(true);
    try {
      await saveTeacherBankDetails({
        teacher_id: user.id,
        account_number: accountNumber.trim(),
        iban: iban.trim(),
        bank_name: bankName.trim(),
        branch_name: branchName.trim() || undefined,
        swift_code: swiftCode.trim() || undefined,
        verified_by_admin: false,
      });

      toast.success('تم حفظ وتوثيق البيانات البنكية بنجاح!');
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ البيانات، يرجى المحاولة ثانية');
    } finally {
      setLoading(false);
    }
  };

  // Handle Template Download
  const handleDownloadTemplate = () => {
    setHasDownloadedTemplate(true);
    const link = document.createElement('a');
    link.href = DEFAULT_OFFICIAL_TEMPLATE.downloadUrl;
    link.setAttribute('download', 'josoorcom-lecture-template.pptx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('بدأ تحميل قالب الشرح الرسمي لمنصة جسوركم!');
  };

  // Handle Step 3: Sign Policy Contract
  const handleSignContract = async () => {
    if (!user) return;

    if (!hasAgreedPolicies) {
      toast.error('يجب الموافقة والإقرار بجميع بنود سياسة التدريس أولاً');
      return;
    }

    if (!signedFullName.trim() || !signedEmail.trim()) {
      toast.error('بيانات التوقيع الرقمي غير مكتملة');
      return;
    }

    setLoading(true);
    try {
      const { contract, pdfBlobUrl } = await signTeacherPolicyContract({
        teacherId: user.id,
        signedName: signedFullName.trim(),
        signedEmail: signedEmail.trim(),
      });

      setSignedContractUrl(pdfBlobUrl);
      toast.success('تم توثيق توقيعك الرقمي واعتمادك رسمياً في منصة جسوركم!');

      // Smooth transition to step 4: Payout Setup
      setTimeout(() => {
        navigate('/teacher/payout-setup');
      }, 1500);
    } catch (err) {
      toast.error('حدث خطأ أثناء اعتماد وتوقيع العقد');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100" dir={dir}>
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">جاري تجهيز مسار اعتماد المعلم الأكاديمي...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden" dir={dir}>
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[550px] h-[550px] bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 relative z-10">
        {/* Header Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            بوابة اعتماد الكادر الأكاديمي (Josoorcom Certified Faculty)
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            استكمال بيانات واعتماد المعلم
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto mt-2 text-sm md:text-base">
            أهلاً بك ضمن نخبة المعلمين في منصة جسوركم. يرجى إكمال المتطلبات النظامية والبنكية لتفعيل حسابك ونشر دوراتك.
          </p>
        </div>

        {/* Multi-Step Wizard Indicator */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { step: 1, title: 'البيانات البنكية', icon: Landmark },
            { step: 2, title: 'المصادر وقالب الشرح', icon: BookOpen },
            { step: 3, title: 'التوقيع الرقمي والسياسات', icon: ShieldCheck },
          ].map((item) => {
            const Icon = item.icon;
            const isCompleted = currentStep > item.step;
            const isCurrent = currentStep === item.step;

            return (
              <div
                key={item.step}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/5'
                    : isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                    isCompleted
                      ? 'bg-emerald-500 text-slate-950'
                      : isCurrent
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : <Icon className="w-5 h-5" />}
                </div>
                <div className="hidden sm:block text-start">
                  <div className="text-xs text-slate-400">الخطوة {item.step}</div>
                  <div className="text-xs md:text-sm font-semibold text-slate-200">{item.title}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Wizard Steps Content */}
        <AnimatePresence mode="wait">
          {/* STEP 1: Bank Details */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl shadow-2xl">
                <CardHeader className="border-b border-slate-800/80 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Landmark className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">البيانات البنكية لتحويل المستحقات الأكاديمية</CardTitle>
                      <CardDescription className="text-slate-400">
                        تُحول عوائد مبيعات ومستحقات الدورات لحسابك المعتمد دورياً وفق الأنظمة المالية المعمول بها.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleBankSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="bankName" className="text-slate-300 font-medium">
                          اسم البنك <span className="text-amber-400">*</span>
                        </Label>
                        <div className="relative">
                          <Building2 className="w-4 h-4 absolute end-3 top-3.5 text-slate-500" />
                          <Input
                            id="bankName"
                            placeholder="مثال: مصرف الراجحي، البنك الأهلي، بنك الإنماء"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            required
                            className="bg-slate-950/70 border-slate-800 text-white focus:border-amber-500 h-11"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="branchName" className="text-slate-300 font-medium">
                          الفرع / المدينة (اختياري)
                        </Label>
                        <Input
                          id="branchName"
                          placeholder="مثال: فرع الرياض الرئيسي، جدة"
                          value={branchName}
                          onChange={(e) => setBranchName(e.target.value)}
                          className="bg-slate-950/70 border-slate-800 text-white focus:border-amber-500 h-11"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accountNumber" className="text-slate-300 font-medium">
                        رقم الحساب البنكي <span className="text-amber-400">*</span>
                      </Label>
                      <div className="relative">
                        <CreditCard className="w-4 h-4 absolute end-3 top-3.5 text-slate-500" />
                        <Input
                          id="accountNumber"
                          placeholder="مثال: 123456789012"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          required
                          className="bg-slate-950/70 border-slate-800 text-white focus:border-amber-500 h-11 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="iban" className="text-slate-300 font-medium">
                          رقم الآيبان الدولي (IBAN) <span className="text-amber-400">*</span>
                        </Label>
                        <span className="text-xs text-slate-500">للحسابات السعودية يبدأ بـ SA (24 خانة)</span>
                      </div>
                      <Input
                        id="iban"
                        placeholder="SA00 0000 0000 0000 0000 0000"
                        value={iban}
                        onChange={(e) => {
                          const val = e.target.value;
                          setIban(formatIBAN(val));
                          if (ibanError) setIbanError(null);
                        }}
                        required
                        className={`bg-slate-950/70 border-slate-800 text-white focus:border-amber-500 h-11 font-mono tracking-wider text-base ${
                          ibanError ? 'border-red-500 focus:border-red-500' : ''
                        }`}
                      />
                      {ibanError && (
                        <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {ibanError}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="swiftCode" className="text-slate-300 font-medium">
                        رمز السويفت (SWIFT / BIC Code) (اختياري للتحويلات الدولية)
                      </Label>
                      <Input
                        id="swiftCode"
                        placeholder="مثال: RJHIXXXX"
                        value={swiftCode}
                        onChange={(e) => setSwiftCode(e.target.value.toUpperCase())}
                        className="bg-slate-950/70 border-slate-800 text-white focus:border-amber-500 h-11 font-mono uppercase"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>ضمان الحماية والسرية:</strong> تُشفر بياناتك البنكية بأعلى معايير الأمان المالي
                        (AES-256) وتُستخدم حصرياً لإيداع مستحقاتك الأكاديمية بحلول اليوم الخامس من كل شهر ميلادي.
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button
                        type="submit"
                        disabled={loading}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-8 h-11 shadow-lg shadow-amber-500/20"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin me-2" />
                            جاري الحفظ...
                          </>
                        ) : (
                          <>
                            حفظ ومتابعة للمصادر
                            <ArrowLeft className="w-4 h-4 ms-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 2: Resources & Video & Template */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              {/* Mandatory Intro Video Player */}
              <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl overflow-hidden shadow-2xl">
                <CardHeader className="border-b border-slate-800/80 pb-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Tv className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg md:text-xl text-white">
                          فيديو تعريفي إلزامي للمعلم
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                          {selectedVideoTitle || 'ماذا يميز منصة جسوركم عن باقي المنصات وكيف تستفيد كمعلم؟'}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs px-3 py-1 self-start sm:self-auto">
                      إلزامي للمشاهدة
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                  <div className="aspect-video w-full rounded-none sm:rounded-xl overflow-hidden bg-black/90 border border-slate-800 relative">
                    <iframe
                      src={selectedVideoUrl || 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'}
                      title="Tutorial Video"
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>

                  {/* Video Selector Pills */}
                  <div className="p-4 sm:p-0 sm:mt-5 flex flex-wrap gap-2">
                    {DEFAULT_TUTORIAL_VIDEOS.map((vid) => (
                      <button
                        key={vid.id}
                        type="button"
                        onClick={() => {
                          setSelectedVideoUrl(vid.url);
                          setSelectedVideoTitle(vid.title);
                        }}
                        className={`text-xs px-3 py-2 rounded-lg border transition-all text-start flex items-center gap-2 ${
                          selectedVideoTitle === vid.title
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Play className="w-3 h-3 text-amber-400" />
                        <span>{vid.title}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Official Lecture Template Download Banner */}
              <Card className="bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-emerald-500/10 border-amber-500/30 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 text-start">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30">
                        <Download className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">قالب الشرح الرسمي لمنصة جسوركم</h3>
                          <Badge className="bg-amber-500 text-slate-950 text-xs font-bold">معتمد 16:9</Badge>
                        </div>
                        <p className="text-sm text-slate-300 mt-1">
                          قم بتحميل قالب العرض التقديمي المعتمد والمصمم وفق الهوية البصرية لتوحيد مظهر الشروحات للطلاب.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleDownloadTemplate}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 h-12 flex-shrink-0 shadow-lg shadow-amber-500/20"
                    >
                      <Download className="w-4 h-4 me-2" />
                      تحميل القالب الرسمي (.PPTX)
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Teaching Tips & Guidelines */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-lg">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  <span>نصائح وإرشادات جسوركم للتدريس الاحترافي</span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {DEFAULT_TEACHER_TIPS.map((tip) => (
                    <div
                      key={tip.id}
                      className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 text-start space-y-2 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white">{tip.title}</h4>
                        <Badge className="bg-slate-800 text-amber-300 border-none text-[11px]">{tip.tag}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{tip.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Teaching Apps */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-lg">
                  <Laptop className="w-5 h-5 text-emerald-400" />
                  <span>التطبيقات المنصوح بها لتسجيل وإلقاء الدروس</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {DEFAULT_TEACHING_APPS.map((app) => (
                    <div
                      key={app.id}
                      className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between text-start hover:border-slate-700 transition-colors group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors">
                            {app.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{app.description}</p>
                      </div>
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 text-xs font-semibold text-amber-400 flex items-center gap-1 hover:underline self-start"
                      >
                        زيارة الموقع والتحميل
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Button */}
              <div className="flex justify-between items-center pt-6 border-t border-slate-800">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="border-slate-800 text-slate-300 hover:bg-slate-900"
                >
                  <ArrowRight className="w-4 h-4 me-2" />
                  الرجوع للبيانات البنكية
                </Button>

                <Button
                  onClick={() => {
                    setCurrentStep(3);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-8 h-11 shadow-lg shadow-amber-500/20"
                >
                  المتابعة للتوقيع الرقمي
                  <ArrowLeft className="w-4 h-4 ms-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Policy Agreement & Digital Signature */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl shadow-2xl">
                <CardHeader className="border-b border-slate-800/80 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-white">
                        اتفاقية وسياسات الانضمام لكادر المعلمين
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        يرجى قراءة البنود الأكاديمية والمهنية وتوثيق التوقيع الرقمي لاعتماد حسابك رسمياً.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Policies Clauses Box */}
                  <div className="space-y-4 max-h-[380px] overflow-y-auto p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-start pr-3">
                    {DEFAULT_TEACHER_POLICIES.map((clause, idx) => (
                      <div key={clause.id} className="border-b border-slate-900 pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-xs flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm font-bold text-white">{clause.title}</h4>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed ps-7">{clause.summary}</p>
                      </div>
                    ))}
                  </div>

                  {/* Agreement Checkbox */}
                  <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex items-start gap-3">
                    <Checkbox
                      id="policyCheck"
                      checked={hasAgreedPolicies}
                      onCheckedChange={(checked) => setHasAgreedPolicies(checked === true)}
                      className="mt-1 border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:text-slate-950"
                    />
                    <label htmlFor="policyCheck" className="text-xs md:text-sm text-slate-200 cursor-pointer leading-relaxed text-start">
                      <strong>أقر وأوافق:</strong> لقد قرأت وفهمت جميع الشروط والسياسات الأكاديمية والمالية المعمول بها في منصة جسوركم، وأتعهد بالالتزام التام بمعايير الجودة الفنية والملكية الفكرية وسرية البيانات طوال فترة نشاطي التعليمي في المنصة.
                    </label>
                  </div>

                  {/* Digital Signature Auto-filled Box */}
                  <div className="p-5 rounded-xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 space-y-4 text-start">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-xs uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4" />
                        حاوية التوقيع الرقمي الموثق (Digital Signature)
                      </span>
                      <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">تشفير معتمد</Badge>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">اسم المعلم الموقع كاملاً</Label>
                        <Input
                          value={signedFullName}
                          onChange={(e) => setSignedFullName(e.target.value)}
                          className="bg-slate-900 border-slate-700 text-white font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">البريد الإلكتروني المعتمد</Label>
                        <Input
                          value={signedEmail}
                          disabled
                          className="bg-slate-900/60 border-slate-800 text-slate-400 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>وقت التوقيع: {new Date().toLocaleString('ar-SA')}</span>
                      <span>البصمة الرقمية: SHA-256 Validated</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      className="border-slate-800 text-slate-300 hover:bg-slate-900"
                    >
                      <ArrowRight className="w-4 h-4 me-2" />
                      الرجوع للمصادر
                    </Button>

                    <Button
                      onClick={handleSignContract}
                      disabled={loading || !hasAgreedPolicies}
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-bold px-8 h-12 shadow-lg shadow-emerald-500/20 text-base"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin me-2" />
                          جاري توثيق التوقيع وتوليد العقد...
                        </>
                      ) : (
                        <>
                          الموافقة والتوقيع الرقمي
                          <CheckCircle2 className="w-5 h-5 ms-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TeacherOnboardingPage;
