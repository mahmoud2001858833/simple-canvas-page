import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Ticket, Copy, Trash2, Search, Percent, DollarSign, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { motion } from 'framer-motion';

export const CouponsManagement = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAr = language === 'ar';
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    max_uses: '',
    min_order_amount: '',
    max_discount_amount: '',
    expires_at: '',
    description: '',
    description_ar: '',
    course_id: '',
  });

  const { data: coursesList = [] } = useQuery({
    queryKey: ['coupon-courses-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, title_ar')
        .eq('is_active', true)
        .order('title_ar');
      if (error) throw error;
      return data || [];
    },
  });

  const t = {
    title: isAr ? 'إدارة الكوبونات' : 'Coupons Management',
    subtitle: isAr ? 'إنشاء وإدارة كوبونات الخصم' : 'Create and manage discount coupons',
    newCoupon: isAr ? 'كوبون جديد' : 'New Coupon',
    code: isAr ? 'كود الكوبون' : 'Coupon Code',
    type: isAr ? 'نوع الخصم' : 'Discount Type',
    percentage: isAr ? 'نسبة مئوية' : 'Percentage',
    fixed: isAr ? 'مبلغ ثابت' : 'Fixed Amount',
    value: isAr ? 'قيمة الخصم' : 'Discount Value',
    maxUses: isAr ? 'الحد الأقصى للاستخدام (فارغ = غير محدود)' : 'Max Uses (empty = unlimited)',
    minOrder: isAr ? 'الحد الأدنى للطلب (ر.س)' : 'Min Order Amount (SAR)',
    maxDiscount: isAr ? 'الحد الأقصى للخصم (ر.س)' : 'Max Discount (SAR)',
    expiresAt: isAr ? 'تاريخ الانتهاء' : 'Expiry Date',
    description: isAr ? 'الوصف (عربي)' : 'Description (Arabic)',
    descriptionEn: isAr ? 'الوصف (إنجليزي)' : 'Description (English)',
    create: isAr ? 'إنشاء الكوبون' : 'Create Coupon',
    active: isAr ? 'نشط' : 'Active',
    expired: isAr ? 'منتهي' : 'Expired',
    inactive: isAr ? 'غير نشط' : 'Inactive',
    uses: isAr ? 'الاستخدامات' : 'Uses',
    noData: isAr ? 'لا توجد كوبونات' : 'No coupons found',
    copied: isAr ? 'تم نسخ الكود' : 'Code copied',
    created: isAr ? 'تم إنشاء الكوبون بنجاح' : 'Coupon created successfully',
    deleted: isAr ? 'تم حذف الكوبون' : 'Coupon deleted',
    totalCoupons: isAr ? 'إجمالي الكوبونات' : 'Total Coupons',
    activeCoupons: isAr ? 'كوبونات نشطة' : 'Active Coupons',
    totalUsage: isAr ? 'إجمالي الاستخدام' : 'Total Usage',
  };

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['admin-coupons', search],
    queryFn: async () => {
      let query = supabase.from('coupons').select('*').order('created_at', { ascending: false });
      if (search) {
        query = query.ilike('code', `%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.code || !form.discount_value) {
        throw new Error(isAr ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields');
      }
      const { error } = await supabase.from('coupons').insert({
        code: form.code.toUpperCase(),
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : 0,
        max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null,
        expires_at: form.expires_at || null,
        description: form.description || null,
        description_ar: form.description_ar || null,
        course_id: form.course_id || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      toast.success(t.created);
      setIsDialogOpen(false);
      setForm({ code: '', discount_type: 'percentage', discount_value: '', max_uses: '', min_order_amount: '', max_discount_amount: '', expires_at: '', description: '', description_ar: '', course_id: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('coupons').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-coupons'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      toast.success(t.deleted);
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t.copied);
  };

  const isExpired = (expiresAt: string | null) => expiresAt && new Date(expiresAt) < new Date();
  const activeCoupons = coupons.filter((c: any) => c.is_active && !isExpired(c.expires_at));
  const totalUsage = coupons.reduce((sum: number, c: any) => sum + (c.current_uses || 0), 0);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setForm({ ...form, code });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gold">
              <Plus className="w-4 h-4 me-2" />
              {t.newCoupon}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t.newCoupon}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>{t.code} *</Label>
                <div className="flex gap-2">
                  <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE20" dir="ltr" />
                  <Button variant="outline" size="sm" onClick={generateCode} type="button">
                    {isAr ? 'توليد' : 'Generate'}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t.type}</Label>
                  <Select value={form.discount_type} onValueChange={v => setForm({ ...form, discount_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">{t.percentage} (%)</SelectItem>
                      <SelectItem value="fixed">{t.fixed} (SAR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.value} *</Label>
                  <Input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} placeholder={form.discount_type === 'percentage' ? '20' : '50'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t.maxUses}</Label>
                  <Input type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} placeholder="100" />
                </div>
                <div className="space-y-2">
                  <Label>{t.expiresAt}</Label>
                  <Input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t.minOrder}</Label>
                  <Input type="number" value={form.min_order_amount} onChange={e => setForm({ ...form, min_order_amount: e.target.value })} placeholder="0" />
                </div>
                {form.discount_type === 'percentage' && (
                  <div className="space-y-2">
                    <Label>{t.maxDiscount}</Label>
                    <Input type="number" value={form.max_discount_amount} onChange={e => setForm({ ...form, max_discount_amount: e.target.value })} placeholder="100" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t.description}</Label>
                <Textarea value={form.description_ar} onChange={e => setForm({ ...form, description_ar: e.target.value })} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>{t.descriptionEn}</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <Button className="btn-gold w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? '...' : t.create}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: t.totalCoupons, value: coupons.length, icon: Ticket, color: 'from-primary to-primary/80' },
          { title: t.activeCoupons, value: activeCoupons.length, icon: Percent, color: 'from-green-500 to-green-600' },
          { title: t.totalUsage, value: totalUsage, icon: Users, color: 'from-amber-500 to-amber-600' },
        ].map((card, i) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                    <card.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-xl font-bold">{card.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={isAr ? 'بحث بالكود...' : 'Search by code...'} value={search} onChange={e => setSearch(e.target.value)} className="ps-10" />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
          ) : coupons.length === 0 ? (
            <div className="p-12 text-center">
              <Ticket className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">{t.noData}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.code}</TableHead>
                  <TableHead>{t.type}</TableHead>
                  <TableHead>{t.value}</TableHead>
                  <TableHead>{t.uses}</TableHead>
                  <TableHead>{t.expiresAt}</TableHead>
                  <TableHead>{isAr ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{isAr ? 'إجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon: any) => {
                  const expired = isExpired(coupon.expires_at);
                  const maxReached = coupon.max_uses && coupon.current_uses >= coupon.max_uses;
                  return (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono font-bold">{coupon.code}</code>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyCode(coupon.code)}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {coupon.discount_type === 'percentage' ? <Percent className="w-3 h-3 me-1" /> : <DollarSign className="w-3 h-3 me-1" />}
                          {coupon.discount_type === 'percentage' ? (isAr ? 'نسبة' : '%') : (isAr ? 'ثابت' : 'Fixed')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold">
                        {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `${coupon.discount_value} ${isAr ? 'ر.س' : 'SAR'}`}
                      </TableCell>
                      <TableCell>
                        {coupon.current_uses}{coupon.max_uses ? `/${coupon.max_uses}` : ''}
                      </TableCell>
                      <TableCell className="text-sm">
                        {coupon.expires_at
                          ? format(new Date(coupon.expires_at), 'PP', { locale: isAr ? ar : enUS })
                          : (isAr ? 'بلا انتهاء' : 'No expiry')}
                      </TableCell>
                      <TableCell>
                        {expired ? (
                          <Badge variant="destructive">{t.expired}</Badge>
                        ) : maxReached ? (
                          <Badge variant="secondary">{isAr ? 'مكتمل' : 'Maxed'}</Badge>
                        ) : coupon.is_active ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{t.active}</Badge>
                        ) : (
                          <Badge variant="secondary">{t.inactive}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={coupon.is_active}
                            onCheckedChange={v => toggleMutation.mutate({ id: coupon.id, is_active: v })}
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(coupon.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
