import { ReactNode, useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('student' | 'instructor' | 'secretary' | 'production' | 'admin')[];
}

const LOADING_TIMEOUT_MS = 5000;

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, loading, authReady, authTimeout } = useAuth();
  const location = useLocation();
  const [showError, setShowError] = useState(false);

  // Timeout protection for loading state
  useEffect(() => {
    if (!loading && authReady) {
      setShowError(false);
      return;
    }

    const timeout = setTimeout(() => {
      if (loading || !authReady) {
        setShowError(true);
      }
    }, LOADING_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [loading, authReady]);

  // Show error fallback UI
  if (showError || authTimeout) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">حدث خطأ في تحميل البيانات</p>
        <Button 
          onClick={() => window.location.reload()} 
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  // Show loading while auth state is being determined
  if (loading || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role is required but not yet loaded, show brief loading
  if (allowedRoles && !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to correct dashboard if role doesn't match
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const dashboardPath = role === 'admin' ? '/admin' : 
                          role === 'instructor' ? '/instructor' : 
                          '/dashboard';
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
};
