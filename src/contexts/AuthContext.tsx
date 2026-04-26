import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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
  signIn: (email: string, password: string) => Promise<{ error: Error | null; data: { user: User | null } | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TIMEOUT_MS = 10000;

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

  const queryClient = useQueryClient();

  const fetchUserData = async (userId: string) => {
    try {
      const [profileResult, roleResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle()
      ]);
      if (profileResult.data) setProfile(profileResult.data as Profile);
      if (roleResult.data) setRole(roleResult.data.role as UserRole);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchUserData(user.id);
  };

  const checkDeviceSession = useCallback(async (userId: string): Promise<{ allowed: boolean; message?: string }> => {
    try {
      const { data: profileData } = await supabase.from('profiles').select('allow_multiple_devices').eq('id', userId).single();
      if (profileData?.allow_multiple_devices) return { allowed: true };

      const fingerprint = await generateDeviceFingerprint();
      const deviceInfo = getDeviceInfo();
      const { data: existingSessions, error: fetchError } = await supabase.from('device_sessions').select('*').eq('user_id', userId).eq('is_active', true);
      if (fetchError) return { allowed: true };

      const currentDeviceSession = existingSessions?.find(s => s.device_fingerprint === fingerprint);
      if (currentDeviceSession) {
        await supabase.from('device_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', currentDeviceSession.id);
        return { allowed: true };
      }

      if (existingSessions && existingSessions.length > 0) {
        await supabase.from('device_sessions').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
      }

      await supabase.from('device_sessions').insert({
        user_id: userId,
        device_fingerprint: fingerprint,
        device_info: deviceInfo,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      });

      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const startTimeout = () => {
      timeoutId = setTimeout(() => {
        if (mounted && loading) {
          setAuthTimeout(true);
          setLoading(false);
          setAuthReady(true);
        }
      }, AUTH_TIMEOUT_MS);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setTimeout(() => { if (mounted) fetchUserData(newSession.user.id); }, 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });

    const initializeAuth = async () => {
      try {
        if (timeoutId) clearTimeout(timeoutId);
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        if (initialSession?.user) await fetchUserData(initialSession.user.id);
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
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, selectedRole: UserRole, phone?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { full_name: fullName, role: selectedRole, phone },
        },
      });
      if (error) throw error;

      if (data.user) {
        await new Promise(resolve => setTimeout(resolve, 1200));
        if (selectedRole !== 'student') {
          await supabase.from('user_roles').update({ role: selectedRole }).eq('user_id', data.user.id);
        }
        if (phone) {
          await supabase.from('profiles').update({ phone }).eq('id', data.user.id);
        }
        setRole(selectedRole);
      }
      return { error: null, selectedRole };
    } catch (error) {
      return { error: error as Error, selectedRole: null };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        return { error: new Error('EMAIL_NOT_CONFIRMED'), data: null };
      }
      const { data: profileData } = await supabase.from('profiles').select('is_banned, banned_reason').eq('id', data.user.id).single();
      if (profileData?.is_banned) {
        await supabase.auth.signOut();
        const reason = profileData.banned_reason || 'تم حظر حسابك';
        return { error: new Error(`تم حظر حسابك: ${reason}`), data: null };
      }
      await checkDeviceSession(data.user.id);
      return { error: null, data: { user: data.user } };
    } catch (error) {
      return { error: error as Error, data: null };
    }
  };

  const signOut = async () => {
    if (user?.id) {
      try {
        const fingerprint = await generateDeviceFingerprint();
        await supabase.from('device_sessions').update({ is_active: false }).eq('user_id', user.id).eq('device_fingerprint', fingerprint);
      } catch {}
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, authReady, authTimeout, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
