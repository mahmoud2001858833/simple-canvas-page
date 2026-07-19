import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { openChatWidget } from '@/components/ai-assistant/ChatWidget';
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  Calendar,
  TrendingUp,
  Award,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
  DollarSign,
  MessageSquare,
  Building2,
  School,
  Headphones,
  Percent,
  X,
  Menu,
  CheckCircle,
  ShieldAlert,
  UserCheck,
  Wallet,
  UserCog,
  Send,
  Ticket,
  GraduationCap as StudentIcon,
  Workflow,
  Video,
  Sparkles,
  Trophy,
  CalendarDays,
  ClipboardList,
  MessagesSquare,
  HelpCircle,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useEffect } from 'react';
import logoImg from '@/assets/logo.png';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  isOpen: boolean;
  onToggle: () => void;
  userRole: 'student' | 'instructor' | 'admin' | 'secretary' | 'production';
  'data-onboarding'?: string;
}

export const DashboardSidebar = ({ activeTab, onTabChange, isOpen, onToggle, userRole, ...props }: SidebarProps) => {
  const { t, dir } = useLanguage();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const unreadMessages = useUnreadMessages();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && isOpen) {
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  const studentTabs = [
    { id: 'overview', label: { ar: 'نظرة عامة', en: 'Overview' }, icon: LayoutDashboard, onboardingId: null, showBadge: false, isAction: false },
    { id: 'courses', label: { ar: 'دوراتي', en: 'My Courses' }, icon: BookOpen, onboardingId: null, showBadge: false, isAction: false },
    { id: 'assignments', label: { ar: 'واجباتي', en: 'Assignments' }, icon: ClipboardList, onboardingId: null, showBadge: false, isAction: false },
    { id: 'progress', label: { ar: 'تقدمي', en: 'Progress' }, icon: TrendingUp, onboardingId: null, showBadge: false, isAction: false },
    { id: 'certificates', label: { ar: 'شهاداتي', en: 'Certificates' }, icon: Award, onboardingId: null, showBadge: false, isAction: false },
    { id: 'payments', label: { ar: 'مدفوعاتي', en: 'My Payments' }, icon: Wallet, onboardingId: null, showBadge: false, isAction: false },
    { id: 'request', label: { ar: 'طلب دورة مخصص', en: 'Request Course' }, icon: FileText, onboardingId: 'request', showBadge: false, isAction: false },
    { id: 'my-requests', label: { ar: 'طلباتي', en: 'My Requests' }, icon: MessageSquare, onboardingId: null, showBadge: true, isAction: false },
    { id: 'achievements', label: { ar: 'إنجازاتي', en: 'Achievements' }, icon: Trophy, onboardingId: null, showBadge: false, isAction: false },
    { id: 'planner', label: { ar: 'الجدول الدراسي', en: 'Study Planner' }, icon: CalendarDays, onboardingId: null, showBadge: false, isAction: false },
    { id: 'support-chat', label: { ar: 'محادثة الدعم', en: 'Support Chat' }, icon: Headphones, onboardingId: null, showBadge: false, isAction: true },
  ];

  const instructorTabs = [
    { id: 'overview', label: { ar: 'نظرة عامة', en: 'Overview' }, icon: LayoutDashboard, onboardingId: null, showBadge: false, isAction: false },
    { id: 'courses', label: { ar: 'دوراتي', en: 'My Courses' }, icon: BookOpen, onboardingId: null, showBadge: false, isAction: false },
    { id: 'assignments', label: { ar: 'الواجبات', en: 'Assignments' }, icon: ClipboardList, onboardingId: null, showBadge: false, isAction: false },
    { id: 'question-bank', label: { ar: 'بنك الأسئلة', en: 'Question Bank' }, icon: HelpCircle, onboardingId: null, showBadge: false, isAction: false },
    { id: 'students', label: { ar: 'طلابي', en: 'My Students' }, icon: Users, onboardingId: null, showBadge: false, isAction: false },
    { id: 'student-engagement', label: { ar: 'تفاعل الطلاب', en: 'Student Engagement' }, icon: Activity, onboardingId: null, showBadge: false, isAction: false },
    { id: 'earnings', label: { ar: 'أرباحي', en: 'Earnings' }, icon: DollarSign, onboardingId: null, showBadge: false, isAction: false },
    { id: 'withdrawals', label: { ar: 'سحب الأرباح', en: 'Withdrawals' }, icon: Wallet, onboardingId: null, showBadge: false, isAction: false },
    { id: 'messages', label: { ar: 'الرسائل', en: 'Messages' }, icon: MessageSquare, onboardingId: null, showBadge: false, isAction: false },
    { id: 'analytics', label: { ar: 'التحليلات', en: 'Analytics' }, icon: TrendingUp, onboardingId: null, showBadge: false, isAction: false },
    { id: 'ai-assistant', label: { ar: 'مساعدك الذكي', en: 'AI Assistant' }, icon: Sparkles, onboardingId: null, showBadge: false, isAction: false },
  ];

  const adminTabs = [
    { id: 'overview', label: { ar: 'نظرة عامة', en: 'Overview' }, icon: LayoutDashboard, onboardingId: null, showBadge: false, isAction: false },
    { id: 'users', label: { ar: 'المستخدمين', en: 'Users' }, icon: Users, onboardingId: null, showBadge: false, isAction: false },
    { id: 'user-insights', label: { ar: 'معلومات المستخدمين', en: 'User Insights' }, icon: UserCheck, onboardingId: null, showBadge: false, isAction: false },
    { id: 'instructor-detail', label: { ar: 'المعلم بالتفصيل', en: 'Instructor Detail' }, icon: UserCog, onboardingId: null, showBadge: false, isAction: false },
    { id: 'student-detail', label: { ar: 'الطالب بالتفصيل', en: 'Student Detail' }, icon: StudentIcon, onboardingId: null, showBadge: false, isAction: false },
    { id: 'courses', label: { ar: 'الدورات', en: 'Courses' }, icon: BookOpen, onboardingId: null, showBadge: false, isAction: false },
    { id: 'course-approvals', label: { ar: 'موافقة على دورات المعلم', en: 'Course Approvals' }, icon: CheckCircle, onboardingId: null, showBadge: false, isAction: false },
    { id: 'universities', label: { ar: 'الجهات', en: 'Universities' }, icon: Building2, onboardingId: null, showBadge: false, isAction: false },
    { id: 'colleges', label: { ar: 'الكليات', en: 'Colleges' }, icon: School, onboardingId: null, showBadge: false, isAction: false },
    { id: 'majors', label: { ar: 'التخصصات', en: 'Majors' }, icon: GraduationCap, onboardingId: null, showBadge: false, isAction: false },
    { id: 'students-by-major', label: { ar: 'الطلاب حسب التخصص', en: 'Students by Major' }, icon: Users, onboardingId: null, showBadge: false, isAction: false },
    { id: 'workflow', label: { ar: 'سير العمل', en: 'Workflow' }, icon: Workflow, onboardingId: null, showBadge: false, isAction: false },
    { id: 'video-analytics', label: { ar: 'إحصائيات الفيديو', en: 'Video Analytics' }, icon: Video, onboardingId: null, showBadge: false, isAction: false },
    { id: 'requests', label: { ar: 'الطلبات', en: 'Requests' }, icon: FileText, onboardingId: null, showBadge: false, isAction: false },
    { id: 'support', label: { ar: 'محادثات الدعم', en: 'Support Chats' }, icon: Headphones, onboardingId: null, showBadge: false, isAction: false },
    { id: 'payments', label: { ar: 'المدفوعات', en: 'Payments' }, icon: DollarSign, onboardingId: null, showBadge: false, isAction: false },
    { id: 'financial-dashboard', label: { ar: 'لوحة المصاريف', en: 'Financial Dashboard' }, icon: Wallet, onboardingId: null, showBadge: false, isAction: false },
    { id: 'accounting', label: { ar: 'دفتر الحسابات', en: 'Accounting Ledger' }, icon: FileText, onboardingId: null, showBadge: false, isAction: false },
    { id: 'withdrawals', label: { ar: 'طلبات السحب', en: 'Withdrawals' }, icon: Send, onboardingId: null, showBadge: false, isAction: false },
    { id: 'coupons', label: { ar: 'الكوبونات', en: 'Coupons' }, icon: Ticket, onboardingId: null, showBadge: false, isAction: false },
    { id: 'reports', label: { ar: 'التقارير', en: 'Reports' }, icon: TrendingUp, onboardingId: null, showBadge: false, isAction: false },
    { id: 'notifications', label: { ar: 'الإشعارات', en: 'Notifications' }, icon: MessageSquare, onboardingId: null, showBadge: false, isAction: false },
    { id: 'logs', label: { ar: 'السجلات', en: 'System Logs' }, icon: FileText, onboardingId: null, showBadge: false, isAction: false },
    { id: 'capture-attempts', label: { ar: 'محاولات التقاط الشاشة', en: 'Screen Capture Attempts' }, icon: ShieldAlert, onboardingId: null, showBadge: false, isAction: false },
    { id: 'instructor-specialties', label: { ar: 'تخصصات المعلمين', en: 'Instructor Specialties' }, icon: UserCog, onboardingId: null, showBadge: false, isAction: false },
    { id: 'instructor-settings', label: { ar: 'إعدادات المعلمين', en: 'Instructor Settings' }, icon: Percent, onboardingId: null, showBadge: false, isAction: false },
    { id: 'general', label: { ar: 'الإعدادات العامة', en: 'General Settings' }, icon: Settings, onboardingId: null, showBadge: false, isAction: false },
  ];

  const getTabs = () => {
    switch (userRole) {
      case 'instructor':
        return instructorTabs;
      case 'admin':
        return adminTabs;
      default:
        return studentTabs;
    }
  };

  const tabs = getTabs();
  const language = dir === 'rtl' ? 'ar' : 'en';

  const handleLogout = async () => {
    await signOut();
    toast.success(language === 'ar' ? 'تم تسجيل الخروج بنجاح' : 'Logged out successfully');
    navigate('/');
  };

  const handleTabClick = (tab: any) => {
    if (tab.isAction && tab.id === 'support-chat') {
      openChatWidget();
    } else {
      onTabChange(tab.id);
    }
    if (window.innerWidth < 768) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
          onClick={onToggle}
        />
      )}

      {/* Mobile Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={onToggle}
        className={cn(
          "fixed top-4 z-50 md:hidden shadow-lg rounded-xl",
          dir === 'rtl' ? 'right-4' : 'left-4',
          isOpen && 'hidden'
        )}
      >
        <Menu className="w-5 h-5" />
      </Button>

      <aside
        className={cn(
          'fixed top-0 h-screen border-e border-sidebar-border transition-all duration-300 z-40',
          'md:translate-x-0',
          isOpen ? 'w-64' : 'md:w-20',
          dir === 'rtl' 
            ? cn('right-0', !isOpen && 'translate-x-full md:translate-x-0')
            : cn('left-0', !isOpen && '-translate-x-full md:translate-x-0')
        )}
        style={{
          background: 'linear-gradient(180deg, hsl(215, 55%, 12%) 0%, hsl(215, 50%, 16%) 40%, hsl(200, 45%, 14%) 70%, hsl(155, 40%, 14%) 100%)',
        }}
      >
        {/* Decorative glow */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-secondary/8 to-transparent pointer-events-none" />

        {/* Logo & Close */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 relative">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-gradient-gold shadow-gold">
              <img src={logoImg} alt="Logo" className="w-8 h-8 object-contain" />
            </div>
            {isOpen && (
              <span className="text-xl font-bold text-white">جسوركم</span>
            )}
          </Link>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="text-white/80 hover:bg-white/10 md:hidden rounded-xl"
          >
            <X className="w-5 h-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="text-white/80 hover:bg-white/10 hidden md:flex rounded-xl"
          >
            {dir === 'rtl' ? (
              isOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />
            ) : (
              isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 pb-32 overflow-y-auto max-h-[calc(100vh-10rem)] sidebar-scrollbar relative">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              data-onboarding={tab.onboardingId || undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group',
                tab.isAction 
                  ? 'text-sky/90 hover:bg-sky/10 border border-sky/20 hover:border-sky/40'
                  : activeTab === tab.id
                    ? 'bg-gradient-to-r from-primary/90 to-primary/70 text-white shadow-lg shadow-primary/20'
                    : 'text-white/70 hover:bg-white/8 hover:text-white'
              )}
            >
              <tab.icon className={cn(
                "w-5 h-5 flex-shrink-0 transition-transform duration-200",
                activeTab !== tab.id && !tab.isAction && "group-hover:scale-110"
              )} />
              {isOpen && <span className="text-sm font-medium truncate">{tab.label[language]}</span>}
              {tab.showBadge && unreadMessages > 0 && (
                <Badge 
                  className={cn(
                    "h-5 min-w-5 px-1 flex items-center justify-center text-xs bg-accent text-accent-foreground",
                    isOpen ? "ms-auto" : "absolute -top-1 -end-1"
                  )}
                >
                  {unreadMessages}
                </Badge>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10 space-y-1" style={{ background: 'linear-gradient(0deg, hsl(215, 55%, 10%) 0%, hsl(215, 55%, 12%) 100%)' }}>
          <button
            onClick={() => {
              onTabChange('settings');
              if (window.innerWidth < 768) onToggle();
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-primary/90 to-primary/70 text-white shadow-lg shadow-primary/20'
                : 'text-white/70 hover:bg-white/8 hover:text-white'
            )}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {isOpen && <span className="text-sm">{language === 'ar' ? 'الإعدادات' : 'Settings'}</span>}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {isOpen && <span className="text-sm">{language === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
