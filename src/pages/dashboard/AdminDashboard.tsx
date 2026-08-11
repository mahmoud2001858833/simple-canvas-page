import { useState, Suspense, lazy } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { StatsGridSkeleton, UsersTableSkeleton, CoursesTableSkeleton, PaymentsTableSkeleton, ListSkeleton } from '@/components/ui/skeletons';

// Lazy load all admin components for faster initial load
const AdminHub = lazy(() => import('@/components/dashboard/admin/AdminHub').then(m => ({ default: m.AdminHub })));
const AdminStats = lazy(() => import('@/components/dashboard/admin/AdminStats').then(m => ({ default: m.AdminStats })));
const UsersManagement = lazy(() => import('@/components/dashboard/admin/UsersManagement').then(m => ({ default: m.UsersManagement })));
const CoursesManagement = lazy(() => import('@/components/dashboard/admin/CoursesManagement').then(m => ({ default: m.CoursesManagement })));
const PaymentsManagement = lazy(() => import('@/components/dashboard/admin/PaymentsManagement').then(m => ({ default: m.PaymentsManagement })));
const RequestsManagement = lazy(() => import('@/components/dashboard/admin/RequestsManagement').then(m => ({ default: m.RequestsManagement })));
const UniversitiesManagement = lazy(() => import('@/components/dashboard/admin/UniversitiesManagement').then(m => ({ default: m.UniversitiesManagement })));
const CollegesManagement = lazy(() => import('@/components/dashboard/admin/CollegesManagement').then(m => ({ default: m.CollegesManagement })));
const MajorsManagement = lazy(() => import('@/components/dashboard/admin/MajorsManagement').then(m => ({ default: m.MajorsManagement })));
const AdminReports = lazy(() => import('@/components/dashboard/admin/AdminReports').then(m => ({ default: m.AdminReports })));
const AdminNotifications = lazy(() => import('@/components/dashboard/admin/AdminNotifications').then(m => ({ default: m.AdminNotifications })));
const SystemLogs = lazy(() => import('@/components/dashboard/admin/SystemLogs').then(m => ({ default: m.SystemLogs })));
const GeneralSettings = lazy(() => import('@/components/dashboard/admin/GeneralSettings').then(m => ({ default: m.GeneralSettings })));
const SupportChats = lazy(() => import('@/components/dashboard/admin/SupportChats').then(m => ({ default: m.SupportChats })));
const UserSettings = lazy(() => import('@/components/dashboard/UserSettings'));
const StudentsByMajor = lazy(() => import('@/components/dashboard/admin/StudentsByMajor').then(m => ({ default: m.StudentsByMajor })));
const InstructorSettings = lazy(() => import('@/components/dashboard/admin/InstructorSettings').then(m => ({ default: m.InstructorSettings })));
const CourseApprovals = lazy(() => import('@/components/dashboard/admin/CourseApprovals').then(m => ({ default: m.CourseApprovals })));
const ScreenCaptureAttempts = lazy(() => import('@/components/dashboard/admin/ScreenCaptureAttempts').then(m => ({ default: m.ScreenCaptureAttempts })));
const UserInsights = lazy(() => import('@/components/dashboard/admin/UserInsights').then(m => ({ default: m.UserInsights })));
const FinancialDashboard = lazy(() => import('@/components/dashboard/admin/FinancialDashboard').then(m => ({ default: m.FinancialDashboard })));
const InstructorDetailView = lazy(() => import('@/components/dashboard/admin/InstructorDetailView').then(m => ({ default: m.InstructorDetailView })));
const StudentDetailView = lazy(() => import('@/components/dashboard/admin/StudentDetailView').then(m => ({ default: m.StudentDetailView })));
const WithdrawalsManagement = lazy(() => import('@/components/dashboard/admin/WithdrawalsManagement').then(m => ({ default: m.WithdrawalsManagement })));
const CouponsManagement = lazy(() => import('@/components/dashboard/admin/CouponsManagement').then(m => ({ default: m.CouponsManagement })));
const AccountingLedger = lazy(() => import('@/components/dashboard/admin/AccountingLedger').then(m => ({ default: m.AccountingLedger })));
const WorkflowDashboard = lazy(() => import('@/components/dashboard/admin/WorkflowDashboard').then(m => ({ default: m.WorkflowDashboard })));
const VideoAnalytics = lazy(() => import('@/components/dashboard/admin/VideoAnalytics').then(m => ({ default: m.VideoAnalytics })));
const InstructorSpecialties = lazy(() => import('@/components/dashboard/admin/InstructorSpecialties').then(m => ({ default: m.InstructorSpecialties })));
const AbandonedPaymentsAnalytics = lazy(() => import('@/components/dashboard/admin/AbandonedPaymentsAnalytics').then(m => ({ default: m.AbandonedPaymentsAnalytics })));
const PaymentMethodsManagement = lazy(() => import('@/components/dashboard/admin/PaymentMethodsManagement').then(m => ({ default: m.PaymentMethodsManagement })));
const MonthlyInstallmentsManagement = lazy(() => import('@/components/dashboard/admin/MonthlyInstallmentsManagement').then(m => ({ default: m.MonthlyInstallmentsManagement })));
const TermsManagement = lazy(() => import('@/components/dashboard/admin/TermsManagement').then(m => ({ default: m.TermsManagement })));
const NelcIntegration = lazy(() => import('@/components/dashboard/admin/NelcIntegration').then(m => ({ default: m.NelcIntegration })));

type TabType = 'overview' | 'users' | 'user-insights' | 'instructor-detail' | 'student-detail' | 'courses' | 'course-approvals' | 'requests' | 'payments' | 'abandoned-payments' | 'payment-methods' | 'monthly-installments' | 'financial-dashboard' | 'accounting' | 'withdrawals' | 'coupons' | 'universities' | 'colleges' | 'majors' | 'students-by-major' | 'reports' | 'notifications' | 'logs' | 'general' | 'settings' | 'support' | 'instructor-settings' | 'terms' | 'nelc' | 'capture-attempts' | 'workflow' | 'video-analytics' | 'instructor-specialties';

// Fallback components for each section
const LoadingFallback = ({ type }: { type: string }) => {
  switch (type) {
    case 'overview':
      return <StatsGridSkeleton count={6} />;
    case 'users':
      return <UsersTableSkeleton rows={5} />;
    case 'courses':
      return <CoursesTableSkeleton rows={5} />;
    case 'payments':
      return <PaymentsTableSkeleton rows={5} />;
    default:
      return <ListSkeleton rows={5} />;
  }
};

// Admin Dashboard Component
const AdminDashboard = () => {
  const { dir } = useLanguage();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <Suspense fallback={<LoadingFallback type="overview" />}>
            <AdminHub onNavigate={(t) => setActiveTab(t as TabType)} />
          </Suspense>
        );
      case 'users':
        return (
          <Suspense fallback={<LoadingFallback type="users" />}>
            <UsersManagement />
          </Suspense>
        );
      case 'user-insights':
        return (
          <Suspense fallback={<LoadingFallback type="users" />}>
            <UserInsights />
          </Suspense>
        );
      case 'courses':
        return (
          <Suspense fallback={<LoadingFallback type="courses" />}>
            <CoursesManagement />
          </Suspense>
        );
      case 'instructor-detail':
        return (
          <Suspense fallback={<LoadingFallback type="users" />}>
            <InstructorDetailView />
          </Suspense>
        );
      case 'student-detail':
        return (
          <Suspense fallback={<LoadingFallback type="users" />}>
            <StudentDetailView />
          </Suspense>
        );
      case 'course-approvals':
        return (
          <Suspense fallback={<LoadingFallback type="courses" />}>
            <CourseApprovals />
          </Suspense>
        );
      case 'requests':
        return (
          <Suspense fallback={<LoadingFallback type="requests" />}>
            <RequestsManagement />
          </Suspense>
        );
      case 'workflow':
        return (
          <Suspense fallback={<LoadingFallback type="workflow" />}>
            <WorkflowDashboard />
          </Suspense>
        );
      case 'support':
        return (
          <Suspense fallback={<LoadingFallback type="support" />}>
            <SupportChats />
          </Suspense>
        );
      case 'payments':
        return (
          <Suspense fallback={<LoadingFallback type="payments" />}>
            <PaymentsManagement />
          </Suspense>
        );
      case 'abandoned-payments':
        return (
          <Suspense fallback={<LoadingFallback type="payments" />}>
            <AbandonedPaymentsAnalytics />
          </Suspense>
        );
      case 'payment-methods':
        return (
          <Suspense fallback={<LoadingFallback type="payments" />}>
            <PaymentMethodsManagement />
          </Suspense>
        );
      case 'monthly-installments':
        return (
          <Suspense fallback={<LoadingFallback type="payments" />}>
            <MonthlyInstallmentsManagement />
          </Suspense>
        );
      case 'financial-dashboard':
        return (
          <Suspense fallback={<LoadingFallback type="payments" />}>
            <FinancialDashboard />
          </Suspense>
        );
      case 'withdrawals':
        return (
          <Suspense fallback={<LoadingFallback type="payments" />}>
            <WithdrawalsManagement />
          </Suspense>
        );
      case 'accounting':
        return (
          <Suspense fallback={<LoadingFallback type="payments" />}>
            <AccountingLedger />
          </Suspense>
        );
      case 'coupons':
        return (
          <Suspense fallback={<LoadingFallback type="payments" />}>
            <CouponsManagement />
          </Suspense>
        );
      case 'universities':
        return (
          <Suspense fallback={<LoadingFallback type="universities" />}>
            <UniversitiesManagement />
          </Suspense>
        );
      case 'colleges':
        return (
          <Suspense fallback={<LoadingFallback type="colleges" />}>
            <CollegesManagement />
          </Suspense>
        );
      case 'majors':
        return (
          <Suspense fallback={<LoadingFallback type="majors" />}>
            <MajorsManagement />
          </Suspense>
        );
      case 'students-by-major':
        return (
          <Suspense fallback={<LoadingFallback type="students-by-major" />}>
            <StudentsByMajor />
          </Suspense>
        );
      case 'reports':
        return (
          <Suspense fallback={<LoadingFallback type="reports" />}>
            <AdminReports />
          </Suspense>
        );
      case 'notifications':
        return (
          <Suspense fallback={<LoadingFallback type="notifications" />}>
            <AdminNotifications />
          </Suspense>
        );
      case 'logs':
        return (
          <Suspense fallback={<LoadingFallback type="logs" />}>
            <SystemLogs />
          </Suspense>
        );
      case 'general':
        return (
          <Suspense fallback={<LoadingFallback type="general" />}>
            <GeneralSettings />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={<LoadingFallback type="settings" />}>
            <UserSettings />
          </Suspense>
        );
      case 'instructor-settings':
        return (
          <Suspense fallback={<LoadingFallback type="instructor-settings" />}>
            <InstructorSettings />
          </Suspense>
        );
      case 'terms':
        return (
          <Suspense fallback={<LoadingFallback type="terms" />}>
            <TermsManagement />
          </Suspense>
        );
      case 'capture-attempts':
        return (
          <Suspense fallback={<LoadingFallback type="capture-attempts" />}>
            <ScreenCaptureAttempts />
          </Suspense>
        );
      case 'video-analytics':
        return (
          <Suspense fallback={<LoadingFallback type="video-analytics" />}>
            <VideoAnalytics />
          </Suspense>
        );
      case 'instructor-specialties':
        return (
          <Suspense fallback={<LoadingFallback type="instructor-specialties" />}>
            <InstructorSpecialties />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex relative" dir={dir}>
      {/* Subtle background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 end-20 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
        <div className="absolute bottom-20 start-20 w-80 h-80 bg-secondary/3 rounded-full blur-3xl" />
        <div className="absolute top-1/2 start-1/3 w-64 h-64 bg-accent/3 rounded-full blur-3xl" />
      </div>

      <DashboardSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        userRole="admin"
      />
      
      <div className={`flex-1 transition-all duration-300 relative ${sidebarOpen ? 'md:ms-64' : 'md:ms-20'}`}>
        <DashboardHeader
          userName={profile?.full_name || profile?.email || 'Admin'}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <main className="p-6 pt-24">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
