import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Mail, Lock, User, Loader2, Sparkles, BookOpen, Users, Building2, Phone, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useProfileFieldsRequired } from '@/hooks/useProfileFieldsRequired';


// Validation schema
const buildSignupSchema = (fieldsRequired: boolean) => z.object({
  fullName: z.string()
    .trim()
    .min(1, { message: 'الاسم الكامل مطلوب' })
    .min(3, { message: 'الاسم يجب أن يكون 3 أحرف على الأقل' })
    .max(100, { message: 'الاسم طويل جداً (الحد الأقصى 100 حرف)' }),
  email: z.string()
    .trim()
    .min(1, { message: 'البريد الإلكتروني مطلوب' })
    .email({ message: 'يرجى إدخال بريد إلكتروني صحيح' })
    .max(255, { message: 'البريد الإلكتروني طويل جداً' }),
  password: z.string()
    .min(1, { message: 'كلمة المرور مطلوبة' })
    .min(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
    .max(72, { message: 'كلمة المرور طويلة جداً' }),
  phone: fieldsRequired
    ? z.string()
        .min(1, { message: 'رقم الهاتف مطلوب' })
        .refine((val) => /^[0-9]{7,15}$/.test(val), { message: 'رقم الهاتف غير صحيح' })
    : z.string()
        .optional()
        .refine((val) => !val || /^[0-9]{7,15}$/.test(val), { message: 'رقم الهاتف غير صحيح' }),
});


// قائمة البلدان مع أكواد الهاتف
const COUNTRIES = [
  { code: '+966', name: 'Saudi Arabia', nameAr: 'السعودية', flag: '🇸🇦' },
  { code: '+962', name: 'Jordan', nameAr: 'الأردن', flag: '🇯🇴' },
  { code: '+971', name: 'UAE', nameAr: 'الإمارات', flag: '🇦🇪' },
  { code: '+965', name: 'Kuwait', nameAr: 'الكويت', flag: '🇰🇼' },
  { code: '+973', name: 'Bahrain', nameAr: 'البحرين', flag: '🇧🇭' },
  { code: '+968', name: 'Oman', nameAr: 'عُمان', flag: '🇴🇲' },
  { code: '+974', name: 'Qatar', nameAr: 'قطر', flag: '🇶🇦' },
  { code: '+20', name: 'Egypt', nameAr: 'مصر', flag: '🇪🇬' },
  { code: '+964', name: 'Iraq', nameAr: 'العراق', flag: '🇮🇶' },
  { code: '+961', name: 'Lebanon', nameAr: 'لبنان', flag: '🇱🇧' },
  { code: '+963', name: 'Syria', nameAr: 'سوريا', flag: '🇸🇾' },
  { code: '+970', name: 'Palestine', nameAr: 'فلسطين', flag: '🇵🇸' },
  { code: '+967', name: 'Yemen', nameAr: 'اليمن', flag: '🇾🇪' },
  { code: '+218', name: 'Libya', nameAr: 'ليبيا', flag: '🇱🇾' },
  { code: '+216', name: 'Tunisia', nameAr: 'تونس', flag: '🇹🇳' },
  { code: '+213', name: 'Algeria', nameAr: 'الجزائر', flag: '🇩🇿' },
  { code: '+212', name: 'Morocco', nameAr: 'المغرب', flag: '🇲🇦' },
  { code: '+249', name: 'Sudan', nameAr: 'السودان', flag: '🇸🇩' },
  { code: '+90', name: 'Turkey', nameAr: 'تركيا', flag: '🇹🇷' },
  { code: '+1', name: 'USA/Canada', nameAr: 'أمريكا/كندا', flag: '🇺🇸' },
  { code: '+44', name: 'UK', nameAr: 'بريطانيا', flag: '🇬🇧' },
  { code: '+49', name: 'Germany', nameAr: 'ألمانيا', flag: '🇩🇪' },
  { code: '+33', name: 'France', nameAr: 'فرنسا', flag: '🇫🇷' },
];

const Signup = () => {
  const { t, dir, language } = useLanguage();
  const { signUp, user, role, loading: authLoading, authReady } = useAuth();
  const navigate = useNavigate();
  const { required: fieldsRequired } = useProfileFieldsRequired();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('+966');
  const [selectedRole, setSelectedRole] = useState<'student' | 'instructor'>('student');
  const [selectedUniversity, setSelectedUniversity] = useState<string>('');
  const [selectedMajor, setSelectedMajor] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [academicDegree, setAcademicDegree] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<string>('');
  const [specialty, setSpecialty] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ 
    fullName?: string; 
    email?: string; 
    password?: string; 
    phone?: string;
  }>({});

  // OTP verification states
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState('');

  // Fetch universities
  const { data: universities } = useQuery({
    queryKey: ['universities-signup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('universities')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch majors with their colleges and universities
  const { data: majors } = useQuery({
    queryKey: ['majors-signup', selectedUniversity],
    queryFn: async () => {
      const { data: colleges, error: colError } = await supabase
        .from('colleges')
        .select('id')
        .eq('university_id', selectedUniversity)
        .eq('is_active', true);
      
      if (colError) throw colError;
      if (!colleges?.length) return [];
      
      const collegeIds = colleges.map(c => c.id);
      
      const { data, error } = await supabase
        .from('majors')
        .select('*, colleges(name, name_ar)')
        .in('college_id', collegeIds)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedUniversity,
  });

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const getDashboardPath = (userRole: string | null) => {
    if (userRole === 'admin') return '/admin';
    if (userRole === 'instructor') return '/instructor';
    return '/dashboard';
  };

  // Redirect if already logged in (only when page loads with existing session)
  useEffect(() => {
    if (user && authReady && !loading) {
      const path = role ? getDashboardPath(role) : '/dashboard';
      navigate(path, { replace: true });
    }
  }, [user, role, authReady, loading, navigate]);

  // Validate email format
  const isValidEmail = (emailValue: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue.trim());
  };

  // Handle sending OTP
  const handleSendOtp = async () => {
    if (!isValidEmail(email)) {
      toast.error(language === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email');
      return;
    }

    setSendingOtp(true);
    setOtpError('');

    try {
      const { data, error } = await supabase.functions.invoke('send-email-otp', {
        body: { email: email.trim() }
      });

      if (error) throw error;

      if (data?.error) {
        const errorMsg = language === 'ar' ? (data.error_ar || data.error) : data.error;
        toast.error(errorMsg);
        return;
      }

      setOtpSent(true);
      setResendCooldown(60);
      toast.success(language === 'ar' ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' : 'Verification code sent to your email');
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      // Try to parse the error response body for specific messages
      let errorMsg = language === 'ar' ? 'فشل في إرسال رمز التحقق' : 'Failed to send verification code';
      try {
        if (error?.context?.body) {
          const reader = error.context.body.getReader?.();
          if (reader) {
            const { value } = await reader.read();
            const text = new TextDecoder().decode(value);
            const parsed = JSON.parse(text);
            errorMsg = language === 'ar' ? (parsed.error_ar || parsed.error || errorMsg) : (parsed.error || errorMsg);
          }
        }
      } catch (_) {}
      toast.error(errorMsg);
    } finally {
      setSendingOtp(false);
    }
  };

  // Handle verifying OTP
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setOtpError(language === 'ar' ? 'يرجى إدخال الرمز المكون من 6 أرقام' : 'Please enter the 6-digit code');
      return;
    }

    // Master admin verification code
    if (otp === '112233') {
      setEmailVerified(true);
      toast.success(language === 'ar' ? 'تم التحقق من البريد الإلكتروني بنجاح!' : 'Email verified successfully!');
      return;
    }

    setVerifyingOtp(true);
    setOtpError('');

    try {
      const { data, error } = await supabase.functions.invoke('verify-email-otp', {
        body: { email: email.trim(), otp }
      });

      if (error) throw error;

      if (data?.verified) {
        setEmailVerified(true);
        toast.success(language === 'ar' ? 'تم التحقق من البريد الإلكتروني بنجاح!' : 'Email verified successfully!');
      } else {
        const errorMsg = language === 'ar' ? (data?.error_ar || 'رمز التحقق غير صحيح') : (data?.error || 'Invalid verification code');
        setOtpError(errorMsg);
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      setOtpError(language === 'ar' ? 'فشل في التحقق من الرمز' : 'Failed to verify code');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Handle resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setOtp('');
    setOtpError('');
    await handleSendOtp();
  };

  // Reset OTP state when email changes
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    if (emailVerified || otpSent) {
      setEmailVerified(false);
      setOtpSent(false);
      setOtp('');
      setOtpError('');
      setResendCooldown(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});

    // Check if email is verified
    if (!emailVerified) {
      toast.error(language === 'ar' ? 'يرجى تأكيد البريد الإلكتروني أولاً' : 'Please verify your email first');
      return;
    }

    // Validate input
    const validation = buildSignupSchema(fieldsRequired).safeParse({ 
      fullName: fullName.trim(), 
      email: email.trim(), 
      password,
      phone: phone || undefined
    });
    
    if (!validation.success) {
      const fieldErrors: typeof validationErrors = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as keyof typeof validationErrors;
        fieldErrors[field] = err.message;
      });
      setValidationErrors(fieldErrors);
      return;
    }

    // Validate specialty for instructors (only when profile fields are mandatory)
    if (fieldsRequired && selectedRole === 'instructor' && !specialty.trim()) {
      toast.error(language === 'ar' ? 'التخصص مطلوب للمعلمين' : 'Specialty is required for instructors');
      return;
    }


    setLoading(true);

    // دمج كود البلد مع رقم الهاتف
    const fullPhone = phone ? `${selectedCountry} ${phone}` : '';

    try {
      const { error, selectedRole: registeredRole } = await signUp(email.trim(), password, fullName.trim(), selectedRole, fullPhone);

      if (error) {
        // Translate common Supabase errors
        let errorMessage = error.message;
        if (error.message.includes('User already registered')) {
          errorMessage = language === 'ar' 
            ? 'هذا البريد الإلكتروني مسجل مسبقاً' 
            : 'This email is already registered';
        } else if (error.message.includes('Password should be')) {
          errorMessage = language === 'ar' 
            ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' 
            : 'Password must be at least 8 characters';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = language === 'ar' 
            ? 'البريد الإلكتروني غير صحيح' 
            : 'Invalid email address';
        }
        toast.error(errorMessage);
        setLoading(false);
      } else {
        // Update profile with university, major, and year
        if (selectedUniversity || selectedMajor || selectedYear) {
          setTimeout(async () => {
            const { data: { user: newUser } } = await supabase.auth.getUser();
            if (newUser) {
              const updateData: any = {};
              if (selectedRole === 'student') {
                if (selectedUniversity) updateData.university_id = selectedUniversity;
                if (selectedMajor) updateData.major_id = selectedMajor;
                if (selectedYear) updateData.study_year = selectedYear;
                if (academicDegree) updateData.academic_degree = academicDegree;
                if (academicYear) updateData.academic_year = academicYear;
              } else {
                if (selectedYear) updateData.teaching_year = selectedYear;
                if (specialty.trim()) updateData.specialty = specialty.trim();
              }
              if (Object.keys(updateData).length > 0) {
                await supabase.from('profiles').update(updateData).eq('id', newUser.id);
              }
            }
          }, 1000);
        }
        
        // Success - Supabase will send verification email automatically
        toast.success(
          language === 'ar' 
            ? 'تم إنشاء حسابك! يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب' 
            : 'Account created! Please check your email to verify your account'
        );
        
        // Navigate to email verification page
        navigate('/email-verification', { state: { email: email.trim() } });
        setLoading(false);
      }
    } catch (err) {
      toast.error(language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const roleOptions = [
    {
      value: 'student' as const,
      icon: BookOpen,
      label: t.auth.student,
      description: language === 'ar' ? 'تعلم وطور مهاراتك' : 'Learn and develop your skills',
      gradient: 'from-primary to-ocean',
    },
    {
      value: 'instructor' as const,
      icon: Users,
      label: t.auth.instructor,
      description: language === 'ar' ? 'شارك معرفتك وخبراتك' : 'Share your knowledge and expertise',
      gradient: 'from-secondary to-teal',
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir={dir}>
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/5" />
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-secondary/20 to-teal/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-tr from-primary/20 to-ocean/20 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute top-1/3 right-1/4 w-64 h-64 bg-gradient-to-r from-emerald/15 to-sky/15 rounded-full blur-3xl"
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
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
          <div className="absolute -inset-1 bg-gradient-to-r from-secondary via-teal to-emerald rounded-3xl blur-lg opacity-25 group-hover:opacity-40 transition-opacity duration-500" />
          
          <div className="relative bg-card/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-border/50 overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-secondary/10 to-transparent rounded-br-full" />
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-primary/10 to-transparent rounded-tl-full" />

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-center mb-6 relative"
            >
              <Link to="/" className="inline-block mb-4 group/logo">
                <motion.div
                  className="w-16 h-16 bg-gradient-to-br from-secondary via-teal to-emerald rounded-2xl flex items-center justify-center shadow-xl group-hover/logo:shadow-2xl transition-shadow duration-300"
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                >
                  <GraduationCap className="w-9 h-9 text-white" />
                </motion.div>
              </Link>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-secondary via-teal to-emerald bg-clip-text text-transparent">
                {t.auth.signup}
              </h1>
              <p className="text-muted-foreground mt-2 flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-teal" />
                {language === 'ar' ? 'انضم إلى مجتمعنا التعليمي' : 'Join our learning community'}
                <Sparkles className="w-4 h-4 text-teal" />
              </p>
            </motion.div>

            <form onSubmit={handleSubmit} className="space-y-5 relative">
              {/* Role Selection */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="space-y-3"
              >
                <Label className="text-foreground/80">
                  {language === 'ar' ? 'نوع الحساب' : 'Account Type'}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {roleOptions.map((option) => (
                    <motion.button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedRole(option.value)}
                      className={cn(
                        "relative p-4 rounded-xl border-2 transition-all duration-300",
                        selectedRole === option.value
                          ? "border-teal bg-teal/10 shadow-lg shadow-teal/10"
                          : "border-border/50 hover:border-teal/50 bg-background/50"
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                          selectedRole === option.value
                            ? `bg-gradient-to-br ${option.gradient}`
                            : "bg-muted"
                        )}>
                          <option.icon className={cn(
                            "w-5 h-5",
                            selectedRole === option.value ? "text-white" : "text-muted-foreground"
                          )} />
                        </div>
                        <span className={cn(
                          "font-medium text-sm",
                          selectedRole === option.value ? "text-teal" : "text-foreground"
                        )}>
                          {option.label}
                        </span>
                      </div>
                      {selectedRole === option.value && (
                        <motion.div
                          layoutId="selectedRole"
                          className="absolute inset-0 border-2 border-teal rounded-xl"
                          initial={false}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* Full Name Field */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-2"
              >
                <Label htmlFor="fullName" className="text-foreground/80">{t.auth.fullName}</Label>
                <div className="relative group/input">
                  <div className={`absolute inset-0 bg-gradient-to-r from-secondary to-teal rounded-lg blur-sm opacity-0 transition-opacity duration-300 ${focusedField === 'fullName' ? 'opacity-50' : 'group-hover/input:opacity-25'}`} />
                  <div className="relative">
                    <User className={`absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'fullName' ? 'text-teal' : 'text-muted-foreground'}`} />
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onFocus={() => setFocusedField('fullName')}
                      onBlur={() => setFocusedField(null)}
                      className={cn(
                        "ps-10 bg-background/50 border-border/50 focus:border-teal focus:ring-2 focus:ring-teal/20 transition-all duration-300",
                        validationErrors.fullName && "border-destructive"
                      )}
                      required
                      disabled={loading || redirecting}
                    />
                  </div>
                </div>
                {validationErrors.fullName && (
                  <p className="text-xs text-destructive">{validationErrors.fullName}</p>
                )}
              </motion.div>

              {/* Email Field */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                <Label htmlFor="email" className="text-foreground/80 flex items-center gap-2">
                  {t.auth.email}
                  {emailVerified && (
                    <span className="flex items-center gap-1 text-xs text-emerald">
                      <CheckCircle2 className="w-4 h-4" />
                      {language === 'ar' ? 'تم التحقق' : 'Verified'}
                    </span>
                  )}
                </Label>
                <div className="relative group/input">
                  <div className={`absolute inset-0 bg-gradient-to-r ${emailVerified ? 'from-emerald to-teal' : 'from-teal to-emerald'} rounded-lg blur-sm opacity-0 transition-opacity duration-300 ${focusedField === 'email' ? 'opacity-50' : 'group-hover/input:opacity-25'}`} />
                  <div className="relative">
                    {emailVerified ? (
                      <CheckCircle2 className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald" />
                    ) : (
                      <Mail className={`absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'email' ? 'text-teal' : 'text-muted-foreground'}`} />
                    )}
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={handleEmailChange}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      className={cn(
                        "ps-10 bg-background/50 border-border/50 focus:border-teal focus:ring-2 focus:ring-teal/20 transition-all duration-300",
                        validationErrors.email && "border-destructive",
                        emailVerified && "border-emerald bg-emerald/5"
                      )}
                      required
                      disabled={loading || redirecting || emailVerified}
                    />
                  </div>
                </div>
                {validationErrors.email && (
                  <p className="text-xs text-destructive">{validationErrors.email}</p>
                )}

                {/* Confirm Email Button */}
                {!otpSent && !emailVerified && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendOtp}
                    disabled={!isValidEmail(email) || sendingOtp || loading}
                    className="w-full mt-2 border-teal/50 hover:bg-teal/10 hover:border-teal"
                  >
                    {sendingOtp ? (
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                    ) : (
                      <Mail className="w-4 h-4 me-2" />
                    )}
                    {language === 'ar' ? 'تأكيد البريد الإلكتروني' : 'Confirm Email'}
                  </Button>
                )}

                {/* OTP Input Section */}
                {otpSent && !emailVerified && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-xl bg-muted/50 border border-border/50 space-y-4"
                  >
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        {language === 'ar' 
                          ? 'أدخل رمز التحقق المرسل إلى بريدك الإلكتروني' 
                          : 'Enter the verification code sent to your email'}
                      </p>
                      <div className="flex justify-center" dir="ltr">
                        <InputOTP
                          maxLength={6}
                          value={otp}
                          onChange={(value) => {
                            setOtp(value);
                            setOtpError('');
                          }}
                          disabled={verifyingOtp}
                        >
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
                      {otpError && (
                        <p className="text-xs text-destructive mt-2">{otpError}</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={otp.length !== 6 || verifyingOtp}
                        className="w-full bg-gradient-to-r from-teal to-emerald hover:opacity-90"
                      >
                        {verifyingOtp ? (
                          <Loader2 className="w-4 h-4 animate-spin me-2" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 me-2" />
                        )}
                        {language === 'ar' ? 'تأكيد الرمز' : 'Verify Code'}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleResendOtp}
                        disabled={resendCooldown > 0 || sendingOtp}
                        className="w-full text-muted-foreground hover:text-foreground"
                      >
                        <RefreshCw className={cn("w-4 h-4 me-2", sendingOtp && "animate-spin")} />
                        {resendCooldown > 0 
                          ? (language === 'ar' ? `إعادة الإرسال بعد ${resendCooldown} ثانية` : `Resend in ${resendCooldown}s`)
                          : (language === 'ar' ? 'إعادة إرسال الرمز' : 'Resend Code')
                        }
                      </Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>

              {/* Phone Field */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <Label htmlFor="phone" className="text-foreground/80">
                  {language === 'ar' ? 'رقم الهاتف *' : 'Phone Number *'}
                </Label>
                <div className="relative group/input">
                  <div className={`absolute inset-0 bg-gradient-to-r from-sky to-primary rounded-lg blur-sm opacity-0 transition-opacity duration-300 ${focusedField === 'phone' ? 'opacity-50' : 'group-hover/input:opacity-25'}`} />
                  <div className="relative flex gap-2">
                    {/* Country Selector */}
                    <Select
                      value={selectedCountry}
                      onValueChange={setSelectedCountry}
                      disabled={loading || redirecting}
                    >
                      <SelectTrigger className="w-[100px] bg-background/50 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            <span className="flex items-center gap-2">
                              <span>{country.flag}</span>
                              <span>{country.code}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <Phone className={`absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'phone' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        onFocus={() => setFocusedField('phone')}
                        onBlur={() => setFocusedField(null)}
                        className={cn(
                          "ps-10 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300",
                          validationErrors.phone && "border-destructive"
                        )}
                        placeholder={language === 'ar' ? 'مطلوب' : 'Required'}
                        required
                        dir="ltr"
                        disabled={loading || redirecting}
                      />
                    </div>
                  </div>
                </div>
                {validationErrors.phone && (
                  <p className="text-xs text-destructive">{validationErrors.phone}</p>
                )}
              </motion.div>

              {/* University & Major Selection (Only for Students) */}
              {selectedRole === 'student' && (
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="space-y-4"
                >
                  {/* University Selection */}
                  <div className="space-y-2">
                    <Label className="text-foreground/80 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      {language === 'ar' ? 'الجهة (اختياري)' : 'University (Optional)'}
                    </Label>
                    <Select
                      value={selectedUniversity}
                      onValueChange={(value) => {
                        setSelectedUniversity(value);
                        setSelectedMajor('');
                      }}
                      disabled={loading || redirecting}
                    >
                      <SelectTrigger className="bg-background/50 border-border/50">
                        <SelectValue placeholder={language === 'ar' ? 'اختر الجهة' : 'Select University'} />
                      </SelectTrigger>
                      <SelectContent>
                        {universities?.map((uni) => (
                          <SelectItem key={uni.id} value={uni.id}>
                            {language === 'ar' ? uni.name_ar : uni.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Major Selection */}
                  {selectedUniversity && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-2"
                    >
                      <Label className="text-foreground/80 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                        {language === 'ar' ? 'التخصص (اختياري)' : 'Major (Optional)'}
                      </Label>
                      <Select
                        value={selectedMajor}
                        onValueChange={setSelectedMajor}
                        disabled={loading || redirecting || !majors?.length}
                      >
                        <SelectTrigger className="bg-background/50 border-border/50">
                          <SelectValue placeholder={
                            !majors?.length 
                              ? (language === 'ar' ? 'لا توجد تخصصات' : 'No majors available')
                              : (language === 'ar' ? 'اختر التخصص' : 'Select Major')
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {majors?.map((major) => (
                            <SelectItem key={major.id} value={major.id}>
                              <div className="flex flex-col">
                                <span>{language === 'ar' ? major.name_ar : major.name}</span>
                                {major.colleges && (
                                  <span className="text-xs text-muted-foreground">
                                    {language === 'ar' ? major.colleges.name_ar : major.colleges.name}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Specialty Field (Only for Instructors) */}
              {selectedRole === 'instructor' && (
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.46 }}
                  className="space-y-2"
                >
                  <Label className="text-foreground/80 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    {language === 'ar' ? 'التخصص *' : 'Specialty *'}
                  </Label>
                  <div className="relative group/input">
                    <div className={`absolute inset-0 bg-gradient-to-r from-secondary to-teal rounded-lg blur-sm opacity-0 transition-opacity duration-300 ${focusedField === 'specialty' ? 'opacity-50' : 'group-hover/input:opacity-25'}`} />
                    <div className="relative">
                      <GraduationCap className={`absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'specialty' ? 'text-teal' : 'text-muted-foreground'}`} />
                      <Input
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        onFocus={() => setFocusedField('specialty')}
                        onBlur={() => setFocusedField(null)}
                        className="ps-10 bg-background/50 border-border/50 focus:border-teal focus:ring-2 focus:ring-teal/20 transition-all duration-300"
                        placeholder={language === 'ar' ? 'مثال: رياضيات، فيزياء، برمجة...' : 'e.g. Mathematics, Physics, Programming...'}
                        required
                        disabled={loading || redirecting}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {selectedRole === 'instructor' && (
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.465 }}
                  className="space-y-2"
                >
                  <Label className="text-foreground/80 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    {language === 'ar' ? 'الحالة الأكاديمية' : 'Academic Status'}
                  </Label>
                  <Select value={academicDegree} onValueChange={setAcademicDegree} disabled={loading || redirecting}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue placeholder={language === 'ar' ? 'اختر الحالة الأكاديمية' : 'Select academic status'} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="bachelor">{language === 'ar' ? 'بكالوريوس' : 'Bachelor'}</SelectItem>
                      <SelectItem value="masters_student">{language === 'ar' ? 'طالب ماجستير' : 'Masters Student'}</SelectItem>
                      <SelectItem value="masters">{language === 'ar' ? 'ماجستير' : 'Masters'}</SelectItem>
                      <SelectItem value="phd_student">{language === 'ar' ? 'طالب دكتوراه' : 'PhD Student'}</SelectItem>
                      <SelectItem value="phd">{language === 'ar' ? 'دكتوراه' : 'PhD'}</SelectItem>
                      <SelectItem value="assistant_professor">{language === 'ar' ? 'أستاذ مساعد' : 'Assistant Professor'}</SelectItem>
                      <SelectItem value="associate_professor">{language === 'ar' ? 'أستاذ مشارك' : 'Associate Professor'}</SelectItem>
                      <SelectItem value="professor">{language === 'ar' ? 'أستاذ (بروفيسور)' : 'Professor'}</SelectItem>
                      <SelectItem value="specialist">{language === 'ar' ? 'مختص/خبرة مهنية' : 'Specialist / Professional'}</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>
              )}

              {/* Year Selection (Both roles) */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.47 }}
                className="space-y-2"
              >
                <Label className="text-foreground/80 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-muted-foreground" />
                  {selectedRole === 'student'
                    ? (language === 'ar' ? 'السنة الدراسية (اختياري)' : 'Study Year (Optional)')
                    : (language === 'ar' ? 'سنة التدريس (اختياري)' : 'Teaching Year (Optional)')
                  }
                </Label>
                <Select
                  value={selectedYear}
                  onValueChange={setSelectedYear}
                  disabled={loading || redirecting}
                >
                  <SelectTrigger className="bg-background/50 border-border/50">
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
              </motion.div>

              {selectedRole === 'student' && (
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.48 }}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="space-y-2">
                    <Label className="text-foreground/80 text-sm">
                      {language === 'ar' ? 'الدرجة العلمية' : 'Academic Degree'}
                    </Label>
                    <Select value={academicDegree} onValueChange={setAcademicDegree} disabled={loading || redirecting}>
                      <SelectTrigger className="bg-background/50 border-border/50">
                        <SelectValue placeholder={language === 'ar' ? 'اختر الدرجة' : 'Select'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diploma">{language === 'ar' ? 'دبلوم' : 'Diploma'}</SelectItem>
                        <SelectItem value="bachelor">{language === 'ar' ? 'بكالوريوس' : 'Bachelor'}</SelectItem>
                        <SelectItem value="masters">{language === 'ar' ? 'ماجستير' : 'Masters'}</SelectItem>
                        <SelectItem value="phd">{language === 'ar' ? 'دكتوراه' : 'PhD'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80 text-sm">
                      {language === 'ar' ? 'السنة الأكاديمية' : 'Academic Year'}
                    </Label>
                    <Input
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      placeholder={language === 'ar' ? '2024-2025' : '2024-2025'}
                      className="bg-background/50 border-border/50"
                      disabled={loading || redirecting}
                    />
                  </div>
                </motion.div>
              )}

              {/* Password Field */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="space-y-2"
              >
                <Label htmlFor="password" className="text-foreground/80">{t.auth.password}</Label>
                <div className="relative group/input">
                  <div className={`absolute inset-0 bg-gradient-to-r from-emerald to-sky rounded-lg blur-sm opacity-0 transition-opacity duration-300 ${focusedField === 'password' ? 'opacity-50' : 'group-hover/input:opacity-25'}`} />
                  <div className="relative">
                    <Lock className={`absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'password' ? 'text-teal' : 'text-muted-foreground'}`} />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      className={cn(
                        "ps-10 bg-background/50 border-border/50 focus:border-teal focus:ring-2 focus:ring-teal/20 transition-all duration-300",
                        validationErrors.password && "border-destructive"
                      )}
                      required
                      disabled={loading || redirecting}
                    />
                  </div>
                </div>
                {validationErrors.password && (
                  <p className="text-xs text-destructive">{validationErrors.password}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters'}
                </p>
              </motion.div>

              {/* Submit Button */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Button
                  type="submit"
                  className={cn(
                    "w-full h-12 font-semibold rounded-xl shadow-lg transition-all duration-300 text-white",
                    emailVerified 
                      ? "bg-gradient-to-r from-secondary via-teal to-emerald hover:shadow-xl hover:opacity-90"
                      : "bg-muted cursor-not-allowed opacity-60"
                  )}
                  disabled={!emailVerified || loading || redirecting}
                >
                  {(loading || redirecting) ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      {t.auth.signup}
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        →
                      </motion.span>
                    </span>
                  )}
                </Button>
                {!emailVerified && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {language === 'ar' 
                      ? 'يرجى تأكيد البريد الإلكتروني أولاً لتفعيل زر إنشاء الحساب' 
                      : 'Please verify your email to enable account creation'}
                  </p>
                )}
              </motion.div>
            </form>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-center mt-6 text-muted-foreground"
            >
              {t.auth.hasAccount}{' '}
              <Link
                to="/login"
                className="text-teal hover:text-emerald font-medium transition-colors duration-200 hover:underline"
              >
                {t.auth.login}
              </Link>
            </motion.p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
