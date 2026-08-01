import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, FileText, CheckCircle, Loader2, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { InstructorProfileWizard } from '@/components/instructor/InstructorProfileWizard';

interface InstructorOnboardingProps {
  onComplete: () => void;
}

export const InstructorOnboarding = ({ onComplete }: InstructorOnboardingProps) => {
  const { language } = useLanguage();
  const { user, refreshProfile } = useAuth();
  const isRTL = language === 'ar';
  
  const [step, setStep] = useState<'video' | 'profile' | 'policies'>('video');
  const [hasWatchedVideo, setHasWatchedVideo] = useState(false);
  const [hasAcceptedPolicies, setHasAcceptedPolicies] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch platform settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-settings-onboarding'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
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

  const hideIntroVideo = settings?.instructor_hide_intro_video === 'true';
  
  const introVideoUrl = hideIntroVideo 
    ? '' 
    : (settings?.instructor_intro_video_url 
      ? String(settings.instructor_intro_video_url).replace(/^"|"$/g, '') 
      : '');
  
  const policies = isRTL 
    ? (settings?.instructor_policies_ar ? String(settings.instructor_policies_ar).replace(/^"|"$/g, '') : '')
    : (settings?.instructor_policies ? String(settings.instructor_policies).replace(/^"|"$/g, '') : '');

  const allowSkip = settings?.instructor_skip_onboarding === 'true';

  // Skip video step if no video is set
  useEffect(() => {
    if (!isLoading && !introVideoUrl) {
      setStep('profile');
      setHasWatchedVideo(true);
    }
  }, [isLoading, introVideoUrl]);

  const handleVideoEnd = () => {
    setHasWatchedVideo(true);
  };

  const handleContinueToPolicy = () => {
    if (hasWatchedVideo) {
      setStep('profile');
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ has_accepted_policies: true })
        .eq('id', user?.id);

      if (error) throw error;

      await refreshProfile();
      toast.success(isRTL ? 'مرحباً بك في المنصة!' : 'Welcome to the platform!');
      onComplete();
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      toast.error(isRTL ? 'حدث خطأ، يرجى المحاولة مرة أخرى' : 'An error occurred, please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!hasAcceptedPolicies) {
      toast.error(isRTL ? 'يرجى الموافقة على السياسات أولاً' : 'Please accept the policies first');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ has_accepted_policies: true })
        .eq('id', user?.id);

      if (error) throw error;

      await refreshProfile();
      toast.success(isRTL ? 'مرحباً بك في المنصة!' : 'Welcome to the platform!');
      onComplete();
    } catch (error) {
      console.error('Error accepting policies:', error);
      toast.error(isRTL ? 'حدث خطأ، يرجى المحاولة مرة أخرى' : 'An error occurred, please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={true}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true}>
      <DialogContent 
        className="sm:max-w-2xl max-h-[90vh] overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {step === 'video' ? (
              <>
                <Play className="w-5 h-5 text-primary" />
                {isRTL ? 'مرحباً بك كمعلم!' : 'Welcome, Instructor!'}
              </>
            ) : step === 'profile' ? (
              <>
                <FileText className="w-5 h-5 text-primary" />
                {isRTL ? 'استكمال بيانات المعلم' : 'Complete your instructor profile'}
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 text-primary" />
                {isRTL ? 'سياسات المنصة' : 'Platform Policies'}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'profile' ? (
          <InstructorProfileWizard onCompleted={() => setStep('policies')} />
        ) : step === 'video' ? (

          <div className="space-y-4">
            <p className="text-muted-foreground">
              {isRTL 
                ? 'شاهد الفيديو التعريفي لفهم كيفية استخدام المنصة بشكل أفضل'
                : 'Watch the introduction video to understand how to use the platform better'}
            </p>

            {introVideoUrl ? (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={introVideoUrl}
                  controls
                  className="w-full h-full"
                  onEnded={handleVideoEnd}
                  onTimeUpdate={(e) => {
                    const video = e.target as HTMLVideoElement;
                    if (video.currentTime >= video.duration * 0.8) {
                      setHasWatchedVideo(true);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">
                  {isRTL ? 'لا يوجد فيديو تعريفي' : 'No introduction video available'}
                </p>
              </div>
            )}

            <div className="flex justify-between items-center">
              {allowSkip && (
                <Button 
                  variant="outline"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <SkipForward className="w-4 h-4" />
                  )}
                  {isRTL ? 'تخطي' : 'Skip'}
                </Button>
              )}
              <div className={!allowSkip ? 'ms-auto' : ''}>
                <Button 
                  onClick={handleContinueToPolicy}
                  disabled={!hasWatchedVideo}
                  className="gap-2"
                >
                  {isRTL ? 'متابعة' : 'Continue'}
                  {hasWatchedVideo && <CheckCircle className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {!hasWatchedVideo && !allowSkip && (
              <p className="text-sm text-muted-foreground text-center">
                {isRTL 
                  ? 'شاهد 80% من الفيديو على الأقل للمتابعة'
                  : 'Watch at least 80% of the video to continue'}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {isRTL 
                ? 'يرجى قراءة السياسات التالية والموافقة عليها للمتابعة'
                : 'Please read and accept the following policies to continue'}
            </p>

            <ScrollArea className="h-64 border rounded-lg p-4">
              <div className="prose prose-sm max-w-none" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="whitespace-pre-wrap text-sm">
                  {policies || (isRTL 
                    ? 'مرحباً بك في منصتنا. كمعلم، أنت توافق على تقديم محتوى تعليمي عالي الجودة والحفاظ على السلوك المهني.'
                    : 'Welcome to our platform. As an instructor, you agree to provide quality educational content and maintain professional conduct.'
                  )}
                </div>
              </div>
            </ScrollArea>

            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Checkbox
                id="accept-policies"
                checked={hasAcceptedPolicies}
                onCheckedChange={(checked) => setHasAcceptedPolicies(checked === true)}
              />
              <label 
                htmlFor="accept-policies" 
                className="text-sm cursor-pointer leading-relaxed"
              >
                {isRTL 
                  ? 'أوافق على السياسات والشروط المذكورة أعلاه'
                  : 'I agree to the policies and terms mentioned above'}
              </label>
            </div>

            <div className="flex justify-between items-center">
              {allowSkip && (
                <Button 
                  variant="outline"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <SkipForward className="w-4 h-4" />
                  )}
                  {isRTL ? 'تخطي' : 'Skip'}
                </Button>
              )}
              <div className={!allowSkip ? 'ms-auto' : ''}>
                <Button 
                  onClick={handleAccept}
                  disabled={!hasAcceptedPolicies || isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {isRTL ? 'موافق والدخول' : 'Accept & Enter'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};