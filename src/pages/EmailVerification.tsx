import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, Mail, Loader2, CheckCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const EmailVerification = () => {
  const { dir, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // Get email from location state or default
  const email = (location.state as { email?: string })?.email || '';

  // Check if user came from verification link
  useEffect(() => {
    const checkVerificationToken = async () => {
      const fullUrl = window.location.href;
      const hash = window.location.hash;
      const search = window.location.search;
      
      console.log('[EmailVerification] Checking for verification token...', { fullUrl });
      
      // Method 1: Check URL hash for email confirmation token
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let type: string | null = null;
      
      if (hash && hash.length > 1) {
        const hashParams = new URLSearchParams(hash.substring(1));
        accessToken = hashParams.get('access_token');
        refreshToken = hashParams.get('refresh_token');
        type = hashParams.get('type');
        console.log('[EmailVerification] Hash params found:', { type, hasToken: !!accessToken });
      }
      
      // Method 2: Check query params
      if (!accessToken && search) {
        const queryParams = new URLSearchParams(search);
        accessToken = queryParams.get('access_token');
        refreshToken = queryParams.get('refresh_token');
        type = queryParams.get('type');
        console.log('[EmailVerification] Query params found:', { type, hasToken: !!accessToken });
      }
      
      // Method 3: Regex fallback
      if (!accessToken && fullUrl.includes('access_token=')) {
        const tokenMatch = fullUrl.match(/access_token=([^&]+)/);
        const typeMatch = fullUrl.match(/type=([^&]+)/);
        const refreshMatch = fullUrl.match(/refresh_token=([^&]+)/);
        
        if (tokenMatch) accessToken = tokenMatch[1];
        if (typeMatch) type = typeMatch[1];
        if (refreshMatch) refreshToken = refreshMatch[1];
        console.log('[EmailVerification] URL regex match:', { type, hasToken: !!accessToken });
      }
      
      // If we have a signup/magiclink token, verify it
      if (accessToken && (type === 'signup' || type === 'magiclink' || type === 'email')) {
        console.log('[EmailVerification] Email verification token detected! Setting session...');
        
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (data?.session && !error) {
            console.log('[EmailVerification] Email verified successfully!');
            setVerified(true);
            // Clear URL
            window.history.replaceState(null, '', '/email-verification');
            toast.success(
              language === 'ar' 
                ? 'تم تأكيد بريدك الإلكتروني بنجاح!' 
                : 'Your email has been verified successfully!'
            );
          } else {
            console.error('[EmailVerification] Failed to verify:', error);
            toast.error(
              language === 'ar' 
                ? 'فشل في تأكيد البريد الإلكتروني. يرجى المحاولة مرة أخرى.' 
                : 'Failed to verify email. Please try again.'
            );
          }
        } catch (err) {
          console.error('[EmailVerification] Error:', err);
        }
      }
      
      setCheckingToken(false);
    };
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[EmailVerification] Auth event:', event);
      
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        setVerified(true);
        setCheckingToken(false);
      }
    });
    
    checkVerificationToken();
    
    return () => subscription.unsubscribe();
  }, [language]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // ⭐ NEW: Polling to check if email was verified in another tab
  useEffect(() => {
    if (verified || !email) return;
    
    const checkEmailConfirmation = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (currentUser?.email_confirmed_at) {
          setVerified(true);
          toast.success(
            language === 'ar' 
              ? 'تم تأكيد بريدك الإلكتروني!' 
              : 'Your email has been verified!'
          );
        }
      } catch (error) {
        // Ignore errors - user might not have a session yet
      }
    };
    
    // Check immediately then every 5 seconds
    checkEmailConfirmation();
    const interval = setInterval(checkEmailConfirmation, 5000);
    
    return () => clearInterval(interval);
  }, [verified, email, language]);

  const handleResendEmail = async () => {
    if (!email || resendCooldown > 0) return;
    
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/email-verification`,
        },
      });
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(
          language === 'ar' 
            ? 'تم إرسال رابط التحقق مرة أخرى' 
            : 'Verification link sent again'
        );
        setResendCooldown(60); // 60 seconds cooldown
      }
    } catch (err) {
      toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = async () => {
    // Sign out first to ensure clean state
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir={dir}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-primary/20 to-ocean/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-secondary/20 to-teal/20 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="relative group">
          {/* Card Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary via-ocean to-secondary rounded-3xl blur-lg opacity-25 group-hover:opacity-40 transition-opacity duration-500" />
          
          <div className="relative bg-card/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-border/50 overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-secondary/10 to-transparent rounded-tr-full" />

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-center mb-8 relative"
            >
              <Link to="/" className="inline-block mb-6 group/logo">
                <motion.div
                  className="w-16 h-16 bg-gradient-to-br from-primary via-ocean to-secondary rounded-2xl flex items-center justify-center shadow-xl group-hover/logo:shadow-2xl transition-shadow duration-300"
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                >
                  <GraduationCap className="w-9 h-9 text-white" />
                </motion.div>
              </Link>
              
              {verified ? (
                <>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-ocean to-secondary bg-clip-text text-transparent">
                    {language === 'ar' ? 'تم التحقق بنجاح!' : 'Verified!'}
                  </h1>
                  <p className="text-muted-foreground mt-2 flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4 text-secondary" />
                    {language === 'ar' ? 'تم تأكيد بريدك الإلكتروني' : 'Your email has been confirmed'}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-ocean to-secondary bg-clip-text text-transparent">
                    {language === 'ar' ? 'تحقق من بريدك' : 'Verify Your Email'}
                  </h1>
                  <p className="text-muted-foreground mt-2 flex items-center justify-center gap-2">
                    <Mail className="w-4 h-4 text-secondary" />
                    {language === 'ar' ? 'يرجى تأكيد بريدك الإلكتروني' : 'Please confirm your email'}
                  </p>
                </>
              )}
            </motion.div>

            {verified ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {language === 'ar' ? 'تم تأكيد حسابك!' : 'Account Verified!'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {language === 'ar' 
                    ? 'يمكنك الآن تسجيل الدخول إلى حسابك' 
                    : 'You can now log in to your account'}
                </p>
                <Button
                  onClick={handleGoToLogin}
                  className="w-full h-12 bg-gradient-to-r from-primary via-ocean to-secondary hover:opacity-90 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {language === 'ar' ? 'تسجيل الدخول' : 'Go to Login'}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-4"
              >
                <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-10 h-10 text-secondary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {language === 'ar' ? 'تحقق من بريدك الإلكتروني' : 'Check Your Email'}
                </h3>
                <p className="text-muted-foreground mb-2">
                  {language === 'ar' 
                    ? 'أرسلنا رابط التحقق إلى بريدك الإلكتروني' 
                    : 'We sent a verification link to your email'}
                </p>
                {email && (
                  <p className="text-sm font-medium text-foreground mb-4">{email}</p>
                )}
                <p className="text-sm text-muted-foreground mb-6">
                  {language === 'ar' 
                    ? 'انقر على الرابط في البريد الإلكتروني لتفعيل حسابك' 
                    : 'Click the link in the email to activate your account'}
                </p>
                
                <div className="space-y-3">
                  {email && (
                    <Button
                      onClick={handleResendEmail}
                      variant="outline"
                      className="w-full"
                      disabled={loading || resendCooldown > 0}
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : resendCooldown > 0 ? (
                        `${language === 'ar' ? 'إعادة الإرسال بعد' : 'Resend in'} ${resendCooldown}s`
                      ) : (
                        language === 'ar' ? 'إعادة إرسال رابط التحقق' : 'Resend Verification Link'
                      )}
                    </Button>
                  )}
                  
                  <Button
                    onClick={handleGoToLogin}
                    variant="ghost"
                    className="w-full"
                  >
                    {language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Login'}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EmailVerification;
