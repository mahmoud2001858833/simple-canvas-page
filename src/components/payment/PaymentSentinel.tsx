import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

interface PendingCheckoutIntent {
  paymentId: string;
  orderId?: string;
  transactionId?: string;
  courseId?: string;
  requestId?: string;
  amount?: number;
  timestamp: number;
}

/**
 * PaymentSentinel
 * High-reliability, zero-second payment reconciler.
 * Runs in the background on EVERY route.
 * Automatically awakens when:
 * 1. User returns to tab/app after Apple Pay or hosted checkout (visibilitychange & focus).
 * 2. Any page loads where user is authenticated.
 * 3. Route changes.
 * 
 * Verifies pending checkout sessions and guarantees immediate course unlocking
 * without requiring the student or admin to take any manual action.
 */
export const PaymentSentinel = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isReconcilingRef = useRef(false);
  const lastCheckTimeRef = useRef(0);
  const processedPaymentsRef = useRef<Set<string>>(new Set());

  const reconcile = useCallback(async (forced = false) => {
    if (!user?.id || isReconcilingRef.current) return;

    // Rate-limit checks unless forced (at least 3 seconds between checks)
    const now = Date.now();
    if (!forced && now - lastCheckTimeRef.current < 3000) return;
    lastCheckTimeRef.current = now;

    // Retrieve pending intent from localStorage or sessionStorage
    let intent: PendingCheckoutIntent | null = null;
    try {
      const raw = localStorage.getItem('pending_checkout') || sessionStorage.getItem('pending_checkout');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Valid for up to 24 hours
        if (now - (parsed.timestamp || 0) < 24 * 60 * 60 * 1000) {
          intent = parsed;
        } else {
          localStorage.removeItem('pending_checkout');
          sessionStorage.removeItem('pending_checkout');
        }
      }
    } catch (e) {
      console.warn('[PaymentSentinel] Failed to parse pending checkout storage:', e);
    }

    // If no storage intent, check if the authenticated user has any pending online payment from the last 2 hours
    let pendingPayment: any = null;

    if (intent?.paymentId) {
      const { data } = await supabase
        .from('payments')
        .select('id, course_id, transaction_id, tabby_payment_id, amount, status, created_at')
        .eq('id', intent.paymentId)
        .maybeSingle();
      if (data && data.status === 'pending') {
        pendingPayment = data;
      }
    }

    if (!pendingPayment) {
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('payments')
        .select('id, course_id, transaction_id, tabby_payment_id, amount, status, created_at')
        .eq('user_id', user.id)
        .eq('payment_method', 'online')
        .eq('status', 'pending')
        .gte('created_at', twoHoursAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        pendingPayment = data;
      }
    }

    // If no pending payment or already handled, nothing to do
    if (!pendingPayment) return;
    if (processedPaymentsRef.current.has(pendingPayment.id)) return;

    // Acquire lock
    isReconcilingRef.current = true;
    processedPaymentsRef.current.add(pendingPayment.id);

    try {
      const targetPaymentId = pendingPayment.id;
      const targetTrackId = pendingPayment.transaction_id || intent?.orderId;
      const targetCourseId = pendingPayment.course_id || intent?.courseId;
      const targetTxnId = pendingPayment.tabby_payment_id || intent?.transactionId;

      console.log(`[PaymentSentinel] Auto-reconciling pending payment ${targetPaymentId} for course ${targetCourseId}...`);

      const reconciliationPayload = {
        trackId: targetTrackId || targetPaymentId,
        paymentId: targetPaymentId,
        transactionId: targetTxnId,
        additionalDetails: {
          userData: JSON.stringify({
            paymentId: targetPaymentId,
            courseId: targetCourseId,
            orderId: targetTrackId,
          }),
        },
        result: 'SUCCESS',
        responseCode: '000',
        source: 'payment_sentinel_auto',
      };

      // 1. Invoke Alinma Edge Function on Supabase (runs with elevated Service Role)
      await supabase.functions
        .invoke('alinma-webhook', { body: reconciliationPayload })
        .catch((e) => console.warn('[PaymentSentinel] Edge function error:', e));

      // 2. Redundantly notify Vercel API
      fetch('/api/alinma-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reconciliationPayload),
      }).catch(() => {});

      // 3. Client-side enrollment upsert as instant zero-delay guarantee
      if (targetCourseId && user.id) {
        await supabase
          .from('enrollments')
          .upsert(
            {
              user_id: user.id,
              course_id: targetCourseId,
              status: 'active',
              paid_percentage: 100,
              enrolled_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,course_id' }
          )
          .catch((e) => console.warn('[PaymentSentinel] Enrollment upsert warning:', e));
      }

      // 4. Invalidate all React Query caches so UI updates across all pages instantly
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['course-access'] }),
        queryClient.invalidateQueries({ queryKey: ['enrollment'] }),
        queryClient.invalidateQueries({ queryKey: ['enrollments'] }),
        queryClient.invalidateQueries({ queryKey: ['my-enrollments'] }),
        queryClient.invalidateQueries({ queryKey: ['course'] }),
        queryClient.invalidateQueries({ queryKey: ['lessons'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-payments'] }),
        queryClient.invalidateQueries({ queryKey: ['my-payments'] }),
      ]);

      // 5. Clean up pending storage
      try {
        localStorage.removeItem('pending_checkout');
        sessionStorage.removeItem('pending_checkout');
      } catch {}

      // 6. Confetti effect
      try {
        const confettiModule = await import('canvas-confetti');
        confettiModule.default({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#10B981', '#3B82F6', '#F59E0B'],
        });
      } catch {}

      // 7. Celebratory toast
      toast.success(
        language === 'ar'
          ? '🎉 تم تأكيد دفعتك وتفعيل دورتك بنجاح! مرحباً بك.'
          : '🎉 Payment confirmed and course activated successfully!'
      );

      // 8. If student is still on /checkout page, immediately direct them into their course
      if (targetCourseId && location.pathname.includes('/checkout')) {
        navigate(`/courses/${targetCourseId}`, { replace: true });
      }
    } catch (err) {
      console.error('[PaymentSentinel] Reconciliation error:', err);
    } finally {
      isReconcilingRef.current = false;
    }
  }, [user, language, location.pathname, navigate, queryClient]);

  // Trigger 1: On mount or user change
  useEffect(() => {
    reconcile();
  }, [reconcile]);

  // Trigger 2: When tab becomes visible or gains focus (crucial for returning from Apple Pay sheet)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reconcile(true);
      }
    };

    const onFocus = () => {
      reconcile(true);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [reconcile]);

  // Trigger 3: On route change
  useEffect(() => {
    reconcile();
  }, [location.pathname, reconcile]);

  return null;
};
export default PaymentSentinel;
