import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GraduationCap, Loader2 } from 'lucide-react';

const UniversitiesSection = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();

  // Fetch universities from database
  const { data: universities = [], isLoading } = useQuery({
    queryKey: ['landing-universities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('universities')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Color gradients for visual variety
  const colorGradients = [
    'from-primary to-ocean',
    'from-secondary to-teal',
    'from-ocean to-teal',
    'from-teal to-emerald',
    'from-emerald to-sky',
    'from-sky to-ocean',
  ];

  const handleUniversityClick = (universityId: string) => {
    navigate(`/courses?university=${universityId}`);
  };

  // Generate abbreviation from name
  const getAbbreviation = (name: string, nameAr: string) => {
    if (language === 'ar') {
      // For Arabic, take first letters of first 2-3 words
      const words = nameAr.split(' ').filter(w => w.length > 2);
      return words.slice(0, 3).map(w => w[0]).join('');
    }
    // For English, take first letter of each significant word
    const words = name.split(' ').filter(w => 
      !['of', 'the', 'and', 'University'].includes(w) && w.length > 0
    );
    return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
  };

  return (
    <section className="py-20 bg-background overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute top-20 left-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-60 h-60 bg-secondary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-ocean to-secondary bg-clip-text text-transparent">
            {language === 'ar' ? 'الجامعات' : 'Universities'}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {language === 'ar'
              ? 'جميع الجامعات المحلية والعالمية'
              : 'All Local and International Universities'}
          </p>
        </motion.div>
      </div>

      {/* Universities Grid */}
      <div className="container mx-auto px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : universities.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {language === 'ar' ? 'لا توجد جامعات متاحة حالياً' : 'No universities available'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {universities.map((university, index) => (
              <motion.div
                key={university.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                onClick={() => handleUniversityClick(university.id)}
                className="h-32 rounded-xl bg-card border border-border/50 flex flex-col items-center justify-center gap-3 group cursor-pointer overflow-hidden relative hover:border-primary/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                {/* Hover Background Effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${colorGradients[index % colorGradients.length]} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                
                {university.logo_url ? (
                  <img 
                    src={university.logo_url} 
                    alt={language === 'ar' ? university.name_ar : university.name}
                    className="w-12 h-12 object-contain rounded-lg group-hover:scale-110 transition-all duration-300"
                  />
                ) : (
                  <div 
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorGradients[index % colorGradients.length]} flex items-center justify-center text-white font-bold text-sm shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}
                  >
                    {getAbbreviation(university.name, university.name_ar)}
                  </div>
                )}
                <span className="text-xs md:text-sm font-medium text-center px-2 group-hover:text-primary transition-colors duration-300">
                  {language === 'ar' ? university.name_ar : university.name}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default UniversitiesSection;
