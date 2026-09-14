import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Landmark,
  FileCheck,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Video,
  Plus,
  Trash2,
  Edit2,
  Upload,
  ExternalLink,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Wallet,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
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
  getOnboardingResources,
  saveOnboardingResource,
  deleteOnboardingResource,
  setBankVerificationByAdmin,
  OnboardingResource,
  TeacherBankDetails,
  DEFAULT_OFFICIAL_TEMPLATE,
} from '@/lib/teacherLifecycleService';

interface TeacherItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  signedAt?: string;
  contractUrl?: string;
  bank?: TeacherBankDetails | null;
}

export const TeachersOnboardingManagement: React.FC<{
  onNavigateToPayouts?: () => void;
}> = ({ onNavigateToPayouts }) => {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [resources, setResources] = useState<OnboardingResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedBankTeacher, setSelectedBankTeacher] = useState<TeacherItem | null>(null);
  const [selectedContractTeacher, setSelectedContractTeacher] = useState<TeacherItem | null>(null);

  // Resource CMS Modals
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [resourceType, setResourceType] = useState<'video' | 'tip' | 'app'>('video');
  const [editingResource, setEditingResource] = useState<OnboardingResource | null>(null);
  const [resTitle, setResTitle] = useState('');
  const [resDesc, setResDesc] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resBadge, setResBadge] = useState('');
  const [resVisible, setResVisible] = useState(true);

  // Template CMS
  const [templateTitle, setTemplateTitle] = useState(DEFAULT_OFFICIAL_TEMPLATE.title);
  const [templateDesc, setTemplateDesc] = useState(DEFAULT_OFFICIAL_TEMPLATE.description);
  const [templateUrl, setTemplateUrl] = useState(DEFAULT_OFFICIAL_TEMPLATE.downloadUrl);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch instructors from profiles & user_roles
      const [profilesRes, rolesRes, contractsRes, banksRes, lifecycleProfRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*').eq('role', 'instructor'),
        (supabase as any).from('teacher_contracts').select('*'),
        (supabase as any).from('teacher_bank_details').select('*'),
        (supabase as any).from('teacher_profiles').select('*'),
      ]);

      const instructorIds = new Set((rolesRes.data || []).map((r: any) => r.user_id));
      const profiles = profilesRes.data || [];
      const contracts = contractsRes.data || [];
      const banks = banksRes.data || [];
      const lifecycleProfiles = lifecycleProfRes.data || [];

      const merged: TeacherItem[] = [];

      for (const p of profiles) {
        if (instructorIds.has(p.id) || p.teaching_year || p.specialty) {
          const contract = contracts.find((c: any) => c.teacher_id === p.id);
          const bank = banks.find((b: any) => b.teacher_id === p.id);
          const lProfile = lifecycleProfiles.find((lp: any) => lp.id === p.id);

          let st = lProfile?.onboarding_status || (contract ? 'policy_signed' : bank ? 'bank_submitted' : 'registered');
          if (p.has_accepted_policies && st === 'registered') st = 'policy_signed';

          merged.push({
            id: p.id,
            name: p.full_name || p.email?.split('@')[0] || 'معلم مسجل',
            email: p.email || '',
            phone: p.phone || 'غير متوفر',
            status: st,
            signedAt: contract?.signed_at,
            contractUrl: contract?.contract_pdf_url,
            bank: bank || null,
          });
        }
      }

      setTeachers(merged);

      // 2. Fetch Resources
      const resList = await getOnboardingResources();
      setResources(resList);

      const templateRes = resList.find((r) => r.type === 'template');
      if (templateRes) {
        setTemplateTitle(templateRes.title);
        setTemplateDesc(templateRes.description);
        setTemplateUrl(templateRes.url || DEFAULT_OFFICIAL_TEMPLATE.downloadUrl);
      }
    } catch (err) {
      console.error('Failed to load teachers onboarding data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered teachers
  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.bank?.bank_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle bank verified status
  const handleToggleBankVerified = async (teacher: TeacherItem) => {
    if (!teacher.bank) return;
    const nextVal = !teacher.bank.verified_by_admin;
    try {
      await setBankVerificationByAdmin(teacher.id, nextVal);
      toast.success(nextVal ? 'تم اعتماد وتوثيق الحساب البنكي' : 'تم إلغاء اعتماد الحساب البنكي');
      await loadData();
      if (selectedBankTeacher) {
        setSelectedBankTeacher({
          ...selectedBankTeacher,
          bank: { ...selectedBankTeacher.bank!, verified_by_admin: nextVal },
        });
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء تعديل حالة الاعتماد');
    }
  };

  // Resource CMS Actions
  const handleOpenAddResource = (type: 'video' | 'tip' | 'app') => {
    setResourceType(type);
    setEditingResource(null);
    setResTitle('');
    setResDesc('');
    setResUrl('');
    setResBadge('');
    setResVisible(true);
    setIsResourceModalOpen(true);
  };

  const handleEditResource = (res: OnboardingResource) => {
    setEditingResource(res);
    setResourceType(res.type as any);
    setResTitle(res.title);
    setResDesc(res.description);
    setResUrl(res.url || '');
    setResBadge(res.badge_tag || '');
    setResVisible(res.is_visible);
    setIsResourceModalOpen(true);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim()) {
      toast.error('يرجى كتابة العنوان');
      return;
    }

    try {
      await saveOnboardingResource({
        id: editingResource?.id,
        type: resourceType,
        title: resTitle.trim(),
        description: resDesc.trim(),
        url: resUrl.trim() || undefined,
        badge_tag: resBadge.trim() || undefined,
        is_visible: resVisible,
        order_index: editingResource?.order_index || 1,
      });

      toast.success('تم حفظ المحتوى بنجاح!');
      setIsResourceModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const handleDeleteResource = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) return;
    try {
      await deleteOnboardingResource(id);
      toast.success('تم حذف المحتوى');
      await loadData();
    } catch {
      toast.error('فشل الحذف');
    }
  };

  const handleToggleResourceVisibility = async (res: OnboardingResource) => {
    try {
      await saveOnboardingResource({
        ...res,
        is_visible: !res.is_visible,
      });
      toast.success(!res.is_visible ? 'تم تفعيل وإظهار المحتوى' : 'تم إخفاء المحتوى');
      await loadData();
    } catch {
      toast.error('فشل تحديث الحالة');
    }
  };

  const handleSaveTemplate = async () => {
    try {
      const templateRes = resources.find((r) => r.type === 'template');
      await saveOnboardingResource({
        id: templateRes?.id,
        type: 'template',
        title: templateTitle.trim(),
        description: templateDesc.trim(),
        url: templateUrl.trim(),
        badge_tag: 'قالب رسمي معتمد',
        is_visible: true,
        order_index: 30,
      });
      toast.success('تم تحديث بيانات قالب الشرح الرسمي بنجاح!');
      await loadData();
    } catch {
      toast.error('فشل حفظ بيانات القالب');
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">نشط ومعتمد</Badge>;
      case 'policy_signed':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">وقع الاتفاقية</Badge>;
      case 'bank_submitted':
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">أدخل البيانات البنكية</Badge>;
      default:
        return <Badge className="bg-slate-800 text-slate-400 border-slate-700">مسجل جديد</Badge>;
    }
  };

  const videosList = resources.filter((r) => r.type === 'video');
  const tipsList = resources.filter((r) => r.type === 'tip');
  const appsList = resources.filter((r) => r.type === 'app');

  return (
    <div className="space-y-8">
      {/* Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">إجمالي المعلمين المسجلين</p>
              <h3 className="text-2xl font-bold text-white mt-1">{teachers.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">الموقعون على السياسات</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                {teachers.filter((t) => t.status === 'policy_signed' || t.status === 'active').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">الحسابات البنكية الموثقة</p>
              <h3 className="text-2xl font-bold text-blue-400 mt-1">
                {teachers.filter((t) => t.bank?.verified_by_admin).length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">موارد المعلمين (CMS)</p>
              <h3 className="text-2xl font-bold text-purple-400 mt-1">{resources.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="roster" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger value="roster" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold">
              كشف المعلمين والبيانات البنكية ({teachers.length})
            </TabsTrigger>
            <TabsTrigger value="videos" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold">
              الفيديوهات الإرشادية ({videosList.length})
            </TabsTrigger>
            <TabsTrigger value="tips_apps" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold">
              النصائح والتطبيقات ({tipsList.length + appsList.length})
            </TabsTrigger>
            <TabsTrigger value="template" className="text-xs data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold">
              قالب الشرح الرسمي
            </TabsTrigger>
          </TabsList>

          {onNavigateToPayouts && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToPayouts}
              className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-xs self-start sm:self-auto"
            >
              <Wallet className="w-3.5 h-3.5 me-1.5" />
              الانتقال لدفع أجور ومفاوضات المعلمين &larr;
            </Button>
          )}
        </div>

        {/* TAB 1: TEACHERS ROSTER */}
        <TabsContent value="roster" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute end-3 top-3 text-slate-500" />
              <Input
                placeholder="ابحث بالاسم، الإيميل، أو البنك..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900 border-slate-800 text-white text-xs h-10"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={loadData} className="text-slate-400 hover:text-white text-xs">
              <RefreshCw className="w-3.5 h-3.5 me-1.5" />
              تحديث الكشف
            </Button>
          </div>

          <Card className="bg-slate-900/80 border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-950/70">
                <TableRow className="border-slate-800">
                  <TableHead className="text-start text-xs text-slate-400 font-bold">المعلم</TableHead>
                  <TableHead className="text-start text-xs text-slate-400 font-bold">حالة الانضمام</TableHead>
                  <TableHead className="text-start text-xs text-slate-400 font-bold">وثيقة العقد والسياسات</TableHead>
                  <TableHead className="text-start text-xs text-slate-400 font-bold">الحساب البنكي</TableHead>
                  <TableHead className="text-start text-xs text-slate-400 font-bold">إجراءات الإدارة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-xs text-slate-500">
                      لا يوجد معلمين مطابقين للبحث حالياً.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <TableRow key={teacher.id} className="border-slate-800/80 hover:bg-slate-800/30">
                      <TableCell className="text-start">
                        <div className="font-semibold text-white text-sm">{teacher.name}</div>
                        <div className="text-xs text-slate-400 font-mono">{teacher.email}</div>
                        {teacher.phone && <div className="text-[11px] text-slate-500 mt-0.5">{teacher.phone}</div>}
                      </TableCell>

                      <TableCell className="text-start">{getStatusBadge(teacher.status)}</TableCell>

                      <TableCell className="text-start">
                        {teacher.signedAt ? (
                          <div className="space-y-1">
                            <div className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              تم التوقيع ({new Date(teacher.signedAt).toLocaleDateString('ar-SA')})
                            </div>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => setSelectedContractTeacher(teacher)}
                              className="text-[11px] text-amber-400 p-0 h-auto hover:underline flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              معاينة وثيقة العقد
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            بانتظار التوقيع الرقمي
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-start">
                        {teacher.bank ? (
                          <div className="space-y-1">
                            <div className="text-xs text-white font-medium flex items-center gap-1.5">
                              <span>{teacher.bank.bank_name}</span>
                              {teacher.bank.verified_by_admin ? (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0">
                                  موثق
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[9px] px-1.5 py-0">
                                  غير موثق
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate max-w-[170px]">
                              {teacher.bank.iban}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">لم تُدخل البيانات البنكية</span>
                        )}
                      </TableCell>

                      <TableCell className="text-start">
                        <div className="flex items-center gap-2">
                          {teacher.bank && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedBankTeacher(teacher)}
                              className="text-xs border-slate-700 hover:bg-slate-800 text-slate-300 h-8"
                            >
                              <Landmark className="w-3.5 h-3.5 me-1" />
                              فحص البنك
                            </Button>
                          )}
                          {onNavigateToPayouts && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={onNavigateToPayouts}
                              className="text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10 h-8"
                            >
                              <Wallet className="w-3.5 h-3.5 me-1" />
                              المفاوضة
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB 2: VIDEOS CMS */}
        <TabsContent value="videos" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">الفيديوهات الإرشادية للمعلم</h3>
              <p className="text-xs text-slate-400">
                إدارة الفيديوهات التي تظهر للمعلمين في صفحة استكمال الانضمام (المشغل المدمج).
              </p>
            </div>
            <Button
              onClick={() => handleOpenAddResource('video')}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9"
            >
              <Plus className="w-4 h-4 me-1.5" />
              إضافة فيديو إرشادي
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {videosList.map((vid) => (
              <Card key={vid.id} className="bg-slate-900/80 border-slate-800 overflow-hidden text-start">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                        <Video className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{vid.title}</h4>
                        <Badge className="bg-slate-800 text-amber-300 border-none text-[10px] mt-1">
                          {vid.badge_tag || 'إرشادي'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditResource(vid)}
                        className="h-8 w-8 text-slate-400 hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteResource(vid.id)}
                        className="h-8 w-8 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{vid.description}</p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">{vid.url}</p>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">حالة الظهور للمعلم</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{vid.is_visible ? 'ظاهر' : 'مخفي'}</span>
                      <Switch
                        checked={vid.is_visible}
                        onCheckedChange={() => handleToggleResourceVisibility(vid)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 3: TIPS & APPS CMS */}
        <TabsContent value="tips_apps" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">النصائح والتطبيقات المنصوح بها</h3>
              <p className="text-xs text-slate-400">توجيهات التدريس وتطبيقات الشرح الموصى بها للمعلمين.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenAddResource('tip')}
                className="text-xs border-slate-700 text-slate-200"
              >
                <Plus className="w-3.5 h-3.5 me-1" />
                إضافة نصيحة
              </Button>
              <Button
                size="sm"
                onClick={() => handleOpenAddResource('app')}
                className="text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold"
              >
                <Plus className="w-3.5 h-3.5 me-1" />
                إضافة تطبيق
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-amber-400 text-start">النصائح والتوجيهات ({tipsList.length})</h4>
            <div className="grid md:grid-cols-2 gap-3">
              {tipsList.map((tip) => (
                <div
                  key={tip.id}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start justify-between text-start"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{tip.title}</span>
                      {tip.badge_tag && <Badge className="text-[10px] bg-slate-800 text-slate-300">{tip.badge_tag}</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{tip.description}</p>
                  </div>
                  <div className="flex items-center gap-1 ms-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditResource(tip)}
                      className="h-7 w-7 text-slate-400 hover:text-white"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteResource(tip.id)}
                      className="h-7 w-7 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h4 className="text-sm font-bold text-emerald-400 text-start">التطبيقات المقترحة ({appsList.length})</h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {appsList.map((app) => (
                <div
                  key={app.id}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between text-start"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{app.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteResource(app.id)}
                        className="h-6 w-6 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{app.description}</p>
                  </div>
                  {app.url && (
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 text-[11px] text-amber-400 flex items-center gap-1 hover:underline"
                    >
                      زيارة الرابط
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: OFFICIAL TEMPLATE CMS */}
        <TabsContent value="template">
          <Card className="bg-slate-900/80 border-slate-800 text-start">
            <CardHeader className="border-b border-slate-800 pb-4">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-amber-400" />
                إدارة قالب الشرح الرسمي لمنصة جسوركم (Presentation Template)
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                هذا القالب يظهر لكافة المعلمين في صفحة استكمال الانضمام لتحميله واستخدامه في تحضير شرائح الشرح.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-300">عنوان القالب</Label>
                <Input
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-300">الوصف التوضيحي</Label>
                <Textarea
                  rows={2}
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-300">رابط تحميل الملف (URL / Storage Path)</Label>
                <Input
                  value={templateUrl}
                  onChange={(e) => setTemplateUrl(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white text-xs font-mono h-10"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleSaveTemplate}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-10 px-6"
                >
                  حفظ وتحديث القالب
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: View & Verify Bank Details */}
      <Dialog open={!!selectedBankTeacher} onOpenChange={() => setSelectedBankTeacher(null)}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-100 max-w-lg text-start">
          <DialogHeader className="border-b border-slate-800 pb-3">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-amber-400" />
              تفاصيل الحساب البنكي للمعلم
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              المعلم: {selectedBankTeacher?.name} ({selectedBankTeacher?.email})
            </DialogDescription>
          </DialogHeader>

          {selectedBankTeacher?.bank ? (
            <div className="space-y-4 py-3">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">اسم البنك:</span>
                  <span className="font-bold text-white">{selectedBankTeacher.bank.bank_name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">الفرع:</span>
                  <span className="text-slate-200">{selectedBankTeacher.bank.branch_name || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">رقم الحساب:</span>
                  <span className="font-mono text-white">{selectedBankTeacher.bank.account_number}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">رقم الـ IBAN:</span>
                  <span className="font-mono text-amber-400 font-bold tracking-wide">
                    {selectedBankTeacher.bank.iban}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">رمز السويفت (SWIFT):</span>
                  <span className="font-mono text-slate-200">{selectedBankTeacher.bank.swift_code || 'غير متوفر'}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">حالة الاعتماد البنكي</span>
                  <span className="text-[11px] text-slate-400">توثيق صحة الحساب لتحويل مستحقات المعلم</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleToggleBankVerified(selectedBankTeacher)}
                  className={`text-xs font-bold ${
                    selectedBankTeacher.bank.verified_by_admin
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                  }`}
                >
                  {selectedBankTeacher.bank.verified_by_admin ? 'إلغاء التوثيق' : 'توثيق واعتماد الحساب'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">لا توجد بيانات بنكية مسجلة.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: View Signed Contract */}
      <Dialog open={!!selectedContractTeacher} onOpenChange={() => setSelectedContractTeacher(null)}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-100 max-w-lg text-start">
          <DialogHeader className="border-b border-slate-800 pb-3">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-400" />
              وثيقة العقد والسياسات الموقعة رقمياً
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              وثيقة رسمية موقعة إلكترونياً بمعايير التشفير المعتمدة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">اسم المعلم الموقع:</span>
                <span className="font-bold text-white">{selectedContractTeacher?.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">البريد الإلكتروني المعتمد:</span>
                <span className="font-mono text-slate-200">{selectedContractTeacher?.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">تاريخ ووقت التوقيع:</span>
                <span className="text-slate-200">
                  {selectedContractTeacher?.signedAt
                    ? new Date(selectedContractTeacher.signedAt).toLocaleString('ar-SA')
                    : 'غير متوفر'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">إصدار السياسات:</span>
                <span className="font-mono text-amber-400">v1.0 (Josoorcom Enterprise)</span>
              </div>
            </div>

            {selectedContractTeacher?.contractUrl && (
              <div className="flex justify-center pt-2">
                <a
                  href={selectedContractTeacher.contractUrl}
                  download={`contract_${selectedContractTeacher.name}.pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
                >
                  <Download className="w-4 h-4" />
                  تحميل وثيقة العقد الموقعة (PDF)
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Add/Edit Resource (CMS) */}
      <Dialog open={isResourceModalOpen} onOpenChange={setIsResourceModalOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-100 max-w-md text-start">
          <DialogHeader className="border-b border-slate-800 pb-3">
            <DialogTitle className="text-base font-bold text-white">
              {editingResource ? 'تعديل محتوى إرشادي' : 'إضافة محتوى إرشادي جديد'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveResource} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">العنوان</Label>
              <Input
                value={resTitle}
                onChange={(e) => setResTitle(e.target.value)}
                required
                className="bg-slate-900 border-slate-800 text-white text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">الوصف التفصيلي</Label>
              <Textarea
                rows={3}
                value={resDesc}
                onChange={(e) => setResDesc(e.target.value)}
                className="bg-slate-900 border-slate-800 text-white text-xs"
              />
            </div>

            {(resourceType === 'video' || resourceType === 'app') && (
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {resourceType === 'video' ? 'رابط تضمين الفيديو (Embed URL)' : 'رابط الموقع أو التحميل'}
                </Label>
                <Input
                  value={resUrl}
                  onChange={(e) => setResUrl(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white text-xs font-mono h-9"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">نص الشارة / التصنيف (Badge Tag)</Label>
              <Input
                placeholder="مثال: إلزامي ومثبت، جودة الصوت، الشرح التفاعلي"
                value={resBadge}
                onChange={(e) => setResBadge(e.target.value)}
                className="bg-slate-900 border-slate-800 text-white text-xs h-9"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-300 font-medium">إظهار المحتوى للمعلم</span>
              <Switch checked={resVisible} onCheckedChange={setResVisible} />
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsResourceModalOpen(false)}
                className="text-xs text-slate-400"
              >
                إلغاء
              </Button>
              <Button type="submit" size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs">
                حفظ المحتوى
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeachersOnboardingManagement;
