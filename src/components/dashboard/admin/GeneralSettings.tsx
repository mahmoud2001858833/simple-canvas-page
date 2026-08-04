import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Globe, Bell, Shield, Database, Save, RefreshCw, Video, Loader2, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FinancialControls } from './FinancialControls';


// Settings keys for database
const SETTINGS_KEYS = {
  SITE_NAME: 'site_name',
  SITE_NAME_EN: 'site_name_en',
  SUPPORT_EMAIL: 'support_email',
  ENABLE_REGISTRATION: 'enable_registration',
  ENABLE_PAYMENTS: 'enable_payments',
  ENABLE_NOTIFICATIONS: 'enable_notifications',
  ENABLE_COURSE_REQUESTS: 'enable_course_requests',
  MAINTENANCE_MODE: 'maintenance_mode',
  EMAIL_NOTIFICATIONS: 'email_notifications',
  PUSH_NOTIFICATIONS: 'push_notifications',
  VIDEO_RECORDING_PROTECTION: 'video_recording_protection',
  ANNOUNCEMENT_ENABLED: 'announcement_bar_enabled',
  ANNOUNCEMENT_TEXT: 'announcement_bar_text',
  ANNOUNCEMENT_TEXT_EN: 'announcement_bar_text_en',
  PROFILE_FIELDS_REQUIRED: 'profile_fields_required',
};


export const GeneralSettings = () => {
  const { language, dir } = useLanguage();
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Site Settings
  const [siteName, setSiteName] = useState('جسوركم');
  const [siteNameEn, setSiteNameEn] = useState('Jusorkum');
  const [supportEmail, setSupportEmail] = useState('support@jusorkum.com');
  
  // Feature Toggles
  const [enableRegistration, setEnableRegistration] = useState(true);
  const [enablePayments, setEnablePayments] = useState(true);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [enableCourseRequests, setEnableCourseRequests] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [profileFieldsRequired, setProfileFieldsRequired] = useState(true);

  
  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  
  // Video Protection
  const [videoRecordingProtection, setVideoRecordingProtection] = useState(false);
  
  // Announcement Bar
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementTextEn, setAnnouncementTextEn] = useState('');

  // Fetch all settings on mount
  useEffect(() => {
    const fetchAllSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('key, value');
        
        if (error) {
          console.error('Error fetching settings:', error);
          return;
        }

        if (data) {
          const settingsMap = new Map(data.map(s => [s.key, s.value]));
          
          // Apply settings from database
          if (settingsMap.has(SETTINGS_KEYS.SITE_NAME)) setSiteName(settingsMap.get(SETTINGS_KEYS.SITE_NAME) || 'جسوركم');
          if (settingsMap.has(SETTINGS_KEYS.SITE_NAME_EN)) setSiteNameEn(settingsMap.get(SETTINGS_KEYS.SITE_NAME_EN) || 'Jusorkum');
          if (settingsMap.has(SETTINGS_KEYS.SUPPORT_EMAIL)) setSupportEmail(settingsMap.get(SETTINGS_KEYS.SUPPORT_EMAIL) || 'support@jusorkum.com');
          if (settingsMap.has(SETTINGS_KEYS.ENABLE_REGISTRATION)) setEnableRegistration(settingsMap.get(SETTINGS_KEYS.ENABLE_REGISTRATION) === 'true');
          if (settingsMap.has(SETTINGS_KEYS.ENABLE_PAYMENTS)) setEnablePayments(settingsMap.get(SETTINGS_KEYS.ENABLE_PAYMENTS) === 'true');
          if (settingsMap.has(SETTINGS_KEYS.ENABLE_NOTIFICATIONS)) setEnableNotifications(settingsMap.get(SETTINGS_KEYS.ENABLE_NOTIFICATIONS) === 'true');
          if (settingsMap.has(SETTINGS_KEYS.ENABLE_COURSE_REQUESTS)) setEnableCourseRequests(settingsMap.get(SETTINGS_KEYS.ENABLE_COURSE_REQUESTS) === 'true');
          if (settingsMap.has(SETTINGS_KEYS.MAINTENANCE_MODE)) setMaintenanceMode(settingsMap.get(SETTINGS_KEYS.MAINTENANCE_MODE) === 'true');
          if (settingsMap.has(SETTINGS_KEYS.EMAIL_NOTIFICATIONS)) setEmailNotifications(settingsMap.get(SETTINGS_KEYS.EMAIL_NOTIFICATIONS) === 'true');
          if (settingsMap.has(SETTINGS_KEYS.PUSH_NOTIFICATIONS)) setPushNotifications(settingsMap.get(SETTINGS_KEYS.PUSH_NOTIFICATIONS) === 'true');
          if (settingsMap.has(SETTINGS_KEYS.VIDEO_RECORDING_PROTECTION)) setVideoRecordingProtection(settingsMap.get(SETTINGS_KEYS.VIDEO_RECORDING_PROTECTION) === 'true');
          if (settingsMap.has(SETTINGS_KEYS.ANNOUNCEMENT_ENABLED)) setAnnouncementEnabled(settingsMap.get(SETTINGS_KEYS.ANNOUNCEMENT_ENABLED) === 'true');
          if (settingsMap.has(SETTINGS_KEYS.ANNOUNCEMENT_TEXT)) setAnnouncementText(settingsMap.get(SETTINGS_KEYS.ANNOUNCEMENT_TEXT) || '');
          if (settingsMap.has(SETTINGS_KEYS.ANNOUNCEMENT_TEXT_EN)) setAnnouncementTextEn(settingsMap.get(SETTINGS_KEYS.ANNOUNCEMENT_TEXT_EN) || '');
          if (settingsMap.has(SETTINGS_KEYS.PROFILE_FIELDS_REQUIRED)) setProfileFieldsRequired(settingsMap.get(SETTINGS_KEYS.PROFILE_FIELDS_REQUIRED) !== 'false');
        }

      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllSettings();
  }, []);

  // Helper function to upsert a setting
  const upsertSetting = async (key: string, value: string) => {
    const { data: existing } = await supabase
      .from('platform_settings')
      .select('id')
      .eq('key', key)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('platform_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('platform_settings')
        .insert({ key, value });
      if (error) throw error;
    }
  };

  // Handle saving all settings
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save all settings to database
      await Promise.all([
        upsertSetting(SETTINGS_KEYS.SITE_NAME, siteName),
        upsertSetting(SETTINGS_KEYS.SITE_NAME_EN, siteNameEn),
        upsertSetting(SETTINGS_KEYS.SUPPORT_EMAIL, supportEmail),
        upsertSetting(SETTINGS_KEYS.ENABLE_REGISTRATION, enableRegistration ? 'true' : 'false'),
        upsertSetting(SETTINGS_KEYS.ENABLE_PAYMENTS, enablePayments ? 'true' : 'false'),
        upsertSetting(SETTINGS_KEYS.ENABLE_NOTIFICATIONS, enableNotifications ? 'true' : 'false'),
        upsertSetting(SETTINGS_KEYS.ENABLE_COURSE_REQUESTS, enableCourseRequests ? 'true' : 'false'),
        upsertSetting(SETTINGS_KEYS.MAINTENANCE_MODE, maintenanceMode ? 'true' : 'false'),
        upsertSetting(SETTINGS_KEYS.EMAIL_NOTIFICATIONS, emailNotifications ? 'true' : 'false'),
        upsertSetting(SETTINGS_KEYS.PUSH_NOTIFICATIONS, pushNotifications ? 'true' : 'false'),
        upsertSetting(SETTINGS_KEYS.VIDEO_RECORDING_PROTECTION, videoRecordingProtection ? 'true' : 'false'),
        upsertSetting(SETTINGS_KEYS.ANNOUNCEMENT_ENABLED, announcementEnabled ? 'true' : 'false'),
        upsertSetting(SETTINGS_KEYS.ANNOUNCEMENT_TEXT, announcementText),
        upsertSetting(SETTINGS_KEYS.ANNOUNCEMENT_TEXT_EN, announcementTextEn),
        upsertSetting(SETTINGS_KEYS.PROFILE_FIELDS_REQUIRED, profileFieldsRequired ? 'true' : 'false'),
      ]);


      toast.success(language === 'ar' ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(language === 'ar' ? 'فشل في حفظ الإعدادات' : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    toast.success(language === 'ar' ? 'تم مسح الكاش بنجاح' : 'Cache cleared successfully');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">
            {language === 'ar' ? 'الإعدادات العامة' : 'General Settings'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'إدارة إعدادات المنصة العامة' : 'Manage platform general settings'}
          </p>
        </div>
        <Button onClick={handleSave} className="gap-2" disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Site Information */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'معلومات الموقع' : 'Site Information'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'الإعدادات الأساسية للموقع' : 'Basic site settings'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'اسم الموقع (عربي)' : 'Site Name (Arabic)'}</Label>
                <Input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  dir="rtl"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'اسم الموقع (إنجليزي)' : 'Site Name (English)'}</Label>
                <Input
                  value={siteNameEn}
                  onChange={(e) => setSiteNameEn(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'بريد الدعم' : 'Support Email'}</Label>
              <Input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Feature Toggles */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'الميزات' : 'Features'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'تفعيل أو تعطيل ميزات المنصة' : 'Enable or disable platform features'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{language === 'ar' ? 'التسجيل' : 'Registration'}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'السماح بتسجيل مستخدمين جدد' : 'Allow new user registration'}
                </p>
              </div>
              <Switch checked={enableRegistration} onCheckedChange={setEnableRegistration} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{language === 'ar' ? 'المدفوعات' : 'Payments'}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'تفعيل نظام الدفع' : 'Enable payment system'}
                </p>
              </div>
              <Switch checked={enablePayments} onCheckedChange={setEnablePayments} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{language === 'ar' ? 'طلبات الدورات' : 'Course Requests'}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'السماح بطلب دورات مخصصة' : 'Allow custom course requests'}
                </p>
              </div>
              <Switch checked={enableCourseRequests} onCheckedChange={setEnableCourseRequests} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex-1 pe-4">
                <p className="font-medium">
                  {language === 'ar' ? 'حقول الملف الشخصي' : 'Profile Fields'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar'
                    ? profileFieldsRequired
                      ? 'إجباري: يجب على المستخدمين (وخاصة المعلمين) تعبئة جميع الحقول عند التسجيل'
                      : 'اختياري: يمكن للمستخدمين إنشاء الحسابات وتسجيل الدخول دون تعبئة الحقول'
                    : profileFieldsRequired
                      ? 'Mandatory: users (especially instructors) must fill all fields'
                      : 'Optional: users can sign up and sign in without filling the fields'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {language === 'ar' ? (profileFieldsRequired ? 'إجباري' : 'اختياري') : (profileFieldsRequired ? 'Required' : 'Optional')}
                </span>
                <Switch checked={profileFieldsRequired} onCheckedChange={setProfileFieldsRequired} />
              </div>
            </div>
            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-destructive">{language === 'ar' ? 'وضع الصيانة' : 'Maintenance Mode'}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إيقاف الموقع مؤقتاً للصيانة' : 'Temporarily disable the site'}
                </p>
              </div>
              <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
            </div>
          </CardContent>
        </Card>

        {/* Video Protection Settings */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'حماية الفيديو' : 'Video Protection'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'إعدادات حماية الفيديوهات من التسجيل' : 'Video recording protection settings'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  {language === 'ar' ? 'حماية من تسجيل الشاشة' : 'Screen Recording Protection'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === 'ar' 
                    ? 'عند التفعيل، سيتم منع المستخدمين من تسجيل الفيديوهات وستظهر لهم رسالة تطلب منهم إيقاف التسجيل' 
                    : 'When enabled, users will be blocked from recording videos and shown a message to stop recording'}
                </p>
              </div>
              <Switch 
                checked={videoRecordingProtection} 
                onCheckedChange={setVideoRecordingProtection}
              />
            </div>
            
            {videoRecordingProtection && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">
                      {language === 'ar' ? 'الحماية مفعلة' : 'Protection Active'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {language === 'ar' 
                        ? 'جميع الفيديوهات محمية الآن من التسجيل. سيتم حظر أي محاولة تسجيل شاشة.'
                        : 'All videos are now protected from recording. Any screen recording attempt will be blocked.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'إعدادات الإشعارات' : 'Notification Settings'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'تحكم في إرسال الإشعارات' : 'Control notification delivery'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{language === 'ar' ? 'إشعارات البريد' : 'Email Notifications'}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إرسال إشعارات عبر البريد' : 'Send notifications via email'}
                </p>
              </div>
              <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{language === 'ar' ? 'الإشعارات الفورية' : 'Push Notifications'}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إشعارات الهاتف والمتصفح' : 'Browser and mobile notifications'}
                </p>
              </div>
              <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{language === 'ar' ? 'الإشعارات داخل التطبيق' : 'In-App Notifications'}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إشعارات داخل لوحة التحكم' : 'Dashboard notifications'}
                </p>
              </div>
              <Switch checked={enableNotifications} onCheckedChange={setEnableNotifications} />
            </div>
          </CardContent>
        </Card>

        {/* Announcement Bar */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'الشريط الإعلاني' : 'Announcement Bar'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'شريط إعلاني يظهر أعلى الصفحة الرئيسية' : 'Banner displayed at the top of the landing page'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{language === 'ar' ? 'تفعيل الشريط' : 'Enable Banner'}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إظهار الشريط الإعلاني في الصفحة الرئيسية' : 'Show announcement bar on landing page'}
                </p>
              </div>
              <Switch checked={announcementEnabled} onCheckedChange={setAnnouncementEnabled} />
            </div>
            {announcementEnabled && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'النص (عربي)' : 'Text (Arabic)'}</Label>
                  <Textarea
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder={language === 'ar' ? 'أدخل نص الإعلان بالعربية...' : 'Enter announcement text in Arabic...'}
                    dir="rtl"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ar' ? 'النص (إنجليزي)' : 'Text (English)'}</Label>
                  <Textarea
                    value={announcementTextEn}
                    onChange={(e) => setAnnouncementTextEn(e.target.value)}
                    placeholder={language === 'ar' ? 'أدخل نص الإعلان بالإنجليزية...' : 'Enter announcement text in English...'}
                    rows={2}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <FinancialControls />

        {/* System Actions */}

        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              {language === 'ar' ? 'إجراءات النظام' : 'System Actions'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'إجراءات الصيانة والتحسين' : 'Maintenance and optimization actions'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border">
              <div>
                <p className="font-medium">{language === 'ar' ? 'مسح الكاش' : 'Clear Cache'}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'مسح الذاكرة المؤقتة للمتصفح' : 'Clear browser cache and storage'}
                </p>
              </div>
              <Button variant="outline" onClick={handleClearCache} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                {language === 'ar' ? 'مسح' : 'Clear'}
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border">
              <div>
                <p className="font-medium">{language === 'ar' ? 'فحص المواعيد' : 'Check Deadlines'}</p>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'فحص الطلبات المتأخرة' : 'Check overdue requests'}
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke('check-deadlines');
                    if (error) throw error;
                    toast.success(language === 'ar' ? 'تم فحص المواعيد' : 'Deadlines checked');
                  } catch (error) {
                    console.error('Error checking deadlines:', error);
                    toast.error(language === 'ar' ? 'فشل الفحص' : 'Check failed');
                  }
                }}
                className="gap-2"
              >
                <Shield className="w-4 h-4" />
                {language === 'ar' ? 'فحص' : 'Check'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
