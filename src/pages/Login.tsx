import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Mail, Lock, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

// Validation schema
const loginSchema = z.object({
  email: z.string()
    .trim()
    .min(1, { message: 'البريد الإلكتروني مطلوب' })
    .email({ message: 'يرجى إدخال بريد إلكتروني صحيح' })
    .max(255, { message: 'البريد الإلكتروني طويل جداً' }),
  password: z.string()
    .min(1, { message: 'كلمة المرور مطلوبة' })
    .min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
});

const Login = () => {
  const { t, dir, language } = useLanguage();
  const { signIn, user, role, loading: authLoading, authReady } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const getDashboardPath = (userRole: string | null) => {
    if (userRole === 'admin') return '/admin';
    if (userRole === 'instructor') return '/instructor';
    return '/dashboard';
  };

  // Redirect when auth state is ready after login — WAIT for role to load
  useEffect(() => {
    if (redirecting && user && authReady && !authLoading && role) {
      navigate(getDashboardPath(role), { replace: true });
    }
  }, [redirecting, user, role, authLoading, authReady, navigate]);

  // Show device kicked message
  useEffect(() => {
    if (sessionStorage.getItem('device_kicked') === 'true') {
      sessionStorage.removeItem('device_kicked');
      toast.error(
        language === 'ar' 
          ? 'تم تسجيل الدخول من جهاز آخر. تم تسجيل خروجك تلقائياً.' 
          : 'You were logged out because someone signed in from another device.',
        { duration: 6000 }
      );
    }
  }, [language]);

  // Redirect if already logged in — WAIT for role to load
  useEffect(() => {
    if (user && authReady && !loading && !redirecting && role) {
      navigate(getDashboardPath(role), { replace: true });
    }
  }, [user, role, authReady, loading, redirecting, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate input
    const validation = loginSchema.safeParse({ email: email.trim(), password });
    if (!validation.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as 'email' | 'password';
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      const { error } = await signIn(email.trim(), password);

      if (error) {
        // التحقق من عدم تأكيد الإيميل
        if (error.message === 'EMAIL_NOT_CONFIRMED') {
          setLoading(false);
          // توجيه لصفحة التحقق من الإيميل
          navigate('/email-verification', { state: { email: email.trim() } });
          return;
        }
        
        // Translate common Supabase errors
        let errorMessage = error.message;
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = language === 'ar' 
            ? 'بيانات تسجيل الدخول غير صحيحة' 
            : 'Invalid login credentials';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = language === 'ar' 
            ? 'يرجى تأكيد بريدك الإلكتروني أولاً' 
            : 'Please confirm your email first';
        } else if (error.message.includes('Too many requests')) {
          errorMessage = language === 'ar' 
            ? 'محاولات كثيرة جداً، يرجى المحاولة لاحقاً' 
            : 'Too many attempts, please try again later';
        }
        toast.error(errorMessage);
        setLoading(false);
      } else {
        toast.success(t.auth.loginSuccess);
        setRedirecting(true);
      }
    } catch (err) {
      toast.error(language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred');
      setLoading(false);
    }
  };

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
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-emerald/10 to-sky/10 rounded-full blur-3xl"
          animate={{
            rotate: [0, 360],
          }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
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
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-ocean to-secondary bg-clip-text text-transparent">
                {t.auth.login}
              </h1>
              <p className="text-muted-foreground mt-2 flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-secondary" />
                {language === 'ar' ? 'مرحباً بعودتك!' : 'Welcome back!'}
              </p>
            </motion.div>

            <form onSubmit={handleSubmit} className="space-y-6 relative">
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                <Label htmlFor="email" className="text-foreground/80">{t.auth.email}</Label>
                <div className="relative group/input">
                  <div className={`absolute inset-0 bg-gradient-to-r from-primary to-ocean rounded-lg blur-sm opacity-0 transition-opacity duration-300 ${focusedField === 'email' ? 'opacity-50' : 'group-hover/input:opacity-25'}`} />
                  <div className="relative">
                    <Mail className={`absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'email' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
                      }}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      className={`ps-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 ${errors.email ? 'border-destructive' : ''}`}
                      placeholder="email@example.com"
                      required
                      disabled={loading || redirecting}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-destructive text-sm mt-1">{errors.email}</p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground/80">{t.auth.password}</Label>
                  <Link
                    to="/reset-password"
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    {language === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                  </Link>
                </div>
                <div className="relative group/input">
                  <div className={`absolute inset-0 bg-gradient-to-r from-ocean to-secondary rounded-lg blur-sm opacity-0 transition-opacity duration-300 ${focusedField === 'password' ? 'opacity-50' : 'group-hover/input:opacity-25'}`} />
                  <div className="relative">
                    <Lock className={`absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'password' ? 'text-ocean' : 'text-muted-foreground'}`} />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                      }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      className={`ps-10 bg-background/50 border-border/50 focus:border-ocean focus:ring-2 focus:ring-ocean/20 transition-all duration-300 ${errors.password ? 'border-destructive' : ''}`}
                      required
                      disabled={loading || redirecting}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-destructive text-sm mt-1">{errors.password}</p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-primary via-ocean to-secondary hover:opacity-90 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group/btn"
                  disabled={loading || redirecting}
                >
                  {(loading || redirecting) ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      {t.auth.login}
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        →
                      </motion.span>
                    </span>
                  )}
                </Button>
              </motion.div>
            </form>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center mt-6 text-muted-foreground"
            >
              {t.auth.noAccount}{' '}
              <Link
                to="/signup"
                className="text-transparent bg-gradient-to-r from-primary to-ocean bg-clip-text font-semibold hover:opacity-80 transition-opacity relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-gradient-to-r after:from-primary after:to-ocean after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300"
              >
                {t.auth.signup}
              </Link>
            </motion.p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;