import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, Loader2, CheckCircle, KeyRound, Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

type Step = 'email' | 'otp' | 'newPassword';

const ResetPassword = () => {
  const { dir, language } = useLanguage();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error(language === 'ar' ? 'الرجاء إدخال البريد الإلكتروني' : 'Please enter your email');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-password-reset-otp', {
        body: { email: email.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error_ar || data.error);
      } else {
        toast.success(language === 'ar' ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' : 'Verification code sent to your email');
        setStep('otp');
      }
    } catch (err: any) {
      toast.error(language === 'ar' ? 'حدث خطأ في إرسال الرمز' : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error(language === 'ar' ? 'الرجاء إدخال الرمز المكون من 6 أرقام' : 'Please enter the 6-digit code');
      return;
    }
    // Just move to password step - actual verification happens on submit
    setStep('newPassword');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(language === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error(language === 'ar' ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-password-with-otp', {
        body: { email: email.trim(), otp, new_password: password },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error_ar || 'Failed to reset password');
        if (data?.error_ar?.includes('رمز التحقق')) {
          setStep('otp');
          setOtp('');
        }
      } else {
        setSuccess(true);
        toast.success(language === 'ar' ? 'تم تغيير كلمة المرور بنجاح!' : 'Password changed successfully!');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      }
    } catch (err: any) {
      toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (step === 'email') return language === 'ar' ? 'نسيت كلمة المرور' : 'Forgot Password';
    if (step === 'otp') return language === 'ar' ? 'رمز التحقق' : 'Verification Code';
    return language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password';
  };

  const getSubtitle = () => {
    if (step === 'email') return language === 'ar' ? 'أدخل بريدك الإلكتروني لإرسال رمز التحقق' : 'Enter your email to receive a verification code';
    if (step === 'otp') return language === 'ar' ? 'أدخل الرمز المرسل إلى بريدك الإلكتروني' : 'Enter the code sent to your email';
    return language === 'ar' ? 'أدخل كلمة المرور الجديدة' : 'Enter your new password';
  };

  const getIcon = () => {
    if (step === 'email') return <Mail className="w-4 h-4 text-secondary" />;
    if (step === 'otp') return <ShieldCheck className="w-4 h-4 text-secondary" />;
    return <KeyRound className="w-4 h-4 text-secondary" />;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-primary/20 to-ocean/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-secondary/20 to-teal/20 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
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
          <div className="absolute -inset-1 bg-gradient-to-r from-primary via-ocean to-secondary rounded-3xl blur-lg opacity-25 group-hover:opacity-40 transition-opacity duration-500" />

          <div className="relative bg-card/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-border/50 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-secondary/10 to-transparent rounded-tr-full" />

            {/* Steps indicator */}
            <div className="flex items-center justify-center gap-2 mb-6 relative">
              {['email', 'otp', 'newPassword'].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    step === s ? 'bg-gradient-to-r from-primary to-ocean text-white shadow-lg' :
                    ['email', 'otp', 'newPassword'].indexOf(step) > i ? 'bg-primary/20 text-primary' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {i + 1}
                  </div>
                  {i < 2 && <div className={`w-8 h-0.5 transition-all duration-300 ${
                    ['email', 'otp', 'newPassword'].indexOf(step) > i ? 'bg-primary' : 'bg-muted'
                  }`} />}
                </div>
              ))}
            </div>

            <motion.div
              key={step}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center mb-8 relative"
            >
              <Link to="/" className="inline-block mb-6 group/logo">
                <motion.div
                  className="w-16 h-16 bg-gradient-to-br from-primary via-ocean to-secondary rounded-2xl flex items-center justify-center shadow-xl"
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                >
                  <GraduationCap className="w-9 h-9 text-white" />
                </motion.div>
              </Link>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-ocean to-secondary bg-clip-text text-transparent">
                {getTitle()}
              </h1>
              <p className="text-muted-foreground mt-2 flex items-center justify-center gap-2">
                {getIcon()}
                {getSubtitle()}
              </p>
            </motion.div>

            {success ? (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{language === 'ar' ? 'تم بنجاح!' : 'Success!'}</h3>
                <p className="text-muted-foreground">{language === 'ar' ? 'جاري تحويلك لصفحة تسجيل الدخول...' : 'Redirecting to login...'}</p>
              </motion.div>
            ) : step === 'email' ? (
              <form onSubmit={handleSendOtp} className="space-y-6 relative">
                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-2">
                  <Label htmlFor="email" className="text-foreground/80">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label>
                  <div className="relative group/input">
                    <div className={`absolute inset-0 bg-gradient-to-r from-primary to-ocean rounded-lg blur-sm opacity-0 transition-opacity duration-300 ${focusedField === 'email' ? 'opacity-50' : 'group-hover/input:opacity-25'}`} />
                    <div className="relative">
                      <Mail className={`absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'email' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <Input
                        id="email" type="email" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        className="ps-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        placeholder="email@example.com" required disabled={loading}
                      />
                    </div>
                  </div>
                </motion.div>
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
                  <Button type="submit" className="w-full h-12 bg-gradient-to-r from-primary via-ocean to-secondary hover:opacity-90 text-white font-semibold rounded-xl shadow-lg" disabled={loading}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (language === 'ar' ? 'إرسال رمز التحقق' : 'Send Verification Code')}
                  </Button>
                </motion.div>
              </form>
            ) : step === 'otp' ? (
              <form onSubmit={handleVerifyOtp} className="space-y-6 relative">
                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-4">
                  <Label className="text-foreground/80 text-center block">{language === 'ar' ? 'أدخل رمز التحقق' : 'Enter verification code'}</Label>
                  <div className="flex justify-center" dir="ltr">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    {language === 'ar' ? 'لم تستلم الرمز؟' : "Didn't receive code?"}
                    <button type="button" onClick={() => { setStep('email'); setOtp(''); }} className="text-primary hover:underline ms-1">
                      {language === 'ar' ? 'أعد الإرسال' : 'Resend'}
                    </button>
                  </p>
                </motion.div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => { setStep('email'); setOtp(''); }} className="flex-1 h-12 rounded-xl">
                    <ArrowLeft className="w-4 h-4 me-2" />
                    {language === 'ar' ? 'رجوع' : 'Back'}
                  </Button>
                  <Button type="submit" className="flex-1 h-12 bg-gradient-to-r from-primary via-ocean to-secondary hover:opacity-90 text-white font-semibold rounded-xl shadow-lg" disabled={otp.length !== 6}>
                    {language === 'ar' ? 'تحقق' : 'Verify'}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-6 relative">
                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-2">
                  <Label htmlFor="password" className="text-foreground/80">{language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}</Label>
                  <div className="relative group/input">
                    <div className={`absolute inset-0 bg-gradient-to-r from-primary to-ocean rounded-lg blur-sm opacity-0 transition-opacity duration-300 ${focusedField === 'password' ? 'opacity-50' : 'group-hover/input:opacity-25'}`} />
                    <div className="relative">
                      <Lock className={`absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'password' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <Input
                        id="password" type="password" value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        className="ps-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        placeholder={language === 'ar' ? '8 أحرف على الأقل' : 'At least 8 characters'}
                        required disabled={loading}
                      />
                    </div>
                  </div>
                </motion.div>
                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground/80">{language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}</Label>
                  <div className="relative group/input">
                    <div className={`absolute inset-0 bg-gradient-to-r from-ocean to-secondary rounded-lg blur-sm opacity-0 transition-opacity duration-300 ${focusedField === 'confirm' ? 'opacity-50' : 'group-hover/input:opacity-25'}`} />
                    <div className="relative">
                      <Lock className={`absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'confirm' ? 'text-ocean' : 'text-muted-foreground'}`} />
                      <Input
                        id="confirmPassword" type="password" value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onFocus={() => setFocusedField('confirm')}
                        onBlur={() => setFocusedField(null)}
                        className="ps-10 bg-background/50 border-border/50 focus:border-ocean focus:ring-2 focus:ring-ocean/20"
                        required disabled={loading}
                      />
                    </div>
                  </div>
                </motion.div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep('otp')} className="flex-1 h-12 rounded-xl">
                    <ArrowLeft className="w-4 h-4 me-2" />
                    {language === 'ar' ? 'رجوع' : 'Back'}
                  </Button>
                  <Button type="submit" className="flex-1 h-12 bg-gradient-to-r from-primary via-ocean to-secondary hover:opacity-90 text-white font-semibold rounded-xl shadow-lg" disabled={loading}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (language === 'ar' ? 'تغيير كلمة المرور' : 'Reset Password')}
                  </Button>
                </div>
              </form>
            )}

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-center mt-6 text-muted-foreground">
              <Link to="/login" className="text-transparent bg-gradient-to-r from-primary to-ocean bg-clip-text font-semibold hover:opacity-80 transition-opacity inline-flex items-center gap-1">
                <ArrowLeft className="w-4 h-4 text-primary" />
                {language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Login'}
              </Link>
            </motion.p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
