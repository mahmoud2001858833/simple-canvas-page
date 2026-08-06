import { useState, useEffect, lazy, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ResearchParticipationModal } from '@/components/dashboard/ResearchParticipationModal';

// Lazy load heavy components for better initial load performance
const InstructorStats = lazy(() => import('@/components/dashboard/instructor/InstructorStats').then(m => ({ default: m.InstructorStats })));
const InstructorCourses = lazy(() => import('@/components/dashboard/instructor/InstructorCourses').then(m => ({ default: m.InstructorCourses })));
const InstructorStudents = lazy(() => import('@/components/dashboard/instructor/InstructorStudents').then(m => ({ default: m.InstructorStudents })));
const InstructorEarnings = lazy(() => import('@/components/dashboard/instructor/InstructorEarnings').then(m => ({ default: m.InstructorEarnings })));
const InstructorMessages = lazy(() => import('@/components/dashboard/instructor/InstructorMessages').then(m => ({ default: m.InstructorMessages })));
const InstructorAnalytics = lazy(() => import('@/components/dashboard/instructor/InstructorAnalytics').then(m => ({ default: m.InstructorAnalytics })));
const WithdrawalRequest = lazy(() => import('@/components/dashboard/instructor/WithdrawalRequest').then(m => ({ default: m.WithdrawalRequest })));
const InstructorOnboarding = lazy(() => import('@/components/instructor/InstructorOnboarding').then(m => ({ default: m.InstructorOnboarding })));
const InstructorAIChat = lazy(() => import('@/components/dashboard/instructor/InstructorAIChat').then(m => ({ default: m.InstructorAIChat })));
const AssignmentManager = lazy(() => import('@/components/dashboard/instructor/AssignmentManager').then(m => ({ default: m.AssignmentManager })));
const QuestionBankManager = lazy(() => import('@/components/dashboard/instructor/QuestionBankManager').then(m => ({ default: m.QuestionBankManager })));
const StudentEngagementAnalytics = lazy(() => import('@/components/dashboard/instructor/StudentEngagementAnalytics').then(m => ({ default: m.StudentEngagementAnalytics })));

type TabType = 'overview' | 'courses' | 'assignments' | 'question-bank' | 'students' | 'student-engagement' | 'earnings' | 'withdrawals' | 'messages' | 'analytics' | 'ai-assistant';

// Loading skeleton for dashboard content
const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} className="h-32 rounded-lg" />
      ))}
    </div>
    <div className="grid lg:grid-cols-2 gap-8">
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  </div>
);

const InstructorDashboard = () => {
  const { dir } = useLanguage();
  const { profile, user, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showResearchModal, setShowResearchModal] = useState(false);

  // Fetch platform settings to check if onboarding should be skipped
  const { data: platformSettings } = useQuery({
    queryKey: ['platform-settings-instructor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .in('key', ['instructor_skip_onboarding', 'instructor_hide_intro_video', 'profile_fields_required']);
      
      if (error) throw error;
      
      const settingsMap: Record<string, string> = {};
      (data as any[])?.forEach((s: any) => {
        settingsMap[s.key] = s.value;
      });
      return settingsMap;
    },
  });

  // Check if instructor needs onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) return;
      
      try {
        // Only an explicit admin setting can skip instructor onboarding
        const skipOnboarding = platformSettings?.instructor_skip_onboarding === 'true';

        
        if (skipOnboarding) {
          // Auto-accept policies for the instructor
          await supabase
            .from('profiles')
            .update({ has_accepted_policies: true })
            .eq('id', user.id);
          
          setShowOnboarding(false);
          setCheckingOnboarding(false);
          return;
        }
        
        const { data } = await supabase
          .from('profiles')
          .select('has_accepted_policies')
          .eq('id', user.id)
          .single();
        
        if (data && !data.has_accepted_policies) {
          setShowOnboarding(true);
        } else {
          // Check if research participation needs to be asked
          const { data: profileData } = await supabase
            .from('profiles')
            .select('research_participation')
            .eq('id', user.id)
            .single();
          
          if (profileData && (profileData as any).research_participation === null) {
            setShowResearchModal(true);
          }
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    if (platformSettings !== undefined) {
      checkOnboarding();
    }
  }, [user, platformSettings]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // After onboarding, check research participation
    const checkResearch = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('research_participation')
        .eq('id', user.id)
        .single();
      if (data && (data as any).research_participation === null) {
        setShowResearchModal(true);
      }
    };
    checkResearch();
    refreshProfile();
  };

  const handleResearchComplete = () => {
    setShowResearchModal(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8">
            <InstructorStats />
            <div className="grid lg:grid-cols-2 gap-8">
              <InstructorCourses limit={3} showViewAll onViewAll={() => setActiveTab('courses')} />
              <InstructorEarnings limit={5} />
            </div>
          </div>
        );
      case 'courses':
        return <InstructorCourses />;
      case 'assignments':
        return <AssignmentManager />;
      case 'question-bank':
        return <QuestionBankManager />;
      case 'student-engagement':
        return <StudentEngagementAnalytics />;
      case 'students':
        return <InstructorStudents />;
      case 'earnings':
        return <InstructorEarnings />;
      case 'withdrawals':
        return <WithdrawalRequest />;
      case 'messages':
        return <InstructorMessages />;
      case 'analytics':
        return <InstructorAnalytics />;
      case 'ai-assistant':
        return <InstructorAIChat />;
      default:
        return null;
    }
  };

  if (checkingOnboarding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show onboarding as full screen overlay before showing dashboard
  if (showOnboarding) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }>
        <InstructorOnboarding onComplete={handleOnboardingComplete} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-background flex relative" dir={dir}>
      {/* Subtle background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 end-20 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
        <div className="absolute bottom-20 start-20 w-80 h-80 bg-secondary/3 rounded-full blur-3xl" />
      </div>

      <ResearchParticipationModal
        open={showResearchModal}
        onComplete={handleResearchComplete}
      />
      <DashboardSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        userRole="instructor"
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

export default InstructorDashboard;
