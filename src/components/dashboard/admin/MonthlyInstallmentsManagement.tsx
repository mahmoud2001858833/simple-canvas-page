import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CalendarClock, Search, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

type PendingCfg = { enabled: boolean; months: number };

export const MonthlyInstallmentsManagement = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [pending, setPending] = useState<Record<string, PendingCfg>>({});

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses-monthly-installments', search],
    queryFn: async () => {
      let q = supabase
        .from('courses')
        .select('id, title, title_ar, price, is_active, monthly_installment_enabled, monthly_installment_months')
        .order('created_at', { ascending: false })
        .limit(500);
      if (search.trim()) q = q.or(`title.ilike.%${search}%,title_ar.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['monthly-installment-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_installments')
        .select('*, courses:course_id(title, title_ar, price)')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const userIds = Array.from(new Set((data || []).map((p: any) => p.user_id)));
      let profiles: any[] = [];
      if (userIds.length) {
        const { data: pf } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .in('id', userIds);
        profiles = pf || [];
      }
      return (data || []).map((p: any) => ({
        ...p,
        profile: profiles.find((x) => x.id === p.user_id) || null,
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, cfg }: { id: string; cfg: PendingCfg }) => {
      const { error } = await supabase
        .from('courses')
        .update({
          monthly_installment_enabled: cfg.enabled,
          monthly_installment_months: Math.max(2, Math.min(12, cfg.months || 3)),
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['courses-monthly-installments'] });
      setPending((p) => {
        const n = { ...p };
        delete n[vars.id];
        return n;
      });
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed'),
  });

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : '—';

  const statusBadge = (p: any) => {
    if (p.status === 'completed')
      return <Badge className="bg-green-600">{isRTL ? 'مكتمل' : 'Completed'}</Badge>;
    const expired = p.current_period_end && new Date(p.current_period_end) < new Date();
    return expired ? (
      <Badge variant="destructive">{isRTL ? 'منتهي - بانتظار الدفعة' : 'Expired - awaiting payment'}</Badge>
    ) : (
      <Badge variant="secondary">{isRTL ? 'نشط' : 'Active'}</Badge>
    );
  };

  const filteredPlans = plans.filter((p: any) => {
    if (!studentSearch.trim()) return true;
    const s = studentSearch.toLowerCase();
    return (
      (p.profile?.full_name || '').toLowerCase().includes(s) ||
      (p.profile?.email || '').toLowerCase().includes(s) ||
      (p.courses?.title || '').toLowerCase().includes(s) ||
      (p.courses?.title_ar || '').includes(studentSearch)
    );
  });

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="w-6 h-6" />
          {isRTL ? 'التقسيط على الأشهر' : 'Monthly Installments'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isRTL
            ? 'فعّل الدفع الشهري لأي دورة وحدد عدد الأشهر، وتابع الطلاب المشتركين بالتقسيط بالتفصيل'
            : 'Enable monthly payments per course, set the number of months, and track subscribed students'}
        </p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">{isRTL ? 'إعدادات الدورات' : 'Course Settings'}</TabsTrigger>
          <TabsTrigger value="students">{isRTL ? 'الطلاب المقسّطون' : 'Installment Students'}</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{isRTL ? 'تفعيل التقسيط لكل دورة' : 'Enable per course'}</CardTitle>
              <CardDescription>
                {isRTL
                  ? 'عند التفعيل، يدفع الطالب قيمة الدورة مقسّمة على عدد الأشهر، ويتوقف وصوله في نهاية كل شهر حتى يدفع الشهر التالي.'
                  : 'When enabled, the student pays the course price split across months; access pauses each month until the next payment.'}
              </CardDescription>
              <div className="relative max-w-md pt-2">
                <Search className="absolute start-3 top-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={isRTL ? 'ابحث عن دورة...' : 'Search courses...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ps-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الدورة' : 'Course'}</TableHead>
                      <TableHead>{isRTL ? 'السعر' : 'Price'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'تقسيط شهري' : 'Monthly'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'عدد الأشهر' : 'Months'}</TableHead>
                      <TableHead>{isRTL ? 'قيمة الشهر' : 'Per month'}</TableHead>
                      <TableHead className="text-center">{isRTL ? 'حفظ' : 'Save'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-6">…</TableCell></TableRow>
                    ) : courses.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        {isRTL ? 'لا يوجد' : 'No courses'}
                      </TableCell></TableRow>
                    ) : courses.map((c: any) => {
                      const cfg: PendingCfg = pending[c.id] ?? {
                        enabled: !!c.monthly_installment_enabled,
                        months: c.monthly_installment_months || 3,
                      };
                      const isDirty = !!pending[c.id];
                      const perMonth = c.price ? Math.ceil(Number(c.price) / Math.max(1, cfg.months)) : 0;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium max-w-xs truncate">
                            {isRTL ? c.title_ar : c.title}
                            {!c.is_active && (
                              <Badge variant="outline" className="ms-2 text-xs">
                                {isRTL ? 'معطلة' : 'Inactive'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {c.price ? `${Number(c.price).toLocaleString()} ${isRTL ? 'ر.س' : 'SAR'}` : (isRTL ? 'مجاناً' : 'Free')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={cfg.enabled}
                              onCheckedChange={(v) =>
                                setPending((p) => ({ ...p, [c.id]: { ...cfg, enabled: v } }))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={2}
                              max={12}
                              value={cfg.months}
                              onChange={(e) =>
                                setPending((p) => ({ ...p, [c.id]: { ...cfg, months: Number(e.target.value) } }))
                              }
                              className="w-20 mx-auto text-center"
                            />
                          </TableCell>
                          <TableCell>
                            {perMonth ? `${perMonth.toLocaleString()} ${isRTL ? 'ر.س' : 'SAR'}` : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant={isDirty ? 'default' : 'outline'}
                              disabled={!isDirty || saveMutation.isPending}
                              onClick={() => saveMutation.mutate({ id: c.id, cfg })}
                            >
                              {saveMutation.isPending && saveMutation.variables?.id === c.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                isRTL ? 'حفظ' : 'Save'
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                {isRTL ? 'تفاصيل الطلاب المشتركين بالتقسيط' : 'Installment subscribers'}
              </CardTitle>
              <div className="relative max-w-md pt-2">
                <Search className="absolute start-3 top-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={isRTL ? 'ابحث باسم الطالب أو الدورة...' : 'Search student or course...'}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="ps-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{isRTL ? 'الدورة' : 'Course'}</TableHead>
                      <TableHead>{isRTL ? 'التقدم' : 'Progress'}</TableHead>
                      <TableHead>{isRTL ? 'قيمة الشهر' : 'Monthly'}</TableHead>
                      <TableHead>{isRTL ? 'المدفوع / الإجمالي' : 'Paid / Total'}</TableHead>
                      <TableHead>{isRTL ? 'ينتهي الوصول' : 'Access ends'}</TableHead>
                      <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plansLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-6">…</TableCell></TableRow>
                    ) : filteredPlans.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                        {isRTL ? 'لا يوجد طلاب بالتقسيط الشهري' : 'No monthly installment students'}
                      </TableCell></TableRow>
                    ) : filteredPlans.map((p: any) => {
                      const paidAmount = Number(p.monthly_amount || 0) * Number(p.months_paid || 0);
                      const pct = Math.round((Number(p.months_paid || 0) / Math.max(1, Number(p.total_months || 1))) * 100);
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-medium">{p.profile?.full_name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{p.profile?.email}</div>
                            {p.profile?.phone && (
                              <div className="text-xs text-muted-foreground" dir="ltr">{p.profile.phone}</div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {isRTL ? p.courses?.title_ar : p.courses?.title}
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            <div className="text-xs mb-1">
                              {isRTL
                                ? `${p.months_paid} من ${p.total_months} شهر`
                                : `${p.months_paid} of ${p.total_months} months`}
                            </div>
                            <Progress value={pct} className="h-2" />
                          </TableCell>
                          <TableCell>{Number(p.monthly_amount || 0).toLocaleString()} {isRTL ? 'ر.س' : 'SAR'}</TableCell>
                          <TableCell>
                            {paidAmount.toLocaleString()} / {Number(p.total_amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>{p.status === 'completed' ? (isRTL ? 'دائم' : 'Permanent') : fmtDate(p.current_period_end)}</TableCell>
                          <TableCell>{statusBadge(p)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
