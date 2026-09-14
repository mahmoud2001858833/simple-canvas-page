import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Landmark,
  Percent,
  Banknote,
  Layers,
  MessageSquare,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Send,
  Loader2,
  Coins,
  RefreshCw,
  Sparkles,
  AlertCircle,
  FileText,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  getTeacherPayoutSettings,
  getTeacherBankDetails,
  getTeacherContract,
  getPayoutNegotiations,
  sendTeacherCounterOffer,
  finalizeAgreedPayout,
  TeacherPayoutSettings,
  TeacherBankDetails,
  TeacherContract,
  PayoutNegotiationMessage,
} from '@/lib/teacherLifecycleService';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const TeacherFinancialStatusCard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [payoutSettings, setPayoutSettings] = useState<TeacherPayoutSettings | null>(null);
  const [bankDetails, setBankDetails] = useState<TeacherBankDetails | null>(null);
  const [contract, setContract] = useState<TeacherContract | null>(null);
  const [negotiations, setNegotiations] = useState<PayoutNegotiationMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Negotiation Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [counterMessage, setCounterMessage] = useState('');
  const [counterFixed, setCounterFixed] = useState('');
  const [counterPercentage, setCounterPercentage] = useState('');
  const [submittingCounter, setSubmittingCounter] = useState(false);
  const [acceptingOffer, setAcceptingOffer] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [settings, bank, ctr, msgs] = await Promise.all([
        getTeacherPayoutSettings(user.id),
        getTeacherBankDetails(user.id),
        getTeacherContract(user.id),
        getPayoutNegotiations(user.id),
      ]);
      setPayoutSettings(settings);
      setBankDetails(bank);
      setContract(ctr);
      setNegotiations(msgs);
    } catch (e) {
      console.error('Error fetching financial status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleSendCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !counterMessage.trim()) {
      toast.error('يرجى كتابة رسالة توضيحية للإدارة');
      return;
    }

    setSubmittingCounter(true);
    try {
      await sendTeacherCounterOffer({
        teacherId: user.id,
        message: counterMessage.trim(),
        proposedFixed: counterFixed ? Number(counterFixed) : undefined,
        proposedPercentage: counterPercentage ? Number(counterPercentage) : undefined,
      });

      toast.success('تم إرسال ردك وعرضك المقابل للإدارة بنجاح');
      setCounterMessage('');
      setCounterFixed('');
      setCounterPercentage('');
      await loadData();
    } catch (err) {
      toast.error('حدث خطأ أثناء الإرسال');
    } finally {
      setSubmittingCounter(false);
    }
  };

  const handleAcceptAdminOffer = async () => {
    if (!user || !payoutSettings) return;

    setAcceptingOffer(true);
    try {
      await finalizeAgreedPayout({
        teacherId: user.id,
        agreedType: payoutSettings.agreed_type || payoutSettings.requested_type,
        fixedAmount: payoutSettings.fixed_amount,
        percentageRate: payoutSettings.percentage_rate,
        notes: 'تمت موافقة المعلم على عرض الإدارة النهائي',
        teacherEmail: profile?.email || user.email,
        teacherName: profile?.full_name || 'معلم معتمد',
      });

      toast.success('تهانينا! تم اعتماد وتفعيل الاتفاق المالي رسمياً.');
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error('حدث خطأ أثناء الاعتماد');
    } finally {
      setAcceptingOffer(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'agreed':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">معتمد ونافذ</Badge>;
      case 'offer_sent':
        return <Badge className="bg-amber-50 text-amber-800 border-amber-300 font-bold animate-pulse">وصلك عرض من الإدارة</Badge>;
      case 'in_negotiation':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">قيد التفاوض</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">قيد المراجعة</Badge>;
    }
  };

  const getPayoutTypeLabel = (type?: string | null) => {
    switch (type) {
      case 'fixed_per_course':
        return 'مبلغ مقطوع عن الدورة كاملة';
      case 'percentage':
        return 'نسبة مئوية من مبيعات الدورة';
      case 'hybrid':
        return 'نموذج هجين (مبلغ مقطوع + نسبة)';
      default:
        return 'لم يتم التحديد بعد';
    }
  };

  const getPayoutTypeIcon = (type?: string | null) => {
    switch (type) {
      case 'fixed_per_course':
        return Banknote;
      case 'percentage':
        return Percent;
      case 'hybrid':
        return Layers;
      default:
        return Wallet;
    }
  };

  const TypeIcon = getPayoutTypeIcon(payoutSettings?.agreed_type || payoutSettings?.requested_type);

  return (
    <>
      <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden relative">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-start">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base md:text-lg text-slate-900 font-bold flex items-center gap-2">
                  <span>الحالة المالية واتفاقية الأرباح</span>
                  {payoutSettings && getStatusBadge(payoutSettings.status)}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  نموذج احتساب وتوزيع مستحقاتك البنكية المعتمدة للدورات
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="border-slate-200 text-slate-600 hover:bg-slate-100 h-8"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>

              {payoutSettings?.status === 'offer_sent' && (
                <Button
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-8 text-xs shadow-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5 ml-1.5" />
                  مراجعة عرض الإدارة
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 md:p-6 space-y-5">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Model Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-start space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold">نموذج الأرباح</span>
                <TypeIcon className="w-4 h-4 text-amber-600" />
              </div>
              <p className="font-bold text-slate-900 text-sm">
                {getPayoutTypeLabel(payoutSettings?.agreed_type || payoutSettings?.requested_type)}
              </p>
              <div className="pt-1">
                {payoutSettings?.percentage_rate && (
                  <span className="text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono">
                    نسبتك: {payoutSettings.percentage_rate}%
                  </span>
                )}
                {payoutSettings?.fixed_amount && (
                  <span className="text-xs font-black text-slate-800 bg-slate-200/70 px-2 py-0.5 rounded font-mono mr-1">
                    {payoutSettings.fixed_amount.toLocaleString()} ر.س
                  </span>
                )}
              </div>
            </div>

            {/* Bank Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-start space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold">الحساب البنكي المعتمد</span>
                <Landmark className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="font-bold text-slate-900 text-sm">
                {bankDetails?.bank_name || 'غير مسجل بعد'}
              </p>
              <p className="text-xs text-slate-600 font-mono" dir="ltr">
                {bankDetails?.iban ? `${bankDetails.iban.slice(0, 4)} **** ${bankDetails.iban.slice(-4)}` : 'SA-- ---- ----'}
              </p>
            </div>

            {/* Contract & Fast Links Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-start flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-semibold">العقد والسياسات</span>
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                </div>
                <p className="font-bold text-slate-900 text-sm">
                  {contract ? 'عقد موثق بالبصمة' : 'مسودة قيد التوثيق'}
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/teacher/onboarding')}
                  className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-7 px-2.5"
                >
                  تعديل البيانات
                </Button>
                {contract?.contract_pdf_url && (
                  <a
                    href={contract.contract_pdf_url}
                    download="عقد_معلم_جسوركم.pdf"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200"
                  >
                    <Download className="w-3 h-3" />
                    تحميل العقد
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Negotiation Room Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl bg-white border border-slate-200 text-slate-900 p-6 rounded-2xl">
          <DialogHeader className="text-start">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-600" />
              غرفة المفاوضة والتوافق المالي
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              مراجعة عرض الإدارة المالية الخاص بعوائد مقرراتك، وإمكانية القبول المباشر أو تقديم عرض مقابل.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            {/* Current Proposed Offer */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-start space-y-2">
              <span className="text-xs font-bold text-amber-800">العرض المقترح حالياً:</span>
              <div className="flex flex-wrap items-center gap-2">
                {payoutSettings?.percentage_rate && (
                  <Badge className="bg-amber-600 text-white font-mono text-sm px-3 py-1">
                    نسبة: {payoutSettings.percentage_rate}%
                  </Badge>
                )}
                {payoutSettings?.fixed_amount && (
                  <Badge className="bg-slate-800 text-white font-mono text-sm px-3 py-1">
                    المبلغ: {payoutSettings.fixed_amount.toLocaleString()} ر.س
                  </Badge>
                )}
              </div>
            </div>

            {/* Chat / Negotiation Log */}
            <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-start">
              {negotiations.length === 0 ? (
                <p className="text-slate-400 text-center py-4">لا توجد رسائل سابقة في المفاوضة.</p>
              ) : (
                negotiations.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2.5 rounded-lg max-w-[85%] ${
                      msg.sender_type === 'admin'
                        ? 'bg-white border border-slate-200 text-slate-800 ms-auto'
                        : 'bg-amber-100/70 border border-amber-200 text-amber-900 me-auto'
                    }`}
                  >
                    <p className="font-bold mb-1 text-[11px] text-slate-500">
                      {msg.sender_type === 'admin' ? 'الإدارة المالية' : 'أنت'}
                    </p>
                    <p>{msg.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Quick Accept Offer Button */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-start">
              <div>
                <p className="font-bold text-emerald-900 text-xs md:text-sm">هل يناسبك هذا العرض؟</p>
                <p className="text-[11px] text-emerald-700">اعتماد العرض يفعّل حسابك فوراً للبدء برفع المحتوى.</p>
              </div>
              <Button
                onClick={handleAcceptAdminOffer}
                disabled={acceptingOffer}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 shadow-xs"
              >
                {acceptingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : 'الموافقة وتفعيل الحساب'}
              </Button>
            </div>

            {/* Counter-Offer Form */}
            <form onSubmit={handleSendCounter} className="space-y-3 pt-2 text-start border-t border-slate-100">
              <Label className="text-xs font-bold text-slate-700">أو قدّم عرضاً مقابلاً (Counter-Offer):</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="النسبة المطلوبة %"
                  value={counterPercentage}
                  onChange={(e) => setCounterPercentage(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 text-xs h-9"
                />
                <Input
                  type="number"
                  placeholder="أو مبلغ مقطوع (ر.س)"
                  value={counterFixed}
                  onChange={(e) => setCounterFixed(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 text-xs h-9"
                />
              </div>
              <Textarea
                placeholder="اكتب رسالتك للإدارة بشأن مبررات العرض المقابل..."
                value={counterMessage}
                onChange={(e) => setCounterMessage(e.target.value)}
                className="bg-white border-slate-300 text-slate-900 text-xs min-h-[60px]"
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={submittingCounter}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold h-9 px-4"
                >
                  {submittingCounter ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'إرسال العرض المقابل'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TeacherFinancialStatusCard;
