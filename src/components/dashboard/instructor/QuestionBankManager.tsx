import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ListSkeleton } from '@/components/ui/skeletons';
import { toast } from 'sonner';
import {
  Plus, Search, X, Trash2, Edit, BookOpen, Shuffle, Filter,
  HelpCircle, CheckCircle, BarChart3
} from 'lucide-react';

interface QuestionForm {
  question: string;
  question_ar: string;
  course_id: string;
  chapter_id: string;
  difficulty: string;
  tags: string;
  options: { text: string; text_ar: string; is_correct: boolean }[];
}

const emptyForm: QuestionForm = {
  question: '', question_ar: '', course_id: '', chapter_id: '', difficulty: 'medium', tags: '',
  options: [
    { text: '', text_ar: '', is_correct: true },
    { text: '', text_ar: '', is_correct: false },
    { text: '', text_ar: '', is_correct: false },
    { text: '', text_ar: '', is_correct: false },
  ],
};

export const QuestionBankManager = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionForm>({ ...emptyForm });
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateCount, setGenerateCount] = useState(5);
  const [generateCourse, setGenerateCourse] = useState('');
  const [generateChapter, setGenerateChapter] = useState('');

  const isAr = language === 'ar';

  const t = {
    title: isAr ? 'بنك الأسئلة' : 'Question Bank',
    desc: isAr ? 'إدارة وتنظيم أسئلتك لإنشاء اختبارات عشوائية' : 'Manage and organize questions for random quizzes',
    add: isAr ? 'إضافة سؤال' : 'Add Question',
    edit: isAr ? 'تعديل السؤال' : 'Edit Question',
    question: isAr ? 'السؤال (إنجليزي)' : 'Question (English)',
    questionAr: isAr ? 'السؤال (عربي)' : 'Question (Arabic)',
    course: isAr ? 'الكورس' : 'Course',
    chapter: isAr ? 'الفصل' : 'Chapter',
    difficulty: isAr ? 'الصعوبة' : 'Difficulty',
    easy: isAr ? 'سهل' : 'Easy',
    medium: isAr ? 'متوسط' : 'Medium',
    hard: isAr ? 'صعب' : 'Hard',
    tags: isAr ? 'الوسوم (مفصولة بفاصلة)' : 'Tags (comma-separated)',
    options: isAr ? 'الخيارات' : 'Options',
    optionText: isAr ? 'نص الخيار (إنجليزي)' : 'Option (English)',
    optionTextAr: isAr ? 'نص الخيار (عربي)' : 'Option (Arabic)',
    correct: isAr ? 'صحيح' : 'Correct',
    save: isAr ? 'حفظ' : 'Save',
    cancel: isAr ? 'إلغاء' : 'Cancel',
    delete: isAr ? 'حذف' : 'Delete',
    search: isAr ? 'ابحث في الأسئلة...' : 'Search questions...',
    all: isAr ? 'الكل' : 'All',
    noData: isAr ? 'لا توجد أسئلة' : 'No questions yet',
    generateQuiz: isAr ? 'توليد اختبار عشوائي' : 'Generate Random Quiz',
    count: isAr ? 'عدد الأسئلة' : 'Question Count',
    generate: isAr ? 'توليد' : 'Generate',
    total: isAr ? 'إجمالي الأسئلة' : 'Total Questions',
    byCourse: isAr ? 'حسب الكورس' : 'By Course',
    byDifficulty: isAr ? 'حسب الصعوبة' : 'By Difficulty',
  };

  // Fetch instructor courses
  const { data: courses = [] } = useQuery({
    queryKey: ['instructor-courses-qb', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, title, title_ar').eq('instructor_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch chapters for selected course
  const activeCourseId = form.course_id || filterCourse;
  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters-qb', activeCourseId],
    queryFn: async () => {
      if (!activeCourseId || activeCourseId === 'all') return [];
      const { data } = await supabase.from('chapters').select('id, title, title_ar').eq('course_id', activeCourseId).order('sort_order');
      return data || [];
    },
    enabled: !!activeCourseId && activeCourseId !== 'all',
  });

  // Fetch all questions
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['question-bank', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('question_bank')
        .select('*, question_bank_options(*), courses(title, title_ar), chapters(title, title_ar)')
        .eq('instructor_id', user!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    let result = questions as any[];
    if (filterCourse !== 'all') result = result.filter(q => q.course_id === filterCourse);
    if (filterDifficulty !== 'all') result = result.filter(q => q.difficulty === filterDifficulty);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(q => q.question?.toLowerCase().includes(s) || q.question_ar?.toLowerCase().includes(s));
    }
    return result;
  }, [questions, filterCourse, filterDifficulty, search]);

  // Stats
  const stats = useMemo(() => {
    const total = questions.length;
    const easy = questions.filter((q: any) => q.difficulty === 'easy').length;
    const medium = questions.filter((q: any) => q.difficulty === 'medium').length;
    const hard = questions.filter((q: any) => q.difficulty === 'hard').length;
    return { total, easy, medium, hard };
  }, [questions]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.question_ar || !form.course_id) throw new Error('Missing required fields');
      const hasCorrect = form.options.some(o => o.is_correct);
      if (!hasCorrect) throw new Error('At least one correct option required');

      const questionData = {
        question: form.question,
        question_ar: form.question_ar,
        course_id: form.course_id,
        chapter_id: form.chapter_id || null,
        difficulty: form.difficulty,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
        instructor_id: user!.id,
      };

      let questionId: string;
      if (editId) {
        const { error } = await supabase.from('question_bank').update(questionData).eq('id', editId);
        if (error) throw error;
        questionId = editId;
        // Delete old options
        await supabase.from('question_bank_options').delete().eq('question_id', editId);
      } else {
        const { data, error } = await supabase.from('question_bank').insert(questionData).select('id').single();
        if (error) throw error;
        questionId = data.id;
      }

      // Insert options
      const optionsToInsert = form.options.filter(o => o.text_ar || o.text).map((o, i) => ({
        question_id: questionId,
        option_text: o.text,
        option_text_ar: o.text_ar,
        is_correct: o.is_correct,
        sort_order: i,
      }));
      if (optionsToInsert.length > 0) {
        const { error } = await supabase.from('question_bank_options').insert(optionsToInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isAr ? 'تم الحفظ بنجاح' : 'Saved successfully');
      qc.invalidateQueries({ queryKey: ['question-bank'] });
      setDialogOpen(false);
      setEditId(null);
      setForm({ ...emptyForm });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('question_bank').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
      qc.invalidateQueries({ queryKey: ['question-bank'] });
    },
  });

  const handleEdit = (q: any) => {
    setEditId(q.id);
    setForm({
      question: q.question || '',
      question_ar: q.question_ar || '',
      course_id: q.course_id,
      chapter_id: q.chapter_id || '',
      difficulty: q.difficulty,
      tags: (q.tags || []).join(', '),
      options: q.question_bank_options?.length > 0
        ? q.question_bank_options.map((o: any) => ({ text: o.option_text, text_ar: o.option_text_ar, is_correct: o.is_correct }))
        : [...emptyForm.options],
    });
    setDialogOpen(true);
  };

  const handleGenerateQuiz = async () => {
    if (!generateCourse) return;
    let pool = questions.filter((q: any) => q.course_id === generateCourse);
    if (generateChapter) pool = pool.filter((q: any) => q.chapter_id === generateChapter);
    
    if (pool.length === 0) {
      toast.error(isAr ? 'لا توجد أسئلة كافية' : 'Not enough questions');
      return;
    }

    // Shuffle and pick
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(generateCount, pool.length));
    
    // Create quiz from selected questions
    const courseName = courses.find(c => c.id === generateCourse);
    const title = `Random Quiz - ${selected.length} Q`;
    const title_ar = `اختبار عشوائي - ${selected.length} سؤال`;

    const chapterId = generateChapter || (await supabase.from('chapters').select('id').eq('course_id', generateCourse).order('sort_order').limit(1).then(r => r.data?.[0]?.id));
    
    if (!chapterId) {
      toast.error(isAr ? 'يرجى إنشاء فصل أولاً' : 'Please create a chapter first');
      return;
    }

    const { data: quiz, error: quizErr } = await supabase.from('quizzes').insert({
      course_id: generateCourse,
      chapter_id: chapterId,
      title,
      title_ar,
      quiz_type: 'interactive',
    }).select('id').single();
    
    if (quizErr) { toast.error(quizErr.message); return; }

    // Insert questions
    for (let i = 0; i < selected.length; i++) {
      const q = selected[i] as any;
      const { data: qq } = await supabase.from('quiz_questions').insert({
        quiz_id: quiz.id,
        question: q.question,
        question_ar: q.question_ar,
        sort_order: i,
      }).select('id').single();

      if (qq && q.question_bank_options) {
        const opts = q.question_bank_options.map((o: any, j: number) => ({
          question_id: qq.id,
          option_text: o.option_text,
          option_text_ar: o.option_text_ar,
          is_correct: o.is_correct,
          sort_order: j,
        }));
        await supabase.from('quiz_options').insert(opts);
      }
    }

    toast.success(isAr ? `تم إنشاء اختبار من ${selected.length} سؤال` : `Quiz created with ${selected.length} questions`);
    setGenerateOpen(false);
  };

  if (isLoading) return <ListSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-muted-foreground">{t.desc}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGenerateOpen(true)} disabled={questions.length === 0}>
            <Shuffle className="w-4 h-4 me-2" />
            {t.generateQuiz}
          </Button>
          <Button onClick={() => { setEditId(null); setForm({ ...emptyForm }); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 me-2" />
            {t.add}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t.total, value: stats.total, icon: HelpCircle, color: 'bg-blue-500' },
          { label: t.easy, value: stats.easy, icon: CheckCircle, color: 'bg-green-500' },
          { label: t.medium, value: stats.medium, icon: BarChart3, color: 'bg-yellow-500' },
          { label: t.hard, value: stats.hard, icon: Filter, color: 'bg-red-500' },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} className="ps-9" />
        </div>
        <Select value={filterCourse} onValueChange={setFilterCourse}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t.course} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            {courses.map(c => <SelectItem key={c.id} value={c.id}>{isAr ? c.title_ar : c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t.difficulty} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            <SelectItem value="easy">{t.easy}</SelectItem>
            <SelectItem value="medium">{t.medium}</SelectItem>
            <SelectItem value="hard">{t.hard}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Questions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{isAr ? 'السؤال' : 'Question'}</TableHead>
                <TableHead>{t.course}</TableHead>
                <TableHead>{t.difficulty}</TableHead>
                <TableHead>{isAr ? 'الخيارات' : 'Options'}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t.noData}</TableCell>
                </TableRow>
              ) : filtered.map((q: any, idx: number) => (
                <TableRow key={q.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="max-w-xs">
                    <p className="font-medium text-sm truncate">{isAr ? q.question_ar : q.question}</p>
                    {q.tags?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {q.tags.slice(0, 3).map((tag: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {isAr ? q.courses?.title_ar : q.courses?.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant={q.difficulty === 'easy' ? 'secondary' : q.difficulty === 'hard' ? 'destructive' : 'default'}>
                      {q.difficulty === 'easy' ? t.easy : q.difficulty === 'hard' ? t.hard : t.medium}
                    </Badge>
                  </TableCell>
                  <TableCell>{q.question_bank_options?.length || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(q)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(q.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? t.edit : t.add}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>{t.questionAr}</Label>
                <Textarea value={form.question_ar} onChange={e => setForm({ ...form, question_ar: e.target.value })} />
              </div>
              <div>
                <Label>{t.question}</Label>
                <Textarea value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} />
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>{t.course}</Label>
                <Select value={form.course_id} onValueChange={v => setForm({ ...form, course_id: v, chapter_id: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {courses.map(c => <SelectItem key={c.id} value={c.id}>{isAr ? c.title_ar : c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.chapter}</Label>
                <Select value={form.chapter_id} onValueChange={v => setForm({ ...form, chapter_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t.all}</SelectItem>
                    {chapters.map((ch: any) => <SelectItem key={ch.id} value={ch.id}>{isAr ? ch.title_ar : ch.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.difficulty}</Label>
                <Select value={form.difficulty} onValueChange={v => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">{t.easy}</SelectItem>
                    <SelectItem value="medium">{t.medium}</SelectItem>
                    <SelectItem value="hard">{t.hard}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t.tags}</Label>
              <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2" />
            </div>

            <div>
              <Label className="mb-2 block">{t.options}</Label>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Checkbox
                      checked={opt.is_correct}
                      onCheckedChange={checked => {
                        const opts = [...form.options];
                        opts[i].is_correct = !!checked;
                        setForm({ ...form, options: opts });
                      }}
                    />
                    <Input
                      placeholder={`${t.optionTextAr} ${i + 1}`}
                      value={opt.text_ar}
                      onChange={e => {
                        const opts = [...form.options];
                        opts[i].text_ar = e.target.value;
                        setForm({ ...form, options: opts });
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder={`${t.optionText} ${i + 1}`}
                      value={opt.text}
                      onChange={e => {
                        const opts = [...form.options];
                        opts[i].text = e.target.value;
                        setForm({ ...form, options: opts });
                      }}
                      className="flex-1"
                    />
                    {form.options.length > 2 && (
                      <Button variant="ghost" size="icon" onClick={() => {
                        const opts = form.options.filter((_, j) => j !== i);
                        setForm({ ...form, options: opts });
                      }}><X className="w-4 h-4" /></Button>
                    )}
                  </div>
                ))}
                {form.options.length < 6 && (
                  <Button variant="outline" size="sm" onClick={() => setForm({ ...form, options: [...form.options, { text: '', text_ar: '', is_correct: false }] })}>
                    <Plus className="w-3 h-3 me-1" /> {isAr ? 'إضافة خيار' : 'Add Option'}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.cancel}</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{t.save}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Quiz Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.generateQuiz}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t.course}</Label>
              <Select value={generateCourse} onValueChange={v => { setGenerateCourse(v); setGenerateChapter(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {courses.map(c => <SelectItem key={c.id} value={c.id}>{isAr ? c.title_ar : c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.chapter} ({isAr ? 'اختياري' : 'Optional'})</Label>
              <Select value={generateChapter} onValueChange={setGenerateChapter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t.all}</SelectItem>
                  {chapters.map((ch: any) => <SelectItem key={ch.id} value={ch.id}>{isAr ? ch.title_ar : ch.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.count}</Label>
              <Input type="number" min={1} max={50} value={generateCount} onChange={e => setGenerateCount(+e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGenerateOpen(false)}>{t.cancel}</Button>
              <Button onClick={handleGenerateQuiz} disabled={!generateCourse}>
                <Shuffle className="w-4 h-4 me-2" />
                {t.generate}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
