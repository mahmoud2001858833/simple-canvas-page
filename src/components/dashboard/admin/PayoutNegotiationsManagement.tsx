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
  Check,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  sendAdminPayoutOffer,
  finalizeAgreedPayout,
  getPayoutNegotiations,
  sendLifecycleEmail,
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
      const [profilesRes, rolesRes, payoutsRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*').eq('role', 'instructor'),
        (supabase as any).from('teacher_payout_settings').select('*'),
        supabase.from('platform_settings').select('*').like('key', 'teacher_%'),
      ]);

      const instructorIds = new Set((rolesRes.data || []).map((r: any) => r.user_id));
      const profiles = profilesRes.data || [];
      const payouts = payoutsRes.data || [];
      const settingsList = settingsRes.data || [];

      // Settings lookup map
      const settingsMap: Record<string, any> = {};
      for (const s of settingsList) {
        try {
          settingsMap[s.key] = JSON.parse(s.value || '{}');
        } catch {}
      }

      const list: TeacherNegotiationItem[] = [];

      for (const p of profiles) {
        if (instructorIds.has(p.id) || p.teaching_year || p.specialty) {
          let settings = payouts.find((ps: any) => ps.teacher_id === p.id) || null;

          // Check cloud JSON store in profiles.teaching_experience_details
          if (p.teaching_experience_details) {
            try {
              const parsed = JSON.parse(p.teaching_experience_details);
              if (parsed?.payout) {
                if (!settings) settings = parsed.payout;
                else {
                  // Merge newest values
                  settings = { ...parsed.payout, ...settings };
                }
              }
            } catch {}
          }

          // Check platform_settings key
          if (!settings && settingsMap[`teacher_payout_${p.id}`]) {
            settings = settingsMap[`teacher_payout_${p.id}`];
          }
          if (settingsMap[`teacher_data_${p.id}`]?.payout) {
            const tdPayout = settingsMap[`teacher_data_${p.id}`].payout;
            if (!settings) settings = tdPayout;
          }

          // Fallback to local storage if still empty
          if (!settings) {
            try {
              const raw = localStorage.getItem(`josoorcom_teacher_lifecycle_payout_${p.id}`);
              if (raw) settings = JSON.parse(raw);
            } catch {}
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

  const handleOpenRoom = async (teacher: TeacherNegotiationItem) => {
    setActiveTeacher(teacher);
    setIsRoomOpen(true);
    setLoadingRoom(true);

    const s = teacher.settings;
    if (s?.fixed_amount) setOfferFixed(s.fixed_amount.toString());
    else setOfferFixed('');

    if (s?.percentage_rate) setOfferPercentage(s.percentage_rate.toString());
    else setOfferPercentage('80');

    setOfferMessage('');

    try {
      const msgs = await getPayoutNegotiations(teacher.id);
      setRoomMessages(msgs);
    } catch {
      setRoomMessages([]);
    } finally {
      setLoadingRoom(false);
    }
  };

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeacher) return;

    if (!offerFixed && !offerPercentage) {
      toast.error('يرجى تحديد مبلغ مقطوع أو نسبة مئوية للعرض');
      return;
    }
    if (!offerMessage.trim()) {
      toast.error('يرجى كتابة رسالة توضيحية للمعلم بخصوص العرض');
      return;
    }

    setSendingOffer(true);
    try {
      await sendAdminPayoutOffer({
        teacherId: activeTeacher.id,
        proposedFixed: offerFixed ? Number(offerFixed) : null,
        proposedPercentage: offerPercentage ? Number(offerPercentage) : null,
        message: offerMessage.trim(),
        teacherEmail: activeTeacher.email,
        teacherName: activeTeacher.name,
      });

      toast.success('تم إرسال العرض المالي ورسالة إشعار إلى بريد المعلم بنجاح!');
      await loadData();
      setIsRoomOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء إرسال العرض');
    } finally {
      setSendingOffer(false);
    }
  };

  const handleQuickApprove = async (teacher: TeacherNegotiationItem) => {
    const s = teacher.settings;
    const reqType = s?.requested_type || 'percentage';
    const rate = s?.percentage_rate || 80;
    const fixed = s?.fixed_amount || null;

    try {
      await finalizeAgreedPayout({
        teacherId: teacher.id,
        agreedType: reqType,
        fixedAmount: fixed,
        percentageRate: rate,
        notes: `تم اعتماد النسبة المطلوبة (${rate}%) مباشرة من قبل الإدارة`,
        teacherEmail: teacher.email,
        teacherName: teacher.name,
      });

      toast.success(`تم اعتماد وتفعيل نسبة (${rate}%) للأستاذ ${teacher.name} بنجاح!`);
      await loadData();
    } catch {
      toast.error('حدث خطأ أثناء الاعتماد');
    }
  };

  const handleFinalizeAgreement = async () => {
    if (!activeTeacher) return;

    setFinalizingAgreed(true);
    try {
      const agreedType: PayoutType = activeTeacher.settings?.requested_type || 'percentage';
      await finalizeAgreedPayout({
        teacherId: activeTeacher.id,
        agreedType: agreedType,
        fixedAmount: offerFixed ? Number(offerFixed) : null,
        percentageRate: offerPercentage ? Number(offerPercentage) : null,
        notes: offerMessage.trim() || 'تم اعتماد الاتفاق النهائي من قبل الإدارة',
        teacherEmail: activeTeacher.email,
        teacherName: activeTeacher.name,
      });

      toast.success('تم اعتماد الاتفاق المالي وتفعيل حساب المعلم وإرسال إشعار بريدي');
      await loadData();
      setIsRoomOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'فشل اعتماد الاتفاق النهائي');
    } finally {
      setFinalizingAgreed(false);
    }
  };

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
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">معتمد ونافذ</Badge>;
      case 'offer_sent':
        return <Badge className="bg-amber-50 text-amber-800 border-amber-300">تم إرسال العرض</Badge>;
      case 'in_negotiation':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">قيد التفاوض</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">بانتظار المراجعة</Badge>;
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
        return 'نسبة مئوية';
    }
  };

  return (
    <div className="space-y-6 text-slate-900">
      {/* 4 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">إجمالي طلبات النماذج</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{teachers.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">اتفاقيات معتمدة ونافذة</p>
              <h3 className="text-2xl font-bold text-emerald-700 mt-1">
                {teachers.filter((t) => t.settings?.status === 'agreed').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">عروض قيد التفاوض</p>
              <h3 className="text-2xl font-bold text-blue-700 mt-1">
                {teachers.filter((t) => t.settings?.status === 'in_negotiation' || t.settings?.status === 'offer_sent').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">بانتظار العرض المالي</p>
              <h3 className="text-2xl font-bold text-amber-700 mt-1">
                {teachers.filter((t) => !t.settings || t.settings.status === 'pending_review').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute end-3 top-3 text-slate-400" />
            <Input
              placeholder="ابحث بالاسم، الإيميل، أو التخصص..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border-slate-300 text-slate-900 text-xs h-10"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-white border border-slate-300 rounded-lg px-3 h-10 text-slate-700 text-xs focus:outline-none focus:border-amber-500"
          >
            <option value="all">كل النماذج</option>
            <option value="percentage">نسبة مئوية</option>
            <option value="fixed_per_course">مبلغ مقطوع</option>
            <option value="hybrid">هجين</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 h-10 text-slate-700 text-xs focus:outline-none focus:border-amber-500"
          >
            <option value="all">كل الحالات</option>
            <option value="pending_review">بانتظار المراجعة</option>
            <option value="offer_sent">تم إرسال العرض</option>
            <option value="in_negotiation">قيد التفاوض</option>
            <option value="agreed">معتمد ونافذ</option>
          </select>
        </div>

        <Button variant="outline" size="sm" onClick={loadData} className="border-slate-200 text-slate-600 hover:bg-slate-50 text-xs h-9">
          <RefreshCw className={`w-3.5 h-3.5 me-1.5 ${loading ? 'animate-spin' : ''}`} />
          تحديث المفاوضات
        </Button>
      </div>

      {/* Negotiations Table */}
      <Card className="bg-white border-slate-200 shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="border-slate-200">
              <TableHead className="text-start text-xs text-slate-700 font-bold">المعلم والتخصص</TableHead>
              <TableHead className="text-start text-xs text-slate-700 font-bold">النموذج المالي</TableHead>
              <TableHead className="text-start text-xs text-slate-700 font-bold">النسبة / المبلغ المطلوب</TableHead>
              <TableHead className="text-start text-xs text-slate-700 font-bold">حالة المفاوضة</TableHead>
              <TableHead className="text-start text-xs text-slate-700 font-bold">إجراءات الإدارة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeachers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-xs text-slate-500">
                  لا توجد طلبات مفاوضة مطابقة للشروط حالياً.
                </TableCell>
              </TableRow>
            ) : (
              filteredTeachers.map((teacher) => {
                const s = teacher.settings;
                const isAgreed = s?.status === 'agreed';

                return (
                  <TableRow key={teacher.id} className="border-slate-100 hover:bg-slate-50/70">
                    <TableCell className="text-start">
                      <div className="font-bold text-slate-900 text-sm">{teacher.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{teacher.email}</div>
                      <div className="text-[11px] text-amber-700 font-medium mt-0.5">{teacher.specialty}</div>
                    </TableCell>

                    <TableCell className="text-start">
                      <div className="font-semibold text-slate-800 text-xs">{getModelLabel(s?.requested_type)}</div>
                      {s?.notes && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 max-w-[200px] mt-0.5">{s.notes}</p>
                      )}
                    </TableCell>

                    <TableCell className="text-start font-mono">
                      {s ? (
                        <div className="space-y-1">
                          {s.percentage_rate && (
                            <span className="text-xs font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              نسبة المعلم: {s.percentage_rate}%
                            </span>
                          )}
                          {s.fixed_amount && (
                            <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded mr-1">
                              {s.fixed_amount.toLocaleString()} ر.س
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">لم يحدد نموذجاً بعد</span>
                      )}
                    </TableCell>

                    <TableCell className="text-start">{getStatusBadge(s?.status)}</TableCell>

                    <TableCell className="text-start">
                      <div className="flex items-center gap-2">
                        {/* 1-Click Quick Approve button if pending review and has percentage */}
                        {!isAgreed && s?.percentage_rate && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickApprove(teacher)}
                            className="text-xs border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 h-8 font-bold"
                          >
                            <Check className="w-3.5 h-3.5 me-1 text-emerald-700" />
                            اعتماد النسبة ({s.percentage_rate}%)
                          </Button>
                        )}

                        <Button
                          size="sm"
                          onClick={() => handleOpenRoom(teacher)}
                          className={`text-xs h-8 font-semibold shadow-xs ${
                            isAgreed
                              ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 border'
                              : 'bg-amber-500 hover:bg-amber-600 text-white'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5 me-1" />
                          {isAgreed ? 'سجل الاتفاق' : 'غرفة المفاوضة'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Negotiation Room & Decision Engine Dialog */}
      <Dialog open={isRoomOpen} onOpenChange={setIsRoomOpen}>
        <DialogContent className="bg-white border border-slate-200 text-slate-900 max-w-2xl text-start rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-600" />
              غرفة المفاوضة المالية: {activeTeacher?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              تحديد واعتماد شروط العرض المالي الخاص بالأستاذ ومزامنة دفتر الحسابات المحاسبي.
            </DialogDescription>
          </DialogHeader>

          {activeTeacher && (
            <div className="space-y-4 my-2 text-xs">
              {/* Teacher Request Overview */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-slate-500 font-semibold block">النموذج المطلوب من المعلم:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {getModelLabel(activeTeacher.settings?.requested_type)}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  {activeTeacher.settings?.percentage_rate && (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-xs">
                      النسبة المطلوبة: {activeTeacher.settings.percentage_rate}%
                    </Badge>
                  )}
                  {activeTeacher.settings?.fixed_amount && (
                    <Badge className="bg-slate-200 text-slate-800 border-slate-300 font-bold text-xs">
                      المبلغ المطلوب: {activeTeacher.settings.fixed_amount.toLocaleString()} ر.س
                    </Badge>
                  )}
                </div>
              </div>

              {/* Message History */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700">سجل المفاوضة والمراسلات:</span>
                <div className="max-h-40 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  {loadingRoom ? (
                    <div className="py-4 text-center text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    </div>
                  ) : roomMessages.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">لم يتم تبادل رسائل سابقة في هذا الطلب.</p>
                  ) : (
                    roomMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-2.5 rounded-lg max-w-[85%] ${
                          msg.sender_type === 'admin'
                            ? 'bg-amber-50 border border-amber-200 text-amber-950 me-auto'
                            : 'bg-white border border-slate-200 text-slate-800 ms-auto'
                        }`}
                      >
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-bold">
                          <span>{msg.sender_type === 'admin' ? 'الإدارة' : 'المعلم'}</span>
                          <span>{new Date(msg.created_at).toLocaleTimeString('ar-SA')}</span>
                        </div>
                        <p>{msg.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Offer Decision Engine Form */}
              <form onSubmit={handleSendOffer} className="space-y-3 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">نسبة مبيعات المعلم (%)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={offerPercentage}
                      onChange={(e) => setOfferPercentage(e.target.value)}
                      placeholder="80"
                      className="bg-white border-slate-300 text-slate-900 text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">أو مبلغ مقطوع (ر.س)</Label>
                    <Input
                      type="number"
                      value={offerFixed}
                      onChange={(e) => setOfferFixed(e.target.value)}
                      placeholder="5000"
                      className="bg-white border-slate-300 text-slate-900 text-xs h-9 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">رسالة توضيحية للمعلم بخصوص العرض</Label>
                  <Textarea
                    rows={2}
                    value={offerMessage}
                    onChange={(e) => setOfferMessage(e.target.value)}
                    placeholder="مرحباً أستاذنا، يسعدنا تقديم هذا العرض المالي لدوراتك في منصة جسوركم..."
                    className="bg-white border-slate-300 text-slate-900 text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsRoomOpen(false)}
                    className="text-xs border-slate-300 text-slate-700"
                  >
                    إغلاق
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleFinalizeAgreement}
                      disabled={finalizingAgreed}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 px-4"
                    >
                      {finalizingAgreed ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'اعتماد الاتفاق النهائي وتفعيله'}
                    </Button>

                    <Button
                      type="submit"
                      disabled={sendingOffer}
                      className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold h-9 px-4"
                    >
                      {sendingOffer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'إرسال العرض المقترح للمعلم'}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayoutNegotiationsManagement;
