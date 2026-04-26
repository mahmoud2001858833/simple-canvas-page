import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Megaphone, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

const AnnouncementBar = () => {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [text, setText] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['announcement_bar_enabled', 'announcement_bar_text', 'announcement_bar_text_en']);

      if (data) {
        const map = new Map(data.map(s => [s.key, s.value]));
        const enabled = map.get('announcement_bar_enabled') === 'true';
        const arText = map.get('announcement_bar_text') || '';
        const enText = map.get('announcement_bar_text_en') || '';
        const displayText = language === 'ar' ? arText : (enText || arText);

        if (enabled && displayText.trim()) {
          setText(displayText);
          setIsVisible(true);
        }
      }
    };

    fetchAnnouncement();
  }, [language]);

  if (!isVisible || dismissed) return null;

  const isRTL = language === 'ar';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="fixed top-20 left-0 right-0 z-[45] overflow-hidden"
      >
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 shadow-lg">
          {/* Diagonal stripes */}
          <div className="absolute inset-0 opacity-15" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.15) 10px, rgba(255,255,255,0.15) 20px)',
          }} />

          {/* Shimmer */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
          />

          <div ref={containerRef} className="relative flex items-center py-2.5 overflow-hidden">
            {/* Close button */}
            <button
              onClick={() => setDismissed(true)}
              className="absolute top-1/2 -translate-y-1/2 end-2 z-10 p-1 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Marquee container */}
            <div className="flex w-full overflow-hidden">
              <motion.div
                className="flex shrink-0 items-center gap-8 whitespace-nowrap"
                animate={{ x: isRTL ? ['0%', '50%'] : ['0%', '-50%'] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                {/* Duplicate content for seamless loop */}
                {[0, 1].map((i) => (
                  <span key={i} className="flex items-center gap-8 shrink-0">
                    <span className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 md:w-5 md:h-5 text-white shrink-0" />
                      <Sparkles className="w-3.5 h-3.5 text-yellow-200 shrink-0" />
                      <span className="text-white font-semibold text-sm md:text-base tracking-wide">
                        {text}
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-yellow-200 shrink-0" />
                    </span>
                    <span className="text-white/40 mx-4">✦</span>
                    <span className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 md:w-5 md:h-5 text-white shrink-0" />
                      <Sparkles className="w-3.5 h-3.5 text-yellow-200 shrink-0" />
                      <span className="text-white font-semibold text-sm md:text-base tracking-wide">
                        {text}
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-yellow-200 shrink-0" />
                    </span>
                    <span className="text-white/40 mx-4">✦</span>
                  </span>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AnnouncementBar;
