import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
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

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pe-1">
      <p className="text-muted-foreground text-sm">
        {isRTL
          ? 'جميع الحقول التالية إجبارية ويتم تعبئتها كتابةً لإكمال تسجيلك كمعلم.'
          : 'All the following fields are required and must be typed in to complete your instructor registration.'}
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
              placeholder={isRTL ? 'مثال: أردني' : 'e.g. Jordanian'}
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
            <Label>{isRTL ? 'الحالة الأكاديمية' : 'Academic status'} *</Label>
            <Input
              value={form.education_status}
              maxLength={100}
              onChange={(e) => set('education_status', e.target.value)}
              placeholder={isRTL ? 'مثال: دكتوراه / طالب ماجستير' : 'e.g. PhD / Masters student'}
            />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'الجهة التعليمية' : 'Institution'} *</Label>
            <Input
              value={form.institution_name}
              maxLength={150}
              onChange={(e) => set('institution_name', e.target.value)}
              placeholder={isRTL ? 'اكتب اسم الجهة التي تنتمي إليها' : 'Type your institution name'}
            />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'التخصص' : 'Specialty'} *</Label>
            <Input
              value={form.specialty}
              maxLength={150}
              onChange={(e) => set('specialty', e.target.value)}
              placeholder={isRTL ? 'مثال: الفيزياء الطبية' : 'e.g. Medical Physics'}
            />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'سنوات خبرة التدريس' : 'Years of teaching experience'} *</Label>
            <Input
              value={form.teaching_experience_years}
              maxLength={50}
              onChange={(e) => set('teaching_experience_years', e.target.value)}
              placeholder={isRTL ? 'مثال: 5 سنوات' : 'e.g. 5 years'}
            />
          </div>
          <div className="space-y-2">
            <Label>{isRTL ? 'جاهزية البدء بالعمل' : 'Availability to start'} *</Label>
            <Input
              value={form.availability_to_start}
              maxLength={100}
              onChange={(e) => set('availability_to_start', e.target.value)}
              placeholder={isRTL ? 'مثال: فوراً / خلال أسبوع' : 'e.g. Immediately / Within a week'}
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
            <Label>{isRTL ? 'هل تقدّم إعداد البحوث والأوراق العلمية؟' : 'Do you offer research & academic papers?'} *</Label>
            <Input
              value={form.offers_research_services}
              maxLength={100}
              onChange={(e) => set('offers_research_services', e.target.value)}
              placeholder={isRTL ? 'نعم / لا' : 'Yes / No'}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{isRTL ? 'من أين سمعت عنا؟' : 'How did you hear about us?'} *</Label>
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
          <Button onClick={handleSubmit} disabled={!step2Valid || saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRTL ? 'متابعة للسياسات' : 'Continue to policies'}
          </Button>
        )}
      </div>
    </div>
  );
};
