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
  getPayoutNegotiations,
  sendTeacherCounterOffer,
  finalizeAgreedPayout,
  TeacherPayoutSettings,
  TeacherBankDetails,
  PayoutNegotiationMessage,
} from '@/lib/teacherLifecycleService';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const TeacherFinancialStatusCard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [payoutSettings, setPayoutSettings] = useState<TeacherPayoutSettings | null>(null);
  const [bankDetails, setBankDetails] = useState<TeacherBankDetails | null>(null);
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
      const [settings, bank, msgs] = await Promise.all([
        getTeacherPayoutSettings(user.id),
        getTeacherBankDetails(user.id),
        getPayoutNegotiations(user.id),
      ]);
      setPayoutSettings(settings);
      setBankDetails(bank);
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

  // Handle Teacher Sending Counter-Offer / Reply to Admin
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

  // Handle Teacher Accepting Admin Offer
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
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">معتمد ونافذ</Badge>;
      case 'offer_sent':
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">وصلك عرض من الإدارة</Badge>;
      case 'in_negotiation':
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40">جاري التفاوض</Badge>;
      default:
        return <Badge className="bg-slate-800 text-slate-300 border-slate-700">قيد المراجعة</Badge>;
    }
  };

  const getPayoutTypeLabel = (type?: string | null) => {
    switch (type) {
      case 'fixed_per_course':
        return 'مبلغ مقطوع عن الدورة كاملة';
      case 'percentage':
        return 'نسبة محددة من مبيعات الدورة';
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
      <Card className="bg-gradient-to-br from-slate-900/90 via-slate-900 to-slate-950 border-slate-800 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 end-0 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        <CardHeader className="border-b border-slate-800/80 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-start">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base md:text-lg text-white flex items-center gap-2">
                  <span>الحالة المالية واتفاقية الأرباح</span>
                  {payoutSettings && getStatusBadge(payoutSettings.status)}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  نموذج احتساب وتوزيع مستحقاتك البنكية المعتمدة للدورات
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-xs h-9"
              >
                <MessageSquare className="w-3.5 h-3.5 me-1.5" />
                غرفة التفاوض المباشر
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-6 text-start">
            {/* Column 1: Agreed or Requested Payout Model */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <span className="text-xs text-slate-400 block font-medium">النموذج المالي المعتمد</span>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <TypeIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {getPayoutTypeLabel(payoutSettings?.agreed_type || payoutSettings?.requested_type)}
                  </h4>
                  <div className="text-xs text-amber-400 font-semibold mt-0.5">
                    {payoutSettings?.agreed_type || payoutSettings?.requested_type === 'fixed_per_course'
                      ? `${payoutSettings?.fixed_amount || 0} ر.س / للدورة`
                      : payoutSettings?.agreed_type || payoutSettings?.requested_type === 'percentage'
                      ? `${payoutSettings?.percentage_rate || 60}% من كل اشتراك`
                      : `${payoutSettings?.fixed_amount || 0} ر.س + ${payoutSettings?.percentage_rate || 0}%`}
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Bank Account Overview */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">الحساب البنكي المعتمد</span>
                {bankDetails?.verified_by_admin ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">موثق من الإدارة</Badge>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-300 text-[10px]">قيد التدقيق</Badge>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Landmark className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-sm font-bold text-white truncate">{bankDetails?.bank_name || 'لم يُحدد البنك'}</h4>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    {bankDetails?.iban || 'الآيبان غير مكتمل'}
                  </p>
                </div>
              </div>
            </div>

            {/* Column 3: Payout Cycle & Quick Navigation */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-400 block font-medium">دورة التحويل المالي</span>
                <div className="text-xs text-slate-300 mt-1 leading-relaxed">
                  تُحول المستحقات تلقائياً بحلول <strong>اليوم الخامس من كل شهر ميلادي</strong> لحسابك الموثق.
                </div>
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate('/teacher/onboarding')}
                className="text-amber-400 hover:text-amber-300 text-xs p-0 h-auto self-start"
              >
                تحديث بيانات البنك أو السياسات &larr;
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Negotiation Room & Direct Chat Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-100 max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="border-b border-slate-800 pb-4 text-start">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <DialogTitle className="text-lg font-bold text-white">غرفة التفاوض المالي المباشر مع الإدارة</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-400">
              قناة رسمية مباشرة بينك وبين إدارة جسوركم للاتفاق على الأرقام والعوائد المالية للدورات.
            </DialogDescription>
          </DialogHeader>

          {/* Chat / Negotiation History */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-2">
            {negotiations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                لا توجد رسائل سابقة. يمكنك بدء الحوار أو تقديم مقترحك المالي للإدارة أدناه.
              </div>
            ) : (
              negotiations.map((msg, idx) => {
                const isAdmin = msg.sender_type === 'admin';

                return (
                  <div
                    key={msg.id || idx}
                    className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-start text-xs leading-relaxed space-y-2 ${
                        isAdmin
                          ? 'bg-slate-900 border border-slate-800 text-slate-200'
                          : 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 border-b border-slate-800/60 pb-1.5 text-[11px]">
                        <span className="font-bold text-white">
                          {isAdmin ? 'إدارة منصة جسوركم الأكاديمية' : 'أنت (المعلم)'}
                        </span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('ar-SA') : ''}
                        </span>
                      </div>

                      {/* If offer numbers attached */}
                      {(msg.proposed_fixed || msg.proposed_percentage) && (
                        <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] font-mono text-emerald-400">
                          {msg.proposed_fixed ? `المبلغ المقترح: ${msg.proposed_fixed} ر.س | ` : ''}
                          {msg.proposed_percentage ? `النسبة المقترحة: ${msg.proposed_percentage}%` : ''}
                        </div>
                      )}

                      <p className="whitespace-pre-line">{msg.message}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Admin Offer Confirmation Section if offer_sent */}
          {payoutSettings?.status === 'offer_sent' && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 mb-4 text-start flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-400 block">عرض الإدارة الحالي متاح للاعتماد:</span>
                <span className="text-sm font-bold text-white">
                  {payoutSettings.fixed_amount ? `${payoutSettings.fixed_amount} ر.س ` : ''}
                  {payoutSettings.percentage_rate ? `بنسبة ${payoutSettings.percentage_rate}%` : ''}
                </span>
              </div>
              <Button
                onClick={handleAcceptAdminOffer}
                disabled={acceptingOffer}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs h-9 px-4"
              >
                {acceptingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : 'الموافقة واعتماد الاتفاق النهائي'}
              </Button>
            </div>
          )}

          {/* Counter-Offer / Reply Form */}
          <form onSubmit={handleSendCounter} className="pt-3 border-t border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-start">
              <div>
                <Input
                  type="number"
                  placeholder="المبلغ المقابل (ر.س)"
                  value={counterFixed}
                  onChange={(e) => setCounterFixed(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white text-xs h-9"
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="النسبة المقابلة (%)"
                  value={counterPercentage}
                  onChange={(e) => setCounterPercentage(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white text-xs h-9"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Textarea
                rows={2}
                placeholder="اكتب رسالتك للإدارة أو قدم مبرراتك للعرض المقابل..."
                value={counterMessage}
                onChange={(e) => setCounterMessage(e.target.value)}
                required
                className="bg-slate-900 border-slate-800 text-white text-xs leading-relaxed"
              />
              <Button
                type="submit"
                disabled={submittingCounter}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 h-auto"
              >
                {submittingCounter ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
