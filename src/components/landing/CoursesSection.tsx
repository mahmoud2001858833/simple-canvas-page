import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const CoursesSection = () => {
  const { t, dir, language } = useLanguage();
  const isRTL = language === 'ar';

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['landing-courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, title_ar, price, original_price, thumbnail_url, duration_hours')
        .eq('is_active', true)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || courses.length === 0) return null;

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4 text-sm px-4 py-1.5">
            <GraduationCap className="w-4 h-4 me-2" />
            {isRTL ? 'الدورات المتاحة' : 'Available Courses'}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            {isRTL ? 'ابدأ رحلتك التعليمية' : 'Start Your Learning Journey'}
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            {isRTL ? 'اختر من بين مجموعة متنوعة من الدورات المصممة لمساعدتك على التفوق' : 'Choose from a variety of courses designed to help you excel'}
          </p>
        </motion.div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link to={`/courses/${course.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={isRTL ? course.title_ar : course.title}
                      className="w-full h-44 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-44 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <GraduationCap className="h-12 w-12 text-primary/40" />
                    </div>
                  )}
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-foreground line-clamp-2 mb-3">
                      {isRTL ? course.title_ar : course.title}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{course.duration_hours || 0} {isRTL ? 'ساعة' : 'hrs'}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        {course.original_price && course.original_price > (course.price || 0) && (
                          <span className="text-sm text-muted-foreground line-through">{course.original_price}</span>
                        )}
                        <span className="font-bold text-primary">
                          {course.price === 0 ? (isRTL ? 'مجاني' : 'Free') : `${course.price} ${isRTL ? 'ر.س' : 'SAR'}`}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center mt-10">
          <Link to="/courses">
            <Button size="lg" variant="outline" className="group">
              {isRTL ? 'عرض جميع الدورات' : 'View All Courses'}
              {isRTL ? (
                <ArrowLeft className="ms-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              ) : (
                <ArrowRight className="ms-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              )}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CoursesSection;
