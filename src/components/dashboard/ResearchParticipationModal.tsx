import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FlaskConical, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ResearchParticipationModalProps {
  open: boolean;
  onComplete: () => void;
}

export const ResearchParticipationModal = ({ open, onComplete }: ResearchParticipationModalProps) => {
  const { dir } = useLanguage();
  const language = dir === 'rtl' ? 'ar' : 'en';
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleResponse = async (participates: boolean) => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ research_participation: participates } as any)
        .eq('id', user.id);

      if (error) throw error;

      toast.success(
        language === 'ar'
          ? (participates ? 'شكراً لمشاركتك في البحوث الأكاديمية!' : 'تم تسجيل اختيارك')
          : (participates ? 'Thank you for participating in academic research!' : 'Your choice has been recorded')
      );
      onComplete();
    } catch (error) {
      console.error('Error saving research participation:', error);
      toast.error(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4">
            <FlaskConical className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">
            {language === 'ar' ? 'المشاركة في البحوث الأكاديمية' : 'Academic Research Participation'}
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            {language === 'ar'
              ? 'هل تود المشاركة في البحوث الأكاديمية؟ مشاركتك تساعد في تطوير العملية التعليمية.'
              : 'Would you like to participate in academic research? Your participation helps improve the educational process.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={() => handleResponse(true)}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90 h-12"
          >
            <CheckCircle2 className="w-5 h-5 me-2" />
            {language === 'ar' ? 'نعم، أود المشاركة' : 'Yes, I want to participate'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleResponse(false)}
            disabled={loading}
            className="flex-1 h-12"
          >
            <XCircle className="w-5 h-5 me-2" />
            {language === 'ar' ? 'لا، شكراً' : 'No, thanks'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
