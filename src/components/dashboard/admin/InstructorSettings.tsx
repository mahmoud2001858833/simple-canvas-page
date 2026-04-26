import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Percent, Video, FileText, Save, Upload, Loader2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const WORKER_URL = 'https://nameless-smoke-ab0f.jowmahmoud6.workers.dev';
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

export const InstructorSettings = () => {
  const { language, dir } = useLanguage();
  const queryClient = useQueryClient();
  const isRTL = language === 'ar';
  
  const [commissionRate, setCommissionRate] = useState(30);
  const [introVideoUrl, setIntroVideoUrl] = useState('');
  const [policies, setPolicies] = useState('');
  const [policiesAr, setPoliciesAr] = useState('');
  const [allowSkipOnboarding, setAllowSkipOnboarding] = useState(false);
  const [hideIntroVideo, setHideIntroVideo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch platform settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');
      if (error) throw error;
      
      const settingsMap: Record<string, any> = {};
      (data as any[])?.forEach((s: any) => {
        settingsMap[s.key] = s.value;
      });
      return settingsMap;
    },
  });

  // Initialize form values
  useEffect(() => {
    if (settings) {
      setCommissionRate(Number(settings.instructor_commission_rate) || 30);
      setIntroVideoUrl(String(settings.instructor_intro_video_url || '').replace(/^"|"$/g, ''));
      setPolicies(String(settings.instructor_policies || '').replace(/^"|"$/g, ''));
      setPoliciesAr(String(settings.instructor_policies_ar || '').replace(/^"|"$/g, ''));
      setAllowSkipOnboarding(settings.instructor_skip_onboarding === 'true');
      setHideIntroVideo(settings.instructor_hide_intro_video === 'true');
    }
  }, [settings]);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error(isRTL ? 'يرجى اختيار ملف فيديو' : 'Please select a video file');
      return;
    }

    // Max file size: 500MB
    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error(isRTL ? 'حجم الفيديو كبير جداً (الحد الأقصى 500MB)' : 'Video file is too large (max 500MB)');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      
      // Step 1: Start multipart upload
      const startFormData = new FormData();
      startFormData.append('action', 'start');
      startFormData.append('filename', file.name);
      startFormData.append('contentType', file.type);
      startFormData.append('totalChunks', totalChunks.toString());
      
      console.log('[InstructorSettings] Starting multipart upload:', file.name, 'Chunks:', totalChunks);
      
      const startResponse = await fetch(WORKER_URL, {
        method: 'POST',
        body: startFormData,
      });
      
      if (!startResponse.ok) {
        const errorText = await startResponse.text();
        throw new Error(`Failed to start upload: ${errorText}`);
      }
      
      const startResult = await startResponse.json();
      const { uploadId, key } = startResult;
      
      console.log('[InstructorSettings] Upload started:', uploadId, key);
      
      // Step 2: Upload all chunks
      const uploadedParts: { partNumber: number; etag: string }[] = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        const partFormData = new FormData();
        partFormData.append('action', 'part');
        partFormData.append('uploadId', uploadId);
        partFormData.append('key', key);
        partFormData.append('partNumber', (i + 1).toString());
        partFormData.append('chunk', chunk);
        
        console.log(`[InstructorSettings] Uploading part ${i + 1}/${totalChunks}`);
        
        const partResponse = await fetch(WORKER_URL, {
          method: 'POST',
          body: partFormData,
        });
        
        if (!partResponse.ok) {
          const errorText = await partResponse.text();
          throw new Error(`Failed to upload part ${i + 1}: ${errorText}`);
        }
        
        const partResult = await partResponse.json();
        uploadedParts.push({
          partNumber: i + 1,
          etag: partResult.etag,
        });
        
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
      
      // Step 3: Complete multipart upload
      const completeFormData = new FormData();
      completeFormData.append('action', 'complete');
      completeFormData.append('uploadId', uploadId);
      completeFormData.append('key', key);
      completeFormData.append('parts', JSON.stringify(uploadedParts));
      
      console.log('[InstructorSettings] Completing upload...');
      
      const completeResponse = await fetch(WORKER_URL, {
        method: 'POST',
        body: completeFormData,
      });
      
      if (!completeResponse.ok) {
        const errorText = await completeResponse.text();
        throw new Error(`Failed to complete upload: ${errorText}`);
      }
      
      // Set the video URL
      const videoUrl = `${WORKER_URL}/video/${key}`;
      console.log('[InstructorSettings] Video URL:', videoUrl);
      setIntroVideoUrl(videoUrl);
      
      toast.success(isRTL ? 'تم رفع الفيديو بنجاح' : 'Video uploaded successfully');
    } catch (error) {
      console.error('[InstructorSettings] Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(isRTL ? `فشل رفع الفيديو: ${errorMessage}` : `Failed to upload video: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { key: 'instructor_commission_rate', value: String(commissionRate) },
        { key: 'instructor_intro_video_url', value: introVideoUrl },
        { key: 'instructor_policies', value: policies },
        { key: 'instructor_policies_ar', value: policiesAr },
        { key: 'instructor_skip_onboarding', value: String(allowSkipOnboarding) },
        { key: 'instructor_hide_intro_video', value: String(hideIntroVideo) },
      ];

      for (const update of updates) {
        // Use upsert to handle both insert and update cases
        const { error } = await supabase
          .from('platform_settings')
          .upsert(
            { 
              key: update.key, 
              value: update.value, 
              updated_at: new Date().toISOString() 
            },
            { 
              onConflict: 'key',
              ignoreDuplicates: false 
            }
          );
        
        if (error) {
          console.error('Upsert error for', update.key, ':', error);
          throw error;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      toast.success(isRTL ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully');
    } catch (error) {
      console.error('Save error:', error);
      toast.error(isRTL ? 'فشل حفظ الإعدادات' : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
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
            {isRTL ? 'إعدادات المعلمين' : 'Instructor Settings'}
          </h1>
          <p className="text-muted-foreground">
            {isRTL ? 'إدارة نسبة الأرباح وإعدادات الترحيب للمعلمين' : 'Manage instructor commission rates and onboarding settings'}
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Commission Rate */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              {isRTL ? 'نسبة أرباح المعلم' : 'Instructor Commission Rate'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'حدد النسبة المئوية التي يحصل عليها المعلم من مبيعات كورساته'
                : 'Set the percentage instructors receive from their course sales'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {isRTL ? 'نسبة المعلم' : 'Instructor Share'}
                </span>
                <span className="text-2xl font-bold text-primary">{commissionRate}%</span>
              </div>
              
              <Slider
                value={[commissionRate]}
                onValueChange={(value) => setCommissionRate(value[0])}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <Separator />

            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">
                {isRTL ? 'مثال على توزيع الأرباح' : 'Example Revenue Split'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {isRTL 
                  ? `لكورس بسعر 100 ريال: المعلم يحصل على ${commissionRate} ريال، المنصة تحصل على ${100 - commissionRate} ريال`
                  : `For a 100 SAR course: Instructor gets ${commissionRate} SAR, Platform gets ${100 - commissionRate} SAR`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Onboarding Settings */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              {isRTL ? 'إعدادات الترحيب' : 'Onboarding Settings'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'تحكم في عملية ترحيب المعلمين الجدد'
                : 'Control the new instructor onboarding process'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <Label className="font-medium">
                  {isRTL ? 'السماح بتخطي الترحيب' : 'Allow Skip Onboarding'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL 
                    ? 'السماح للمعلمين بالدخول مباشرة بدون مشاهدة الفيديو أو الموافقة على السياسات'
                    : 'Allow instructors to enter directly without watching video or accepting policies'}
                </p>
              </div>
              <Switch 
                checked={allowSkipOnboarding}
                onCheckedChange={setAllowSkipOnboarding}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <Label className="font-medium">
                  {isRTL ? 'إخفاء الفيديو التعريفي' : 'Hide Introduction Video'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isRTL 
                    ? 'إخفاء الفيديو التعريفي تماماً عن المعلمين الجدد'
                    : 'Completely hide the introduction video from new instructors'}
                </p>
              </div>
              <Switch 
                checked={hideIntroVideo}
                onCheckedChange={setHideIntroVideo}
              />
            </div>
          </CardContent>
        </Card>

        {/* Intro Video */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              {isRTL ? 'الفيديو التعريفي' : 'Introduction Video'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'فيديو يظهر للمعلمين الجدد عند تسجيل الدخول لأول مرة'
                : 'Video shown to new instructors on their first login'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'رابط الفيديو' : 'Video URL'}</Label>
              <Input
                value={introVideoUrl}
                onChange={(e) => setIntroVideoUrl(e.target.value)}
                placeholder={isRTL ? 'https://example.com/video.mp4' : 'https://example.com/video.mp4'}
              />
            </div>

            <div className="text-center text-muted-foreground text-sm py-2">
              {isRTL ? '- أو -' : '- or -'}
            </div>

            <div>
              <Label 
                htmlFor="video-upload" 
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              >
                {isUploading ? (
                  <div className="w-full px-4 space-y-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-sm text-center text-muted-foreground">
                      {uploadProgress}%
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      {isRTL ? 'اضغط لرفع فيديو (حتى 500MB)' : 'Click to upload video (up to 500MB)'}
                    </span>
                  </>
                )}
              </Label>
              <Input
                id="video-upload"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoUpload}
                disabled={isUploading}
              />
            </div>

            {introVideoUrl && (
              <div className="mt-4">
                <video 
                  src={introVideoUrl} 
                  controls 
                  className="w-full rounded-lg max-h-48 object-cover"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Policies */}
        <Card className="card-premium lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {isRTL ? 'سياسات المعلمين' : 'Instructor Policies'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'السياسات التي يجب على المعلمين الموافقة عليها قبل استخدام المنصة'
                : 'Policies instructors must agree to before using the platform'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>{isRTL ? 'السياسات (الإنجليزية)' : 'Policies (English)'}</Label>
                <Textarea
                  value={policies}
                  onChange={(e) => setPolicies(e.target.value)}
                  rows={8}
                  placeholder="Enter instructor policies in English..."
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'السياسات (العربية)' : 'Policies (Arabic)'}</Label>
                <Textarea
                  value={policiesAr}
                  onChange={(e) => setPoliciesAr(e.target.value)}
                  rows={8}
                  placeholder="أدخل سياسات المعلمين بالعربية..."
                  dir="rtl"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};