import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Share2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  SOCIAL_PLATFORMS,
  SOCIAL_LINKS_KEY,
  parseSocialLinks,
  isValidSocialUrl,
  type SocialLinkSetting,
} from '@/lib/socialPlatforms';

export const SocialLinksSettings = () => {
  const { language, dir } = useLanguage();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [links, setLinks] = useState<Record<string, SocialLinkSetting>>(() =>
    Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.id, { id: p.id, url: '', enabled: false }]))
  );

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', SOCIAL_LINKS_KEY)
        .maybeSingle();

      if (!error) {
        const saved = parseSocialLinks(data?.value);
        setLinks((prev) => {
          const next = { ...prev };
          saved.forEach((link) => {
            next[link.id] = link;
          });
          return next;
        });
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const update = (id: string, patch: Partial<SocialLinkSetting>) => {
    setLinks((prev) => ({ ...prev, [id]: { ...prev[id], id, ...patch } }));
  };

  const handleSave = async () => {
    const values = Object.values(links);
    const invalid = values.find((l) => l.enabled && !isValidSocialUrl(l.url));
    if (invalid) {
      toast.error(
        language === 'ar'
          ? 'يرجى إدخال رابط صحيح يبدأ بـ https:// للمنصات المفعّلة'
          : 'Please enter a valid https:// link for enabled platforms'
      );
      return;
    }

    setIsSaving(true);
    const payload = values
      .filter((l) => l.url.trim() || l.enabled)
      .map((l) => ({ id: l.id, url: l.url.trim().slice(0, 500), enabled: l.enabled }));

    const { error } = await supabase
      .from('platform_settings')
      .upsert({ key: SOCIAL_LINKS_KEY, value: JSON.stringify(payload), updated_at: new Date().toISOString() }, { onConflict: 'key' });

    setIsSaving(false);

    if (error) {
      toast.error(language === 'ar' ? 'تعذر حفظ الروابط' : 'Could not save links');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['social-links'] });
    toast.success(language === 'ar' ? 'تم حفظ مواقع التواصل الاجتماعي' : 'Social links saved');
  };

  if (isLoading) {
    return (
      <Card className="card-premium">
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-premium" dir={dir}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="w-5 h-5 text-primary" />
          {language === 'ar' ? 'مواقع التواصل الاجتماعي' : 'Social Media'}
        </CardTitle>
        <CardDescription>
          {language === 'ar'
            ? 'فعّل المنصة وأدخل الرابط، وسيظهر شعارها في نهاية الصفحة ويفتح الرابط عند النقر عليه'
            : 'Enable a platform and enter its link; its icon appears in the footer and opens the link on click'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {SOCIAL_PLATFORMS.map((platform) => {
          const link = links[platform.id];
          return (
            <div
              key={platform.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-border"
            >
              <div className="flex items-center gap-3 sm:w-48 shrink-0">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <platform.icon className="w-5 h-5 text-primary" />
                </div>
                <Label className="font-medium">
                  {language === 'ar' ? platform.labelAr : platform.label}
                </Label>
              </div>
              <Input
                dir="ltr"
                value={link?.url ?? ''}
                placeholder={platform.placeholder}
                maxLength={500}
                onChange={(e) => update(platform.id, { url: e.target.value })}
                className="flex-1"
              />
              <Switch
                checked={link?.enabled ?? false}
                onCheckedChange={(checked) => update(platform.id, { enabled: checked })}
                aria-label={platform.label}
              />
            </div>
          );
        })}

        <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-gold text-primary-foreground">
          {isSaving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Save className="w-4 h-4 me-2" />}
          {language === 'ar' ? 'حفظ' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  );
};
