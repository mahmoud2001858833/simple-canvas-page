import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

interface Props {
  onCompleted: () => void;
}

const schema = z.object({
  residence_country: z.string().trim().min(2).max(100),
  nationality: z.string().trim().min(2).max(100),
  date_of_birth: z.string().min(4),
  gender: z.enum(['male', 'female']),
  education_status: z.enum(['student', 'graduate']),
  university_id: z.string().uuid(),
  teaching_experience_years: z.string().min(1),
  teaching_experience_details: z.string().trim().min(10).max(1000),
  availability_to_start: z.string().min(1),
  expected_students_count: z.number().int().min(0).max(100000),
  offers_research_services: z.enum(['yes', 'no']),
  referral_source: z.string().min(1),
});

const EXPERIENCE = [
  { v: 'none', ar: 'لا يوجد خبرة', en: 'No experience' },
  { v: '1-2', ar: 'سنة إلى سنتين', en: '1-2 years' },
  { v: '3-5', ar: '3 إلى 5 سنوات', en: '3-5 years' },
  { v: '6-10', ar: '6 إلى 10 سنوات', en: '6-10 years' },
  { v: '10+', ar: 'أكثر من 10 سنوات', en: '10+ years' },
];

const AVAILABILITY = [
  { v: 'immediately', ar: 'فوراً', en: 'Immediately' },
  { v: 'within_week', ar: 'خلال أسبوع', en: 'Within a week' },
  { v: 'within_month', ar: 'خلال شهر', en: 'Within a month' },
  { v: 'later', ar: 'لاحقاً', en: 'Later' },
];

const SOURCES = [
  { v: 'social_media', ar: 'وسائل التواصل الاجتماعي', en: 'Social media' },
  { v: 'friend', ar: 'صديق أو زميل', en: 'Friend or colleague' },
  { v: 'search', ar: 'محركات البحث', en: 'Search engines' },
  { v: 'ads', ar: 'إعلان', en: 'Advertisement' },
  { v: 'other', ar: 'أخرى', en: 'Other' },
];

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
    university_id: '',
    teaching_experience_years: '',
    teaching_experience_details: '',
    availability_to_start: '',
    expected_students_count: '',
    offers_research_services: '',
    referral_source: '',
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const { data: universities } = useQuery({
    queryKey: ['universities-onboarding'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('universities')
        .select('id, name, name_ar')
        .eq('is_active', true)
        .order('name_ar');
      if (error) throw error;
      return data || [];
    },
  });

  const step1Valid =
    form.residence_country.trim().length >= 2 &&
    form.nationality.trim().length >= 2 &&
    !!form.date_of_birth &&
    !!form.gender;

  const step2Valid =
    !!form.education_status &&
    !!form.university_id &&
    !!form.teaching_experience_years &&
    form.teaching_experience_details.trim().length >= 10 &&
    !!form.availability_to_start &&
    form.expected_students_count !== '' &&
    Number(form.expected_students_count) >= 0 &&
    !!form.offers_research_services &&
    !!form.referral_source;

  const handleSubmit = async () => {
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
          university_id: parsed.data.university_id,
          teaching_experience_years: parsed.data.teaching_experience_years,
          teaching_experience_details: parsed.data.teaching_experience_details,
          availability_to_start: parsed.data.availability_to_start,
          expected_students_count: parsed.data.expected_students_count,
          offers_research_services: parsed.data.offers_research_services === 'yes',
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

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pe-1">
      <p className="text-muted-foreground text-sm">
        {isRTL
          ? 'جميع الحقول التالية إجبارية لإكمال تسجيلك كمعلم.'
          : 'All the following fields are required to complete your instructor registration.'}
      </p>

      {subStep === 1 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{isRTL ? 'مقر الإقامة' : 'Country of residence'} *</Label>
            <Input
              value={form.residence_country}
              maxLength={100}
              onChange={(e) => set('residence_country', e.target.value)}
              placeholder={isRTL ? 'مثال: السعودية - الرياض' : 'e.g. Saudi Arabia - Riyadh'}
            />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'الجنسية' : 'Nationality'} *</Label>
            <Input
              value={form.nationality}
              maxLength={100}
              onChange={(e) => set('nationality', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'تاريخ الميلاد' : 'Date of birth'} *</Label>
            <Input
              type="date"
              value={form.date_of_birth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => set('date_of_birth', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'الجنس' : 'Gender'} *</Label>
            <Select value={form.gender} onValueChange={(v) => set('gender', v)}>
              <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر' : 'Select'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{isRTL ? 'ذكر' : 'Male'}</SelectItem>
                <SelectItem value="female">{isRTL ? 'أنثى' : 'Female'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{isRTL ? 'الحالة الأكاديمية' : 'Academic status'} *</Label>
            <Select value={form.education_status} onValueChange={(v) => set('education_status', v)}>
              <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر' : 'Select'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">{isRTL ? 'طالب حالي' : 'Current student'}</SelectItem>
                <SelectItem value="graduate">{isRTL ? 'خريج' : 'Graduate'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'الجهة التعليمية' : 'Institution'} *</Label>
            <Select value={form.university_id} onValueChange={(v) => set('university_id', v)}>
              <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر الجهة' : 'Select institution'} /></SelectTrigger>
              <SelectContent>
                {(universities as any[])?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{isRTL ? u.name_ar : u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'سنوات خبرة التدريس' : 'Years of teaching experience'} *</Label>
            <Select value={form.teaching_experience_years} onValueChange={(v) => set('teaching_experience_years', v)}>
              <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر' : 'Select'} /></SelectTrigger>
              <SelectContent>
                {EXPERIENCE.map((o) => (
                  <SelectItem key={o.v} value={o.v}>{isRTL ? o.ar : o.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'جاهزية البدء بالعمل' : 'Availability to start'} *</Label>
            <Select value={form.availability_to_start} onValueChange={(v) => set('availability_to_start', v)}>
              <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر' : 'Select'} /></SelectTrigger>
              <SelectContent>
                {AVAILABILITY.map((o) => (
                  <SelectItem key={o.v} value={o.v}>{isRTL ? o.ar : o.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{isRTL ? 'نبذة عن خبرتك في التدريس' : 'Describe your teaching experience'} *</Label>
            <Textarea
              rows={3}
              maxLength={1000}
              value={form.teaching_experience_details}
              onChange={(e) => set('teaching_experience_details', e.target.value)}
              placeholder={isRTL ? 'المواد التي درّستها، الجهات، وأي إنجازات...' : 'Subjects taught, institutions, achievements...'}
            />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'عدد الطلاب المتوقع تسجيلهم' : 'Expected number of students'} *</Label>
            <Input
              type="number"
              min={0}
              max={100000}
              value={form.expected_students_count}
              onChange={(e) => set('expected_students_count', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'هل تقدّم إعداد البحوث والأوراق العلمية؟' : 'Do you offer research & academic papers?'} *</Label>
            <Select value={form.offers_research_services} onValueChange={(v) => set('offers_research_services', v)}>
              <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر' : 'Select'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">{isRTL ? 'نعم' : 'Yes'}</SelectItem>
                <SelectItem value="no">{isRTL ? 'لا' : 'No'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{isRTL ? 'كيف سمعت عن منصة جسوركم؟' : 'How did you hear about Josoorcom?'} *</Label>
            <Select value={form.referral_source} onValueChange={(v) => set('referral_source', v)}>
              <SelectTrigger><SelectValue placeholder={isRTL ? 'اختر' : 'Select'} /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((o) => (
                  <SelectItem key={o.v} value={o.v}>{isRTL ? o.ar : o.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Button onClick={handleSubmit} disabled={!step2Valid || saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRTL ? 'متابعة للسياسات' : 'Continue to policies'}
          </Button>
        )}
      </div>
    </div>
  );
};
