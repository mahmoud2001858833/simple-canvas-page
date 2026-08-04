import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Percent, Search, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const CourseCommissions = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [retroactive, setRetroactive] = useState(true);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: courses, isLoading } = useQuery({
    queryKey: ['admin-course-commissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, title_ar, price, instructor_commission, instructor_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (courses || []).filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${c.title} ${c.title_ar}`.toLowerCase().includes(q);
  });

  const handleSave = async (courseId: string, current: number) => {
    const raw = rates[courseId];
    const rate = raw === undefined || raw === '' ? current : Number(raw);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      toast.error(isRTL ? 'النسبة يجب أن تكون بين 0 و 100' : 'Rate must be between 0 and 100');
      return;
    }
    setSavingId(courseId);
    try {
      const { error } = await supabase.rpc('set_course_commission', {
        p_course_id: courseId,
        p_rate: rate,
        p_retroactive: retroactive,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['admin-course-commissions'] });
      toast.success(
        isRTL
          ? retroactive ? 'تم تحديث النسبة وتطبيقها على الأرباح السابقة' : 'تم تحديث النسبة'
          : retroactive ? 'Rate updated and applied retroactively' : 'Rate updated'
      );
    } catch (e) {
      console.error(e);
      toast.error(isRTL ? 'فشل تحديث النسبة' : 'Failed to update rate');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card className="card-premium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-primary" />
          {isRTL ? 'نسبة أرباح كل دورة' : 'Per-course commission'}
        </CardTitle>
        <CardDescription>
          {isRTL
            ? 'تحكم بنسبة ربح المعلم لكل دورة، مع إمكانية تطبيق التغيير على الأرباح غير المدفوعة السابقة'
            : 'Control the instructor share per course, optionally applying it to previous unpaid earnings'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute top-3 start-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRTL ? 'ابحث عن دورة...' : 'Search courses...'}
              className="ps-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={retroactive} onCheckedChange={setRetroactive} id="retro" />
            <Label htmlFor="retro" className="text-sm">
              {isRTL ? 'تطبيق بأثر رجعي' : 'Apply retroactively'}
            </Label>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {filtered.map((c) => {
              const current = Number(c.instructor_commission ?? 30);
              return (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{isRTL ? c.title_ar : c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {isRTL ? 'الحالية' : 'Current'}: <Badge variant="secondary">{current}%</Badge>
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-24"
                    value={rates[c.id] ?? String(current)}
                    onChange={(e) => setRates({ ...rates, [c.id]: e.target.value })}
                  />
                  <Button
                    size="sm"
                    className="gap-2 shrink-0"
                    disabled={savingId === c.id}
                    onClick={() => handleSave(c.id, current)}
                  >
                    {savingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isRTL ? 'حفظ' : 'Save'}
                  </Button>
                </div>
              );
            })}
            {!filtered.length && (
              <p className="text-center text-muted-foreground py-8 text-sm">
                {isRTL ? 'لا توجد دورات' : 'No courses found'}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
