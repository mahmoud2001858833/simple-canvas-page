import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Search, GraduationCap, BookOpen, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GlobalSearchProps {
  isScrolled?: boolean;
}

export const GlobalSearch = ({ isScrolled = false }: GlobalSearchProps) => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results = [] } = useQuery({
    queryKey: ['global-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const searchLower = query.toLowerCase();

      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, title_ar, thumbnail_url, price, category')
        .eq('is_active', true)
        .or(`title.ilike.%${searchLower}%,title_ar.ilike.%${searchLower}%,subject_name.ilike.%${searchLower}%,subject_code.ilike.%${searchLower}%`)
        .limit(8);

      return (courses || []).map(c => ({
        id: c.id,
        title: isRTL ? c.title_ar : c.title,
        subtitle: c.category || '',
        thumbnail: c.thumbnail_url,
        price: c.price,
        type: 'course' as const,
      }));
    },
    enabled: query.length >= 2,
    staleTime: 30000,
  });

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowInput(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (showInput) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showInput]);

  const handleSelect = (item: typeof results[0]) => {
    navigate(`/courses/${item.id}`);
    setQuery('');
    setIsOpen(false);
    setShowInput(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Search Icon Toggle */}
      {!showInput && (
        <button
          onClick={() => { setShowInput(true); setIsOpen(true); }}
          className={`p-2 rounded-full transition-colors ${
            isScrolled
              ? 'hover:bg-accent/10 text-foreground/70 hover:text-accent'
              : 'text-white/80 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Search className="w-5 h-5" />
        </button>
      )}

      {/* Expanded Search Input */}
      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative"
          >
            <Search className={`absolute top-2.5 w-4 h-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
              placeholder={isRTL ? 'ابحث عن كورس...' : 'Search courses...'}
              className={`h-9 text-sm bg-background/90 backdrop-blur border-border/50 ${isRTL ? 'pr-9 pl-8' : 'pl-9 pr-8'}`}
            />
            <button
              onClick={() => { setQuery(''); setShowInput(false); setIsOpen(false); }}
              className={`absolute top-2.5 text-muted-foreground hover:text-foreground ${isRTL ? 'left-2' : 'right-2'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Dropdown */}
      <AnimatePresence>
        {isOpen && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`absolute top-full mt-2 w-80 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden ${isRTL ? 'right-0' : 'left-0'}`}
          >
            {results.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {results.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-accent/10 transition-colors text-start"
                  >
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <GraduationCap className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                    <div className="text-xs font-semibold text-primary">
                      {item.price === 0 || item.price === null
                        ? (isRTL ? 'مجاني' : 'Free')
                        : `${item.price} ${isRTL ? 'ر.س' : 'SAR'}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
