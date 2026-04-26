-- ====================================
-- منصة جسوركم - Jasorkom Platform
-- قاعدة البيانات الشاملة - المرحلة 1
-- ====================================

-- 1. إنشاء Enum لأنواع المستخدمين
CREATE TYPE public.user_role AS ENUM ('student', 'instructor', 'secretary', 'production', 'admin');

-- 2. إنشاء Enum لحالة المهام
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'delayed', 'urgent', 'completed');

-- 3. إنشاء Enum لطريقة التقديم
CREATE TYPE public.delivery_method AS ENUM ('zoom_live', 'meet_live', 'recorded');

-- 4. إنشاء Enum لحالة الدفع
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'partial', 'failed', 'refunded');

-- 5. إنشاء Enum لطريقة الدفع
CREATE TYPE public.payment_method AS ENUM ('online', 'tabby', 'bank_transfer', 'manual');

-- ====================================
-- جدول الملفات الشخصية
-- ====================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    full_name_ar TEXT,
    phone TEXT,
    avatar_url TEXT,
    preferred_language TEXT DEFAULT 'ar',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ====================================
-- جدول الأدوار (منفصل للأمان)
-- ====================================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- دالة للتحقق من الدور
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- دالة للحصول على دور المستخدم
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1
$$;

CREATE POLICY "Users can view own role" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ====================================
-- جدول الجامعات
-- ====================================
CREATE TABLE public.universities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    logo_url TEXT,
    country TEXT DEFAULT 'السعودية',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view universities" ON public.universities
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage universities" ON public.universities
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ====================================
-- جدول الكليات
-- ====================================
CREATE TABLE public.colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view colleges" ON public.colleges
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage colleges" ON public.colleges
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ====================================
-- جدول التخصصات
-- ====================================
CREATE TABLE public.majors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID REFERENCES public.colleges(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.majors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view majors" ON public.majors
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage majors" ON public.majors
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ====================================
-- جدول المقررات/الكورسات
-- ====================================
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    major_id UUID REFERENCES public.majors(id) ON DELETE SET NULL,
    instructor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    description TEXT,
    description_ar TEXT,
    thumbnail_url TEXT,
    price DECIMAL(10, 2) DEFAULT 0,
    original_price DECIMAL(10, 2),
    duration_hours INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active courses" ON public.courses
    FOR SELECT USING (is_active = true);

CREATE POLICY "Instructors can manage own courses" ON public.courses
    FOR ALL USING (instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ====================================
-- جدول التسجيلات/الاشتراكات (يجب قبل lessons)
-- ====================================
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'active',
    progress INTEGER DEFAULT 0,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE (user_id, course_id)
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enrollments" ON public.enrollments
    FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert enrollments" ON public.enrollments
    FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- ====================================
-- جدول الدروس
-- ====================================
CREATE TABLE public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    duration_minutes INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_preview BOOLEAN DEFAULT false,
    is_live BOOLEAN DEFAULT false,
    live_date TIMESTAMPTZ,
    live_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enrolled users can view lessons" ON public.lessons
    FOR SELECT USING (
        is_preview = true OR
        EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.course_id = lessons.course_id
            AND e.user_id = auth.uid()
            AND e.status = 'active'
        ) OR
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'instructor')
    );

-- ====================================
-- جدول طلبات الكورسات المخصصة
-- ====================================
CREATE TABLE public.custom_course_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    delivery_method delivery_method NOT NULL,
    status task_status DEFAULT 'pending',
    assigned_secretary_id UUID REFERENCES auth.users(id),
    assigned_production_id UUID REFERENCES auth.users(id),
    assigned_instructor_id UUID REFERENCES auth.users(id),
    estimated_price DECIMAL(10, 2),
    final_price DECIMAL(10, 2),
    deadline TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.custom_course_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests" ON public.custom_course_requests
    FOR SELECT USING (
        user_id = auth.uid() OR
        assigned_secretary_id = auth.uid() OR
        assigned_production_id = auth.uid() OR
        assigned_instructor_id = auth.uid() OR
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'secretary')
    );

CREATE POLICY "Users can create requests" ON public.custom_course_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can update requests" ON public.custom_course_requests
    FOR UPDATE USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'secretary') OR
        assigned_production_id = auth.uid() OR
        assigned_instructor_id = auth.uid()
    );

-- ====================================
-- جدول ملفات الطلبات المخصصة
-- ====================================
CREATE TABLE public.request_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.custom_course_requests(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    ai_classification JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.request_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view request files" ON public.request_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.custom_course_requests r
            WHERE r.id = request_files.request_id
            AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
        )
    );

CREATE POLICY "Users can insert request files" ON public.request_files
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.custom_course_requests r
            WHERE r.id = request_files.request_id
            AND r.user_id = auth.uid()
        )
    );

-- ====================================
-- جدول المدفوعات
-- ====================================
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id),
    request_id UUID REFERENCES public.custom_course_requests(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method payment_method NOT NULL,
    status payment_status DEFAULT 'pending',
    transaction_id TEXT,
    tabby_payment_id TEXT,
    installment_plan JSONB,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage payments" ON public.payments
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own payments" ON public.payments
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- ====================================
-- جدول الإشعارات
-- ====================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    title_ar TEXT,
    message TEXT NOT NULL,
    message_ar TEXT,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- ====================================
-- جدول الرسائل
-- ====================================
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.messages
    FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT WITH CHECK (sender_id = auth.uid());

-- ====================================
-- جدول سجل التقدم
-- ====================================
CREATE TABLE public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
    progress_percent INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    last_position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, lesson_id)
);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress" ON public.lesson_progress
    FOR ALL USING (user_id = auth.uid());

-- ====================================
-- جدول الشهادات
-- ====================================
CREATE TABLE public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    certificate_number TEXT UNIQUE NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    pdf_url TEXT
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own certificates" ON public.certificates
    FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ====================================
-- جدول أرباح المدرسين
-- ====================================
CREATE TABLE public.instructor_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id),
    amount DECIMAL(10, 2) NOT NULL,
    commission_rate DECIMAL(5, 2) DEFAULT 30.00,
    status TEXT DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.instructor_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can view own earnings" ON public.instructor_earnings
    FOR SELECT USING (instructor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ====================================
-- Trigger لتحديث updated_at
-- ====================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON public.courses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_universities_updated_at
    BEFORE UPDATE ON public.universities
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_requests_updated_at
    BEFORE UPDATE ON public.custom_course_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================
-- Trigger لإنشاء Profile و Role تلقائياً
-- ====================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
        NEW.id,
        COALESCE(
            (NEW.raw_user_meta_data->>'role')::user_role,
            'student'
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================
-- إضافة بيانات أولية للجامعات السعودية
-- ====================================
INSERT INTO public.universities (name, name_ar, logo_url) VALUES
('King Saud University', 'جامعة الملك سعود', NULL),
('King Abdulaziz University', 'جامعة الملك عبدالعزيز', NULL),
('King Fahd University', 'جامعة الملك فهد للبترول والمعادن', NULL),
('Imam Muhammad University', 'جامعة الإمام محمد بن سعود', NULL),
('Princess Nourah University', 'جامعة الأميرة نورة', NULL),
('Umm Al-Qura University', 'جامعة أم القرى', NULL),
('King Khalid University', 'جامعة الملك خالد', NULL),
('Taibah University', 'جامعة طيبة', NULL),
('Qassim University', 'جامعة القصيم', NULL),
('Taif University', 'جامعة الطائف', NULL);