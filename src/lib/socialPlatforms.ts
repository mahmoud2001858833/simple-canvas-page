import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Send,
  MessageCircle,
  Music2,
  Ghost,
  Globe,
  type LucideIcon,
} from 'lucide-react';

export interface SocialPlatform {
  id: string;
  label: string;
  labelAr: string;
  icon: LucideIcon;
  placeholder: string;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { id: 'facebook', label: 'Facebook', labelAr: 'فيسبوك', icon: Facebook, placeholder: 'https://facebook.com/...' },
  { id: 'instagram', label: 'Instagram', labelAr: 'إنستغرام', icon: Instagram, placeholder: 'https://instagram.com/...' },
  { id: 'twitter', label: 'X (Twitter)', labelAr: 'إكس (تويتر)', icon: Twitter, placeholder: 'https://x.com/...' },
  { id: 'youtube', label: 'YouTube', labelAr: 'يوتيوب', icon: Youtube, placeholder: 'https://youtube.com/@...' },
  { id: 'tiktok', label: 'TikTok', labelAr: 'تيك توك', icon: Music2, placeholder: 'https://tiktok.com/@...' },
  { id: 'snapchat', label: 'Snapchat', labelAr: 'سناب شات', icon: Ghost, placeholder: 'https://snapchat.com/add/...' },
  { id: 'linkedin', label: 'LinkedIn', labelAr: 'لينكد إن', icon: Linkedin, placeholder: 'https://linkedin.com/company/...' },
  { id: 'telegram', label: 'Telegram', labelAr: 'تيليجرام', icon: Send, placeholder: 'https://t.me/...' },
  { id: 'whatsapp', label: 'WhatsApp', labelAr: 'واتساب', icon: MessageCircle, placeholder: 'https://wa.me/9665xxxxxxx' },
  { id: 'website', label: 'Website', labelAr: 'موقع إلكتروني', icon: Globe, placeholder: 'https://...' },
];

export const SOCIAL_LINKS_KEY = 'social_links';

export interface SocialLinkSetting {
  id: string;
  url: string;
  enabled: boolean;
}

export const getPlatform = (id: string) =>
  SOCIAL_PLATFORMS.find((p) => p.id === id);

export const isValidSocialUrl = (url: string) => {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

export const parseSocialLinks = (value?: string | null): SocialLinkSetting[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: any) => item && typeof item.id === 'string' && typeof item.url === 'string')
      .map((item: any) => ({
        id: item.id,
        url: String(item.url).slice(0, 500),
        enabled: Boolean(item.enabled),
      }))
      .filter((item) => !!getPlatform(item.id));
  } catch {
    return [];
  }
};
