import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface QuizEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  courseId: string;
  onSuccess: () => void;
}

interface QuestionDraft {
  question: string;
  question_ar: string;
  options: { text: string; text_ar: string; is_correct: boolean }[];
}

export const QuizEditor = ({ open, onOpenChange, chapterId, courseId, onSuccess }: QuizEditorProps) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { question: '', question_ar: '', options: [
      { text: '', text_ar: '', is_correct: true },
      { text: '', text_ar: '', is_correct: false },
    ]},
  ]);

  const t = isRTL ? {
    title: 'إنشاء كويز إلكتروني',
    quizTitleEn: 'عنوان الكويز (إنجليزي)',
    quizTitleAr: 'عنوان الكويز (عربي)',
    questionEn: 'السؤال (إنجليزي)',
    questionAr: 'السؤال (عربي)',
    optionEn: 'الخيار (إنجليزي)',
    optionAr: 'الخيار (عربي)',
    correct: 'صحيح',
    addOption: 'إضافة خيار',
    addQuestion: 'إضافة سؤال',
    save: 'حفظ الكويز',
    cancel: 'إلغاء',
    saving: 'جاري الحفظ...',
    success: 'تم إنشاء الكويز بنجاح',
    error: 'حدث خطأ',
    questionNum: 'السؤال',
  } : {
    title: 'Create Interactive Quiz',
    quizTitleEn: 'Quiz Title (English)',
    quizTitleAr: 'Quiz Title (Arabic)',
    questionEn: 'Question (English)',
    questionAr: 'Question (Arabic)',
    optionEn: 'Option (English)',
    optionAr: 'Option (Arabic)',
    correct: 'Correct',
    addOption: 'Add Option',
    addQuestion: 'Add Question',
    save: 'Save Quiz',
    cancel: 'Cancel',
    saving: 'Saving...',
    success: 'Quiz created successfully',
    error: 'Error creating quiz',
    questionNum: 'Question',
  };

  const addQuestion = () => {
    setQuestions([...questions, {
      question: '', question_ar: '',
      options: [
        { text: '', text_ar: '', is_correct: true },
        { text: '', text_ar: '', is_correct: false },
      ],
    }]);
  };

  const removeQuestion = (qi: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== qi));
  };

  const updateQuestion = (qi: number, field: string, value: string) => {
    const updated = [...questions];
    (updated[qi] as any)[field] = value;
    setQuestions(updated);
  };

  const addOption = (qi: number) => {
    const updated = [...questions];
    updated[qi].options.push({ text: '', text_ar: '', is_correct: false });
    setQuestions(updated);
  };

  const removeOption = (qi: number, oi: number) => {
    if (questions[qi].options.length <= 2) return;
    const updated = [...questions];
    updated[qi].options = updated[qi].options.filter((_, i) => i !== oi);
    setQuestions(updated);
  };

  const updateOption = (qi: number, oi: number, field: string, value: any) => {
    const updated = [...questions];
    if (field === 'is_correct' && value === true) {
      // Uncheck others
      updated[qi].options.forEach((o, i) => { o.is_correct = i === oi; });
    } else {
      (updated[qi].options[oi] as any)[field] = value;
    }
    setQuestions(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Create quiz
      const { data: quiz, error: quizErr } = await supabase.from('quizzes' as any).insert({
        chapter_id: chapterId,
        course_id: courseId,
        title: title || 'Quiz',
        title_ar: titleAr || 'كويز',
        quiz_type: 'interactive',
        sort_order: 0,
      }).select().single();
      if (quizErr) throw quizErr;

      // Create questions
      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi];
        const { data: qData, error: qErr } = await supabase.from('quiz_questions' as any).insert({
          quiz_id: (quiz as any).id,
          question: q.question,
          question_ar: q.question_ar,
          sort_order: qi,
        }).select().single();
        if (qErr) throw qErr;

        // Create options
        const optionsToInsert = q.options.map((opt, oi) => ({
          question_id: (qData as any).id,
          option_text: opt.text,
          option_text_ar: opt.text_ar,
          is_correct: opt.is_correct,
          sort_order: oi,
        }));
        const { error: optErr } = await supabase.from('quiz_options' as any).insert(optionsToInsert);
        if (optErr) throw optErr;
      }

      toast.success(t.success);
      onOpenChange(false);
      onSuccess();
      // Reset
      setTitle('');
      setTitleAr('');
      setQuestions([{ question: '', question_ar: '', options: [
        { text: '', text_ar: '', is_correct: true },
        { text: '', text_ar: '', is_correct: false },
      ]}]);
    } catch (err) {
      console.error(err);
      toast.error(t.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Quiz Title */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.quizTitleEn}</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t.quizTitleAr}</Label>
              <Input value={titleAr} onChange={e => setTitleAr(e.target.value)} dir="rtl" />
            </div>
          </div>

          {/* Questions */}
          {questions.map((q, qi) => (
            <div key={qi} className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{t.questionNum} {qi + 1}</h4>
                {questions.length > 1 && (
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeQuestion(qi)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t.questionEn}</Label>
                  <Input value={q.question} onChange={e => updateQuestion(qi, 'question', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.questionAr}</Label>
                  <Input value={q.question_ar} onChange={e => updateQuestion(qi, 'question_ar', e.target.value)} dir="rtl" />
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2 ms-4">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <Checkbox
                      checked={opt.is_correct}
                      onCheckedChange={(checked) => updateOption(qi, oi, 'is_correct', checked)}
                    />
                    <Input
                      className="flex-1 h-8 text-sm"
                      placeholder={isRTL ? t.optionAr : t.optionEn}
                      value={isRTL ? opt.text_ar : opt.text}
                      onChange={e => updateOption(qi, oi, isRTL ? 'text_ar' : 'text', e.target.value)}
                    />
                    <Input
                      className="flex-1 h-8 text-sm"
                      placeholder={isRTL ? t.optionEn : t.optionAr}
                      value={isRTL ? opt.text : opt.text_ar}
                      onChange={e => updateOption(qi, oi, isRTL ? 'text' : 'text_ar', e.target.value)}
                      dir={isRTL ? 'ltr' : 'rtl'}
                    />
                    {q.options.length > 2 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeOption(qi, oi)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {q.options.length < 6 && (
                  <Button variant="ghost" size="sm" onClick={() => addOption(qi)}>
                    <Plus className="w-3 h-3 me-1" />{t.addOption}
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addQuestion} className="w-full">
            <Plus className="w-4 h-4 me-2" />{t.addQuestion}
          </Button>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
            <Button onClick={handleSave} disabled={saving} className="btn-gold">
              {saving ? <><Loader2 className="w-4 h-4 me-2 animate-spin" />{t.saving}</> : <><Save className="w-4 h-4 me-2" />{t.save}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
