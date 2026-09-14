import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Percent,
  Layers,
  Coins,
  Search,
  Filter,
  RefreshCw,
  Send,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  User,
  Mail,
  Phone,
  ArrowRight,
  Loader2,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  sendAdminPayoutOffer,
  finalizeAgreedPayout,
  getPayoutNegotiations,
  PayoutType,
  NegotiationStatus,
  PayoutNegotiationMessage,
  TeacherPayoutSettings,
} from '@/lib/teacherLifecycleService';

interface TeacherNegotiationItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  specialty?: string;
  settings: TeacherPayoutSettings | null;
}

export const PayoutNegotiationsManagement: React.FC = () => {
  const [teachers, setTeachers] = useState<TeacherNegotiationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | PayoutType>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Teacher for Offer Decision Engine & Negotiation Room
  const [activeTeacher, setActiveTeacher] = useState<TeacherNegotiationItem | null>(null);
  const [isRoomOpen, setIsRoomOpen] = useState(false);
  const [roomMessages, setRoomMessages] = useState<PayoutNegotiationMessage[]>([]);
  const [loadingRoom, setLoadingRoom] = useState(false);

  // Decision Engine Form State
  const [offerFixed, setOfferFixed] = useState('');
  const [offerPercentage, setOfferPercentage] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [finalizingAgreed, setFinalizingAgreed] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes, payoutsRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*').eq('role', 'instructor'),
        (supabase as any).from('teacher_payout_settings').select('*'),
      ]);

      const instructorIds = new Set((rolesRes.data || []).map((r: any) => r.user_id));
      const profiles = profilesRes.data || [];
      const payouts = payoutsRes.data || [];

      const list: TeacherNegotiationItem[] = [];

      for (const p of profiles) {
        if (instructorIds.has(p.id) || p.teaching_year || p.specialty) {
          let settings = payouts.find((ps: any) => ps.teacher_id === p.id) || null;

          // Check local storage if table hasn't migrated yet
          if (!settings) {
            try {
              const raw = localStorage.getItem(`josoorcom_teacher_lifecycle_payout_${p.id}`);
              if (raw) settings = JSON.parse(raw);
            } catch {
              // ignore
            }
          }

          list.push({
            id: p.id,
            name: p.full_name || p.email?.split('@')[0] || 'معلم جسوركم',
            email: p.email || '',
            phone: p.phone || 'غير متوفر',
            specialty: p.specialty || 'تخصص أكاديمي',
            settings: settings,
          });
        }
      }

      setTeachers(list);
    } catch (err) {
      console.error('Error fetching negotiations data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open Negotiation Room
  const handleOpenRoom = async (teacher: TeacherNegotiationItem) => {
    setActiveTeacher(teacher);
    setIsRoomOpen(true);
    setLoadingRoom(true);

    // Seed form with existing requested/agreed values
    const s = teacher.settings;
    if (s?.fixed_amount) setOfferFixed(s.fixed_amount.toString());
    else setOfferFixed('');

    if (s?.percentage_rate) setOfferPercentage(s.percentage_rate.toString());
    else setOfferPercentage('60');

    setOfferMessage('');

    try {
      const msgs = await getPayoutNegotiations(teacher.id);
      setRoomMessages(msgs);
    } catch (e) {
      console.error('Failed to load room messages:', e);
    } finally {
      setLoadingRoom(false);
    }
  };

  // Submit Admin Offer
  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeacher) return;

    if (!offerMessage.trim()) {
      toast.error('يرجى كتابة رسالة توضيحية للعرض المالي');
      return;
    }

    setSendingOffer(true);
    try {
      await sendAdminPayoutOffer({
        teacherId: activeTeacher.id,
        proposedFixed: offerFixed ? Number(offerFixed) : undefined,
        proposedPercentage: offerPercentage ? Number(offerPercentage) : undefined,
        message: offerMessage.trim(),
        teacherEmail: activeTeacher.email,
        teacherName: activeTeacher.name,
      });

      toast.success('تم إرسال العرض المالي للمعلم بنجاح مع إشعاره بريدياً!');
      setOfferMessage('');
      const updatedMsgs = await getPayoutNegotiations(activeTeacher.id);
      setRoomMessages(updatedMsgs);
      await loadData();
    } catch (err) {
      toast.error('حدث خطأ أثناء إرسال العرض');
    } finally {
      setSendingOffer(false);
    }
  };

  // Finalize & Accept Final Agreement
  const handleFinalizeAgreement = async () => {
    if (!activeTeacher) return;

    const chosenType: PayoutType =
      activeTeacher.settings?.requested_type || (offerFixed && offerPercentage ? 'hybrid' : offerFixed ? 'fixed_per_course' : 'percentage');

    setFinalizingAgreed(true);
    try {
      await finalizeAgreedPayout({
        teacherId: activeTeacher.id,
        agreedType: chosenType,
        fixedAmount: offerFixed ? Number(offerFixed) : null,
        percentageRate: offerPercentage ? Number(offerPercentage) : null,
        notes: 'تم اعتماد وتفعيل الاتفاق النهائي رسمياً من قبل الإدارة',
        teacherEmail: activeTeacher.email,
        teacherName: activeTeacher.name,
      });

      toast.success('تم اعتماد الاتفاق النهائي وتزامن دفتر الحسابات تلقائياً!');
      setIsRoomOpen(false);
      await loadData();
    } catch (err) {
      toast.error('حدث خطأ أثناء اعتماد الاتفاق');
    } finally {
      setFinalizingAgreed(false);
    }
  };

  // Filtered teachers list
  const filteredTeachers = teachers.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.specialty || '').toLowerCase().includes(searchQuery.toLowerCase());

    const tType = t.settings?.requested_type || 'percentage';
    const matchesType = filterType === 'all' || tType === filterType;

    const tStatus = t.settings?.status || 'pending_review';
    const matchesStatus = filterStatus === 'all' || tStatus === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case 'agreed':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">معتمد ونافذ</Badge>;
      case 'offer_sent':
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">تم إرسال العرض</Badge>;
      case 'in_negotiation':
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">جاري التفاوض</Badge>;
      default:
        return <Badge className="bg-slate-800 text-slate-400 border-slate-700">بانتظار المراجعة</Badge>;
    }
  };

  const getModelLabel = (type?: string | null) => {
    switch (type) {
      case 'fixed_per_course':
        return 'مبلغ مقطوع';
      case 'percentage':
        return 'نسبة مئوية';
      case 'hybrid':
        return 'نموذج هجين';
      default:
        return 'نسبة مئوية (افتراضي)';
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">إجمالي طلبات النماذج</p>
              <h3 className="text-2xl font-bold text-white mt-1">{teachers.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">اتفاقيات معتمدة ونافذة</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                {teachers.filter((t) => t.settings?.status === 'agreed').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">عروض قيد التفاوض</p>
              <h3 className="text-2xl font-bold text-blue-400 mt-1">
                {teachers.filter((t) => t.settings?.status === 'in_negotiation' || t.settings?.status === 'offer_sent').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">بانتظار العرض المالي</p>
              <h3 className="text-2xl font-bold text-amber-400 mt-1">
                {teachers.filter((t) => !t.settings || t.settings.status === 'pending_review').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
            className={`text-xs ${filterType === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'border-slate-800 text-slate-300'}`}
          >
            الجميع ({teachers.length})
          </Button>
          <Button
            variant={filterType === 'percentage' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('percentage')}
            className={`text-xs ${filterType === 'percentage' ? 'bg-amber-500 text-slate-950 font-bold' : 'border-slate-800 text-slate-300'}`}
          >
            <Percent className="w-3.5 h-3.5 me-1" />
            نسبة مئوية
          </Button>
          <Button
            variant={filterType === 'fixed_per_course' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('fixed_per_course')}
            className={`text-xs ${filterType === 'fixed_per_course' ? 'bg-amber-500 text-slate-950 font-bold' : 'border-slate-800 text-slate-300'}`}
          >
            <Banknote className="w-3.5 h-3.5 me-1" />
            مبلغ مقطوع
          </Button>
          <Button
            variant={filterType === 'hybrid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('hybrid')}
            className={`text-xs ${filterType === 'hybrid' ? 'bg-amber-500 text-slate-950 font-bold' : 'border-slate-800 text-slate-300'}`}
          >
            <Layers className="w-3.5 h-3.5 me-1" />
            نموذج هجين
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute end-3 top-2.5 text-slate-500" />
            <Input
              placeholder="ابحث بالاسم أو الإيميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border-slate-800 text-white text-xs h-9"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={loadData} className="text-slate-400 hover:text-white h-9 px-2">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Teachers Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTeachers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500 text-sm">
            لا يوجد معلمين يطابقون خيارات الفلترة المحددة.
          </div>
        ) : (
          filteredTeachers.map((teacher) => {
            const s = teacher.settings;
            const requestedType = s?.requested_type || 'percentage';

            return (
              <Card
                key={teacher.id}
                className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between text-start"
              >
                <CardHeader className="pb-3 border-b border-slate-800/60">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white">{teacher.name}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{teacher.email}</p>
                      <p className="text-[11px] text-amber-400/80 mt-1">{teacher.specialty}</p>
                    </div>
                    {getStatusBadge(s?.status)}
                  </div>
                </CardHeader>

                <CardContent className="py-4 space-y-3 flex-1">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">النموذج المطلوب:</span>
                      <span className="font-bold text-white">{getModelLabel(requestedType)}</span>
                    </div>

                    {s?.fixed_amount && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">المبلغ المقترح:</span>
                        <span className="font-mono text-amber-400 font-semibold">{s.fixed_amount} ر.س</span>
                      </div>
                    )}

                    {s?.percentage_rate && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">النسبة المقترحة:</span>
                        <span className="font-mono text-emerald-400 font-semibold">{s.percentage_rate}%</span>
                      </div>
                    )}

                    {s?.notes && (
                      <div className="pt-1.5 border-t border-slate-800/60 text-[11px] text-slate-400 line-clamp-2">
                        <strong>ملاحظة المعلم:</strong> {s.notes}
                      </div>
                    )}
                  </div>
                </CardContent>

                <div className="p-4 pt-0">
                  <Button
                    onClick={() => handleOpenRoom(teacher)}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs h-9 shadow-md shadow-amber-500/10"
                  >
                    <MessageSquare className="w-3.5 h-3.5 me-1.5" />
                    فتح غرفة التفاوض واعتماد العرض
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Decision Engine & Negotiation Room Dialog */}
      <Dialog open={isRoomOpen} onOpenChange={setIsRoomOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-100 max-w-3xl max-h-[90vh] flex flex-col p-6 text-start">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base md:text-lg font-bold text-white">
                    غرفة التفاوض ومحرك اعتماد العرض المالي
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400 mt-0.5">
                    المعلم: {activeTeacher?.name} ({activeTeacher?.email}) | {activeTeacher?.phone}
                  </DialogDescription>
                </div>
              </div>
              {getStatusBadge(activeTeacher?.settings?.status)}
            </div>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-6 flex-1 overflow-hidden py-4">
            {/* Left: Chat & Offer History */}
            <div className="flex flex-col border border-slate-800 rounded-xl bg-slate-900/60 p-4 overflow-hidden">
              <h4 className="text-xs font-bold text-amber-400 mb-3 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Clock className="w-3.5 h-3.5" />
                سجل الرسائل والعروض المتبادلة
              </h4>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {loadingRoom ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  </div>
                ) : roomMessages.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    لا توجد مراسلات سابقة. قدم عرضك المالي من الخانة المقابلة.
                  </div>
                ) : (
                  roomMessages.map((msg, idx) => {
                    const isAdmin = msg.sender_type === 'admin';
                    return (
                      <div
                        key={msg.id || idx}
                        className={`p-3 rounded-xl text-xs space-y-1.5 ${
                          isAdmin
                            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-200'
                            : 'bg-slate-950 border border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex justify-between text-[11px] font-semibold border-b border-slate-800/60 pb-1">
                          <span className={isAdmin ? 'text-amber-400' : 'text-slate-200'}>
                            {isAdmin ? 'الإدارة (أنت)' : activeTeacher?.name}
                          </span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('ar-SA') : ''}
                          </span>
                        </div>

                        {(msg.proposed_fixed || msg.proposed_percentage) && (
                          <div className="p-1.5 rounded bg-slate-950/80 font-mono text-[11px] text-emerald-400">
                            {msg.proposed_fixed ? `المبلغ: ${msg.proposed_fixed} ر.س | ` : ''}
                            {msg.proposed_percentage ? `النسبة: ${msg.proposed_percentage}%` : ''}
                          </div>
                        )}

                        <p className="leading-relaxed whitespace-pre-line">{msg.message}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Offer Decision Engine Form */}
            <div className="flex flex-col justify-between border border-slate-800 rounded-xl bg-slate-900/60 p-4">
              <form onSubmit={handleSendOffer} className="space-y-4">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <Coins className="w-3.5 h-3.5" />
                  محرك تحديد العرض المالي (Offer Decision Engine)
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-300">المبلغ المقطوع (ر.س)</Label>
                    <Input
                      type="number"
                      placeholder="مثال: 3000"
                      value={offerFixed}
                      onChange={(e) => setOfferFixed(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-300">النسبة المئوية (%)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="مثال: 60"
                      value={offerPercentage}
                      onChange={(e) => setOfferPercentage(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white text-xs h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-300">تفاصيل ورسالة العرض للمعلم</Label>
                  <Textarea
                    rows={3}
                    placeholder="مثال: بناءً على مراجعة الخطة الدراسية، يسرنا تقديم هذا العرض المعتمد لمقرراتك..."
                    value={offerMessage}
                    onChange={(e) => setOfferMessage(e.target.value)}
                    required
                    className="bg-slate-950 border-slate-800 text-white text-xs leading-relaxed"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={sendingOffer}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9"
                >
                  {sendingOffer ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 me-1.5" />
                      إرسال العرض المالي وإشعار المعلم
                    </>
                  )}
                </Button>
              </form>

              {/* Accept & Finalize Button */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <div className="text-[11px] text-slate-400">
                  عند الوصول لاتفاق نهائي، اضغط أدناه لتثبيت العقد وتحديث دفتر الحسابات ونسب العمولات آلياً:
                </div>
                <Button
                  onClick={handleFinalizeAgreement}
                  disabled={finalizingAgreed}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs h-10 shadow-lg shadow-emerald-500/20"
                >
                  {finalizingAgreed ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 me-1.5" />
                      اعتماد الاتفاق النهائي وتزامن دفتر الحسابات
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayoutNegotiationsManagement;
