import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminStats } from '@/components/dashboard/admin/AdminStats';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  Users,
  BookOpenCheck,
  FileText,
  Wallet,
  MessageSquare,
  CreditCard,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
  Eye,
  Bot,
  Building2,
  School,
  GraduationCap,
  TrendingUp,
  Percent,
  Search,
  CheckCircle2,
  Send,
  Ticket,
  CalendarClock,
  RotateCcw,
  UserCog,
  Workflow,
  Video,
  Activity,
  ShieldCheck,
  Settings,
  Sparkles,
  Landmark,
  UserCheck,
  HelpCircle,
  BrainCircuit,
  Headphones,
  Package,
} from 'lucide-react';

interface AdminHubProps {
  onNavigate: (tab: string) => void;
}

interface HubItem {
  id: string;
  title: string;
  description: string;
  category: 'teachers' | 'academic' | 'students' | 'finance' | 'ai' | 'security';
  icon: any;
  badge?: string | number;
  highlight?: boolean;
}

export const AdminHub = ({ onNavigate }: AdminHubProps) => {
  const { language, dir } = useLanguage();
  const isRTL = language === 'ar';
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Fetch real-time attention alerts across all platform vectors
  const { data: alerts } = useQuery({
    queryKey: ['admin-hub-alerts-v2'],
    queryFn: async () => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [approvals, requests, withdrawals, support, abandoned, captures, pendingNegotiations] = await Promise.all([
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending'),
        supabase.from('custom_course_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('support_chats').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', dayAgo),
        supabase.from('screen_capture_attempts').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
        (supabase as any).from('payout_negotiations').select('id', { count: 'exact', head: true }).in('status', ['offer_sent_by_admin', 'counter_offer_by_teacher']),
      ]);

      return {
        approvals: approvals.count || 0,
        requests: requests.count || 0,
        withdrawals: withdrawals.count || 0,
        support: support.count || 0,
        abandoned: abandoned.count || 0,
        captures: captures.count || 0,
        pendingNegotiations: pendingNegotiations.count || 0,
      };
    },
    staleTime: 30000,
  });

  // Emergency platform risk status
  const { data: activeRisk } = useQuery({
    queryKey: ['admin-platform-risk-hub'],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'active_platform_risk')
        .maybeSingle();

      if (!data?.setting_value) return null;
      try {
        const parsed = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
        return parsed?.active ? parsed : null;
      } catch {
        return null;
      }
    },
    refetchInterval: 15000,
  });

  const categories = [
    { id: 'all', label: isRTL ? 'جميع الأقسام' : 'All Sections' },
    { id: 'teachers', label: isRTL ? 'هيئة التدريس والمعلمون' : 'Faculty & Teachers' },
    { id: 'academic', label: isRTL ? 'المقررات والأكاديميا' : 'Academic & Curricula' },
    { id: 'students', label: isRTL ? 'الطلاب والفرص البيعية' : 'Students & Leads' },
    { id: 'finance', label: isRTL ? 'المالية والمحاسبة' : 'Financials & Ledger' },
    { id: 'ai', label: isRTL ? 'منظومة الذكاء الاصطناعي' : 'AI Command & Automation' },
    { id: 'security', label: isRTL ? 'الأمان، الاعتماد والإدارة' : 'Security & Governance' },
  ];

  const hubItems: HubItem[] = [
    // 1. Faculty & Teachers
    {
      id: 'comprehensive-users',
      title: isRTL ? 'دليل المستخدمين الشامل 👥' : 'Comprehensive Users Hub',
      description: isRTL ? 'عرض شامل لكافة المعلمين والطلاب مع الشهادات، المقررات، تعيين المهام والمحادثات المباشرة.' : '360° user directory for teachers and students with certificates, task assignment, and live direct chat.',
      category: 'teachers',
      icon: Users,
      highlight: true,
    },
    {
      id: 'teachers-onboarding',
      title: isRTL ? 'انضمام المعلمين والمصادر' : 'Teachers Onboarding',
      description: isRTL ? 'متابعة مراحل تسجيل المعلمين، توثيق الحسابات البنكية، ومعاينة العقود ونماذج العمل.' : 'Track onboarding pipeline, verify bank accounts, inspect contracts.',
      category: 'teachers',
      icon: UserCheck,
      highlight: true,
    },
    {
      id: 'payout-negotiations',
      title: isRTL ? 'غرفة مفاوضات الأرباح' : 'Payout Negotiations Room',
      description: isRTL ? 'إدارة عروض المقايضة المالية (نسبة / مقطوع / هجين)، ومراجعة عروض المعلمين وملاحظاتهم.' : 'Negotiate profit sharing and fixed compensations with teachers.',
      category: 'teachers',
      icon: Landmark,
      badge: alerts?.pendingNegotiations ? `${alerts.pendingNegotiations} مفاوضة` : undefined,
      highlight: true,
    },
    {
      id: 'instructor-payouts',
      title: isRTL ? 'مستحقات وأرباح المعلمين' : 'Instructor Dues & Payouts',
      description: isRTL ? 'تدقيق مستحقات المعلمين مع بيانات الآيبان البنكي (SA) والتحويل الفوري.' : 'Audit teacher dues, copy verified IBANs, and settle payouts.',
      category: 'teachers',
      icon: Wallet,
    },
    {
      id: 'instructor-settings',
      title: isRTL ? 'سياسات وإعدادات المعلمين' : 'Instructor Policies & Settings',
      description: isRTL ? 'تحديد نسب العمولة الافتراضية، شروط الانضمام، وسياسات الدفع.' : 'Configure default commission rates and onboarding policies.',
      category: 'teachers',
      icon: Percent,
    },
    {
      id: 'instructor-specialties',
      title: isRTL ? 'تخصصات الكادر التعليمي' : 'Instructor Specialties',
      description: isRTL ? 'إدارة التخصصات الأكاديمية والدرجات العلمية المصنفة للكادر.' : 'Manage approved academic specialties and professor ranks.',
      category: 'teachers',
      icon: UserCog,
    },
    {
      id: 'instructor-detail',
      title: isRTL ? 'الملف الأكاديمي للمعلم' : 'Instructor Deep Profile',
      description: isRTL ? 'استعراض شامل لملف المعلم، مقرراته النشطة، أرباحه، وتقييمات الطلاب.' : 'In-depth profile of courses, students, and financial performance.',
      category: 'teachers',
      icon: Users,
    },

    // 2. Academic & Curricula
    {
      id: 'courses',
      title: isRTL ? 'إدارة المقررات الدراسية' : 'Course Management',
      description: isRTL ? 'إدارة محتوى المقررات، الفصول، الفيديوهات والملفات المرفقة.' : 'Manage courses, chapters, lesson videos, and attachments.',
      category: 'academic',
      icon: BookOpenCheck,
    },
    {
      id: 'course-approvals',
      title: isRTL ? 'اعتماد الدورات الجديدة' : 'Course Approvals',
      description: isRTL ? 'مراجعة طلبات نشر وتحديث الدورات المقدمة من المعلمين.' : 'Review and approve new courses submitted by instructors.',
      category: 'academic',
      icon: CheckCircle2,
      badge: alerts?.approvals ? `${alerts.approvals} بانتظار الاعتماد` : undefined,
      highlight: alerts?.approvals ? true : false,
    },
    {
      id: 'bundles',
      title: isRTL ? 'إدارة البكجات والحزم الدراسية' : 'Course Bundles & Packages',
      description: isRTL ? 'تجميع المقررات في باقات مخفضة وتحديد الأسعار وضبط قواعد باقات الطلاب المخصصة.' : 'Create curated course bundles, set special bundle prices and custom bundle discount rules.',
      category: 'academic',
      icon: Package,
      highlight: true,
    },
    {
      id: 'requests',
      title: isRTL ? 'طلبات الدورات المخصصة' : 'Custom Course Requests',
      description: isRTL ? 'مراجعة طلبات الطلاب للمقررات غير المتاحة وإحالتها للمدرس المناسب.' : 'Review student requests and assign to capable teachers.',
      category: 'academic',
      icon: FileText,
      badge: alerts?.requests ? `${alerts.requests} معلق` : undefined,
    },
    {
      id: 'universities',
      title: isRTL ? 'الجهات والجامعات' : 'Universities & Entities',
      description: isRTL ? 'إدارة الجامعات والمؤسسات التعليمية المعتمدة في النظام.' : 'Manage registered Saudi universities and partner institutions.',
      category: 'academic',
      icon: Building2,
    },
    {
      id: 'colleges',
      title: isRTL ? 'الكليات الأكاديمية' : 'Academic Colleges',
      description: isRTL ? 'إدارة الكليات التابعة لكل جامعة وتوزيع الأقسام.' : 'Manage colleges linked to registered institutions.',
      category: 'academic',
      icon: School,
    },
    {
      id: 'majors',
      title: isRTL ? 'التخصصات الدراسية' : 'Academic Majors',
      description: isRTL ? 'إدارة التخصصات الأكاديمية وربطها بالكليات والمقررات.' : 'Manage majors, degree plans, and course requirements.',
      category: 'academic',
      icon: GraduationCap,
    },
    {
      id: 'terms',
      title: isRTL ? 'الفصول والشروط الأكاديمية' : 'Academic Terms & Policies',
      description: isRTL ? 'تحديد الفصول الدراسية وسياسات التسجيل والتقويم الجامعي.' : 'Manage semester calendars and academic terms.',
      category: 'academic',
      icon: CalendarClock,
    },
    {
      id: 'video-analytics',
      title: isRTL ? 'تحليلات واستهلاك الفيديو' : 'Video Analytics & Storage',
      description: isRTL ? 'إحصاءات مشاهدة الدروس، استهلاك سعة البث، ومعدلات الاحتفاظ.' : 'Video watch duration, bandwidth, and student retention.',
      category: 'academic',
      icon: Video,
    },

    // 3. Students & Leads
    {
      id: 'users',
      title: isRTL ? 'إدارة المستخدمين والحسابات' : 'User Accounts Management',
      description: isRTL ? 'التحكم بجميع الحسابات، ترقية الأدوار، الحظر، وتعديل الصلاحيات.' : 'Full control over accounts, roles, access permissions, and bans.',
      category: 'students',
      icon: Users,
    },
    {
      id: 'preview-students',
      title: isRTL ? 'طلاب المعاينة والفرص البيعية' : 'Preview Students (Hot Leads)',
      description: isRTL ? 'سجل الطلاب الذين شاهدوا المحتوى المجاني مع بيانات الاتصال ونسب التحويل.' : 'Students who watched preview videos with contact info and funnel metrics.',
      category: 'students',
      icon: Eye,
      highlight: true,
    },
    {
      id: 'user-insights',
      title: isRTL ? 'رؤى وتحليلات المستخدمين' : 'User Behavior Insights',
      description: isRTL ? 'تحليل معدلات النشاط، أوقات الذروة، وسلوك التفاعل مع المنصة.' : 'Engagement insights, peak hours, and cohort activity.',
      category: 'students',
      icon: UserCheck,
    },
    {
      id: 'students-by-major',
      title: isRTL ? 'توزيع الطلاب حسب التخصص' : 'Students Distribution by Major',
      description: isRTL ? 'خريطة انتشار وتوزيع الطلاب على الكليات والتخصصات المختلفة.' : 'Geographic and departmental distribution of enrolled students.',
      category: 'students',
      icon: GraduationCap,
    },
    {
      id: 'student-detail',
      title: isRTL ? 'السجل التفصيلي للطالب' : 'Student Deep Profile',
      description: isRTL ? 'سجل شامل لتسجيلات الطالب، مدفوعاته، واجباته، وشهاداته.' : 'Full student transcript, payments, assignments, and certificates.',
      category: 'students',
      icon: GraduationCap,
    },

    // 4. Financials & Ledger
    {
      id: 'financial-dashboard',
      title: isRTL ? 'اللوحة المالية الشاملة' : 'Financial Executive Dashboard',
      description: isRTL ? 'ملخص الإيرادات، المصروفات، هوامش الربح، والمؤشرات المالية الكلية.' : 'Total revenue, operating expenses, profit margins, and net ROI.',
      category: 'finance',
      icon: Wallet,
      highlight: true,
    },
    {
      id: 'accounting',
      title: isRTL ? 'دفتر الأستاذ والمحاسبة' : 'Accounting Ledger',
      description: isRTL ? 'سجل محاسبي تفصيلي مزدوج القيد لجميع الحركات المالية والقيود.' : 'Detailed general ledger of all platform credit/debit entries.',
      category: 'finance',
      icon: FileText,
    },
    {
      id: 'payments',
      title: isRTL ? 'سجل المدفوعات والعمليات' : 'Payments & Invoices Log',
      description: isRTL ? 'متابعة جميع عمليات الدفع الناجحة، المعلقة، والفواتير الضريبية.' : 'Log of all successful and pending customer transactions.',
      category: 'finance',
      icon: CreditCard,
    },
    {
      id: 'live-payments',
      title: isRTL ? 'إشعارات الدفع المباشرة' : 'Live Payment Alerts Stream',
      description: isRTL ? 'بث فوري لعمليات الدفع والاشتراكات الجديدة لحظة بلحظة.' : 'Real-time telemetry of transactions as they happen.',
      category: 'finance',
      icon: Activity,
    },
    {
      id: 'abandoned-payments',
      title: isRTL ? 'المدفوعات المهجورة (+24 س)' : 'Abandoned Carts (24h+)',
      description: isRTL ? 'الطلبات التي لم تكتمل مع أدوات إرسال التذكيرات وحث الدفع.' : 'Unfinished checkout sessions with recovery triggers.',
      category: 'finance',
      icon: AlertTriangle,
      badge: alerts?.abandoned ? `${alerts.abandoned} مهجورة` : undefined,
    },
    {
      id: 'payment-methods',
      title: isRTL ? 'بوابات وطرق الدفع' : 'Payment Methods & Gateways',
      description: isRTL ? 'تخصيص طرق الدفع المتاحة (مدى، فيزا، ماستركارد، آبل باي) لكل مقرر.' : 'Configure supported payment gateways per course or global.',
      category: 'finance',
      icon: CreditCard,
    },
    {
      id: 'monthly-installments',
      title: isRTL ? 'تقسيط الأقساط الشهرية' : 'Installments Management (Tabby/Tamara)',
      description: isRTL ? 'إدارة برامج التقسيط وربط خدمات الدفع بالآجل والتمويل الطلابي.' : 'Manage split-payment installment plans and loan partners.',
      category: 'finance',
      icon: CalendarClock,
    },
    {
      id: 'withdrawals',
      title: isRTL ? 'طلبات سحب الأرباح' : 'Instructor Withdrawals',
      description: isRTL ? 'مراجعة واعتماد طلبات تحويل الأرباح لحسابات المعلمين.' : 'Review and disburse teacher payout withdrawal requests.',
      category: 'finance',
      icon: Send,
      badge: alerts?.withdrawals ? `${alerts.withdrawals} معلق` : undefined,
      highlight: alerts?.withdrawals ? true : false,
    },
    {
      id: 'student-refunds',
      title: isRTL ? 'مستحقات الطلاب المنسحبين' : 'Student Refunds & Reversals',
      description: isRTL ? 'معالجة طلبات الاسترجاع وفق سياسة الإلغاء والضوابط المعتمدة.' : 'Process course cancellation refunds and ledger reconciliations.',
      category: 'finance',
      icon: RotateCcw,
    },
    {
      id: 'coupons',
      title: isRTL ? 'كوبونات وقسائم الخصم' : 'Coupons & Promo Codes',
      description: isRTL ? 'إنشاء وتتبع حملات الخصم، وتحديد نسب الاستخدام وحدود التفعيل.' : 'Generate discount codes, set campaign limits and track redemption.',
      category: 'finance',
      icon: Ticket,
    },

    // 5. AI Command & Neural Automation
    {
      id: 'ai-control',
      title: isRTL ? 'مركز التحكم بالذكاء الاصطناعي 🤖' : 'AI Control Center & Prompts',
      description: isRTL ? 'إدارة المستشار التنفيذي العام، تدريب النماذج، وضبط قواعد التفاعل.' : 'Master AI Executive, prompt engineering, and agent instructions.',
      category: 'ai',
      icon: Bot,
      highlight: true,
    },
    {
      id: 'mega-ai-ops',
      title: isRTL ? 'غرفة العمليات والرادار العصبي' : 'Mega AI Operations Hub',
      description: isRTL ? 'رصد أداء الـ 6 وكلاء الأذكياء، سرعة الاستجابة، ورادار الطوارئ والأمان.' : 'Real-time telemetry of the 6 autonomous agents and risk radar.',
      category: 'ai',
      icon: BrainCircuit,
      highlight: true,
    },

    // 6. Security, Compliance & Governance
    {
      id: 'nelc',
      title: isRTL ? 'الاعتماد والتكامل مع NELC' : 'NELC National Accreditation',
      description: isRTL ? 'التحقق من الامتثال لمعايير المركز الوطني للتعليم الإلكتروني.' : 'National e-learning center compliance and audit trails.',
      category: 'security',
      icon: ShieldCheck,
    },
    {
      id: 'capture-attempts',
      title: isRTL ? 'محاولات تصوير الشاشة' : 'DRM & Screen Capture Attempts',
      description: isRTL ? 'سجل المحاولات المرصودة لتسجيل الفيديو المحمي لاتخاذ إجراءات الحظر.' : 'Detect unauthorized video capture attempts and enforce DRM.',
      category: 'security',
      icon: ShieldAlert,
      badge: alerts?.captures ? `${alerts.captures} محاولة` : undefined,
    },
    {
      id: 'support',
      title: isRTL ? 'محادثات الدعم الفني' : 'Live Support Chats',
      description: isRTL ? 'الرد الفوري على استفسارات الطلاب وحل المشكلات التشغيلية.' : 'Resolve student technical support inquiries and direct chats.',
      category: 'security',
      icon: Headphones,
      badge: alerts?.support ? `${alerts.support} مفتوح` : undefined,
      highlight: alerts?.support ? true : false,
    },
    {
      id: 'reports',
      title: isRTL ? 'التقارير التحليلية المتقدمة' : 'Comprehensive Analytics Reports',
      description: isRTL ? 'تقارير دورية شاملة للمبيعات، الطلاب، المقررات، وقابلة للتصدير Excel/PDF.' : 'Generate exportable reports across all platform verticals.',
      category: 'security',
      icon: TrendingUp,
    },
    {
      id: 'notifications',
      title: isRTL ? 'الإشعارات والتعميمات' : 'Broadcast & Notifications',
      description: isRTL ? 'إرسال تنبيهات جماعية مخصصة للطلاب أو المعلمين عبر التطبيق والبريد.' : 'Dispatch platform-wide alerts and push notifications.',
      category: 'security',
      icon: MessageSquare,
    },
    {
      id: 'logs',
      title: isRTL ? 'سجلات النظام والأمان' : 'System & Security Logs',
      description: isRTL ? 'سجل كامل للأحداث الإدارية، تسجيل الدخول، والتغييرات الحساسة.' : 'Immutable audit log of all administrative actions and security events.',
      category: 'security',
      icon: FileText,
    },
    {
      id: 'workflow',
      title: isRTL ? 'سير العمليات والإنتاج' : 'Workflow & Production Pipeline',
      description: isRTL ? 'تنسيق المهام بين السكرتارية، فرق الإنتاج، ومراجعي المقررات.' : 'Coordination board between administrative staff and course producers.',
      category: 'security',
      icon: Workflow,
    },
    {
      id: 'general',
      title: isRTL ? 'الإعدادات العامة للمنصة' : 'General Platform Settings',
      description: isRTL ? 'إعدادات الهوية البصرية، بيانات التواصل، بوابات الرسائل، والسياسات.' : 'Brand identity, SMTP mail settings, and global parameters.',
      category: 'security',
      icon: Settings,
    },
  ];

  // Filtering
  const filteredItems = useMemo(() => {
    return hubItems.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery, isRTL]);

  const alertCards = [
    {
      id: 'course-approvals',
      icon: BookOpenCheck,
      count: alerts?.approvals || 0,
      label: isRTL ? 'دورات بانتظار الاعتماد' : 'Courses awaiting approval',
      tone: 'border-amber-400/40 bg-amber-500/10 text-amber-900',
    },
    {
      id: 'payout-negotiations',
      icon: Landmark,
      count: alerts?.pendingNegotiations || 0,
      label: isRTL ? 'مفاوضات أرباح معلمين نشطة' : 'Active payout negotiations',
      tone: 'border-purple-400/40 bg-purple-500/10 text-purple-900',
    },
    {
      id: 'requests',
      icon: FileText,
      count: alerts?.requests || 0,
      label: isRTL ? 'طلبات دورات مخصصة معلقة' : 'Pending custom requests',
      tone: 'border-blue-400/40 bg-blue-500/10 text-blue-900',
    },
    {
      id: 'withdrawals',
      icon: Wallet,
      count: alerts?.withdrawals || 0,
      label: isRTL ? 'طلبات سحب أرباح معلقة' : 'Withdrawal requests pending',
      tone: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-900',
    },
    {
      id: 'support',
      icon: MessageSquare,
      count: alerts?.support || 0,
      label: isRTL ? 'محادثات دعم فني مفتوحة' : 'Open support chats',
      tone: 'border-teal-400/40 bg-teal-500/10 text-teal-900',
    },
    {
      id: 'abandoned-payments',
      icon: CreditCard,
      count: alerts?.abandoned || 0,
      label: isRTL ? 'مدفوعات مهجورة (+24 ساعة)' : 'Abandoned payments (24h+)',
      tone: 'border-rose-400/40 bg-rose-500/10 text-rose-900',
    },
    {
      id: 'capture-attempts',
      icon: ShieldAlert,
      count: alerts?.captures || 0,
      label: isRTL ? 'محاولات تصوير شاشة مرصودة' : 'Screen capture attempts (24h)',
      tone: 'border-red-400/40 bg-red-500/10 text-red-900',
    },
  ];

  const activeAlerts = alertCards.filter((a) => a.count > 0);

  return (
    <div className="space-y-8" dir={dir}>
      {/* Top Live KPI Statistics */}
      <AdminStats />

      {/* Emergency Platform Risk Banner if active */}
      {activeRisk && (
        <Card className="border-2 border-destructive bg-destructive/10 shadow-lg">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-destructive text-white animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-destructive">
                  {isRTL ? 'حالة طوارئ معلنة على مستوى المنصة' : 'Platform Emergency Alert Active'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeRisk.description || activeRisk.title || (isRTL ? 'يرجى مراجعة الرادار الذكي فوراً.' : 'Action required.')}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onNavigate('mega-ai-ops')}
              className="gap-2 shadow-sm shrink-0"
            >
              <span>{isRTL ? 'فتح غرفة العمليات' : 'Open Ops Room'}</span>
              <Arrow className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Needs Attention Now Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold text-foreground">
            {isRTL ? 'يحتاج انتباهك وإجراءاتك الفورية' : 'Needs Your Attention Now'}
          </h2>
          {activeAlerts.length > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-bold border-amber-300">
              {activeAlerts.length}
            </Badge>
          )}
        </div>

        {activeAlerts.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground bg-muted/20 border-emerald-500/20">
            <div className="flex items-center gap-3 text-emerald-700 font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>
                {isRTL
                  ? 'لا توجد مهام معلقة أو إجراءات عاجلة الآن. المنظومة تعمل بأعلى درجات الكفاءة.'
                  : 'No urgent pending actions right now. All platform metrics are healthy.'}
              </span>
            </div>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {activeAlerts.map((a) => (
              <button
                key={a.id}
                onClick={() => onNavigate(a.id)}
                className={`text-start rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${a.tone}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <a.icon className="w-5 h-5" />
                  <span className="text-2xl font-extrabold">{a.count}</span>
                </div>
                <div className="text-xs font-bold leading-tight">{a.label}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Royal 38-Command Directory Header & Search */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">
              {isRTL ? 'الدليل القيادي الشامل لمنصة جسوركم (38 محوراً)' : 'Master Executive Directory (38 Sections)'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isRTL
                ? 'لوحة الإشراف المتكاملة للتحكم في الكادر التعليمي، المقررات، الفرص البيعية، والمالية المؤتمتة'
                : 'Centralized access to all educational, administrative, and AI operations'}
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute top-3 start-3 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'ابحث عن أي قسم أو أداة...' : 'Search tools, sections...'}
              className="ps-9 h-10 text-sm bg-card border-primary/20 focus-visible:ring-primary"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <Button
                key={cat.id}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-xl text-xs font-semibold shrink-0 transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card hover:bg-muted/50 border-border text-muted-foreground'
                }`}
              >
                {cat.label}
              </Button>
            );
          })}
        </div>

        {/* Directory Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`group cursor-pointer border rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 bg-card ${
                  item.highlight ? 'ring-1 ring-[#D4AF37]/30 bg-amber-500/2' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    item.highlight
                      ? 'bg-[#D4AF37]/15 text-[#B89020] group-hover:bg-primary group-hover:text-white'
                      : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  {item.badge && (
                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20 font-bold">
                      {item.badge}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <Arrow className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12 border rounded-2xl bg-muted/10">
            <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold text-muted-foreground">
              {isRTL ? 'لم يتم العثور على أي قسم يطابق بحثك' : 'No sections matched your search'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
