import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Landmark,
  ShieldCheck,
  BookOpen,
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
  Mail,
  FileText,
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
  sendLifecycleEmail,
  OnboardingResource,
  DEFAULT_TEACHER_POLICIES,
  DEFAULT_TEACHER_TIPS,
  DEFAULT_TEACHING_APPS,
  DEFAULT_TUTORIAL_VIDEOS,
  DEFAULT_OFFICIAL_TEMPLATE,
} from '@/lib/teacherLifecycleService';

const SAUDI_BANKS = [
  'مصرف الراجحي (Al Rajhi Bank)',
  'البنك الأهلي السعودي (SNB)',
  'مصرف الإنماء (Alinma Bank)',
  'بنك الرياض (Riyad Bank)',
  'بنك البلاد (Bank Albilad)',
  'البنك السعودي الأول (SAB)',
  'البنك العربي الوطني (ANB)',
  'بنك الجزيرة (Bank AlJazira)',
  'البنك السعودي للاستثمار (SAIB)',
  'بنك الخليج الدولي (GIB)',
  'أخرى (بنوك دولية / خليجية)',
];

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

  // Step 2: Resources State
  const [resources, setResources] = useState<OnboardingResource[]>([]);
  const [hasDownloadedTemplate, setHasDownloadedTemplate] = useState(false);
  const [selectedGuideModal, setSelectedGuideModal] = useState<OnboardingResource | null>(null);

  // Step 3: Policy Agreement & Digital Signature State
  const [hasAgreedPolicies, setHasAgreedPolicies] = useState(false);
  const [signedFullName, setSignedFullName] = useState('');
  const [signedEmail, setSignedEmail] = useState('');
  const [signedContractUrl, setSignedContractUrl] = useState<string | null>(null);

  // Success Banner / Modal State
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Initial Load
  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const name = profile?.full_name || user.user_metadata?.full_name || 'معلم جسوركم';
        const email = profile?.email || user.email || '';
        setSignedFullName(name);
        setSignedEmail(email);

        const existingBank = await getTeacherBankDetails(user.id);
        if (existingBank) {
          setAccountNumber(existingBank.account_number || '');
          setIban(existingBank.iban || '');
          setBankName(existingBank.bank_name || '');
          setBranchName(existingBank.branch_name || '');
          setSwiftCode(existingBank.swift_code || '');
        }

        const resList = await getOnboardingResources();
        setResources(resList);
      } catch (err) {
        console.error('Error initializing teacher onboarding:', err);
      } finally {
        setInitialLoading(false);
      }
    }
    loadData();
  }, [user, profile]);

  const handleIbanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatIBAN(raw);
    setIban(formatted);

    const validation = validateIBAN(formatted);
    if (!validation.isValid && formatted.length >= 10) {
      setIbanError(validation.message || 'صيغة الآيبان غير صحيحة');
    } else {
      setIbanError(null);
    }
  };

  const handleSaveBankStep = async () => {
    if (!user) return;

    const validation = validateIBAN(iban);
    if (!validation.isValid) {
      setIbanError(validation.message || 'يرجى إدخال رقم آيبان صحيح');
      toast.error(validation.message || 'يرجى التأكد من صحة رقم الآيبان');
      return;
    }
    if (!accountNumber.trim()) {
      toast.error('يرجى إدخال رقم الحساب البنكي');
      return;
    }
    if (!bankName.trim()) {
      toast.error('يرجى اختيار اسم البنك');
      return;
    }

    setLoading(true);
    try {
      await saveTeacherBankDetails({
        teacher_id: user.id,
        account_number: accountNumber.trim(),
        iban: iban.trim(),
        bank_name: bankName.trim(),
        branch_name: branchName.trim() || 'الرئيسي',
        swift_code: swiftCode.trim() || 'SAUDI_BANK',
        verified_by_admin: false,
      });

      // Send email receipt for bank info
      const userEmail = profile?.email || user.email || '';
      const userName = profile?.full_name || signedFullName;
      if (userEmail) {
        sendLifecycleEmail({
          type: 'teacher_bank_submitted',
          toEmail: userEmail,
          toName: userName,
          bankName: bankName.trim(),
          iban: iban.trim(),
          userId: user.id,
        }).catch(() => {});
      }

      toast.success('تم حفظ بيانات الحساب البنكي بنجاح');
      setCurrentStep(2);
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء حفظ البيانات البنكية');
    } finally {
      setLoading(false);
    }
  };

  const handleSignContractStep = async () => {
    if (!user) return;

    if (!hasAgreedPolicies) {
      toast.error('يرجى تأكيد الموافقة على جميع الشروط والسياسات الأكاديمية');
      return;
    }
    if (!signedFullName.trim()) {
      toast.error('يرجى كتابة الاسم الثلاثي الكامل للتوقيع الرقمي');
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
      setShowCompletionModal(true);

      toast.success('تم توثيق التوقيع الرقمي وإرسال العقد لبريدك الإلكتروني');
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء توثيق العقد');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800" dir={dir}>
        <Loader2 className="h-10 w-10 animate-spin text-amber-600 mb-4" />
        <p className="font-semibold text-slate-600">جاري تحميل بوابة تأهيل المعلم...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 relative selection:bg-amber-100 selection:text-amber-900" dir={dir}>
      {/* Top Header Navbar */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 text-white font-black text-xl">
              ج
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-lg tracking-wide">منصة جسوركم</span>
                <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 text-xs font-semibold">
                  بوابة المعلم
                </Badge>
              </div>
              <p className="text-xs text-slate-500 font-medium">الاعتماد الأكاديمي والتوثيق الرقمي الموحد</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-left text-xs text-slate-500">
              <span className="font-semibold text-slate-800">{signedFullName || user?.email}</span>
              <span className="text-[11px] text-slate-400">معلم معتمد</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/instructor')}
              className="border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
            >
              لوحة التحكم
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Welcome Hero Banner */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold mb-2 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            الخطوة 1 من 2: التوثيق البنكي والسياسات الأكاديمية
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            مرحباً بك في كادر معلمي منصة جسوركم الأكاديمية
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            يرجى إكمال خطوات الاعتماد الثلاث لإيداع أرباحك وتوثيق عقدك الرقمي واعتماد نموذج الشرح الرسمي.
          </p>
        </div>

        {/* Clean Light Stepper */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
          {[
            { step: 1, title: 'البيانات البنكية', desc: 'الحساب والتحويلات', icon: Landmark },
            { step: 2, title: 'المعايير وقالب الشرح', desc: 'الأدلة والمصادر', icon: BookOpen },
            { step: 3, title: 'السياسات والتوقيع', desc: 'العقد الرقمي المعتمد', icon: ShieldCheck },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = currentStep === item.step;
            const isCompleted = currentStep > item.step;

            return (
              <div
                key={item.step}
                className={`p-4 rounded-xl border transition-all duration-200 ${
                  isActive
                    ? 'bg-white border-amber-500 shadow-md ring-2 ring-amber-500/10'
                    : isCompleted
                    ? 'bg-emerald-50/50 border-emerald-200 text-slate-700'
                    : 'bg-white/60 border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-white shadow-sm'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="hidden sm:block text-start">
                    <p className={`text-xs md:text-sm font-bold ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-500">{item.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step 1: Bank Information */}
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                      <Landmark className="h-5 w-5 text-amber-700" />
                    </div>
                    <div>
                      <CardTitle className="text-lg md:text-xl font-bold text-slate-900">
                        البيانات البنكية لتحويل الأرباح الشهرية
                      </CardTitle>
                      <CardDescription className="text-slate-500 text-xs md:text-sm">
                        تُحول عوائد مبيعات مقرراتك الجامعية تلقائياً إلى هذا الحساب بحلول يوم 5 من كل شهر ميلادي.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 md:p-8 space-y-6">
                  <div className="grid md:grid-cols-2 gap-5">
                    {/* Bank Selection */}
                    <div className="space-y-2 text-start">
                      <Label className="text-slate-700 font-semibold text-xs md:text-sm">
                        اسم البنك المصرفي <span className="text-rose-500">*</span>
                      </Label>
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3.5 h-11 text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm font-medium"
                      >
                        <option value="">اختر البنك...</option>
                        {SAUDI_BANKS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Account Number */}
                    <div className="space-y-2 text-start">
                      <Label className="text-slate-700 font-semibold text-xs md:text-sm">
                        رقم الحساب البنكي <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder="مثال: 1020304050"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-amber-500/20 h-11"
                      />
                    </div>

                    {/* IBAN */}
                    <div className="space-y-2 md:col-span-2 text-start">
                      <div className="flex items-center justify-between">
                        <Label className="text-slate-700 font-semibold text-xs md:text-sm">
                          رقم الآيبان الدولي (IBAN) <span className="text-rose-500">*</span>
                        </Label>
                        <span className="text-[11px] text-slate-500 font-mono">SA + 22 رقماً</span>
                      </div>
                      <Input
                        type="text"
                        placeholder="SA00 0000 0000 0000 0000 0000"
                        value={iban}
                        onChange={handleIbanChange}
                        maxLength={34}
                        className={`bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-amber-500/20 h-11 font-mono text-base ${
                          ibanError ? 'border-rose-400 focus:border-rose-500' : ''
                        }`}
                        dir="ltr"
                      />
                      {ibanError && <p className="text-xs text-rose-600 font-medium">{ibanError}</p>}
                    </div>

                    {/* Swift Code */}
                    <div className="space-y-2 text-start">
                      <Label className="text-slate-700 font-semibold text-xs md:text-sm">
                        رمز السويفت (SWIFT / BIC) <span className="text-slate-400 font-normal">(اختياري)</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder="مثال: RJHIXXXX"
                        value={swiftCode}
                        onChange={(e) => setSwiftCode(e.target.value.toUpperCase())}
                        className="bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-amber-500/20 h-11 font-mono uppercase"
                        dir="ltr"
                      />
                    </div>

                    {/* Branch */}
                    <div className="space-y-2 text-start">
                      <Label className="text-slate-700 font-semibold text-xs md:text-sm">
                        اسم الفرع / المدينة <span className="text-slate-400 font-normal">(اختياري)</span>
                      </Label>
                      <Input
                        type="text"
                        placeholder="مثال: الرياض - الفرع الرئيسي"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        className="bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-amber-500/20 h-11"
                      />
                    </div>
                  </div>

                  {/* Security Notice Card */}
                  <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-start gap-3 text-start">
                    <ShieldCheck className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 leading-relaxed font-medium">
                      بياناتك المصرفية مشفرة بالكامل طبقاً لأعلى معايير الحماية والأمان المالي، وتستخدم حصرياً لإيداع أرباحك وإشعارات التحويل البنكي المعتمدة.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleSaveBankStep}
                      disabled={loading}
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold px-8 h-11 shadow-sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          جاري الحفظ والتحقق...
                        </>
                      ) : (
                        <>
                          حفظ ومتابعة للمصادر وقالب الشرح
                          <ArrowLeft className="mr-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Resources & Official Template */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-amber-700" />
                    </div>
                    <div>
                      <CardTitle className="text-lg md:text-xl font-bold text-slate-900">
                        الأدلة والمعايير الأكاديمية وقالب الشرح الرسمي
                      </CardTitle>
                      <CardDescription className="text-slate-500 text-xs md:text-sm">
                        يرجى الاطلاع على معايير الجودة وتنزيل قالب الشرح المعتمد لمنصة جسوركم.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 md:p-8 space-y-6">
                  {/* Official PowerPoint Template Card */}
                  <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-start shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-600 text-white text-[11px]">قالب معتمد 16:9</Badge>
                        <span className="font-bold text-slate-900 text-sm md:text-base">
                          {DEFAULT_OFFICIAL_TEMPLATE.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                        {DEFAULT_OFFICIAL_TEMPLATE.description}
                      </p>
                    </div>

                    <a
                      href={DEFAULT_OFFICIAL_TEMPLATE.downloadUrl}
                      download
                      onClick={() => setHasDownloadedTemplate(true)}
                      className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
                    >
                      <Download className="h-4 w-4" />
                      تنزيل القالب الرسمي PPTX
                    </a>
                  </div>

                  {/* Guides & Educational Standards */}
                  <div className="space-y-3 text-start">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-600" />
                      أدلة المعايير الأكاديمية وهندسة التسجيل
                    </h3>

                    <div className="grid md:grid-cols-3 gap-4">
                      {DEFAULT_TUTORIAL_VIDEOS.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between hover:border-amber-300 hover:bg-white transition-all shadow-2xs group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="border-slate-300 text-slate-600 text-[10px]">
                                {item.tag}
                              </Badge>
                              {item.isMandatory && (
                                <Badge className="bg-amber-100 text-amber-800 text-[10px] font-semibold border-amber-200">
                                  إلزامي
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-bold text-slate-900 text-xs md:text-sm group-hover:text-amber-700 transition-colors">
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed">
                              {item.description}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 mt-3">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800"
                            >
                              عرض وتنزيل الدليل PDF
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Apps */}
                  <div className="space-y-3 text-start">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Laptop className="h-4 w-4 text-amber-600" />
                      البرامج والتطبيقات الموصى بها لتسجيل المحاضرات
                    </h3>

                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {DEFAULT_TEACHING_APPS.map((app) => (
                        <a
                          key={app.id}
                          href={app.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-xs transition-all flex flex-col justify-between text-start group"
                        >
                          <div className="space-y-1">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[10px] mb-1">
                              {app.tag}
                            </Badge>
                            <p className="font-bold text-xs text-slate-900 group-hover:text-amber-600 transition-colors">
                              {app.title}
                            </p>
                            <p className="text-[11px] text-slate-500 line-clamp-2">{app.description}</p>
                          </div>
                          <div className="pt-2 text-[10px] font-semibold text-slate-400 group-hover:text-amber-600 flex items-center gap-1 mt-2">
                            زيارة الموقع الرسمي <ExternalLink className="h-2.5 w-2.5" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      <ArrowRight className="ml-2 h-4 w-4" />
                      السابق
                    </Button>

                    <Button
                      onClick={() => setCurrentStep(3)}
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold px-8 h-11 shadow-sm"
                    >
                      متابعة للسياسات والتوقيع الرقمي
                      <ArrowLeft className="mr-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Policies & Digital Signature */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                      <ShieldCheck className="h-5 w-5 text-amber-700" />
                    </div>
                    <div>
                      <CardTitle className="text-lg md:text-xl font-bold text-slate-900">
                        اتفاقية التدريس والسياسات الأكاديمية والتوقيع الرقمي
                      </CardTitle>
                      <CardDescription className="text-slate-500 text-xs md:text-sm">
                        يرجى قراءة بنود الاتفاقية الخمس وتوثيق توقيعك الرقمي المعتمد قانونياً.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 md:p-8 space-y-6">
                  {/* Policies Accordion / Scroll Box */}
                  <div className="space-y-3 max-h-[380px] overflow-y-auto p-4 rounded-xl bg-slate-50/80 border border-slate-200 text-start pr-2">
                    {DEFAULT_TEACHER_POLICIES.map((p, idx) => (
                      <div key={p.id} className="p-3.5 rounded-lg bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs md:text-sm text-slate-900">
                            {idx + 1}. {p.title}
                          </span>
                          <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-500">
                            المعيار {idx + 1}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{p.content}</p>
                      </div>
                    ))}
                  </div>

                  {/* Digital Signature Confirmation Form */}
                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-start">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="agreePolicies"
                        checked={hasAgreedPolicies}
                        onCheckedChange={(checked) => setHasAgreedPolicies(!!checked)}
                        className="mt-1 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                      <label htmlFor="agreePolicies" className="text-xs md:text-sm font-semibold text-slate-800 leading-relaxed cursor-pointer select-none">
                        أقر وأوافق بصفتي معلماً معتمداً على كافة السياسات والمعايير الأكاديمية أعلاه، وأفوض منصة جسوركم بإصدار وثيقة العقد الرقمي الموثقة بالبصمة الإلكترونية.
                      </label>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">
                          الاسم الثلاثي الكامل للتوقيع الرقمي <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          type="text"
                          placeholder="الاسم الثلاثي المعتمد"
                          value={signedFullName}
                          onChange={(e) => setSignedFullName(e.target.value)}
                          className="bg-white border-slate-300 text-slate-900 font-semibold h-10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">البريد الإلكتروني المعتمد</Label>
                        <Input
                          type="text"
                          value={signedEmail}
                          disabled
                          className="bg-slate-100 border-slate-300 text-slate-500 font-mono text-xs h-10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      className="border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      <ArrowRight className="ml-2 h-4 w-4" />
                      السابق
                    </Button>

                    <Button
                      onClick={handleSignContractStep}
                      disabled={loading || !hasAgreedPolicies || !signedFullName.trim()}
                      className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold px-8 h-11 shadow-sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          جاري توثيق العقد وإرسال الإيميل...
                        </>
                      ) : (
                        <>
                          اعتماد التوقيع وتوثيق العقد رسمياً
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Stage 1 Completion Modal & Next Step Redirection */}
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
                تم استكمال الخطوة الأولى بنجاح
              </Badge>
              <h3 className="text-xl md:text-2xl font-black text-slate-900">
                تهانينا أستاذنا الفاضل!
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                تم بنجاح توثيق بياناتك البنكية واعتماد توقيعك الرقمي على السياسات والمعايير الأكاديمية لمنصة جسوركم.
              </p>
            </div>

            {/* Email notice alert box */}
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-start flex items-start gap-3">
              <Mail className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <p className="font-bold">✉️ تم إرسال رسالة تأكيد إلى بريدك الإلكتروني:</p>
                <p className="font-mono text-[11px] text-amber-800">{signedEmail}</p>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  تتضمن الرسالة تفاصيل حسابك البنكي ورابط تنزيل نسختك المعتمدة من العقد الرقمي.
                </p>
              </div>
            </div>

            {signedContractUrl && (
              <div className="flex justify-center">
                <a
                  href={signedContractUrl}
                  download="عقد_معلم_معتمد_جسوركم.pdf"
                  className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  تحميل نسخة من العقد الرقمي الموثق (PDF)
                </a>
              </div>
            )}

            <div className="pt-2">
              <Button
                onClick={() => navigate('/teacher/payout-setup')}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold h-12 text-base shadow-md shadow-amber-500/20"
              >
                المتابعة إلى تحديد نموذج الأرباح والنسبة (الخطوة 2 من 2)
                <ArrowLeft className="mr-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default TeacherOnboardingPage;
