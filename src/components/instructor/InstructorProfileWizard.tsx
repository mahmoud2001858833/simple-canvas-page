import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronRight, ChevronLeft, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

interface Props {
  onCompleted: () => void;
}

const schema = z.object({
  residence_country: z.string().trim().min(2).max(100),
  nationality: z.string().trim().min(2).max(100),
  date_of_birth: z.string().min(4),
  gender: z.string().trim().min(2).max(30),
  education_status: z.string().trim().min(2).max(100),
  institution_name: z.string().trim().min(2).max(150),
  specialty: z.string().trim().min(2).max(150),
  teaching_experience_years: z.string().trim().min(1).max(50),
  teaching_experience_details: z.string().trim().min(3).max(1000),
  availability_to_start: z.string().trim().min(2).max(100),
  expected_students_count: z.number().int().min(0).max(100000),
  offers_research_services: z.string().trim().min(1).max(100),
  referral_source: z.string().trim().min(2).max(200),
});

const fieldHelp: Record<string, { ar: string; en: string }> = {
  residence_country: {
    ar: 'اكتب البلد والمدينة التي تقيم فيها حالياً.',
    en: 'Enter the country and city where you currently live.',
  },
  nationality: {
    ar: 'اكتب جنسيتك الحالية.',
    en: 'Enter your current nationality.',
  },
  date_of_birth: {
    ar: 'اختر تاريخ ميلادك الحقيقي.',
    en: 'Select your real date of birth.',
  },
  gender: {
    ar: 'اكتب ذكر أو أنثى.',
    en: 'Type Male or Female.',
  },
  education_status: {
    ar: 'اكتب أعلى مؤهل علمي حاصل عليه (مثلاً: دكتوراه، ماجستير، بكالوريوس).',
    en: 'Type your highest academic degree (e.g., PhD, Masters, Bachelor).',
  },
  institution_name: {
    ar: 'اكتب اسم الجهة التعليمية أو الكلية التي تنتمي إليها.',
    en: 'Type the name of the educational institution or college you belong to.',
  },
  specialty: {
    ar: 'اكتب التخصص الدقيق الذي تدرّس فيه (مثلاً: الفيزياء الطبية).',
    en: 'Type the specific field you teach in (e.g., Medical Physics).',
  },
  teaching_experience_years: {
    ar: 'اكتب عدد سنوات خبرتك العملية في التدريس.',
    en: 'Enter the number of years you have practically taught.',
  },
  teaching_experience_details: {
    ar: 'اكتب نبذة مختصرة عن خبراتك السابقة: المواد، الجهات، والإنجازات.',
    en: 'Write a brief summary of your previous experience: subjects, institutions, and achievements.',
  },
  availability_to_start: {
    ar: 'حدّد متى تستطيع البدء بالتدريس على المنصة (مثلاً: فوراً، خلال أسبوع).',
    en: 'State when you can start teaching on the platform (e.g., immediately, within a week).',
  },
  expected_students_count: {
    ar: 'كم طالباً تتوقع تسجيله في دوراتك تقريباً؟',
    en: 'Approximately how many students do you expect to enroll in your courses?',
  },
  offers_research_services: {
    ar: 'هل تستطيع مساعدة الطلاب في إعداد البحوث والأوراق العلمية؟ اكتب نعم أو لا.',
    en: 'Can you help students prepare research papers and academic articles? Type Yes or No.',
  },
  referral_source: {
    ar: 'كيف تعرّفت على منصة جسوركم؟ (مثلاً: إعلان، زميل، وسائل التواصل).',
    en: 'How did you hear about Jasorkom platform? (e.g., ad, colleague, social media).',
  },
};

export const InstructorProfileWizard = ({ onCompleted }: Props) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isRTL = language === 'ar';
  const [subStep, setSubStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    residence_country: '',
    nationality: '',
    date_of_birth: '',
    gender: '',
    education_status: '',
    institution_name: '',
    specialty: '',
    teaching_experience_years: '',
    teaching_experience_details: '',
    availability_to_start: '',
    expected_students_count: '',
    offers_research_services: '',
    referral_source: '',
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const step1Valid =
    form.residence_country.trim().length >= 2 &&
    form.nationality.trim().length >= 2 &&
    !!form.date_of_birth &&
    form.gender.trim().length >= 2;

  const step2Missing: string[] = [];
  if (form.education_status.trim().length < 2) step2Missing.push(isRTL ? 'الحالة الأكاديمية' : 'Academic status');
  if (form.institution_name.trim().length < 2) step2Missing.push(isRTL ? 'الجهة التعليمية' : 'Institution');
  if (form.specialty.trim().length < 2) step2Missing.push(isRTL ? 'التخصص' : 'Specialty');
  if (form.teaching_experience_years.trim().length < 1) step2Missing.push(isRTL ? 'سنوات الخبرة' : 'Years of experience');
  if (form.teaching_experience_details.trim().length < 3) step2Missing.push(isRTL ? 'نبذة عن خبرتك' : 'Experience details');
  if (form.availability_to_start.trim().length < 2) step2Missing.push(isRTL ? 'جاهزية البدء' : 'Availability');
  if (form.expected_students_count === '' || Number(form.expected_students_count) < 0) step2Missing.push(isRTL ? 'عدد الطلاب المتوقع' : 'Expected students');
  if (form.offers_research_services.trim().length < 1) step2Missing.push(isRTL ? 'الخدمات البحثية' : 'Research services');
  if (form.referral_source.trim().length < 2) step2Missing.push(isRTL ? 'من أين سمعت عنا' : 'Referral source');
  const step2Valid = step2Missing.length === 0;

  const handleSubmit = async () => {
    if (!step2Valid) {
      toast.error((isRTL ? 'يرجى تعبئة: ' : 'Please fill: ') + step2Missing.join('، '));
      return;
    }
    const parsed = schema.safeParse({
      ...form,
      expected_students_count: Number(form.expected_students_count),
    });
    if (!parsed.success) {
      toast.error(isRTL ? 'يرجى تعبئة جميع الحقول بشكل صحيح' : 'Please complete all fields correctly');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          residence_country: parsed.data.residence_country,
          nationality: parsed.data.nationality,
          date_of_birth: parsed.data.date_of_birth,
          gender: parsed.data.gender,
          education_status: parsed.data.education_status,
          institution_name: parsed.data.institution_name,
          specialty: parsed.data.specialty,
          teaching_experience_years: parsed.data.teaching_experience_years,
          teaching_experience_details: parsed.data.teaching_experience_details,
          availability_to_start: parsed.data.availability_to_start,
          expected_students_count: parsed.data.expected_students_count,
          offers_research_services: /^(نعم|yes|y|true)$/i.test(parsed.data.offers_research_services.trim()),
          referral_source: parsed.data.referral_source,
        } as any)
        .eq('id', user?.id as string);
      if (error) throw error;
      onCompleted();
    } catch (e) {
      console.error(e);
      toast.error(isRTL ? 'حدث خطأ أثناء الحفظ' : 'Error while saving');
    } finally {
      setSaving(false);
    }
  };

  const Next = isRTL ? ChevronLeft : ChevronRight;

  const FieldLabel = ({
    fieldKey,
    children,
    required,
  }: {
    fieldKey: string;
    children: React.ReactNode;
    required?: boolean;
  }) => {
    const help = fieldHelp[fieldKey];
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="flex items-center gap-1">
          {children}
          {required && <span className="text-destructive">*</span>}
        </Label>
        {help && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                aria-label={isRTL ? 'شرح الحقل' : 'Field explanation'}
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side={isRTL ? 'left' : 'right'}
              align="start"
              className="w-64 sm:w-80 text-xs leading-relaxed"
            >
              {isRTL ? help.ar : help.en}
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pe-1">
      <p className="text-muted-foreground text-sm">
        {isRTL
          ? 'جميع الحقول التالية إجبارية ويتم تعبئتها كتابةً لإكمال تسجيلك كمعلم. اضغط على أيقونة الاستفهام بجانب كل خيار لمعرفة ما يُطلب منك.'
          : 'All the following fields are required and must be typed in to complete your instructor registration. Click the question mark next to each option to see what is requested.'}
      </p>

      {subStep === 1 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabel fieldKey="residence_country" required>
              {isRTL ? 'مقر الإقامة' : 'Country of residence'}
            </FieldLabel>
            <Input
              value={form.residence_country}
              maxLength={100}
              onChange={(e) => set('residence_country', e.target.value)}
              placeholder={isRTL ? 'مثال: السعودية - الرياض' : 'e.g. Saudi Arabia - Riyadh'}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel fieldKey="nationality" required>
              {isRTL ? 'الجنسية' : 'Nationality'}
            </FieldLabel>
            <Input
              value={form.nationality}
              maxLength={100}
              onChange={(e) => set('nationality', e.target.value)}
              placeholder={isRTL ? 'مثال: أردني' : 'e.g. Jordanian'}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel fieldKey="date_of_birth" required>
              {isRTL ? 'تاريخ الميلاد' : 'Date of birth'}
            </FieldLabel>
            <Input
              type="date"
              value={form.date_of_birth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => set('date_of_birth', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel fieldKey="gender" required>
              {isRTL ? 'الجنس' : 'Gender'}
            </FieldLabel>
            <Input
              value={form.gender}
              maxLength={30}
              onChange={(e) => set('gender', e.target.value)}
              placeholder={isRTL ? 'ذكر / أنثى' : 'Male / Female'}
            />
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabel fieldKey="education_status" required>
              {isRTL ? 'الحالة الأكاديمية' : 'Academic status'}
            </FieldLabel>
            <Input
              value={form.education_status}
              maxLength={100}
              onChange={(e) => set('education_status', e.target.value)}
              placeholder={isRTL ? 'مثال: دكتوراه / طالب ماجستير' : 'e.g. PhD / Masters student'}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel fieldKey="institution_name" required>
              {isRTL ? 'الجهة التعليمية' : 'Institution'}
            </FieldLabel>
            <Input
              value={form.institution_name}
              maxLength={150}
              onChange={(e) => set('institution_name', e.target.value)}
              placeholder={isRTL ? 'اكتب اسم الجهة التي تنتمي إليها' : 'Type your institution name'}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel fieldKey="specialty" required>
              {isRTL ? 'التخصص' : 'Specialty'}
            </FieldLabel>
            <Input
              value={form.specialty}
              maxLength={150}
              onChange={(e) => set('specialty', e.target.value)}
              placeholder={isRTL ? 'مثال: الفيزياء الطبية' : 'e.g. Medical Physics'}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel fieldKey="teaching_experience_years" required>
              {isRTL ? 'سنوات خبرة التدريس' : 'Years of teaching experience'}
            </FieldLabel>
            <Input
              value={form.teaching_experience_years}
              maxLength={50}
              onChange={(e) => set('teaching_experience_years', e.target.value)}
              placeholder={isRTL ? 'مثال: 5 سنوات' : 'e.g. 5 years'}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel fieldKey="availability_to_start" required>
              {isRTL ? 'جاهزية البدء بالعمل' : 'Availability to start'}
            </FieldLabel>
            <Input
              value={form.availability_to_start}
              maxLength={100}
              onChange={(e) => set('availability_to_start', e.target.value)}
              placeholder={isRTL ? 'مثال: فوراً / خلال أسبوع' : 'e.g. Immediately / Within a week'}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel fieldKey="expected_students_count" required>
              {isRTL ? 'عدد الطلاب المتوقع تسجيلهم' : 'Expected number of students'}
            </FieldLabel>
            <Input
              type="number"
              min={0}
              max={100000}
              value={form.expected_students_count}
              onChange={(e) => set('expected_students_count', e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <FieldLabel fieldKey="teaching_experience_details" required>
              {isRTL ? 'نبذة عن خبرتك في التدريس' : 'Describe your teaching experience'}
            </FieldLabel>
            <Textarea
              rows={3}
              maxLength={1000}
              value={form.teaching_experience_details}
              onChange={(e) => set('teaching_experience_details', e.target.value)}
              placeholder={isRTL ? 'المواد التي درّستها، الجهات، وأي إنجازات...' : 'Subjects taught, institutions, achievements...'}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel fieldKey="offers_research_services" required>
              {isRTL ? 'هل تقدّم إعداد البحوث والأوراق العلمية؟' : 'Do you offer research & academic papers?'}
            </FieldLabel>
            <Input
              value={form.offers_research_services}
              maxLength={100}
              onChange={(e) => set('offers_research_services', e.target.value)}
              placeholder={isRTL ? 'نعم / لا' : 'Yes / No'}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <FieldLabel fieldKey="referral_source" required>
              {isRTL ? 'من أين سمعت عنا؟' : 'How did you hear about us?'}
            </FieldLabel>
            <Textarea
              rows={2}
              maxLength={200}
              value={form.referral_source}
              onChange={(e) => set('referral_source', e.target.value)}
              placeholder={isRTL ? 'مثال: عبر زميل في العمل / إعلان على انستغرام' : 'e.g. Through a colleague / Instagram ad'}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => setSubStep(1)}
          disabled={subStep === 1 || saving}
        >
          {isRTL ? 'السابق' : 'Back'}
        </Button>
        <span className="text-xs text-muted-foreground">{subStep} / 2</span>
        {subStep === 1 ? (
          <Button onClick={() => setSubStep(2)} disabled={!step1Valid} className="gap-2">
            {isRTL ? 'التالي' : 'Next'}
            <Next className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRTL ? 'متابعة للسياسات' : 'Continue to policies'}
          </Button>
        )}
      </div>
    </div>
  );
};
