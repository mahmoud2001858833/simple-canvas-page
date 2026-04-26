import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding, OnboardingPage } from '@/contexts/OnboardingContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw, Globe, Bell, Shield, BookOpen, GraduationCap, PlayCircle, LayoutDashboard, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const UserSettings = () => {
  const { language, setLanguage } = useLanguage();
  const { user, role } = useAuth();
  const { resetOnboarding, isPageDisabled, togglePageOnboarding, resetPageOnboarding } = useOnboarding();
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [savingYear, setSavingYear] = useState(false);

  // Load current year
  useEffect(() => {
    const loadYear = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('teaching_year, study_year')
        .eq('id', user.id)
        .single();
      if (data) {
        const yearVal = role === 'instructor' ? (data as any).teaching_year : (data as any).study_year;
        if (yearVal) setSelectedYear(yearVal);
      }
    };
    loadYear();
  }, [user, role]);

  const handleYearChange = async (value: string) => {
    setSelectedYear(value);
    if (!user) return;
    setSavingYear(true);
    try {
      const updateData: any = role === 'instructor'
        ? { teaching_year: value }
        : { study_year: value };
      const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id);
      if (error) throw error;
      toast.success(language === 'ar' ? 'تم حفظ السنة الدراسية' : 'Year saved successfully');
    } catch {
      toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
    } finally {
      setSavingYear(false);
    }
  };

  const handleResetOnboarding = () => {
    resetOnboarding();
    toast.success(
      language === 'ar' 
        ? 'تم إعادة تعيين التوجيهات. ستظهر عند تحديث الصفحة.' 
        : 'Onboarding reset. It will appear on page refresh.'
    );
  };

  const handleLanguageToggle = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {language === 'ar' ? 'الإعدادات' : 'Settings'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'ar' ? 'إدارة تفضيلات حسابك' : 'Manage your account preferences'}
        </p>
      </div>

      {/* Onboarding Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <RotateCcw className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {language === 'ar' ? 'التوجيهات والمساعدة' : 'Onboarding & Help'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' 
                  ? 'تحكم في عرض التوجيهات الإرشادية لكل صفحة' 
                  : 'Control the display of guided tours for each page'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Per-page onboarding controls */}
          {([
            { page: 'dashboard' as OnboardingPage, icon: LayoutDashboard, label: { ar: 'لوحة التحكم', en: 'Dashboard' } },
            { page: 'courses' as OnboardingPage, icon: BookOpen, label: { ar: 'صفحة الكورسات', en: 'Courses Page' } },
            { page: 'courseDetails' as OnboardingPage, icon: GraduationCap, label: { ar: 'تفاصيل الكورس', en: 'Course Details' } },
            { page: 'lessonViewer' as OnboardingPage, icon: PlayCircle, label: { ar: 'مشاهدة الدرس', en: 'Lesson Viewer' } },
          ]).map(({ page, icon: Icon, label }) => (
            <div key={page} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {language === 'ar' ? label.ar : label.en}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isPageDisabled(page) 
                      ? (language === 'ar' ? 'التوجيهات معطلة' : 'Onboarding disabled')
                      : (language === 'ar' ? 'التوجيهات مفعلة' : 'Onboarding enabled')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetPageOnboarding(page);
                    toast.success(
                      language === 'ar' 
                        ? `تم إعادة تعيين توجيهات ${label.ar}` 
                        : `${label.en} onboarding reset`
                    );
                  }}
                  className="text-xs"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  {language === 'ar' ? 'إعادة' : 'Reset'}
                </Button>
                <Switch
                  checked={!isPageDisabled(page)}
                  onCheckedChange={() => togglePageOnboarding(page)}
                />
              </div>
            </div>
          ))}
          
          <Separator />
          
          {/* Reset all */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {language === 'ar' ? 'إعادة تشغيل جميع التوجيهات' : 'Reset All Onboarding'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' 
                  ? 'إعادة تعيين كل التوجيهات وإظهار رسالة الترحيب' 
                  : 'Reset all tours and show welcome message again'}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleResetOnboarding}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {language === 'ar' ? 'إعادة الكل' : 'Reset All'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Year Selection Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {role === 'instructor'
                  ? (language === 'ar' ? 'سنة التدريس' : 'Teaching Year')
                  : (language === 'ar' ? 'السنة الدراسية' : 'Study Year')
                }
              </CardTitle>
              <CardDescription>
                {language === 'ar' ? 'اختر السنة الدراسية الحالية' : 'Select your current academic year'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Select value={selectedYear} onValueChange={handleYearChange} disabled={savingYear || role === 'student'}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={language === 'ar' ? 'اختر السنة' : 'Select Year'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first">{language === 'ar' ? 'السنة الأولى' : 'First Year'}</SelectItem>
              <SelectItem value="second">{language === 'ar' ? 'السنة الثانية' : 'Second Year'}</SelectItem>
              <SelectItem value="third">{language === 'ar' ? 'السنة الثالثة' : 'Third Year'}</SelectItem>
              <SelectItem value="fourth">{language === 'ar' ? 'السنة الرابعة' : 'Fourth Year'}</SelectItem>
              <SelectItem value="fifth">{language === 'ar' ? 'السنة الخامسة' : 'Fifth Year'}</SelectItem>
              <SelectItem value="masters">{language === 'ar' ? 'ماجستير' : 'Masters'}</SelectItem>
              <SelectItem value="phd">{language === 'ar' ? 'دكتوراه' : 'PhD'}</SelectItem>
            </SelectContent>
          </Select>
          {role === 'student' && (
            <p className="text-xs text-muted-foreground mt-2">
              {language === 'ar' ? 'لا يمكنك تعديل بياناتك الشخصية. تواصل مع الإدارة للتعديل.' : 'You cannot edit your personal data. Contact admin for changes.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Language Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Globe className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {language === 'ar' ? 'اللغة' : 'Language'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' 
                  ? 'اختر لغة العرض المفضلة' 
                  : 'Choose your preferred display language'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Label htmlFor="language-toggle" className="text-sm font-medium">
                {language === 'ar' ? 'العربية' : 'Arabic'}
              </Label>
              <Switch
                id="language-toggle"
                checked={language === 'en'}
                onCheckedChange={handleLanguageToggle}
              />
              <Label htmlFor="language-toggle" className="text-sm font-medium">
                {language === 'ar' ? 'الإنجليزية' : 'English'}
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Bell className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {language === 'ar' ? 'الإشعارات' : 'Notifications'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' 
                  ? 'إدارة تفضيلات الإشعارات' 
                  : 'Manage notification preferences'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {language === 'ar' ? 'إشعارات البريد الإلكتروني' : 'Email Notifications'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' 
                  ? 'استلام إشعارات عبر البريد الإلكتروني' 
                  : 'Receive notifications via email'}
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {language === 'ar' ? 'إشعارات التطبيق' : 'App Notifications'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' 
                  ? 'إظهار الإشعارات داخل التطبيق' 
                  : 'Show in-app notifications'}
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Privacy Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Shield className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {language === 'ar' ? 'الخصوصية والأمان' : 'Privacy & Security'}
              </CardTitle>
              <CardDescription>
                {language === 'ar' 
                  ? 'إدارة إعدادات الخصوصية والأمان' 
                  : 'Manage privacy and security settings'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {language === 'ar' ? 'إظهار الملف الشخصي' : 'Show Profile'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' 
                  ? 'السماح للآخرين بمشاهدة ملفك الشخصي' 
                  : 'Allow others to view your profile'}
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserSettings;
