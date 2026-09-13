import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Loader2, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { translateTextWithAI } from '@/lib/aiTranslation';

const KEYS = ['instructor_policies_ar', 'instructor_policies', 'privacy_policy_ar', 'privacy_policy'] as const;

export const TermsManagement = () => {
  const { language, dir } = useLanguage();
  const isRTL = language === 'ar';
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [translatingField, setTranslatingField] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-settings-terms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', KEYS as unknown as string[]);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.key] = String(s.value ?? '').replace(/^"|"$/g, ''); });
      return map;
    },
  });

  useEffect(() => {
    if (settings) setValues(settings);
  }, [settings]);

  const set = (key: string, value: string) => setValues((p) => ({ ...p, [key]: value }));

  const handleTranslate = async (sourceKey: string, targetKey: string, sourceLang: 'ar' | 'en', targetLang: 'ar' | 'en') => {
    const sourceText = values[sourceKey];
    if (!sourceText || !sourceText.trim()) {
      toast.error(isRTL ? 'يرجى إدخال نص للترجمة أولاً' : 'Please enter text to translate first');
      return;
    }
    setTranslatingField(targetKey);
    try {
      toast.info(isRTL ? 'جاري الترجمة بالذكاء الاصطناعي...' : 'Translating with AI...');
      const translated = await translateTextWithAI({
        text: sourceText,
        sourceLang,
        targetLang,
      });
      if (translated) {
        set(targetKey, translated);
        toast.success(isRTL ? 'تمت الترجمة بنجاح' : 'Translation successful');
      }
    } catch (e: any) {
      toast.error(e.message || (isRTL ? 'فشلت الترجمة' : 'Translation failed'));
    } finally {
      setTranslatingField(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const key of KEYS) {
        const { error } = await supabase
          .from('platform_settings')
          .upsert({ key, value: values[key] ?? '', updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ['platform-settings-terms'] });
      await queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      toast.success(isRTL ? 'تم حفظ الشروط والسياسات' : 'Terms & policies saved');
    } catch (e: any) {
      toast.error(e.message || (isRTL ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">{isRTL ? 'الشروط والأحكام والسياسات' : 'Terms & Policies'}</h1>
          <p className="text-muted-foreground">
            {isRTL ? 'تعديل نص الشروط والأحكام وسياسة الخصوصية الظاهرة للمستخدمين' : 'Edit the public terms and privacy policy content'}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isRTL ? 'حفظ التغييرات' : 'Save changes'}
        </Button>
      </div>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {isRTL ? 'المحتوى' : 'Content'}
          </CardTitle>
          <CardDescription>
            {isRTL ? 'يظهر هذا المحتوى في صفحتي /terms و /privacy' : 'Shown on the /terms and /privacy pages'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="terms">
            <TabsList>
              <TabsTrigger value="terms">{isRTL ? 'الشروط والأحكام' : 'Terms'}</TabsTrigger>
              <TabsTrigger value="privacy">{isRTL ? 'سياسة الخصوصية' : 'Privacy policy'}</TabsTrigger>
            </TabsList>

            <TabsContent value="terms" className="grid md:grid-cols-2 gap-6 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{isRTL ? 'النص بالعربية' : 'Arabic text'}</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={!values.instructor_policies || translatingField === 'instructor_policies_ar'}
                    onClick={() => handleTranslate('instructor_policies', 'instructor_policies_ar', 'en', 'ar')}
                  >
                    {translatingField === 'instructor_policies_ar' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-primary" />
                    )}
                    {isRTL ? 'ترجم من الإنجليزية (AI)' : 'Translate from English (AI)'}
                  </Button>
                </div>
                <Textarea
                  dir="rtl"
                  rows={20}
                  value={values.instructor_policies_ar || ''}
                  onChange={(e) => set('instructor_policies_ar', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{isRTL ? 'النص بالإنجليزية' : 'English text'}</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={!values.instructor_policies_ar || translatingField === 'instructor_policies'}
                    onClick={() => handleTranslate('instructor_policies_ar', 'instructor_policies', 'ar', 'en')}
                  >
                    {translatingField === 'instructor_policies' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-primary" />
                    )}
                    {isRTL ? 'ترجم من العربية (AI)' : 'Translate from Arabic (AI)'}
                  </Button>
                </div>
                <Textarea
                  dir="ltr"
                  rows={20}
                  value={values.instructor_policies || ''}
                  onChange={(e) => set('instructor_policies', e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="privacy" className="grid md:grid-cols-2 gap-6 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{isRTL ? 'النص بالعربية' : 'Arabic text'}</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={!values.privacy_policy || translatingField === 'privacy_policy_ar'}
                    onClick={() => handleTranslate('privacy_policy', 'privacy_policy_ar', 'en', 'ar')}
                  >
                    {translatingField === 'privacy_policy_ar' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-primary" />
                    )}
                    {isRTL ? 'ترجم من الإنجليزية (AI)' : 'Translate from English (AI)'}
                  </Button>
                </div>
                <Textarea
                  dir="rtl"
                  rows={20}
                  value={values.privacy_policy_ar || ''}
                  onChange={(e) => set('privacy_policy_ar', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{isRTL ? 'النص بالإنجليزية' : 'English text'}</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={!values.privacy_policy_ar || translatingField === 'privacy_policy'}
                    onClick={() => handleTranslate('privacy_policy_ar', 'privacy_policy', 'ar', 'en')}
                  >
                    {translatingField === 'privacy_policy' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-primary" />
                    )}
                    {isRTL ? 'ترجم من العربية (AI)' : 'Translate from Arabic (AI)'}
                  </Button>
                </div>
                <Textarea
                  dir="ltr"
                  rows={20}
                  value={values.privacy_policy || ''}
                  onChange={(e) => set('privacy_policy', e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
