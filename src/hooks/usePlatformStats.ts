import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformStats {
  students: number;
  courses: number;
  instructors: number;
  enrollments: number;
  universities: number;
  avgRating: number;
  satisfactionPercent: number;
  loading: boolean;
}

export function usePlatformStats(): PlatformStats {
  const [stats, setStats] = useState<PlatformStats>({
    students: 0,
    courses: 0,
    instructors: 0,
    enrollments: 0,
    universities: 0,
    avgRating: 0,
    satisfactionPercent: 0,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [profiles, courses, instructors, enrollments, universities, reviews] =
          await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }),
            supabase
              .from('courses')
              .select('*', { count: 'exact', head: true })
              .eq('is_active', true)
              .eq('is_approved', true),
            supabase
              .from('user_roles')
              .select('user_id', { count: 'exact', head: true })
              .eq('role', 'instructor'),
            supabase.from('enrollments').select('*', { count: 'exact', head: true }),
            supabase.from('universities').select('*', { count: 'exact', head: true }),
            supabase.from('course_reviews').select('rating'),
          ]);

        const ratings = (reviews.data ?? []).map((r: any) => Number(r.rating) || 0);
        const avg =
          ratings.length > 0
            ? ratings.reduce((a, b) => a + b, 0) / ratings.length
            : 0;
        const satisfaction =
          ratings.length > 0
            ? Math.round(
                (ratings.filter((r) => r >= 4).length / ratings.length) * 100,
              )
            : 0;

        if (!mounted) return;
        setStats({
          students: profiles.count ?? 0,
          courses: courses.count ?? 0,
          instructors: instructors.count ?? 0,
          enrollments: enrollments.count ?? 0,
          universities: universities.count ?? 0,
          avgRating: Math.round(avg * 10) / 10,
          satisfactionPercent: satisfaction,
          loading: false,
        });
      } catch (e) {
        if (mounted) setStats((s) => ({ ...s, loading: false }));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return stats;
}
