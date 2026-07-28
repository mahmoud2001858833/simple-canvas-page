import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreditCard, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ALL_METHODS = [
  { key: 'alinmapay', labelAr: 'الإنماء (أونلاين)', labelEn: 'Alinma (Online)' },
  { key: 'bank_transfer', labelAr: 'تحويل بنكي / يدوي', labelEn: 'Bank Transfer / Manual' },
];

export const PaymentMethodsManagement = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Record<string, string[]>>({});

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses-payment-methods', search],
    queryFn: async () => {
      let q = supabase
        .from('courses')
        .select('id, title, title_ar, price, is_active, enabled_payment_methods')
        .order('created_at', { ascending: false })
        .limit(500);
      if (search.trim()) q = q.or(`title.ilike.%${search}%,title_ar.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, methods }: { id: string; methods: string[] }) => {
      const { error } = await supabase
        .from('courses')
        .update({ enabled_payment_methods: methods } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['courses-payment-methods'] });
      setPending((p) => {
        const n = { ...p };
        delete n[vars.id];
        return n;
      });
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
    },
    onError: (e: any) =>
      toast.error(isRTL ? `فشل: ${e?.message || ''}` : `Failed: ${e?.message || ''}`),
  });

  const toggle = (courseId: string, current: string[], method: string) => {
    const next = current.includes(method)
      ? current.filter((m) => m !== method)
      : [...current, method];
    setPending((p) => ({ ...p, [courseId]: next }));
  };

  const bulkSet = async (enable: boolean) => {
    if (!confirm(isRTL ? 'تطبيق على كل الدورات؟' : 'Apply to all courses?')) return;
    const methods = enable ? ALL_METHODS.map((m) => m.key) : [];
    const ids = courses.map((c: any) => c.id);
    const { error } = await supabase
      .from('courses')
      .update({ enabled_payment_methods: methods } as any)
      .in('id', ids);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['courses-payment-methods'] });
    toast.success(isRTL ? 'تم التحديث' : 'Updated');
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            {isRTL ? 'طرق الدفع لكل دورة' : 'Payment Methods per Course'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL
              ? 'حدّد أي طرق دفع تظهر للطلاب عند شراء كل دورة'
              : 'Choose which payment methods appear to students on each course'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => bulkSet(true)}>
            {isRTL ? 'تفعيل الكل' : 'Enable All'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => bulkSet(false)}>
            {isRTL ? 'تعطيل الكل' : 'Disable All'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-md">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                  {ALL_METHODS.map((m) => (
                    <TableHead key={m.key} className="text-center">
                      {isRTL ? m.labelAr : m.labelEn}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">{isRTL ? 'حفظ' : 'Save'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6">…</TableCell></TableRow>
                ) : courses.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    {isRTL ? 'لا يوجد' : 'No courses'}
                  </TableCell></TableRow>
                ) : courses.map((c: any) => {
                  const current: string[] =
                    pending[c.id] ?? (c.enabled_payment_methods || []);
                  const isDirty = !!pending[c.id];
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
                      {ALL_METHODS.map((m) => (
                        <TableCell key={m.key} className="text-center">
                          <Checkbox
                            checked={current.includes(m.key)}
                            onCheckedChange={() => toggle(c.id, current, m.key)}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant={isDirty ? 'default' : 'outline'}
                          disabled={!isDirty || saveMutation.isPending}
                          onClick={() => saveMutation.mutate({ id: c.id, methods: current })}
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
    </div>
  );
};
