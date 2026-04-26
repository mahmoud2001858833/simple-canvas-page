import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { UnifiedRealtimeProvider } from "@/components/UnifiedRealtimeProvider";
import { createOptimizedQueryClient } from "@/lib/queryConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

// Eagerly loaded pages (critical path)
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import MaintenancePage from "./pages/MaintenancePage";

// Retry wrapper for lazy imports (handles stale chunk errors after deploys)
function lazyRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch(() => {
      // Force reload on chunk load failure (stale deploy)
      window.location.reload();
      return new Promise(() => {}); // never resolves, page will reload
    })
  );
}

// Lazy loaded pages for better initial load
const Courses = lazyRetry(() => import("./pages/Courses"));
const CourseDetails = lazyRetry(() => import("./pages/CourseDetails"));
const LessonViewer = lazyRetry(() => import("./pages/LessonViewer"));
const Checkout = lazyRetry(() => import("./pages/Checkout"));
const PaymentSuccess = lazyRetry(() => import("./pages/PaymentSuccess"));
const PaymentFailed = lazyRetry(() => import("./pages/PaymentFailed"));
const PaymentPending = lazyRetry(() => import("./pages/PaymentPending"));
const About = lazyRetry(() => import("./pages/About"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const EmailVerification = lazyRetry(() => import("./pages/EmailVerification"));
const StudentDashboard = lazyRetry(() => import("./pages/dashboard/StudentDashboard"));
const AdminDashboard = lazyRetry(() => import("./pages/dashboard/AdminDashboard"));
const InstructorDashboard = lazyRetry(() => import("./pages/dashboard/InstructorDashboard"));
const VideoEditor = lazyRetry(() => import("./pages/dashboard/VideoEditor"));
const QuizPage = lazyRetry(() => import("./pages/QuizPage"));
const CertificateVerify = lazyRetry(() => import("./pages/CertificateVerify"));

// Lazy loaded global components
const WelcomeModal = lazy(() => import("./components/onboarding/WelcomeModal").then(m => ({ default: m.WelcomeModal })));
const OnboardingTooltip = lazy(() => import("./components/onboarding/OnboardingTooltip").then(m => ({ default: m.OnboardingTooltip })));
const ChatWidget = lazy(() => import("./components/ai-assistant/ChatWidget").then(m => ({ default: m.ChatWidget })));
const DirectSupportChat = lazy(() => import("./components/support/DirectSupportChat").then(m => ({ default: m.DirectSupportChat })));

// Create optimized query client for high-traffic scenarios
const queryClient = createOptimizedQueryClient();

// Page loading skeleton
const PageSkeleton = () => (
  <div className="min-h-screen bg-background p-8">
    <div className="max-w-7xl mx-auto space-y-6">
      <Skeleton className="h-16 w-64" />
      <Skeleton className="h-8 w-96" />
      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  </div>
);

// Password recovery redirect handler component
const PasswordRecoveryHandler = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    const fullUrl = window.location.href;
    const hash = window.location.hash;
    const search = window.location.search;
    
    // Only redirect if we're on the root path and have recovery tokens
    if (location.pathname === '/') {
      const hasRecoveryToken = 
        (hash && hash.includes('type=recovery')) ||
        (search && search.includes('type=recovery')) ||
        fullUrl.includes('type=recovery') ||
        fullUrl.includes('access_token=');
      
      if (hasRecoveryToken) {
        console.log('[App] Password recovery token detected on root, redirecting to /reset-password');
        // Preserve the entire hash/search for the reset page
        const tokenPart = hash || '';
        // Use navigate with replace to redirect while preserving tokens
        navigate(`/reset-password${tokenPart}`, { replace: true });
      }
    }
  }, [location.pathname, navigate]);
  
  return null;
};

// Maintenance mode guard - blocks all non-admin users when maintenance is on
const MaintenanceGuard = ({ children }: { children: React.ReactNode }) => {
  const { role } = useAuth();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkMaintenance = async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .maybeSingle();
      
      setIsMaintenanceMode(data?.value === 'true');
      setChecked(true);
    };
    checkMaintenance();
  }, []);

  if (!checked) return <PageSkeleton />;
  
  // Admins bypass maintenance mode
  if (isMaintenanceMode && role !== 'admin') {
    return <MaintenancePage />;
  }

  return <>{children}</>;
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <LanguageProvider>
          <AuthProvider>
            <OnboardingProvider>
              <UnifiedRealtimeProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <Suspense fallback={null}>
                    <WelcomeModal />
                    <OnboardingTooltip />
                  </Suspense>
                  <BrowserRouter>
                    <PasswordRecoveryHandler />
                    <MaintenanceGuard>
                      <Suspense fallback={<PageSkeleton />}>
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/about" element={<About />} />
                          <Route path="/courses" element={<Courses />} />
                          <Route path="/courses/:id" element={<CourseDetails />} />
                          <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonViewer />} />
                          <Route path="/checkout/:courseId" element={<Checkout />} />
                          <Route path="/checkout" element={<Checkout />} />
                          <Route path="/payment/success" element={<PaymentSuccess />} />
                          <Route path="/payment/failed" element={<PaymentFailed />} />
                          <Route path="/payment/pending" element={<PaymentPending />} />
                          <Route path="/login" element={<Login />} />
                          <Route path="/reset-password" element={<ResetPassword />} />
                          <Route path="/email-verification" element={<EmailVerification />} />
                          <Route path="/signup" element={<Signup />} />
                          <Route
                            path="/dashboard"
                            element={
                              <ProtectedRoute allowedRoles={['student']}>
                                <StudentDashboard />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/instructor"
                            element={
                              <ProtectedRoute allowedRoles={['instructor']}>
                                <InstructorDashboard />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/instructor/video-editor/:lessonId"
                            element={
                              <ProtectedRoute allowedRoles={['instructor', 'admin']}>
                                <VideoEditor />
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/admin"
                            element={
                              <ProtectedRoute allowedRoles={['admin']}>
                                <AdminDashboard />
                              </ProtectedRoute>
                            }
                          />
                          <Route path="/quiz/:quizId" element={<QuizPage />} />
                          <Route path="/verify/:token" element={<CertificateVerify />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                      <Suspense fallback={null}>
                        <ChatWidget />
                        <DirectSupportChat />
                      </Suspense>
                    </MaintenanceGuard>
                  </BrowserRouter>
                </TooltipProvider>
              </UnifiedRealtimeProvider>
            </OnboardingProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
