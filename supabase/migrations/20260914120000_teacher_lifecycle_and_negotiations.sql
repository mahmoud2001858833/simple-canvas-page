-- ====================================================================
-- Migration: Teacher Lifecycle, Bank Details, Contracts, Payout Negotiations,
--            Onboarding Resources & Accounting Ledger
-- ====================================================================

-- 1. Table: teacher_profiles
CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bio text,
  full_name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  onboarding_status varchar(50) NOT NULL DEFAULT 'registered' 
    CHECK (onboarding_status IN ('registered', 'bank_submitted', 'policy_signed', 'payout_selected', 'active')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Table: teacher_bank_details
CREATE TABLE IF NOT EXISTS public.teacher_bank_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_number varchar(100) NOT NULL,
  iban varchar(50) NOT NULL,
  bank_name varchar(150) NOT NULL,
  branch_name varchar(150),
  swift_code varchar(50),
  verified_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teacher_bank UNIQUE (teacher_id)
);

-- 3. Table: teacher_contracts
CREATE TABLE IF NOT EXISTS public.teacher_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_version varchar(50) NOT NULL DEFAULT 'v1.0',
  signed_name varchar(255) NOT NULL,
  signed_email varchar(255) NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  contract_pdf_url text,
  ip_address varchar(100),
  terms_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Table: teacher_payout_settings
CREATE TABLE IF NOT EXISTS public.teacher_payout_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_type varchar(50) NOT NULL 
    CHECK (requested_type IN ('fixed_per_course', 'percentage', 'hybrid')),
  agreed_type varchar(50) 
    CHECK (agreed_type IS NULL OR agreed_type IN ('fixed_per_course', 'percentage', 'hybrid')),
  fixed_amount numeric(10,2),
  percentage_rate numeric(5,2),
  status varchar(50) NOT NULL DEFAULT 'pending_review' 
    CHECK (status IN ('pending_review', 'offer_sent', 'in_negotiation', 'agreed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teacher_payout_settings UNIQUE (teacher_id)
);

-- 5. Table: payout_negotiations
CREATE TABLE IF NOT EXISTS public.payout_negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type varchar(20) NOT NULL 
    CHECK (sender_type IN ('admin', 'teacher')),
  proposed_fixed numeric(10,2),
  proposed_percentage numeric(5,2),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Table: admin_onboarding_resources
CREATE TABLE IF NOT EXISTS public.admin_onboarding_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(50) NOT NULL 
    CHECK (type IN ('video', 'tip', 'app', 'template')),
  title varchar(255) NOT NULL,
  description text NOT NULL,
  url text,
  badge_tag varchar(100),
  is_visible boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Table: accounting_ledger
CREATE TABLE IF NOT EXISTS public.accounting_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  transaction_type varchar(50) NOT NULL 
    CHECK (transaction_type IN ('accrued_profit', 'payout_processed')),
  amount numeric(10,2) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'paid')),
  payout_rule_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ====================================================================
-- Enable Row Level Security (RLS)
-- ====================================================================

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_onboarding_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_ledger ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role::text = 'admin'
  );
$$;

-- RLS Policies: teacher_profiles
CREATE POLICY "Users can view own teacher profile" 
  ON public.teacher_profiles FOR SELECT 
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can insert own teacher profile" 
  ON public.teacher_profiles FOR INSERT 
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own teacher profile" 
  ON public.teacher_profiles FOR UPDATE 
  USING (auth.uid() = id OR public.is_admin());

-- RLS Policies: teacher_bank_details
CREATE POLICY "Users can view own bank details" 
  ON public.teacher_bank_details FOR SELECT 
  USING (auth.uid() = teacher_id OR public.is_admin());

CREATE POLICY "Users can insert own bank details" 
  ON public.teacher_bank_details FOR INSERT 
  WITH CHECK (auth.uid() = teacher_id OR public.is_admin());

CREATE POLICY "Users can update own bank details" 
  ON public.teacher_bank_details FOR UPDATE 
  USING (auth.uid() = teacher_id OR public.is_admin());

-- RLS Policies: teacher_contracts
CREATE POLICY "Users can view own contracts" 
  ON public.teacher_contracts FOR SELECT 
  USING (auth.uid() = teacher_id OR public.is_admin());

CREATE POLICY "Users can insert own contracts" 
  ON public.teacher_contracts FOR INSERT 
  WITH CHECK (auth.uid() = teacher_id OR public.is_admin());

-- RLS Policies: teacher_payout_settings
CREATE POLICY "Users can view own payout settings" 
  ON public.teacher_payout_settings FOR SELECT 
  USING (auth.uid() = teacher_id OR public.is_admin());

CREATE POLICY "Users can insert own payout settings" 
  ON public.teacher_payout_settings FOR INSERT 
  WITH CHECK (auth.uid() = teacher_id OR public.is_admin());

CREATE POLICY "Users can update own payout settings" 
  ON public.teacher_payout_settings FOR UPDATE 
  USING (auth.uid() = teacher_id OR public.is_admin());

-- RLS Policies: payout_negotiations
CREATE POLICY "Users can view negotiations for their account" 
  ON public.payout_negotiations FOR SELECT 
  USING (auth.uid() = teacher_id OR public.is_admin());

CREATE POLICY "Users can insert negotiations for their account" 
  ON public.payout_negotiations FOR INSERT 
  WITH CHECK (auth.uid() = teacher_id OR public.is_admin());

-- RLS Policies: admin_onboarding_resources
CREATE POLICY "Public and users can view visible resources" 
  ON public.admin_onboarding_resources FOR SELECT 
  USING (is_visible = true OR public.is_admin());

CREATE POLICY "Admins can manage all resources" 
  ON public.admin_onboarding_resources FOR ALL 
  USING (public.is_admin());

-- RLS Policies: accounting_ledger
CREATE POLICY "Teachers can view own ledger entries" 
  ON public.accounting_ledger FOR SELECT 
  USING (auth.uid() = teacher_id OR public.is_admin());

CREATE POLICY "Admins can manage ledger entries" 
  ON public.accounting_ledger FOR ALL 
  USING (public.is_admin());

-- ====================================================================
-- Seed Initial Onboarding Resources
-- ====================================================================

INSERT INTO public.admin_onboarding_resources (type, title, description, url, badge_tag, order_index, is_visible)
VALUES
  -- Videos
  ('video', 'ماذا يميز منصة جسوركم عن باقي المنصات وكيف تستفيد كمعلم؟', 'فيديو تعريفي إلزامي يشرح هوية جسوركم، الميزات التقنية الحصرية، وكيف تحقق أعلى فائدة أكاديمية ومالية كمعلم معتمد.', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'إلزامي ومثبت', 1, true),
  ('video', 'كيفية إعداد بيئة التسجيل وتجهيز المايك والإضاءة', 'دليل عملي لتجهيز استوديو منزلي احترافي: اختيار الميكروفون المناسب، عزل الصوت والصدى، وضبط زوايا الإضاءة لدقة 1080p.', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'جودة الاستوديو', 2, true),
  ('video', 'دليل استخدام قالب الشرح الرسمي لمنصة جسوركم', 'شرح خطوة بخطوة لكيفية استيراد واستخدام قالب جسوركم الرسمي في البوربوينت وGoodNotes لتوحيد الهوية البصرية.', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'الهوية الرسمية', 3, true),

  -- Tips & Guidelines
  ('tip', 'الصوت نصف المحتوى التعليمي', 'استخدم ميكروفوناً خارجياً (Lavalier أو USB Mic احترافي) وسجل في غرفة معزولة تماماً عن الصدى والضوضاء المحيطة.', NULL, 'جودة الصوت', 1, true),
  ('tip', 'قاعدة الـ 10 دقائق (Micro-lessons)', 'قسّم الدروس الطويلة إلى وحدات مصغرة تتراوح بين 7 إلى 12 دقيقة لضمان أقصى درجات التركيز واستيعاب الطالب.', NULL, 'هيكلة الدرس', 2, true),
  ('tip', 'التفاعل العملي وحل المشكلات', 'ابدأ كل درس بمشكلة أو سؤال واقعي محفز، وانهِه بمسألة تدريبية تحلها مع الطالب خطوة بخطوة لترسيخ المفاهيم.', NULL, 'بيداغوجيا الشرح', 3, true),
  ('tip', 'العلامة البصرية والالتزام بالقالب', 'افتح دائماً قالب جسوركم الرسمي المعتمد واستخدم ألوان الهوية المؤسسية لضمان التناسق البصري لكافة مواد المنصة.', NULL, 'الهوية البصرية', 4, true),

  -- Recommended Apps
  ('app', 'GoodNotes / Notability', 'أفضل تطبيق لتدوين الملاحظات والشرح اليدوي التفاعلي مع دعم كامل لملفات PDF والشرائح وأقلام الآيباد.', 'https://www.goodnotes.com/', 'الشرح التفاعلي', 1, true),
  ('app', 'Microsoft OneNote & OpenBoard', 'لوحة بيضاء تفاعلية تدعم شاشات اللمس والتابلت وأجهزة الويندوز والماك مع إمكانية الرسم والتخطيط المباشر.', 'https://openboard.ch/', 'السبورة التفاعلية', 2, true),
  ('app', 'OBS Studio', 'البرنامج المعياري الاحترافي المفتوح المصدر لتسجيل الشاشة ودمج الكاميرا بدقة فائقة 1080p/60fps وإعدادات صوت احترافية.', 'https://obsproject.com/', 'تسجيل الشاشة', 3, true),
  ('app', 'Canva Education', 'أداة سحابية رائدة لتصميم شرائح العرض التعليمية وتنسيق المخططات البيانية والجداول التوضيحية بسهولة وسرعة.', 'https://www.canva.com/', 'تصميم الشرائح', 4, true),

  -- Official Template
  ('template', 'قالب الشرح الرسمي لمنصة جسوركم (Josoorcom Official Teaching Template)', 'القالب المؤسسي المعتمد لشرائح العرض التعليمية بالألوان الرسمية ونسب الأبعاد الفنية (16:9). بصيغة جاهزة للاستخدام الفوري.', '/templates/josoorcom-lecture-template.pptx', 'قالب رسمي معتمد', 1, true)
ON CONFLICT DO NOTHING;
