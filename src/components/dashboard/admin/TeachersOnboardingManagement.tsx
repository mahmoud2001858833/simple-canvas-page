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
  ExternalLink,
  Search,
  RefreshCw,
  Wallet,
  Sparkles,
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
      // 1. Fetch instructors from profiles & user_roles & tables & platform_settings
      const [profilesRes, rolesRes, contractsRes, banksRes, lifecycleProfRes, platformSettingsRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*').eq('role', 'instructor'),
        (supabase as any).from('teacher_contracts').select('*'),
        (supabase as any).from('teacher_bank_details').select('*'),
        (supabase as any).from('teacher_profiles').select('*'),
        supabase.from('platform_settings').select('*').like('key', 'teacher_%'),
      ]);

      const instructorIds = new Set((rolesRes.data || []).map((r: any) => r.user_id));
      const profiles = profilesRes.data || [];
      const contracts = contractsRes.data || [];
      const banks = banksRes.data || [];
      const lifecycleProfiles = lifecycleProfRes.data || [];
      const settingsList = platformSettingsRes.data || [];

      // Create settings lookup map
      const settingsMap: Record<string, any> = {};
      for (const s of settingsList) {
        try {
          settingsMap[s.key] = JSON.parse(s.value || '{}');
        } catch {}
      }

      const merged: TeacherItem[] = [];

      for (const p of profiles) {
        if (instructorIds.has(p.id) || p.teaching_year || p.specialty) {
          let contract = contracts.find((c: any) => c.teacher_id === p.id);
          let bank = banks.find((b: any) => b.teacher_id === p.id);
          let lProfile = lifecycleProfiles.find((lp: any) => lp.id === p.id);

          // Check cloud JSON store in profiles.teaching_experience_details
          if (p.teaching_experience_details) {
            try {
              const parsed = JSON.parse(p.teaching_experience_details);
              if (!bank && parsed.bank) bank = parsed.bank;
              if (!contract && parsed.contract) contract = parsed.contract;
              if (parsed.onboarding_status) lProfile = { onboarding_status: parsed.onboarding_status };
            } catch {}
          }

          // Check platform_settings key
          if (!bank && settingsMap[`teacher_bank_${p.id}`]) {
            bank = settingsMap[`teacher_bank_${p.id}`];
          }
          if (settingsMap[`teacher_data_${p.id}`]) {
            const td = settingsMap[`teacher_data_${p.id}`];
            if (!bank && td.bank) bank = td.bank;
            if (!contract && td.contract) contract = td.contract;
            if (td.onboarding_status) lProfile = { onboarding_status: td.onboarding_status };
          }

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

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.bank?.bank_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    } catch {
      toast.error('حدث خطأ أثناء تعديل حالة الحساب');
    }
  };

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
    setResourceType(res.type as 'video' | 'tip' | 'app');
    setResTitle(res.title);
    setResDesc(res.description);
    setResUrl(res.url || '');
    setResBadge(res.badge_tag || '');
    setResVisible(res.is_visible);
    setIsResourceModalOpen(true);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resDesc.trim()) {
      toast.error('يرجى ملء العنوان والوصف');
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
    } catch {
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
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">نشط ومعتمد</Badge>;
      case 'policy_signed':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">وقع الاتفاقية</Badge>;
      case 'bank_submitted':
        return <Badge className="bg-amber-50 text-amber-800 border-amber-300">أدخل البيانات البنكية</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">مسجل جديد</Badge>;
    }
  };

  const videosList = resources.filter((r) => r.type === 'video');
  const tipsList = resources.filter((r) => r.type === 'tip');
  const appsList = resources.filter((r) => r.type === 'app');

  return (
    <div className="space-y-6 text-slate-900">
      {/* 4 Stat Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">إجمالي المعلمين المسجلين</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{teachers.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">الموقعون على السياسات</p>
              <h3 className="text-2xl font-bold text-emerald-700 mt-1">
                {teachers.filter((t) => t.status === 'policy_signed' || t.status === 'active').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">الحسابات البنكية الموثقة</p>
              <h3 className="text-2xl font-bold text-blue-700 mt-1">
                {teachers.filter((t) => t.bank?.verified_by_admin).length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">موارد المعلمين (CMS)</p>
              <h3 className="text-2xl font-bold text-purple-700 mt-1">{resources.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="roster" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <TabsList className="bg-slate-100 border border-slate-200 p-1">
            <TabsTrigger value="roster" className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs font-bold">
              كشف المعلمين والبيانات البنكية ({teachers.length})
            </TabsTrigger>
            <TabsTrigger value="videos" className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs font-bold">
              الأدلة الإرشادية ({videosList.length})
            </TabsTrigger>
            <TabsTrigger value="tips_apps" className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs font-bold">
              النصائح والتطبيقات ({tipsList.length + appsList.length})
            </TabsTrigger>
            <TabsTrigger value="template" className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs font-bold">
              قالب الشرح الرسمي
            </TabsTrigger>
          </TabsList>

          {onNavigateToPayouts && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToPayouts}
              className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold self-start sm:self-auto"
            >
              <Wallet className="w-3.5 h-3.5 me-1.5" />
              الانتقال لغرفة مفاوضات ونسب الأرباح &larr;
            </Button>
          )}
        </div>

        {/* TAB 1: TEACHERS ROSTER */}
        <TabsContent value="roster" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute end-3 top-3 text-slate-400" />
              <Input
                placeholder="ابحث بالاسم، الإيميل، أو البنك..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border-slate-300 text-slate-900 text-xs h-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadData} className="border-slate-200 text-slate-600 hover:bg-slate-50 text-xs h-9">
              <RefreshCw className={`w-3.5 h-3.5 me-1.5 ${loading ? 'animate-spin' : ''}`} />
              تحديث الكشف
            </Button>
          </div>

          <Card className="bg-white border-slate-200 shadow-xs overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-200">
                  <TableHead className="text-start text-xs text-slate-700 font-bold">المعلم</TableHead>
                  <TableHead className="text-start text-xs text-slate-700 font-bold">حالة الانضمام</TableHead>
                  <TableHead className="text-start text-xs text-slate-700 font-bold">وثيقة العقد والسياسات</TableHead>
                  <TableHead className="text-start text-xs text-slate-700 font-bold">الحساب البنكي والآيبان</TableHead>
                  <TableHead className="text-start text-xs text-slate-700 font-bold">إجراءات الإدارة</TableHead>
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
                    <TableRow key={teacher.id} className="border-slate-100 hover:bg-slate-50/70">
                      <TableCell className="text-start">
                        <div className="font-bold text-slate-900 text-sm">{teacher.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{teacher.email}</div>
                        {teacher.phone && <div className="text-[11px] text-slate-400 mt-0.5">{teacher.phone}</div>}
                      </TableCell>

                      <TableCell className="text-start">{getStatusBadge(teacher.status)}</TableCell>

                      <TableCell className="text-start">
                        {teacher.signedAt ? (
                          <div className="space-y-1">
                            <div className="text-xs text-emerald-700 flex items-center gap-1 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              تم التوقيع ({new Date(teacher.signedAt).toLocaleDateString('ar-SA')})
                            </div>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => setSelectedContractTeacher(teacher)}
                              className="text-[11px] text-amber-700 p-0 h-auto hover:underline flex items-center gap-1 font-bold"
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
                            <div className="text-xs text-slate-900 font-bold flex items-center gap-1.5">
                              <span>{teacher.bank.bank_name}</span>
                              {teacher.bank.verified_by_admin ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0">
                                  موثق
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[9px] px-1.5 py-0">
                                  قيد الفحص
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 font-mono truncate max-w-[190px]">
                              {teacher.bank.iban}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">لم تُدخل البيانات البنكية بعد</span>
                        )}
                      </TableCell>

                      <TableCell className="text-start">
                        <div className="flex items-center gap-2">
                          {teacher.bank && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedBankTeacher(teacher)}
                              className="text-xs border-slate-300 text-slate-700 hover:bg-slate-100 h-8"
                            >
                              <Landmark className="w-3.5 h-3.5 me-1 text-amber-600" />
                              فحص واعتماد
                            </Button>
                          )}
                          {onNavigateToPayouts && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={onNavigateToPayouts}
                              className="text-xs border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 h-8 font-semibold"
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

        {/* TAB 2: GUIDES CMS */}
        <TabsContent value="videos" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">أدلة المعايير الأكاديمية للمعلم</h3>
              <p className="text-xs text-slate-500">
                إدارة الأدلة والوثائق الأكاديمية التي تظهر للمعلمين في صفحة استكمال الانضمام.
              </p>
            </div>
            <Button
              onClick={() => handleOpenAddResource('video')}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs h-9 shadow-xs"
            >
              <Plus className="w-4 h-4 me-1.5" />
              إضافة دليل أكاديمي
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {videosList.map((vid) => (
              <Card key={vid.id} className="bg-white border-slate-200 shadow-xs overflow-hidden text-start">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{vid.title}</h4>
                        <Badge className="bg-slate-100 text-slate-700 border-none text-[10px] mt-1">
                          {vid.badge_tag || 'دليل معتمد'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditResource(vid)}
                        className="h-8 w-8 text-slate-500 hover:text-slate-800"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteResource(vid.id)}
                        className="h-8 w-8 text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{vid.description}</p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">{vid.url}</p>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">حالة الظهور للمعلم</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">{vid.is_visible ? 'ظاهر' : 'مخفي'}</span>
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
              <h3 className="text-base font-bold text-slate-900">النصائح والتطبيقات المنصوح بها</h3>
              <p className="text-xs text-slate-500">توجيهات التدريس وتطبيقات الشرح الموصى بها للمعلمين.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenAddResource('tip')}
                className="text-xs border-slate-300 text-slate-700"
              >
                <Plus className="w-3.5 h-3.5 me-1" />
                إضافة نصيحة
              </Button>
              <Button
                size="sm"
                onClick={() => handleOpenAddResource('app')}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <Plus className="w-3.5 h-3.5 me-1" />
                إضافة تطبيق
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-800 text-start">النصائح والتوجيهات ({tipsList.length})</h4>
            <div className="grid md:grid-cols-2 gap-3">
              {tipsList.map((tip) => (
                <div
                  key={tip.id}
                  className="p-4 rounded-xl bg-white border border-slate-200 flex items-start justify-between text-start shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{tip.title}</span>
                      {tip.badge_tag && <Badge className="text-[10px] bg-slate-100 text-slate-700 border-none">{tip.badge_tag}</Badge>}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{tip.description}</p>
                  </div>
                  <div className="flex items-center gap-1 ms-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditResource(tip)}
                      className="h-7 w-7 text-slate-400 hover:text-slate-800"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteResource(tip.id)}
                      className="h-7 w-7 text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-bold text-emerald-800 text-start">التطبيقات المقترحة ({appsList.length})</h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {appsList.map((app) => (
                <div
                  key={app.id}
                  className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col justify-between text-start shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">{app.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteResource(app.id)}
                        className="h-6 w-6 text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{app.description}</p>
                  </div>
                  {app.url && (
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 text-[11px] text-amber-700 font-bold flex items-center gap-1 hover:underline"
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
          <Card className="bg-white border-slate-200 shadow-xs text-start">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-base text-slate-900 font-bold flex items-center gap-2">
                <Download className="w-5 h-5 text-amber-600" />
                إدارة قالب الشرح الرسمي لمنصة جسوركم (Presentation Template)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                هذا القالب يظهر لكافة المعلمين في صفحة استكمال الانضمام لتحميله واستخدامه في تحضير شرائح الشرح.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">عنوان القالب</Label>
                <Input
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">الوصف التوضيحي</Label>
                <Textarea
                  rows={2}
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">رابط تحميل الملف (URL / Storage Path)</Label>
                <Input
                  value={templateUrl}
                  onChange={(e) => setTemplateUrl(e.target.value)}
                  className="bg-white border-slate-300 text-slate-900 text-xs font-mono h-10"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleSaveTemplate}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs h-10 px-6 shadow-xs"
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
        <DialogContent className="bg-white border border-slate-200 text-slate-900 max-w-lg text-start rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-amber-600" />
              فحص وتوثيق الحساب البنكي للمعلم
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              مطابقة بيانات التحويلات المالية للأرباح الخاصة بالأستاذ {selectedBankTeacher?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedBankTeacher?.bank ? (
            <div className="space-y-4 my-2 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">البنك:</span>
                  <span className="font-bold text-slate-900">{selectedBankTeacher.bank.bank_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">رقم الحساب:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedBankTeacher.bank.account_number}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">الآيبان (IBAN):</span>
                  <span className="font-mono font-bold text-amber-700" dir="ltr">{selectedBankTeacher.bank.iban}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">الفرع:</span>
                  <span className="font-medium text-slate-700">{selectedBankTeacher.bank.branch_name || 'غير محدد'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-semibold">حالة الاعتماد:</span>
                  <span>
                    {selectedBankTeacher.bank.verified_by_admin ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">موثق ومعتمد</Badge>
                    ) : (
                      <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">قيد المراجعة</Badge>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBankTeacher(null)}
                  className="border-slate-300 text-slate-700"
                >
                  إغلاق
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleToggleBankVerified(selectedBankTeacher)}
                  className={
                    selectedBankTeacher.bank.verified_by_admin
                      ? 'bg-rose-500 hover:bg-rose-600 text-white font-bold'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
                  }
                >
                  {selectedBankTeacher.bank.verified_by_admin ? 'إلغاء الاعتماد' : 'اعتماد الحساب البنكي رسمياً'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4">لم يدخل هذا المعلم بياناته البنكية بعد.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: View Contract */}
      <Dialog open={!!selectedContractTeacher} onOpenChange={() => setSelectedContractTeacher(null)}>
        <DialogContent className="bg-white border border-slate-200 text-slate-900 max-w-lg text-start rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-600" />
              وثيقة العقد الرقمي الموثق
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              تفاصيل التوقيع الإلكتروني للأستاذ {selectedContractTeacher?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">المعلم الموقع:</span>
                <span className="font-bold text-slate-900">{selectedContractTeacher?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">البريد الإلكتروني:</span>
                <span className="font-mono text-slate-700">{selectedContractTeacher?.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">تاريخ التوقيع:</span>
                <span className="text-slate-700">
                  {selectedContractTeacher?.signedAt ? new Date(selectedContractTeacher.signedAt).toLocaleString('ar-SA') : 'مسجل'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-semibold">البصمة الرقمية:</span>
                <span className="font-mono text-emerald-700 font-bold">SHA256-DIGITAL-VERIFIED</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedContractTeacher(null)}
                className="border-slate-300 text-slate-700"
              >
                إغلاق
              </Button>
              {selectedContractTeacher?.contractUrl && (
                <a
                  href={selectedContractTeacher.contractUrl}
                  download={`عقد_${selectedContractTeacher.name}.pdf`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-4 py-2 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  تحميل نسخة العقد PDF
                </a>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Add/Edit Resource */}
      <Dialog open={isResourceModalOpen} onOpenChange={setIsResourceModalOpen}>
        <DialogContent className="bg-white border border-slate-200 text-slate-900 max-w-md text-start rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingResource ? 'تعديل المحتوى الأكاديمي' : 'إضافة محتوى أكاديمي جديد'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              تحديد محتوى الأدلة والنصائح التي تظهر للمعلمين أثناء استكمال الانضمام.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveResource} className="space-y-3.5 my-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">العنوان الرئيسي</Label>
              <Input
                value={resTitle}
                onChange={(e) => setResTitle(e.target.value)}
                placeholder="عنوان الدليل أو التطبيق"
                className="bg-white border-slate-300 text-slate-900 text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">الوصف والشرح</Label>
              <Textarea
                rows={3}
                value={resDesc}
                onChange={(e) => setResDesc(e.target.value)}
                placeholder="شرح موجز لأهمية هذا المورد وكيفية الاستفادة منه"
                className="bg-white border-slate-300 text-slate-900 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">الرابط (URL / Download Path)</Label>
              <Input
                value={resUrl}
                onChange={(e) => setResUrl(e.target.value)}
                placeholder="https://..."
                className="bg-white border-slate-300 text-slate-900 text-xs font-mono h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">شارة التصنيف (Badge Tag)</Label>
              <Input
                value={resBadge}
                onChange={(e) => setResBadge(e.target.value)}
                placeholder="مثال: إرشادي، موصى به، جودة عالية"
                className="bg-white border-slate-300 text-slate-900 text-xs h-9"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsResourceModalOpen(false)}
                className="text-xs border-slate-300 text-slate-700"
              >
                إلغاء
              </Button>
              <Button type="submit" className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold">
                حفظ
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeachersOnboardingManagement;
