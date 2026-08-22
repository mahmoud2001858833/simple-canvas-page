import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SOCIAL_LINKS_KEY, parseSocialLinks, isValidSocialUrl } from '@/lib/socialPlatforms';

export const useSocialLinks = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['social-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', SOCIAL_LINKS_KEY)
        .maybeSingle();

      if (error) throw error;
      return parseSocialLinks(data?.value).filter(
        (link) => link.enabled && isValidSocialUrl(link.url)
      );
    },
    staleTime: 5 * 60 * 1000,
  });

  return { links: data ?? [], isLoading };
};
