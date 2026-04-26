import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, ArrowLeft, Trophy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface QuizPlayerProps {
  quizId: string;
  onBack: () => void;
}

export const QuizPlayer = ({ quizId, onBack }: QuizPlayerProps) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; review: Array<{ questionId: string; isCorrect: boolean; correctOptionId: string | null; selectedOptionId: string | null }> } | null>(null);

  const t = isRTL ? {
    quiz: 'الكويز',
    question: 'السؤال',
    submit: 'تسليم الإجابات',
    back: 'رجوع',
    score: 'النتيجة',
    correct: 'صحيح',
    wrong: 'خطأ',
    retake: 'إعادة الكويز',
    loading: 'جاري التحميل...',
    noQuestions: 'لا توجد أسئلة',
    selectAnswer: 'اختر إجابة',
    of: 'من',
    congratulations: 'تهانينا!',
    tryAgain: 'حاول مرة أخرى',
    submitting: 'جاري التسليم...',
    submitError: 'حدث خطأ أثناء التسليم',
  } : {
    quiz: 'Quiz',
    question: 'Question',
    submit: 'Submit Answers',
    back: 'Back',
    score: 'Score',
    correct: 'Correct',
    wrong: 'Wrong',
    retake: 'Retake Quiz',
    loading: 'Loading...',
    noQuestions: 'No questions available',
    selectAnswer: 'Select an answer',
    of: 'of',
    congratulations: 'Congratulations!',
    tryAgain: 'Try again!',
    submitting: 'Submitting...',
    submitError: 'Error submitting quiz',
  };

  const { data: quiz, isLoading: quizLoading } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: async () => {
      const { data, error } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch questions WITHOUT is_correct — only option text for display
  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['quiz-questions', quizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('id, question, question_ar, sort_order, quiz_options(id, option_text, option_text_ar, sort_order)')
        .eq('quiz_id', quizId)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-quiz', {
        body: { quizId, answers },
      });
      if (error) throw error;
      setResult(data);
      setSubmitted(true);
    } catch (err) {
      console.error('Quiz submission error:', err);
      toast.error(t.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setSubmitted(false);
    setResult(null);
  };

  if (quizLoading || questionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t.noQuestions}</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="w-4 h-4 me-2" />{t.back}
        </Button>
      </div>
    );
  }

  // Show result
  if (submitted && result) {
    const percentage = Math.round((result.score / result.total) * 100);
    const passed = percentage >= 60;

    // Build a map of questionId -> review info
    const reviewMap = new Map(result.review.map(r => [r.questionId, r]));

    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 me-2" />{t.back}
        </Button>
        <Card className="text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${passed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {passed ? <Trophy className="w-10 h-10 text-green-600" /> : <XCircle className="w-10 h-10 text-red-500" />}
            </div>
            <h2 className="text-2xl font-bold">{passed ? t.congratulations : t.tryAgain}</h2>
            <div className="text-4xl font-bold text-primary">{percentage}%</div>
            <p className="text-muted-foreground">{result.score} {t.of} {result.total} {t.correct}</p>
            <Progress value={percentage} className="h-3" />
            
            {/* Show answers review */}
            <div className="text-start space-y-3 mt-6">
              {questions.map((q, qi) => {
                const rev = reviewMap.get(q.id);
                const isCorrect = rev?.isCorrect ?? false;
                const correctOption = (q.quiz_options || []).find((o: any) => o.id === rev?.correctOptionId);
                return (
                  <div key={q.id} className={`p-3 rounded-lg border ${isCorrect ? 'border-green-200 bg-green-50 dark:bg-green-900/10' : 'border-red-200 bg-red-50 dark:bg-red-900/10'}`}>
                    <div className="flex items-start gap-2">
                      {isCorrect ? <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5" />}
                      <div>
                        <p className="text-sm font-medium">{qi + 1}. {isRTL ? q.question_ar : q.question}</p>
                        {!isCorrect && correctOption && (
                          <p className="text-xs text-green-600 mt-1">
                            {t.correct}: {isRTL ? correctOption.option_text_ar : correctOption.option_text}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button onClick={handleRetake} className="mt-4">{t.retake}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 me-2" />{t.back}
        </Button>
        <h2 className="font-bold">{isRTL ? quiz?.title_ar : quiz?.title}</h2>
        <Badge variant="outline">
          {Object.keys(answers).length}/{questions.length}
        </Badge>
      </div>

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <Card key={q.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {qi + 1}. {isRTL ? (q.question_ar || q.question) : (q.question || q.question_ar)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(q.quiz_options || [])
                .sort((a: any, b: any) => a.sort_order - b.sort_order)
                .map((opt: any) => (
                  <button
                    key={opt.id}
                    onClick={() => setAnswers({ ...answers, [q.id]: opt.id })}
                    className={`w-full text-start p-3 rounded-lg border transition-colors ${
                      answers[q.id] === opt.id
                        ? 'border-primary bg-primary/10 font-medium'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    {isRTL ? (opt.option_text_ar || opt.option_text) : (opt.option_text || opt.option_text_ar)}
                  </button>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={handleSubmit}
        className="w-full btn-gold"
        size="lg"
        disabled={Object.keys(answers).length < questions.length || submitting}
      >
        {submitting ? (
          <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t.submitting}</>
        ) : t.submit}
      </Button>
    </div>
  );
};
