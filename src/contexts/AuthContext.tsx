import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { User, Session } from '@supabase/supabase-js';

export type UserRole = 'student' | 'instructor' | 'secretary' | 'production' | 'admin';

export interface Profile {
  id: string;
  full_name: string | null;
  full_name_ar: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  preferred_language: string | null;
  is_banned?: boolean;
  banned_reason?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  authReady: boolean;
  authTimeout: boolean;
  signUp: (email: string, password: string, fullName: string, role: UserRole, phone?: string) => Promise<{ error: Error | null; selectedRole: UserRole | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; data: { user: User; role: UserRole } | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TIMEOUT_MS = 10000;

// Device fingerprint generation
const generateDeviceFingerprint = async (): Promise<string> => {
  const components: string[] = [];
  components.push(navigator.userAgent);
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  components.push(navigator.language);
  components.push(navigator.platform);
  components.push(String(navigator.hardwareConcurrency || 'unknown'));

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('XBuild Device', 2, 15);
      components.push(canvas.toDataURL());
    }
  } catch (e) {
    components.push('canvas-not-supported');
  }

  const data = components.join('|||');
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
};

const getDeviceInfo = (): Record<string, any> => {
  const nav = navigator as any;
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    deviceMemory: nav.deviceMemory || 'unknown',
    touchSupport: 'ontouchstart' in window,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);
  const deviceRegistrationInProgress = useRef(false);
  
  const queryClient = useQueryClient();

  const fetchUserData = async (userId: string): Promise<UserRole | null> => {
    try {
      const [profileResult, roleResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle()
      ]);

      if (profileResult.data) {
        setProfile(profileResult.data as Profile);
      }
      
      if (roleResult.data) {
        const resolvedRole = roleResult.data.role as UserRole;
        setRole(resolvedRole);
        return resolvedRole;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchUserData(user.id);
    }
  };
  
  // Check and register device session - now deactivates old sessions instead of blocking
  const checkDeviceSession = useCallback(async (userId: string): Promise<{ allowed: boolean; message?: string }> => {
    try {
      // First check if user is allowed multiple devices
      const { data: profileData } = await supabase
        .from('profiles')
        .select('allow_multiple_devices')
        .eq('id', userId)
        .single();
      
      // If user is allowed multiple devices, skip device check
      if (profileData?.allow_multiple_devices) {
        return { allowed: true };
      }
      
      const fingerprint = await generateDeviceFingerprint();
      const deviceInfo = getDeviceInfo();
      
      // Perform activation and old-device deactivation atomically in the
      // database. This prevents RLS/query races during a fresh login.
      const { error: registrationError } = await supabase.rpc(
        'register_current_device_session',
        {
          _device_fingerprint: fingerprint,
          _device_info: deviceInfo,
        }
      );

      if (registrationError) throw registrationError;

      return { allowed: true };
    } catch (error) {
      console.error('Error checking device session:', error);
      return { allowed: false, message: 'تعذر تسجيل الجهاز، يرجى المحاولة مرة أخرى' };
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const clearAuthTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    // Timeout protection - only set after initial check
    const startTimeout = () => {
      timeoutId = setTimeout(() => {
        if (mounted && loading) {
          console.warn('Auth timeout reached');
          setAuthTimeout(true);
          setLoading(false);
          setAuthReady(true);
        }
      }, AUTH_TIMEOUT_MS);
    };

    // Set up auth state listener FIRST (best practice)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        
        console.log('Auth state change:', event);
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => {
            if (mounted) fetchUserData(newSession.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }
      }
    );

    // Initial load - controls loading state
    const initializeAuth = async () => {
      try {
        clearAuthTimeout();
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          await fetchUserData(initialSession.user.id);
        }
      } catch (e) {
        console.error('Error initializing auth:', e);
      } finally {
        if (mounted) {
          setAuthReady(true);
          setLoading(false);
        }
      }
    };

    startTimeout();
    initializeAuth();

    return () => {
      mounted = false;
      clearAuthTimeout();
      subscription.unsubscribe();
    };
  }, []);

  // ⭐ NEW: Realtime listener for device session changes - auto logout when session deactivated
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel(`device-session-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'device_sessions',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          if (deviceRegistrationInProgress.current) return;

          const newData = payload.new as { device_fingerprint: string; is_active: boolean };
          
          // Check if this device's session was deactivated
          const currentFingerprint = await generateDeviceFingerprint();
          
          if (newData.device_fingerprint === currentFingerprint && newData.is_active === false) {
            console.log('Device session deactivated by another device - signing out');
            
            // Just sign out - no redirect, let ProtectedRoute handle naturally
            setUser(null);
            setSession(null);
            setProfile(null);
            setRole(null);
            queryClient.clear();
            
            try {
              // Local scope is essential: a global logout from the old device
              // would also revoke the newly-created session on the new device.
              await supabase.auth.signOut({ scope: 'local' });
            } catch (e) {
              console.log('Sign out failed (session may be invalid)');
            }
            
            return;
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Fallback: periodic heartbeat check in case Realtime is unavailable
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const forceSignOut = async () => {
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      queryClient.clear();
      try {
        // Never let a kicked device revoke the active device's refresh token.
        await supabase.auth.signOut({ scope: 'local' });
      } catch (e) {
        console.log('Sign out failed (session may be invalid)');
      }
    };

    const checkStillActive = async () => {
      try {
        if (deviceRegistrationInProgress.current) return;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('allow_multiple_devices')
          .eq('id', user.id)
          .maybeSingle();
        if (profileData?.allow_multiple_devices) return;

        const fingerprint = await generateDeviceFingerprint();
        const { data: sessions, error } = await supabase
          .from('device_sessions')
          .select('device_fingerprint, is_active')
          .eq('user_id', user.id);
        if (error || cancelled || !sessions) return;

        const mine = sessions.find((s) => s.device_fingerprint === fingerprint);
        // Only sign out a device after its own registered session is explicitly
        // deactivated. During a fresh login there is a short interval where the
        // auth event arrives before checkDeviceSession registers this device;
        // treating a missing row as invalid causes the new login to sign itself out.
        if (mine && !mine.is_active) {
          console.log('Device session no longer valid - signing out');
          await forceSignOut();
        }
      } catch (e) {
        // ignore
      }
    };

    checkStillActive();
    const interval = setInterval(checkStillActive, 20000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkStillActive();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.id, queryClient]);


  const signUp = async (email: string, password: string, fullName: string, selectedRole: UserRole, phone?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: fullName,
            role: selectedRole,
            phone: phone,
          },
        },
      });
      
      if (error) throw error;

      // Update user role if not student (since student is default in handle_new_user)
      // And update phone number in profile
      if (data.user) {
        // Wait for the trigger to create the default role
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // Update role if not student - with retry logic
        if (selectedRole !== 'student') {
          let retries = 3;
          let roleUpdated = false;
          
          while (retries > 0 && !roleUpdated) {
            const { error: roleError } = await supabase
              .from('user_roles')
              .update({ role: selectedRole })
              .eq('user_id', data.user.id);
            
            if (!roleError) {
              roleUpdated = true;
              console.log('Role updated successfully to:', selectedRole);
            } else {
              console.warn('Role update attempt failed, retrying...', roleError);
              retries--;
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          }
          
          if (!roleUpdated) {
            console.error('Failed to update role after all retries');
          }
        }
        
        // Update phone in profile
        if (phone) {
          await supabase
            .from('profiles')
            .update({ phone: phone })
            .eq('id', data.user.id);
        }
        
        // Set the role in state immediately for correct redirection
        setRole(selectedRole);
      }
      
      return { error: null, selectedRole };
    } catch (error) {
      return { error: error as Error, selectedRole: null };
    }
  };

  const signIn = async (email: string, password: string) => {
    deviceRegistrationInProgress.current = true;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // التحقق من تأكيد البريد الإلكتروني
      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut({ scope: 'local' });
        return { 
          error: new Error('EMAIL_NOT_CONFIRMED'), 
          data: null 
        };
      }
      
      // Check if user is banned
      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_banned, banned_reason')
        .eq('id', data.user.id)
        .single();
      
      if (profileData?.is_banned) {
        await supabase.auth.signOut({ scope: 'local' });
        const reason = profileData.banned_reason || 'تم حظر حسابك';
        return { 
          error: new Error(`تم حظر حسابك: ${reason}`), 
          data: null 
        };
      }
      
      // Check device session - now deactivates old sessions instead of blocking
      const deviceResult = await checkDeviceSession(data.user.id);
      if (!deviceResult.allowed) {
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error(deviceResult.message || 'تعذر تسجيل هذا الجهاز، يرجى المحاولة مرة أخرى');
      }

      // Resolve the role before returning so the login page never waits on the
      // asynchronous auth listener to decide where it should navigate.
      const resolvedRole = await fetchUserData(data.user.id);
      if (!resolvedRole) {
        throw new Error('تعذر تحميل صلاحيات الحساب، يرجى المحاولة مرة أخرى');
      }

      return { error: null, data: { user: data.user, role: resolvedRole } };
    } catch (error) {
      return { error: error as Error, data: null };
    } finally {
      deviceRegistrationInProgress.current = false;
    }
  };

  const signOut = async () => {
    // Deactivate device session before signing out
    if (user?.id) {
      try {
        const fingerprint = await generateDeviceFingerprint();
        await supabase
          .from('device_sessions')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('device_fingerprint', fingerprint);
      } catch (error) {
        console.error('Error deactivating device session:', error);
      }
    }
    
    await supabase.auth.signOut({ scope: 'local' });
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    // Clear all React Query cache
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        authReady,
        authTimeout,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
