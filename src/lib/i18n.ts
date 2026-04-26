// نظام الترجمة ثنائي اللغة - Jasorkom

export type Language = 'ar' | 'en';

export const translations = {
  ar: {
    // التنقل
    nav: {
      home: 'الرئيسية',
      courses: 'الكورسات',
      universities: 'الجامعات',
      customCourse: 'اطلب كورس مخصص',
      about: 'عن جسوركم',
      contact: 'تواصل معنا',
      login: 'تسجيل الدخول',
      signup: 'إنشاء حساب',
      dashboard: 'لوحة التحكم',
      logout: 'تسجيل الخروج',
    },
    // الصفحة الرئيسية
    hero: {
      title: 'جسوركم',
      subtitle: 'منصتك التعليمية الذكية',
      description: 'نوفر لك شروحات أكاديمية احترافية لجميع الجامعات المحلية والعالمية، مع إمكانية طلب كورسات مخصصة حسب احتياجاتك',
      cta: 'ابدأ رحلتك التعليمية',
      exploreCourses: 'استكشف الكورسات',
    },
    // الإحصائيات
    stats: {
      students: 'طالب',
      courses: 'كورس',
      universities: 'جامعة',
      instructors: 'مدرس',
    },
    // الميزات
    features: {
      title: 'لماذا جسوركم؟',
      subtitle: 'منصة تعليمية متكاملة مصممة خصيصاً لاحتياجات الطالب السعودي',
      academic: {
        title: 'شروحات أكاديمية',
        description: 'شروحات متخصصة لجميع المقررات الجامعية في السعودية',
      },
      custom: {
        title: 'كورسات مخصصة',
        description: 'اطلب كورس مخصص حسب ملفاتك ومتطلباتك الخاصة',
      },
      live: {
        title: 'بث مباشر',
        description: 'جلسات حية مع المدرسين عبر Zoom و Google Meet',
      },
      payment: {
        title: 'دفع مرن',
        description: 'ادفع بالأقساط عبر Tabby أو بطرق الدفع المختلفة',
      },
      ai: {
        title: 'ذكاء اصطناعي',
        description: 'نستخدم AI لتصنيف المحتوى ومساعدتك في إيجاد ما تحتاجه',
      },
      certificates: {
        title: 'شهادات معتمدة',
        description: 'احصل على شهادات إتمام لجميع الكورسات',
      },
    },
    // الجامعات
    universities: {
      title: 'الجامعات المدعومة',
      subtitle: 'نغطي جميع الجامعات السعودية الكبرى',
    },
    // الكورسات
    courses: {
      title: 'أحدث الكورسات',
      subtitle: 'اكتشف أحدث الشروحات والدورات المتاحة',
      viewAll: 'عرض الكل',
      enroll: 'سجل الآن',
      free: 'مجاني',
      featured: 'مميز',
      hours: 'ساعة',
      lessons: 'درس',
    },
    // الفوتر
    footer: {
      description: 'منصة تعليمية ذكية للطلاب الجامعيين في السعودية',
      quickLinks: 'روابط سريعة',
      support: 'الدعم',
      legal: 'قانوني',
      terms: 'الشروط والأحكام',
      privacy: 'سياسة الخصوصية',
      faq: 'الأسئلة الشائعة',
      copyright: 'جميع الحقوق محفوظة',
    },
    // التسجيل
    auth: {
      login: 'تسجيل الدخول',
      signup: 'إنشاء حساب',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      confirmPassword: 'تأكيد كلمة المرور',
      fullName: 'الاسم الكامل',
      phone: 'رقم الجوال',
      selectRole: 'اختر نوع الحساب',
      student: 'طالب',
      instructor: 'مدرس / محاضر',
      forgotPassword: 'نسيت كلمة المرور؟',
      noAccount: 'ليس لديك حساب؟',
      hasAccount: 'لديك حساب بالفعل؟',
      loginSuccess: 'تم تسجيل الدخول بنجاح',
      signupSuccess: 'تم إنشاء الحساب بنجاح',
    },
    // عام
    common: {
      loading: 'جاري التحميل...',
      error: 'حدث خطأ',
      success: 'تم بنجاح',
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تعديل',
      view: 'عرض',
      search: 'بحث',
      filter: 'تصفية',
      sort: 'ترتيب',
      all: 'الكل',
      more: 'المزيد',
      less: 'أقل',
    },
  },
  en: {
    nav: {
      home: 'Home',
      courses: 'Courses',
      universities: 'Universities',
      customCourse: 'Request Custom Course',
      about: 'About Us',
      contact: 'Contact',
      login: 'Login',
      signup: 'Sign Up',
      dashboard: 'Dashboard',
      logout: 'Logout',
    },
    hero: {
      title: 'Jasorkom',
      subtitle: 'Your Smart Learning Platform',
      description: 'Professional academic explanations for all local and international universities, with the ability to request custom courses tailored to your needs',
      cta: 'Start Your Learning Journey',
      exploreCourses: 'Explore Courses',
    },
    stats: {
      students: 'Students',
      courses: 'Courses',
      universities: 'Universities',
      instructors: 'Instructors',
    },
    features: {
      title: 'Why Jasorkom?',
      subtitle: 'A comprehensive educational platform designed specifically for Saudi students',
      academic: {
        title: 'Academic Explanations',
        description: 'Specialized explanations for all university courses in Saudi Arabia',
      },
      custom: {
        title: 'Custom Courses',
        description: 'Request a custom course based on your files and requirements',
      },
      live: {
        title: 'Live Streaming',
        description: 'Live sessions with instructors via Zoom and Google Meet',
      },
      payment: {
        title: 'Flexible Payment',
        description: 'Pay in installments via Tabby or various payment methods',
      },
      ai: {
        title: 'Artificial Intelligence',
        description: 'We use AI to classify content and help you find what you need',
      },
      certificates: {
        title: 'Certified Certificates',
        description: 'Get completion certificates for all courses',
      },
    },
    universities: {
      title: 'Supported Universities',
      subtitle: 'We cover all major Saudi universities',
    },
    courses: {
      title: 'Latest Courses',
      subtitle: 'Discover the latest available explanations and courses',
      viewAll: 'View All',
      enroll: 'Enroll Now',
      free: 'Free',
      featured: 'Featured',
      hours: 'hours',
      lessons: 'lessons',
    },
    footer: {
      description: 'Smart educational platform for university students in Saudi Arabia',
      quickLinks: 'Quick Links',
      support: 'Support',
      legal: 'Legal',
      terms: 'Terms & Conditions',
      privacy: 'Privacy Policy',
      faq: 'FAQ',
      copyright: 'All rights reserved',
    },
    auth: {
      login: 'Login',
      signup: 'Sign Up',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      fullName: 'Full Name',
      phone: 'Phone Number',
      selectRole: 'Select Account Type',
      student: 'Student',
      instructor: 'Instructor',
      forgotPassword: 'Forgot Password?',
      noAccount: "Don't have an account?",
      hasAccount: 'Already have an account?',
      loginSuccess: 'Successfully logged in',
      signupSuccess: 'Account created successfully',
    },
    common: {
      loading: 'Loading...',
      error: 'An error occurred',
      success: 'Success',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      view: 'View',
      search: 'Search',
      filter: 'Filter',
      sort: 'Sort',
      all: 'All',
      more: 'More',
      less: 'Less',
    },
  },
};

export type TranslationKeys = typeof translations.ar;

export const getTranslation = (lang: Language) => translations[lang];
