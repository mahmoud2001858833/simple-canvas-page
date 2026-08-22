import { useState, useEffect, lazy, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'react-router-dom';

// Lazy load heavy components for better initial load performance
const MyCourses = lazy(() => import('@/components/dashboard/student/MyCourses').then(m => ({ default: m.MyCourses })));
const ProgressOverview = lazy(() => import('@/components/dashboard/student/ProgressOverview').then(m => ({ default: m.ProgressOverview })));
const MyCertificates = lazy(() => import('@/components/dashboard/student/MyCertificates').then(m => ({ default: m.MyCertificates })));
const DashboardStats = lazy(() => import('@/components/dashboard/student/DashboardStats').then(m => ({ default: m.DashboardStats })));
const CustomCourseRequest = lazy(() => import('@/components/dashboard/student/CustomCourseRequest').then(m => ({ default: m.CustomCourseRequest })));
const MyRequests = lazy(() => import('@/components/dashboard/student/MyRequests').then(m => ({ default: m.MyRequests })));
const MyPayments = lazy(() => import('@/components/dashboard/student/MyPayments').then(m => ({ default: m.MyPayments })));
const RecentActivity = lazy(() => import('@/components/dashboard/student/RecentActivity').then(m => ({ default: m.RecentActivity })));
const UserSettings = lazy(() => import('@/components/dashboard/UserSettings'));
const GamificationWidget = lazy(() => import('@/components/dashboard/student/GamificationWidget').then(m => ({ default: m.GamificationWidget })));
const StudyPlanner = lazy(() => import('@/components/dashboard/student/StudyPlanner').then(m => ({ default: m.StudyPlanner })));
const MyAssignments = lazy(() => import('@/components/dashboard/student/MyAssignments').then(m => ({ default: m.MyAssignments })));

type TabType = 'overview' | 'courses' | 'assignments' | 'progress' | 'certificates' | 'payments' | 'request' | 'my-requests' | 'achievements' | 'planner' | 'settings';

const dashboardTabs: TabType[] = ['overview', 'courses', 'assignments', 'progress', 'certificates', 'payments', 'request', 'my-requests', 'achievements', 'planner', 'settings'];

// Loading skeleton for dashboard content
const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} className="h-32 rounded-lg" />
      ))}
    </div>
    <Skeleton className="h-64 rounded-lg" />
    <Skeleton className="h-48 rounded-lg" />
  </div>
);

// Onboarding steps for student dashboard
const dashboardOnboardingSteps = [
  {
    id: 'student-stats',
    title: 'Dashboard Overview',
    title_ar: 'نظرة عامة على لوحة التحكم',
    description: 'Here you can see your learning statistics and quick overview of your progress.',
    description_ar: 'هنا يمكنك رؤية إحصائيات التعلم ونظرة سريعة على تقدمك.',
    target: '[data-onboarding="stats"]',
    placement: 'bottom' as const,
  },
  {
    id: 'student-courses',
    title: 'My Courses',
    title_ar: 'دوراتي',
    description: 'View all your enrolled courses and continue learning from where you left off.',
    description_ar: 'شاهد جميع الدورات المسجلة وتابع التعلم من حيث توقفت.',
    target: '[data-onboarding="courses"]',
    placement: 'right' as const,
  },
  {
    id: 'student-request',
    title: 'Custom Course Request',
    title_ar: 'طلب دورة مخصص',
    description: 'Can\'t find what you need? Request a custom course explanation powered by AI!',
    description_ar: 'لم تجد ما تبحث عنه؟ اطلب شرح مخصص مدعوم بالذكاء الاصطناعي!',
    target: '[data-onboarding="request"]',
    placement: 'right' as const,
  },
];

const StudentDashboard = () => {
  const { dir } = useLanguage();
  const { profile } = useAuth();
  const { startOnboarding, state } = useOnboarding();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = requestedTab && dashboardTabs.includes(requestedTab as TabType)
    ? requestedTab as TabType
    : 'overview';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'overview') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  useEffect(() => {
    if (requestedTab && dashboardTabs.includes(requestedTab as TabType)) {
      setActiveTab(requestedTab as TabType);
    }
  }, [requestedTab]);

  // Start onboarding when dashboard loads (if not completed)
  useEffect(() => {
    // Small delay to ensure DOM elements are rendered
    const timer = setTimeout(() => {
      if (state.hasSeenWelcome && !state.completedSteps.includes('student-stats')) {
        startOnboarding(dashboardOnboardingSteps);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [state.hasSeenWelcome]);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8">
            <div data-onboarding="stats">
              <DashboardStats />
            </div>
            <div data-onboarding="courses">
              <MyCourses limit={3} showViewAll onViewAll={() => handleTabChange('courses')} />
            </div>
            <RecentActivity />
            <ProgressOverview limit={4} />
          </div>
        );
      case 'courses':
        return <MyCourses />;
      case 'assignments':
        return <MyAssignments />;
      case 'progress':
        return <ProgressOverview />;
      case 'certificates':
        return <MyCertificates />;
      case 'payments':
        return <MyPayments />;
      case 'request':
        return <CustomCourseRequest />;
      case 'my-requests':
        return <MyRequests />;
      case 'achievements':
        return <GamificationWidget />;
      case 'planner':
        return <StudyPlanner />;
      case 'settings':
        return <UserSettings />;
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
      </div>

      <DashboardSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        userRole="student"
        data-onboarding="request"
      />
      
      <div className={`flex-1 transition-all duration-300 relative ${sidebarOpen ? 'md:ms-64' : 'md:ms-20'}`}>
        <DashboardHeader
          userName={profile?.full_name || profile?.email || ''}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <main className="p-6 pt-24">
          <div className="max-w-7xl mx-auto">
            <Suspense fallback={<DashboardSkeleton />}>
              {renderContent()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default StudentDashboard;
