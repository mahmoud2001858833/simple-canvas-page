import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Platform setting: are profile fields (phone, specialty, onboarding data) mandatory?
 * Key: profile_fields_required ('true' | 'false'). Defaults to true.
 */
export const useProfileFieldsRequired = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['profile-fields-required'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'profile_fields_required')
        .maybeSingle();
      if (error) return 'true';
      return data?.value ?? 'true';
    },
    staleTime: 60_000,
  });

  return { required: data !== 'false', isLoading };
};
