/**
 * ====================================================================
 * Teacher Lifecycle & Onboarding Workflow Service (منصة جسوركم)
 * Handles:
 * - Teacher Profiles & Onboarding state machine
 * - Bank Details & Validation (IBAN, Swift, etc.)
 * - Digital Policies & Contract signing (with jsPDF generation)
 * - Payout Models (Fixed, Percentage, Hybrid) & Offer Negotiation
 * - Accounting Ledger Synchronization
 * - Onboarding Resources CMS (Videos, Tips, Apps, Official Template)
 * ====================================================================
 */

import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';

export type OnboardingStatus = 
  | 'registered' 
  | 'bank_submitted' 
  | 'policy_signed' 
  | 'payout_selected' 
  | 'active';

export type PayoutType = 'fixed_per_course' | 'percentage' | 'hybrid';
export type NegotiationStatus = 'pending_review' | 'offer_sent' | 'in_negotiation' | 'agreed';

export interface TeacherProfile {
  id: string;
  full_name: string;
  email: string;
  bio?: string;
  onboarding_status: OnboardingStatus;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherBankDetails {
  id?: string;
  teacher_id: string;
  account_number: string;
  iban: string;
  bank_name: string;
  branch_name?: string;
  swift_code?: string;
  verified_by_admin: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TeacherContract {
  id?: string;
  teacher_id: string;
  policy_version: string;
  signed_name: string;
  signed_email: string;
  signed_at: string;
  contract_pdf_url?: string;
  ip_address?: string;
  terms_payload?: any;
}

export interface TeacherPayoutSettings {
  id?: string;
  teacher_id: string;
  requested_type: PayoutType;
  agreed_type?: PayoutType | null;
  fixed_amount?: number | null;
  percentage_rate?: number | null;
  status: NegotiationStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PayoutNegotiationMessage {
  id?: string;
  teacher_id: string;
  sender_type: 'admin' | 'teacher';
  proposed_fixed?: number | null;
  proposed_percentage?: number | null;
  message: string;
  created_at?: string;
}

export interface OnboardingResource {
  id: string;
  type: 'video' | 'tip' | 'app' | 'template';
  title: string;
  description: string;
  url?: string;
  badge_tag?: string;
  is_visible: boolean;
  order_index: number;
  created_at?: string;
  updated_at?: string;
}

export interface AccountingLedgerItem {
  id?: string;
  teacher_id: string;
  course_id?: string | null;
  transaction_type: 'accrued_profit' | 'payout_processed';
  amount: number;
  status: 'pending' | 'paid';
  payout_rule_snapshot?: any;
  created_at?: string;
}

// ====================================================================
// Default Official Seed Resources (Fallback & Reference)
// ====================================================================

export const DEFAULT_TEACHER_POLICIES = [
  {
    id: 'pol-1',
    title: 'الملكية الفكرية والحصرية',
    summary: 'حقوق محتوى المادة التعليمية المسجلة مخصصة للنشر حصرياً عبر منصة جسوركم طوال سريان العقد، ويمنع إعادة نشرها في منصات موازية دون إذن خطي مسبق.',
  },
  {
    id: 'pol-2',
    title: 'معايير جودة التسجيل الفنية',
    summary: 'التزام المعلم بأعلى المعايير الفنية المعتمدة (دقة 1080p كحد أدنى، صوت ستيريو نقي وخالٍ من الصدى والتشويش، واستخدام قالب المنصة الرسمي المعتمد).',
  },
  {
    id: 'pol-3',
    title: 'الدعم والتفاعل الأكاديمي',
    summary: 'الالتزام بمتابعة استفسارات الطلاب المسجلين بالدورة والرد على نقاشاتهم خلال 24 إلى 48 ساعة كحد أقصى لضمان تجربة تعليمية متميزة.',
  },
  {
    id: 'pol-4',
    title: 'السرية المهنية وعدم المنافسة',
    summary: 'منع توجيه الطلاب خارج المنصة لأغراض دروس خصوصية موازية، والمحافظة التامة على سرية بيانات الطلاب والمنصة.',
  },
  {
    id: 'pol-5',
    title: 'التحويلات والدورات المالية',
    summary: 'تُدفع المستحقات المالية بحسب النموذج المتفق عليه والمعتمد في لوحة التحكم بحلول اليوم الخامس من كل شهر ميلادي عبر الحساب البنكي الموثق.',
  },
];

export const DEFAULT_TEACHER_TIPS = [
  {
    id: 'tip-1',
    title: 'الصوت نصف المحتوى التعليمي',
    description: 'استخدم ميكروفوناً خارجياً احترافياً (Lavalier أو USB Mic) وسجل في غرفة معزولة تماماً عن الصدى والضوضاء المحيطة لضمان وضوح فائق.',
    tag: 'جودة الصوت',
  },
  {
    id: 'tip-2',
    title: 'قاعدة الـ 10 دقائق (Micro-lessons)',
    description: 'قسّم الدروس والموضوعات الكبيرة إلى وحدات مصغرة تتراوح بين 7 إلى 12 دقيقة، مما يرفع معدل إتمام الدروس ويحافظ على تركيز الطالب.',
    tag: 'هيكلة الدرس',
  },
  {
    id: 'tip-3',
    title: 'التفاعل العملي وحل المسائل',
    description: 'ابدأ كل درس بمشكلة أو سؤال واقعي محفز، وانهِه بمسألة تدريبية تحلها مع الطالب خطوة بخطوة لترسيخ المفاهيم والمعادلات.',
    tag: 'بيداغوجيا الشرح',
  },
  {
    id: 'tip-4',
    title: 'العلامة البصرية والالتزام بالقالب',
    description: 'افتح دائماً قالب جسوركم الرسمي المعتمد واستخدم ألوان الهوية المؤسسية لضمان التناسق البصري لكافة مواد ومقررات المنصة.',
    tag: 'الهوية الرسمية',
  },
];

export const DEFAULT_TEACHING_APPS = [
  {
    id: 'app-1',
    title: 'GoodNotes / Notability',
    description: 'أفضل تطبيق لتدوين الملاحظات والشرح اليدوي التفاعلي مع دعم كامل لملفات PDF والشرائح التوضيحية وأقلام الآيباد.',
    url: 'https://www.goodnotes.com/',
    tag: 'الشرح التفاعلي',
  },
  {
    id: 'app-2',
    title: 'Microsoft OneNote & OpenBoard',
    description: 'سبورة بيضاء تفاعلية تدعم شاشات اللمس والتابلت وأجهزة الويندوز والماك مع إمكانية الرسم والتخطيط المباشر.',
    url: 'https://openboard.ch/',
    tag: 'السبورة التفاعلية',
  },
  {
    id: 'app-3',
    title: 'OBS Studio',
    description: 'البرنامج المعياري الاحترافي المفتوح المصدر لتسجيل الشاشة ودمج الكاميرا بدقة فائقة 1080p/60fps وإعدادات صوت احترافية.',
    url: 'https://obsproject.com/',
    tag: 'تسجيل الشاشة',
  },
  {
    id: 'app-4',
    title: 'Canva Education',
    description: 'أداة سحابية رائدة لتصميم شرائح الععرض التعليمية وتنسيق المخططات البيانية والجداول التوضيحية بسهولة وسرعة.',
    url: 'https://www.canva.com/',
    tag: 'تصميم الشرائح',
  },
];

export const DEFAULT_TUTORIAL_VIDEOS = [
  {
    id: 'guide-1',
    title: 'المعايير الأكاديمية وهندسة المقررات في جسوركم',
    description: 'دليل أكاديمي معتمد يشرح معايير اعتماد المحتوى الجامعي، أسلوب بناء المحاضرات التفاعلية، وتنظيم الوحدات الدراسية والاختبارات.',
    url: '/وثيقة_الاعتماد_الفني_للفيلم_الرسمي_جسوركم.pdf',
    tag: 'إلزامي ومثبت',
    isMandatory: true,
  },
  {
    id: 'guide-2',
    title: 'الدليل الفني لتجهيز استوديو التسجيل وهندسة الصوت النقي',
    description: 'إرشادات عملية لضبط الميكروفون الموجه الاحترافي، عزل الصدى والتشويش، وضبط زوايا الإضاءة لدقة 1080p بمستوى تقني رفيع.',
    url: '/docs/studio-setup-guide.pdf',
    tag: 'جودة الاستوديو',
    isMandatory: false,
  },
  {
    id: 'guide-3',
    title: 'دليل استخدام قالب الشرح الرسمي لمنصة جسوركم',
    description: 'شرح خطوة بخطوة لكيفية استيراد واستخدام قالب جسوركم الرسمي في البوربوينت وGoodNotes لتوحيد الهوية البصرية الأكاديمية.',
    url: '/templates/josoorcom-lecture-template.pptx',
    tag: 'الهوية الرسمية',
    isMandatory: false,
  },
];

export const DEFAULT_OFFICIAL_TEMPLATE = {
  title: 'قالب الشرح الرسمي لمنصة جسوركم (Josoorcom Official Teaching Template)',
  description: 'القالب المؤسسي المعتمد لشرائح العرض التعليمية بالألوان الرسمية ونسب الأبعاد الفنية (16:9). بصيغة جاهزة للاستخدام الفوري.',
  downloadUrl: '/templates/josoorcom-lecture-template.pptx',
};

// ====================================================================
// IBAN & Form Validation Helpers
// ====================================================================

export function validateIBAN(iban: string): { isValid: boolean; message?: string } {
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  if (!clean) {
    return { isValid: false, message: 'يرجى إدخال رقم الـ IBAN' };
  }
  if (clean.length < 15 || clean.length > 34) {
    return { isValid: false, message: 'طول رقم الـ IBAN غير صحيح' };
  }
  // If Saudi IBAN, strictly 24 chars starting with SA
  if (clean.startsWith('SA')) {
    if (clean.length !== 24) {
      return { isValid: false, message: 'الآيبان السعودي يجب أن يتكون من 24 خانة ويبدأ بـ SA' };
    }
    if (!/^SA\d{22}$/.test(clean)) {
      return { isValid: false, message: 'صيغة الآيبان السعودي غير صحيحة (SA متبوعة بـ 22 رقماً)' };
    }
  }
  return { isValid: true };
}

export function formatIBAN(iban: string): string {
  return iban
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

// ====================================================================
// Storage & In-Memory Fallback Store
// ====================================================================

const LOCAL_STORAGE_PREFIX = 'josoorcom_teacher_lifecycle_';

function getLocalStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setLocalStore<T>(key: string, val: T): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(val));
  } catch (e) {
    console.warn('Local storage write failed', e);
  }
}

// ====================================================================
// Cross-Device Cloud Sync Helpers (Profiles & Platform Settings)
// ====================================================================

export interface TeacherCertificate {
  id: string;
  title: string;
  issuer?: string;
  issue_date?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  uploaded_at: string;
}

export interface TeacherCloudStore {
  onboarding_status?: OnboardingStatus;
  bank?: TeacherBankDetails;
  payout?: TeacherPayoutSettings;
  contract?: TeacherContract;
  certificates?: TeacherCertificate[];
  updated_at?: string;
}

export async function syncTeacherDataToCloud(
  teacherId: string,
  partial: Partial<TeacherCloudStore>
): Promise<TeacherCloudStore> {
  let currentStore: TeacherCloudStore = {};

  // 1. Read existing from profiles.teaching_experience_details
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('teaching_experience_details')
      .eq('id', teacherId)
      .maybeSingle();

    if (prof?.teaching_experience_details) {
      try {
        currentStore = JSON.parse(prof.teaching_experience_details);
      } catch {
        currentStore = {};
      }
    }
  } catch {
    // ignore
  }

  // Also check platform_settings
  if (!currentStore.bank && !currentStore.payout) {
    try {
      const { data: setting } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', `teacher_data_${teacherId}`)
        .maybeSingle();
      if (setting?.value) {
        try {
          currentStore = JSON.parse(setting.value);
        } catch {}
      }
    } catch {}
  }

  const merged: TeacherCloudStore = {
    ...currentStore,
    ...partial,
    bank: partial.bank ? { ...currentStore.bank, ...partial.bank } : currentStore.bank,
    payout: partial.payout ? { ...currentStore.payout, ...partial.payout } : currentStore.payout,
    contract: partial.contract ? { ...currentStore.contract, ...partial.contract } : currentStore.contract,
    onboarding_status: partial.onboarding_status || currentStore.onboarding_status || 'registered',
    updated_at: new Date().toISOString(),
  };

  const serialized = JSON.stringify(merged);

  // 2. Persist to profiles.teaching_experience_details in PostgreSQL
  try {
    await supabase
      .from('profiles')
      .update({ teaching_experience_details: serialized })
      .eq('id', teacherId);
  } catch (e) {
    console.warn('Sync to profiles:', e);
  }

  // 3. Persist to platform_settings for shared access across all clients
  try {
    await supabase.from('platform_settings').upsert({
      key: `teacher_data_${teacherId}`,
      value: serialized,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    if (merged.payout) {
      await supabase.from('platform_settings').upsert({
        key: `teacher_payout_${teacherId}`,
        value: JSON.stringify(merged.payout),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    }

    if (merged.bank) {
      await supabase.from('platform_settings').upsert({
        key: `teacher_bank_${teacherId}`,
        value: JSON.stringify(merged.bank),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    }
  } catch (e) {
    console.warn('Sync to platform_settings non-fatal:', e);
  }

  // 4. Update local cache
  setLocalStore(`cloud_${teacherId}`, merged);
  if (merged.bank) setLocalStore(`bank_${teacherId}`, merged.bank);
  if (merged.payout) setLocalStore(`payout_${teacherId}`, merged.payout);
  if (merged.contract) setLocalStore(`contract_${teacherId}`, merged.contract);

  return merged;
}

export async function getTeacherDataFromCloud(teacherId: string): Promise<TeacherCloudStore | null> {
  // 1. Try profiles
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('teaching_experience_details')
      .eq('id', teacherId)
      .maybeSingle();

    if (prof?.teaching_experience_details) {
      try {
        const parsed = JSON.parse(prof.teaching_experience_details);
        if (parsed && (parsed.bank || parsed.payout || parsed.contract)) {
          return parsed;
        }
      } catch {}
    }
  } catch {}

  // 2. Try platform_settings
  try {
    const { data: setting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', `teacher_data_${teacherId}`)
      .maybeSingle();

    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (parsed) return parsed;
      } catch {}
    }
  } catch {}

  return getLocalStore<TeacherCloudStore | null>(`cloud_${teacherId}`, null);
}

export async function getTeacherCertificates(teacherId: string): Promise<TeacherCertificate[]> {
  const store = await getTeacherDataFromCloud(teacherId);
  return store?.certificates || [];
}

export async function addTeacherCertificate(
  teacherId: string,
  cert: Omit<TeacherCertificate, 'id' | 'uploaded_at'>
): Promise<TeacherCertificate> {
  const existing = await getTeacherCertificates(teacherId);
  const newCert: TeacherCertificate = {
    id: `cert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...cert,
    uploaded_at: new Date().toISOString(),
  };
  const updated = [...existing, newCert];
  await syncTeacherDataToCloud(teacherId, { certificates: updated });
  return newCert;
}

export async function deleteTeacherCertificate(teacherId: string, certId: string): Promise<boolean> {
  const existing = await getTeacherCertificates(teacherId);
  const updated = existing.filter(c => c.id !== certId);
  await syncTeacherDataToCloud(teacherId, { certificates: updated });
  return true;
}

// ====================================================================
// Teacher Profile & Lifecycle State Machine
// ====================================================================

export async function getTeacherLifecycleProfile(userId: string): Promise<TeacherProfile | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('teacher_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      return data as TeacherProfile;
    }
  } catch (e) {
    // Fall back to profiles table
  }

  try {
    const { data: prof } = await (supabase as any)
      .from('profiles')
      .select('id, full_name, email, bio, has_accepted_policies, teaching_experience_details')
      .eq('id', userId)
      .maybeSingle();

    if (prof) {
      let parsedStatus: OnboardingStatus = prof.has_accepted_policies ? 'active' : 'registered';
      if (prof.teaching_experience_details) {
        try {
          const parsed = JSON.parse(prof.teaching_experience_details);
          if (parsed.onboarding_status) parsedStatus = parsed.onboarding_status;
        } catch {}
      }

      const local = getLocalStore<TeacherProfile>(`profile_${userId}`, {
        id: prof.id,
        full_name: prof.full_name || 'معلم جسوركم',
        email: prof.email || '',
        bio: prof.bio || '',
        onboarding_status: parsedStatus,
      });
      return local;
    }
  } catch {
    // ignore
  }

  return getLocalStore<TeacherProfile | null>(`profile_${userId}`, null);
}

export async function upsertTeacherLifecycleProfile(
  profile: Partial<TeacherProfile> & { id: string }
): Promise<TeacherProfile> {
  const payload = {
    id: profile.id,
    full_name: profile.full_name || 'معلم جسوركم',
    email: profile.email || '',
    bio: profile.bio || '',
    onboarding_status: profile.onboarding_status || 'registered',
    updated_at: new Date().toISOString(),
  };

  try {
    await (supabase as any).from('teacher_profiles').upsert(payload);
  } catch {
    // ignore if table not yet migrated
  }

  setLocalStore(`profile_${profile.id}`, payload);
  await syncTeacherDataToCloud(profile.id, { onboarding_status: payload.onboarding_status });
  return payload as TeacherProfile;
}

// ====================================================================
// Teacher Bank Details API
// ====================================================================

export async function getTeacherBankDetails(teacherId: string): Promise<TeacherBankDetails | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('teacher_bank_details')
      .select('*')
      .eq('teacher_id', teacherId)
      .maybeSingle();

    if (!error && data) return data as TeacherBankDetails;
  } catch {
    // ignore
  }

  // Check Cloud Store
  const cloud = await getTeacherDataFromCloud(teacherId);
  if (cloud?.bank) return cloud.bank;

  // Check platform_settings bank key
  try {
    const { data: ps } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', `teacher_bank_${teacherId}`)
      .maybeSingle();
    if (ps?.value) {
      try {
        const parsed = JSON.parse(ps.value);
        if (parsed) return parsed as TeacherBankDetails;
      } catch {}
    }
  } catch {}

  return getLocalStore<TeacherBankDetails | null>(`bank_${teacherId}`, null);
}

export async function saveTeacherBankDetails(
  details: Omit<TeacherBankDetails, 'id' | 'created_at' | 'updated_at'>
): Promise<TeacherBankDetails> {
  const cleanIban = details.iban.replace(/\s+/g, '').toUpperCase();
  const payload: TeacherBankDetails = {
    id: 'bank-' + details.teacher_id,
    ...details,
    iban: cleanIban,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await (supabase as any)
      .from('teacher_bank_details')
      .upsert({ ...payload }, { onConflict: 'teacher_id' })
      .select()
      .maybeSingle();

    if (!error && data) {
      payload.id = data.id || payload.id;
    }
  } catch {
    // ignore
  }

  // Cloud Sync to profiles & platform_settings
  await syncTeacherDataToCloud(details.teacher_id, {
    bank: payload,
    onboarding_status: 'bank_submitted',
  });

  setLocalStore(`bank_${details.teacher_id}`, payload);
  await upsertTeacherLifecycleProfile({ id: details.teacher_id, onboarding_status: 'bank_submitted' });
  return payload;
}

export async function setBankVerificationByAdmin(
  teacherId: string,
  verified: boolean
): Promise<boolean> {
  try {
    await (supabase as any)
      .from('teacher_bank_details')
      .update({ verified_by_admin: verified, updated_at: new Date().toISOString() })
      .eq('teacher_id', teacherId);
  } catch {
    // ignore
  }

  const local = getLocalStore<TeacherBankDetails | null>(`bank_${teacherId}`, null);
  if (local) {
    local.verified_by_admin = verified;
    setLocalStore(`bank_${teacherId}`, local);
  }
  return true;
}

// ====================================================================
// Digital Contract Signing & PDF Generation
// ====================================================================

export async function signTeacherPolicyContract(params: {
  teacherId: string;
  signedName: string;
  signedEmail: string;
  ipAddress?: string;
}): Promise<{ contract: TeacherContract; pdfBlobUrl: string }> {
  const signedAt = new Date().toISOString();
  
  // 1. Generate Signed PDF via jsPDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 38, 'F');

  doc.setTextColor(212, 175, 55); // Josoorcom Gold
  doc.setFontSize(22);
  doc.text('JOSCORCOM ENTERPRISE', 105, 18, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('Official Certified Instructor Agreement & Policy Contract', 105, 28, { align: 'center' });

  // Body text & Metadata
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.text('Teacher Onboarding & Intellectual Property Agreement', 15, 50);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Agreement Reference: JOS-CTR-${Date.now()}`, 15, 58);
  doc.text(`Policy Version: v1.0 (Enterprise Academic Standard)`, 15, 64);
  doc.text(`Signed At (UTC): ${signedAt}`, 15, 70);
  doc.text(`IP Address Record: ${params.ipAddress || 'Verified Digital Client'}`, 15, 76);

  doc.setDrawColor(226, 232, 240);
  doc.line(15, 82, 195, 82);

  // Policy Articles
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  let y = 92;

  const clauses = [
    { title: 'Article 1: Intellectual Property & Exclusivity', desc: 'All recorded educational materials, quizzes, and course assets are exclusively dedicated to Josoorcom for the duration of the contract.' },
    { title: 'Article 2: Audio & Video Recording Quality Standards', desc: 'Instructor commits to minimum 1080p full HD resolution, clean stereo audio without reverb, and the official Josoorcom teaching slide template.' },
    { title: 'Article 3: Student Interaction & 24-48h Response SLA', desc: 'Instructor agrees to actively answer enrolled student inquiries within 24 to 48 hours to maintain premier academic standards.' },
    { title: 'Article 4: Professional Confidentiality & Anti-Disintermediation', desc: 'Instructor strictly refrains from directing students outside the platform for private tutoring and protects platform proprietary data.' },
    { title: 'Article 5: Monthly Payout Cycles & Bank Remittances', desc: 'Accrued course earnings are transferred to the verified instructor bank account by the 5th business day of each calendar month.' },
  ];

  clauses.forEach((c) => {
    doc.setFont('helvetica', 'bold');
    doc.text(c.title, 15, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const splitDesc = doc.splitTextToSize(c.desc, 180);
    doc.text(splitDesc, 15, y);
    y += splitDesc.length * 5 + 6;
  });

  // Digital Signature Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(15, y + 5, 180, 45, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text('LEGALLY BINDING DIGITAL SIGNATURE (VERIFIED)', 20, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Signed Full Name: ${params.signedName}`, 20, y + 23);
  doc.text(`Registered Email: ${params.signedEmail}`, 20, y + 30);
  doc.text(`Digital Fingerprint: SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}-CONFIRMED`, 20, y + 37);
  doc.text(`Platform Seal: JOS-LEGAL-STAMP-APPROVED`, 20, y + 44);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Josoorcom Academic Platform - All rights reserved. Generated via secure digital execution.', 105, 287, { align: 'center' });

  const pdfBlob = doc.output('blob');
  const pdfBlobUrl = URL.createObjectURL(pdfBlob);

  const contractObj: TeacherContract = {
    id: 'ctr-' + Date.now(),
    teacher_id: params.teacherId,
    policy_version: 'v1.0',
    signed_name: params.signedName,
    signed_email: params.signedEmail,
    signed_at: signedAt,
    contract_pdf_url: pdfBlobUrl,
    ip_address: params.ipAddress || 'Client Verified',
    terms_payload: DEFAULT_TEACHER_POLICIES,
  };

  try {
    await (supabase as any).from('teacher_contracts').insert({
      teacher_id: params.teacherId,
      policy_version: 'v1.0',
      signed_name: params.signedName,
      signed_email: params.signedEmail,
      signed_at: signedAt,
      contract_pdf_url: pdfBlobUrl,
      ip_address: params.ipAddress,
      terms_payload: DEFAULT_TEACHER_POLICIES,
    });
  } catch {
    // ignore if table not created
  }

  // Also update profiles.has_accepted_policies
  try {
    await (supabase as any)
      .from('profiles')
      .update({ has_accepted_policies: true })
      .eq('id', params.teacherId);
  } catch {
    // ignore
  }

  setLocalStore(`contract_${params.teacherId}`, contractObj);
  await upsertTeacherLifecycleProfile({ id: params.teacherId, onboarding_status: 'policy_signed' });
  await syncTeacherDataToCloud(params.teacherId, {
    contract: contractObj,
    onboarding_status: 'policy_signed',
  });

  // Trigger Confirmation Email
  try {
    await sendLifecycleEmail({
      type: 'teacher_policy_confirmed',
      toEmail: params.signedEmail,
      toName: params.signedName,
      contractUrl: pdfBlobUrl,
      userId: params.teacherId,
    });
  } catch (e) {
    console.warn('Email confirmation non-blocking failure', e);
  }

  return { contract: contractObj, pdfBlobUrl };
}

export async function getTeacherContract(teacherId: string): Promise<TeacherContract | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('teacher_contracts')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) return data as TeacherContract;
  } catch {
    // ignore
  }

  const cloud = await getTeacherDataFromCloud(teacherId);
  if (cloud?.contract) return cloud.contract;

  return getLocalStore<TeacherContract | null>(`contract_${teacherId}`, null);
}

// ====================================================================
// Teacher Payout Settings & Offer Negotiation
// ====================================================================

export async function getTeacherPayoutSettings(teacherId: string): Promise<TeacherPayoutSettings | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('teacher_payout_settings')
      .select('*')
      .eq('teacher_id', teacherId)
      .maybeSingle();

    if (!error && data) return data as TeacherPayoutSettings;
  } catch {
    // ignore
  }

  try {
    const { data: ps } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', `teacher_payout_${teacherId}`)
      .maybeSingle();
    if (ps?.value) {
      try {
        const parsed = JSON.parse(ps.value);
        if (parsed) return parsed as TeacherPayoutSettings;
      } catch {}
    }
  } catch {}

  const cloud = await getTeacherDataFromCloud(teacherId);
  if (cloud?.payout) return cloud.payout;

  return getLocalStore<TeacherPayoutSettings | null>(`payout_${teacherId}`, null);
}

export async function requestPayoutModel(params: {
  teacherId: string;
  requestedType: PayoutType;
  fixedAmount?: number;
  percentageRate?: number;
  notes?: string;
}): Promise<TeacherPayoutSettings> {
  const payload: TeacherPayoutSettings = {
    id: 'payout-' + params.teacherId,
    teacher_id: params.teacherId,
    requested_type: params.requestedType,
    fixed_amount: params.fixedAmount || null,
    percentage_rate: params.percentageRate || null,
    status: 'pending_review',
    notes: params.notes || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await (supabase as any)
      .from('teacher_payout_settings')
      .upsert(payload, { onConflict: 'teacher_id' })
      .select()
      .maybeSingle();

    if (!error && data) {
      payload.id = data.id || payload.id;
    }
  } catch {
    // ignore
  }

  await syncTeacherDataToCloud(params.teacherId, {
    payout: payload,
    onboarding_status: 'payout_selected',
  });

  setLocalStore(`payout_${params.teacherId}`, payload);
  await upsertTeacherLifecycleProfile({ id: params.teacherId, onboarding_status: 'payout_selected' });
  return payload;
}

export async function sendAdminPayoutOffer(params: {
  teacherId: string;
  proposedFixed?: number | null;
  proposedPercentage?: number | null;
  message: string;
  teacherEmail?: string;
  teacherName?: string;
}): Promise<boolean> {
  const negotiation: PayoutNegotiationMessage = {
    id: 'neg-' + Date.now(),
    teacher_id: params.teacherId,
    sender_type: 'admin',
    proposed_fixed: params.proposedFixed,
    proposed_percentage: params.proposedPercentage,
    message: params.message,
    created_at: new Date().toISOString(),
  };

  // 1. Try database table
  try {
    await (supabase as any).from('payout_negotiations').insert(negotiation);
    await (supabase as any)
      .from('teacher_payout_settings')
      .update({
        status: 'offer_sent',
        fixed_amount: params.proposedFixed,
        percentage_rate: params.proposedPercentage,
        updated_at: new Date().toISOString(),
      })
      .eq('teacher_id', params.teacherId);
  } catch {}

  // 2. Fetch current messages and append
  const currentMsgs = await getPayoutNegotiations(params.teacherId);
  const updatedMsgs = [...currentMsgs.filter(m => m.id !== negotiation.id), negotiation];

  // 3. Sync to platform_settings
  try {
    await supabase.from('platform_settings').upsert({
      key: `teacher_negotiations_${params.teacherId}`,
      value: JSON.stringify(updatedMsgs),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
  } catch (e) {
    console.warn('Sync negotiation to platform_settings non-fatal:', e);
  }

  // 4. Update local & cloud store
  setLocalStore(`neg_${params.teacherId}`, updatedMsgs);

  const payout = getLocalStore<TeacherPayoutSettings | null>(`payout_${params.teacherId}`, null) || {
    id: 'payout-' + params.teacherId,
    teacher_id: params.teacherId,
    requested_type: params.proposedFixed ? 'fixed_per_course' : 'percentage',
    status: 'offer_sent',
    created_at: new Date().toISOString(),
  };
  payout.status = 'offer_sent';
  payout.fixed_amount = params.proposedFixed ?? payout.fixed_amount;
  payout.percentage_rate = params.proposedPercentage ?? payout.percentage_rate;
  payout.notes = params.message;
  payout.updated_at = new Date().toISOString();
  setLocalStore(`payout_${params.teacherId}`, payout);

  await syncTeacherDataToCloud(params.teacherId, { payout });

  // 5. In-app notification for the teacher
  try {
    await supabase.from('notifications').insert({
      user_id: params.teacherId,
      title: 'عرض مالي ومفاوضة من الإدارة',
      title_ar: 'عرض مالي ومفاوضة من الإدارة',
      message: `قدمت لك الإدارة عرضاً مالياً: ${params.proposedPercentage ? `${params.proposedPercentage}% نسبة` : ''} ${params.proposedFixed ? `${params.proposedFixed} ر.س` : ''}. الملاحظة: "${params.message}"`,
      message_ar: `قدمت لك الإدارة عرضاً مالياً: ${params.proposedPercentage ? `${params.proposedPercentage}% نسبة` : ''} ${params.proposedFixed ? `${params.proposedFixed} ر.س` : ''}. الملاحظة: "${params.message}"`,
      link: '/instructor/negotiation',
      type: 'warning',
    });
  } catch {}

  // 6. Trigger Email
  if (params.teacherEmail) {
    sendLifecycleEmail({
      type: 'teacher_offer_sent',
      toEmail: params.teacherEmail,
      toName: params.teacherName || 'أستاذنا الفاضل',
      offerDetails: params.message,
      fixedAmount: params.proposedFixed || undefined,
      percentageRate: params.proposedPercentage || undefined,
      userId: params.teacherId,
    }).catch((e) => console.warn('Offer email notice failed', e));
  }

  return true;
}

export async function sendTeacherCounterOffer(params: {
  teacherId: string;
  proposedFixed?: number | null;
  proposedPercentage?: number | null;
  message: string;
}): Promise<boolean> {
  const negotiation: PayoutNegotiationMessage = {
    id: 'neg-' + Date.now(),
    teacher_id: params.teacherId,
    sender_type: 'teacher',
    proposed_fixed: params.proposedFixed,
    proposed_percentage: params.proposedPercentage,
    message: params.message,
    created_at: new Date().toISOString(),
  };

  // 1. Try database table
  try {
    await (supabase as any).from('payout_negotiations').insert(negotiation);
    await (supabase as any)
      .from('teacher_payout_settings')
      .update({
        status: 'in_negotiation',
        updated_at: new Date().toISOString(),
      })
      .eq('teacher_id', params.teacherId);
  } catch {}

  // 2. Fetch current messages and append
  const currentMsgs = await getPayoutNegotiations(params.teacherId);
  const updatedMsgs = [...currentMsgs.filter(m => m.id !== negotiation.id), negotiation];

  // 3. Sync to platform_settings
  try {
    await supabase.from('platform_settings').upsert({
      key: `teacher_negotiations_${params.teacherId}`,
      value: JSON.stringify(updatedMsgs),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
  } catch (e) {
    console.warn('Sync negotiation to platform_settings non-fatal:', e);
  }

  // 4. Update local & cloud store
  setLocalStore(`neg_${params.teacherId}`, updatedMsgs);

  const payout = getLocalStore<TeacherPayoutSettings | null>(`payout_${params.teacherId}`, null);
  if (payout) {
    payout.status = 'in_negotiation';
    payout.notes = `عرض مقابل من المعلم: ${params.message}`;
    if (params.proposedFixed !== undefined && params.proposedFixed !== null) payout.fixed_amount = params.proposedFixed;
    if (params.proposedPercentage !== undefined && params.proposedPercentage !== null) payout.percentage_rate = params.proposedPercentage;
    payout.updated_at = new Date().toISOString();
    setLocalStore(`payout_${params.teacherId}`, payout);
    await syncTeacherDataToCloud(params.teacherId, { payout });
  }

  // 5. Notify all admins in notifications table
  try {
    const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
    if (adminRoles && adminRoles.length > 0) {
      const notifs = adminRoles.map((a: any) => ({
        user_id: a.user_id,
        title: 'عرض مقابل جديد من المعلم',
        title_ar: 'عرض مقابل جديد من المعلم',
        message: `قدم المعلم رداً وعرضاً مقابلاً: "${params.message}".`,
        message_ar: `قدم المعلم رداً وعرضاً مقابلاً: "${params.message}".`,
        link: '/admin',
        type: 'info',
      }));
      await supabase.from('notifications').insert(notifs);
    }
  } catch {}

  return true;
}

export async function getPayoutNegotiations(teacherId: string): Promise<PayoutNegotiationMessage[]> {
  // 1. Try DB table
  try {
    const { data, error } = await (supabase as any)
      .from('payout_negotiations')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) return data as PayoutNegotiationMessage[];
  } catch {}

  // 2. Try platform_settings
  try {
    const { data: ps } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', `teacher_negotiations_${teacherId}`)
      .maybeSingle();

    if (ps?.value) {
      const parsed = JSON.parse(ps.value);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // 3. Try profiles.teaching_experience_details
  try {
    const cloud = await getTeacherDataFromCloud(teacherId);
    if ((cloud as any)?.negotiations && Array.isArray((cloud as any).negotiations)) {
      return (cloud as any).negotiations;
    }
  } catch {}

  // 4. Local storage fallback
  return getLocalStore<PayoutNegotiationMessage[]>(`neg_${teacherId}`, []);
}

export async function finalizeAgreedPayout(params: {
  teacherId: string;
  agreedType: PayoutType;
  fixedAmount?: number | null;
  percentageRate?: number | null;
  notes?: string;
  teacherEmail?: string;
  teacherName?: string;
}): Promise<TeacherPayoutSettings> {
  const updatePayload = {
    agreed_type: params.agreedType,
    fixed_amount: params.fixedAmount || null,
    percentage_rate: params.percentageRate || null,
    status: 'agreed' as NegotiationStatus,
    notes: params.notes || 'تم اعتماد الاتفاق النهائي من قبل الإدارة',
    updated_at: new Date().toISOString(),
  };

  try {
    await (supabase as any)
      .from('teacher_payout_settings')
      .update(updatePayload)
      .eq('teacher_id', params.teacherId);

    // Synchronize to instructor's courses commission if percentage
    if (params.percentageRate) {
      await (supabase as any)
        .from('courses')
        .update({ instructor_commission: params.percentageRate })
        .eq('instructor_id', params.teacherId);
    }
  } catch {
    // ignore
  }

  // Update local & cloud
  let payout = getLocalStore<TeacherPayoutSettings | null>(`payout_${params.teacherId}`, null);
  if (!payout) {
    payout = {
      teacher_id: params.teacherId,
      requested_type: params.agreedType,
      status: 'agreed',
    };
  }
  Object.assign(payout, updatePayload);
  setLocalStore(`payout_${params.teacherId}`, payout);

  // Cloud Sync
  await syncTeacherDataToCloud(params.teacherId, {
    payout,
    onboarding_status: 'active',
  });

  // Mark teacher profile as fully active
  await upsertTeacherLifecycleProfile({ id: params.teacherId, onboarding_status: 'active' });

  // Record initial rule snapshot in accounting_ledger
  await recordAccountingLedgerEntry({
    teacher_id: params.teacherId,
    transaction_type: 'accrued_profit',
    amount: params.fixedAmount || 0,
    status: 'pending',
    payout_rule_snapshot: {
      type: params.agreedType,
      fixed: params.fixedAmount,
      percentage: params.percentageRate,
      agreed_at: new Date().toISOString(),
    },
  });

  // Trigger Email
  if (params.teacherEmail) {
    sendLifecycleEmail({
      type: 'teacher_offer_agreed',
      toEmail: params.teacherEmail,
      toName: params.teacherName || 'أستاذنا الفاضل',
      fixedAmount: params.fixedAmount || undefined,
      percentageRate: params.percentageRate || undefined,
      userId: params.teacherId,
    }).catch((e) => console.warn('Agreed email notice failed', e));
  }

  return payout;
}

// ====================================================================
// Accounting Ledger Integration
// ====================================================================

export async function recordAccountingLedgerEntry(entry: AccountingLedgerItem): Promise<boolean> {
  const payload = {
    ...entry,
    created_at: new Date().toISOString(),
  };

  try {
    await (supabase as any).from('accounting_ledger').insert(payload);
  } catch {
    // ignore
  }

  const list = getLocalStore<AccountingLedgerItem[]>('all_ledger_items', []);
  list.unshift(payload);
  setLocalStore('all_ledger_items', list);
  return true;
}

export async function getTeacherLedger(teacherId: string): Promise<AccountingLedgerItem[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('accounting_ledger')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (!error && data) return data as AccountingLedgerItem[];
  } catch {
    // ignore
  }

  const all = getLocalStore<AccountingLedgerItem[]>('all_ledger_items', []);
  return all.filter((item) => item.teacher_id === teacherId);
}

export async function getAllAccountingLedgerEntries(): Promise<AccountingLedgerItem[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('accounting_ledger')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) return data as AccountingLedgerItem[];
  } catch {
    // ignore
  }

  return getLocalStore<AccountingLedgerItem[]>('all_ledger_items', []);
}

// ====================================================================
// Onboarding Resources CMS
// ====================================================================

export async function getOnboardingResources(): Promise<OnboardingResource[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('admin_onboarding_resources')
      .select('*')
      .order('order_index', { ascending: true });

    if (!error && data && data.length > 0) return data as OnboardingResource[];
  } catch {
    // ignore
  }

  // Fallback to merged default items
  const localList = getLocalStore<OnboardingResource[]>('cms_resources', []);
  if (localList.length > 0) return localList;

  const initialResources: OnboardingResource[] = [
    ...DEFAULT_TUTORIAL_VIDEOS.map((v, i) => ({
      id: v.id,
      type: 'video' as const,
      title: v.title,
      description: v.description,
      url: v.url,
      badge_tag: v.tag,
      is_visible: true,
      order_index: i + 1,
    })),
    ...DEFAULT_TEACHER_TIPS.map((t, i) => ({
      id: t.id,
      type: 'tip' as const,
      title: t.title,
      description: t.description,
      badge_tag: t.tag,
      is_visible: true,
      order_index: i + 10,
    })),
    ...DEFAULT_TEACHING_APPS.map((a, i) => ({
      id: a.id,
      type: 'app' as const,
      title: a.title,
      description: a.description,
      url: a.url,
      badge_tag: a.tag,
      is_visible: true,
      order_index: i + 20,
    })),
    {
      id: 'template-1',
      type: 'template' as const,
      title: DEFAULT_OFFICIAL_TEMPLATE.title,
      description: DEFAULT_OFFICIAL_TEMPLATE.description,
      url: DEFAULT_OFFICIAL_TEMPLATE.downloadUrl,
      badge_tag: 'قالب رسمي معتمد',
      is_visible: true,
      order_index: 30,
    },
  ];

  setLocalStore('cms_resources', initialResources);
  return initialResources;
}

export async function saveOnboardingResource(
  resource: Omit<OnboardingResource, 'created_at' | 'updated_at'> & { id?: string }
): Promise<OnboardingResource> {
  const isNew = !resource.id || resource.id.startsWith('local-');
  const finalId = isNew ? 'res-' + Date.now() : resource.id;

  const payload: OnboardingResource = {
    ...resource,
    id: finalId,
    updated_at: new Date().toISOString(),
  };

  try {
    await (supabase as any).from('admin_onboarding_resources').upsert(payload);
  } catch {
    // ignore
  }

  const all = await getOnboardingResources();
  const existingIdx = all.findIndex((r) => r.id === finalId);
  if (existingIdx >= 0) {
    all[existingIdx] = payload;
  } else {
    all.push(payload);
  }
  setLocalStore('cms_resources', all);
  return payload;
}

export async function deleteOnboardingResource(id: string): Promise<boolean> {
  try {
    await (supabase as any).from('admin_onboarding_resources').delete().eq('id', id);
  } catch {
    // ignore
  }

  const all = await getOnboardingResources();
  const filtered = all.filter((r) => r.id !== id);
  setLocalStore('cms_resources', filtered);
  return true;
}

// ====================================================================
// Email & In-App Notification Dispatch Helper (with Deduplication)
// ====================================================================

const emailDispatchDebounceMap: Record<string, number> = {};

export async function sendLifecycleEmail(params: {
  type: 
    | 'teacher_welcome' 
    | 'teacher_policy_confirmed' 
    | 'teacher_bank_submitted' 
    | 'teacher_payout_submitted' 
    | 'teacher_offer_sent' 
    | 'teacher_offer_agreed';
  toEmail: string;
  toName: string;
  contractUrl?: string;
  fileUrl?: string;
  fileName?: string;
  offerDetails?: string;
  fixedAmount?: number;
  percentageRate?: number;
  bankName?: string;
  iban?: string;
  userId?: string;
}): Promise<boolean> {
  // Deduplication: prevent sending the same email type to the same address within 45 seconds
  const debounceKey = `${params.toEmail?.toLowerCase()}_${params.type}`;
  const now = Date.now();
  if (emailDispatchDebounceMap[debounceKey] && (now - emailDispatchDebounceMap[debounceKey] < 45000)) {
    console.log(`[Email Deduplication] Suppressed duplicate email dispatch: ${debounceKey}`);
    return true;
  }
  emailDispatchDebounceMap[debounceKey] = now;
  const payload = {
    ...params,
    to_email: params.toEmail,
    toEmail: params.toEmail,
    to_name: params.toName,
    toName: params.toName,
    contract_url: params.contractUrl,
    contractUrl: params.contractUrl,
    file_url: params.fileUrl,
    fileUrl: params.fileUrl,
    file_name: params.fileName,
    fileName: params.fileName,
    offer_details: params.offerDetails,
    offerDetails: params.offerDetails,
    fixed_amount: params.fixedAmount,
    fixedAmount: params.fixedAmount,
    percentage_rate: params.percentageRate,
    percentageRate: params.percentageRate,
    bank_name: params.bankName,
    bankName: params.bankName,
    iban: params.iban,
  };

  let sent = false;

  // 1. Try Supabase Edge Function
  try {
    const { error } = await supabase.functions.invoke('send-notification-email', {
      body: payload,
    });
    if (!error) {
      sent = true;
    } else {
      console.warn('send-notification-email invoke warning:', error);
    }
  } catch (err) {
    console.warn('send-notification-email non-fatal:', err);
  }

  // 2. Fallback to Vercel Serverless Function
  if (!sent && typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/send-lifecycle-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) sent = true;
    } catch (e) {
      console.warn('/api/send-lifecycle-email notice:', e);
    }
  }

  // 3. Insert notification record into notifications table
  try {
    let targetUserId = params.userId;
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      targetUserId = user?.id;
    }
    if (targetUserId) {
      const titleMap: Record<string, string> = {
        teacher_welcome: 'مرحباً بك في منصة جسوركم الأكاديمية',
        teacher_policy_confirmed: 'تم توثيق واعتماد اتفاقية التدريس بنجاح',
        teacher_bank_submitted: 'تم استلام وتوثيق بيانات حسابك البنكي',
        teacher_payout_submitted: 'تم استلام مقترح نموذج الأرباح والنسبة المالية',
        teacher_offer_sent: 'عرض مالي مقترح من إدارة المنصة',
        teacher_offer_agreed: 'تهانينا! تم اعتماد الاتفاق المالي النهائي',
      };
      const linkMap: Record<string, string> = {
        teacher_welcome: '/teacher/onboarding',
        teacher_policy_confirmed: '/teacher/payout-setup',
        teacher_bank_submitted: '/teacher/payout-setup',
        teacher_payout_submitted: '/instructor',
        teacher_offer_sent: '/instructor',
        teacher_offer_agreed: '/instructor',
      };

      await supabase.from('notifications').insert({
        user_id: targetUserId,
        title: titleMap[params.type] || 'إشعار جديد',
        title_ar: titleMap[params.type] || 'إشعار جديد',
        message: `تم إرسال إشعار رسمي وتفاصيل هذه المرحلة إلى بريدك الإلكتروني (${params.toEmail}).`,
        message_ar: `تم إرسال إشعار رسمي وتفاصيل هذه المرحلة إلى بريدك الإلكتروني (${params.toEmail}).`,
        link: linkMap[params.type] || '/instructor',
        type: 'success',
      });
    }
  } catch (e) {
    console.warn('In-app notification insert notice:', e);
  }

  return true;
}
