// Grouping + contextual help texts for the dashboard sidebars (student / instructor / admin)

export type Bilingual = { ar: string; en: string };

export type SidebarGroupDef = {
  id: string;
  label: Bilingual;
  help: Bilingual;
  items: string[];
};

export const ITEM_HELP: Record<string, Bilingual> = {
  // shared
  overview: { ar: 'ملخص سريع لأهم الأرقام والأنشطة في حسابك.', en: 'Quick summary of your key numbers and activity.' },
  settings: { ar: 'تعديل بيانات حسابك وتفضيلاتك.', en: 'Edit your account details and preferences.' },

  // student
  courses: { ar: 'الدورات المسجّل بها ومتابعة الدروس.', en: 'Courses you are enrolled in and lesson access.' },
  assignments: { ar: 'الواجبات المطلوبة منك وتسليمها ومتابعة الدرجات.', en: 'Your assignments, submissions and grades.' },
  progress: { ar: 'نسبة إنجازك في كل دورة والوقت المستغرق.', en: 'Your completion rate per course and time spent.' },
  certificates: { ar: 'الشهادات التي حصلت عليها بعد إتمام الدورات.', en: 'Certificates earned after completing courses.' },
  payments: { ar: 'سجل عمليات الدفع والفواتير الخاصة بك.', en: 'Your payment history and invoices.' },
  request: { ar: 'اطلب دورة مخصصة حسب احتياجك الدراسي.', en: 'Request a custom course tailored to your needs.' },
  'my-requests': { ar: 'متابعة حالة طلباتك والتواصل مع الفريق.', en: 'Track your requests and chat with the team.' },
  achievements: { ar: 'نقاطك وشاراتك ومستواك في المنصة.', en: 'Your points, badges and level on the platform.' },
  planner: { ar: 'نظّم جدولك الدراسي وذكّر نفسك بالمهام.', en: 'Organize your study schedule and reminders.' },
  'support-chat': { ar: 'محادثة مباشرة مع فريق الدعم.', en: 'Live chat with the support team.' },

  // instructor
  'question-bank': { ar: 'أنشئ وخزّن أسئلة قابلة لإعادة الاستخدام في الاختبارات.', en: 'Create and store reusable quiz questions.' },
  students: { ar: 'قائمة الطلاب المسجّلين في دوراتك.', en: 'List of students enrolled in your courses.' },
  'student-engagement': { ar: 'مؤشرات تفاعل الطلاب مع الدروس والواجبات.', en: 'Student engagement metrics for lessons and assignments.' },
  earnings: { ar: 'أرباحك من مبيعات الدورات بالتفصيل.', en: 'Detailed earnings from your course sales.' },
  withdrawals: { ar: 'تقديم طلب سحب أرباحك ومتابعة حالته.', en: 'Request a payout and track its status.' },
  messages: { ar: 'الرسائل بينك وبين طلابك والإدارة.', en: 'Messages between you, your students and the admin.' },
  analytics: { ar: 'تحليلات أداء دوراتك ومبيعاتك.', en: 'Performance and sales analytics for your courses.' },
  'ai-assistant': { ar: 'مساعد ذكي يساعدك في إعداد المحتوى والأسئلة.', en: 'AI assistant to help you build content and questions.' },

  // admin
  users: { ar: 'إدارة جميع الحسابات: الأدوار، الحظر، والحذف.', en: 'Manage all accounts: roles, bans and deletion.' },
  'user-insights': { ar: 'بيانات تفصيلية عن المستخدمين وسلوكهم.', en: 'Detailed data about users and their behaviour.' },
  'instructor-detail': { ar: 'ملف كامل لكل معلم: دوراته وأرباحه وطلابه.', en: 'Full profile per instructor: courses, earnings, students.' },
  'student-detail': { ar: 'ملف كامل لكل طالب: تسجيلاته ومدفوعاته وتقدمه.', en: 'Full profile per student: enrollments, payments, progress.' },
  'course-approvals': { ar: 'مراجعة دورات المعلمين والموافقة عليها قبل النشر.', en: 'Review and approve instructor courses before publishing.' },
  universities: { ar: 'إدارة الجهات التعليمية المسجّلة.', en: 'Manage registered institutions.' },
  colleges: { ar: 'إدارة الكليات التابعة للجهات.', en: 'Manage colleges under each institution.' },
  majors: { ar: 'إدارة التخصصات التابعة للكليات.', en: 'Manage majors under each college.' },
  'students-by-major': { ar: 'توزيع الطلاب حسب التخصص.', en: 'Student distribution by major.' },
  workflow: { ar: 'متابعة سير العمل بين السكرتارية والإنتاج والمعلمين.', en: 'Track workflow between staff, production and instructors.' },
  'video-analytics': { ar: 'إحصائيات مشاهدة الفيديوهات واستهلاك التخزين.', en: 'Video watch statistics and storage usage.' },
  requests: { ar: 'إدارة طلبات الدورات المخصصة وتعيينها.', en: 'Manage and assign custom course requests.' },
  support: { ar: 'الرد على محادثات الدعم والملاحظات الداخلية.', en: 'Reply to support chats and internal notes.' },
  'abandoned-payments': { ar: 'المدفوعات المعلّقة لأكثر من 24 ساعة مع إمكانية التذكير والتصدير.', en: 'Payments pending 24h+ with reminders and export.' },
  'payment-methods': { ar: 'تحكم كامل في طرق الدفع المتاحة لكل دورة.', en: 'Full control of payment methods per course.' },
  'financial-dashboard': { ar: 'المصاريف والإيرادات ومؤشرات الربحية.', en: 'Expenses, revenue and profitability indicators.' },
  accounting: { ar: 'دفتر الحسابات التفصيلي للعمليات المالية.', en: 'Detailed accounting ledger of financial operations.' },
  coupons: { ar: 'إنشاء كوبونات خصم وربطها بدورات محددة.', en: 'Create discount coupons and bind them to courses.' },
  reports: { ar: 'تقارير شاملة قابلة للتصدير.', en: 'Comprehensive exportable reports.' },
  notifications: { ar: 'إرسال إشعارات للمستخدمين ومتابعتها.', en: 'Send and track user notifications.' },
  logs: { ar: 'سجل العمليات والأحداث الأمنية في النظام.', en: 'System operation and security event logs.' },
  'capture-attempts': { ar: 'محاولات تسجيل أو التقاط شاشة الفيديوهات المحمية.', en: 'Screen capture attempts on protected videos.' },
  'instructor-specialties': { ar: 'إدارة تخصصات المعلمين المعتمدة.', en: 'Manage approved instructor specialties.' },
  'instructor-settings': { ar: 'نِسَب العمولة وإعدادات تسجيل المعلمين.', en: 'Commission rates and instructor onboarding settings.' },
  general: { ar: 'الإعدادات العامة للمنصة والسياسات.', en: 'General platform settings and policies.' },
  storage: { ar: 'إدارة مساحة التخزين والملفات.', en: 'Manage storage space and files.' },
  performance: { ar: 'مؤشرات أداء المنصة وسرعتها.', en: 'Platform performance indicators.' },
  chapters: { ar: 'إدارة فصول الدورات ومحتواها.', en: 'Manage course chapters and content.' },
  lessons: { ar: 'إدارة الدروس والفيديوهات والمرفقات.', en: 'Manage lessons, videos and attachments.' },
};

const GROUP = (id: string, ar: string, en: string, helpAr: string, helpEn: string, items: string[]): SidebarGroupDef => ({
  id,
  label: { ar, en },
  help: { ar: helpAr, en: helpEn },
  items,
});

export const STUDENT_GROUPS: SidebarGroupDef[] = [
  GROUP('learning', 'التعلّم', 'Learning', 'كل ما يخص دراستك: الدورات، الواجبات، التقدم والشهادات.', 'Everything about your studies: courses, assignments, progress and certificates.', ['courses', 'assignments', 'progress', 'certificates']),
  GROUP('requests', 'الطلبات والدعم', 'Requests & Support', 'طلب دورات مخصصة والتواصل مع فريق الدعم.', 'Request custom courses and reach the support team.', ['request', 'my-requests', 'support-chat']),
  GROUP('organize', 'الإنجازات والتنظيم', 'Achievements & Planning', 'نقاطك وشاراتك وتنظيم جدولك الدراسي.', 'Your points, badges and study schedule.', ['achievements', 'planner']),
  GROUP('finance', 'المالية', 'Finance', 'مدفوعاتك وفواتيرك.', 'Your payments and invoices.', ['payments']),
];

export const INSTRUCTOR_GROUPS: SidebarGroupDef[] = [
  GROUP('content', 'المحتوى التعليمي', 'Teaching Content', 'إنشاء وإدارة الدورات والواجبات وبنك الأسئلة.', 'Create and manage courses, assignments and the question bank.', ['courses', 'assignments', 'question-bank', 'assigned-requests']),
  GROUP('students', 'الطلاب والتفاعل', 'Students & Engagement', 'متابعة طلابك ومستوى تفاعلهم مع المحتوى.', 'Track your students and their engagement.', ['students', 'student-engagement']),
  GROUP('finance', 'المالية', 'Finance', 'أرباحك من الدورات وطلبات السحب.', 'Your course earnings and payout requests.', ['earnings', 'withdrawals']),
  GROUP('tools', 'الأدوات', 'Tools', 'الرسائل والتحليلات والمساعد الذكي.', 'Messages, analytics and the AI assistant.', ['messages', 'analytics', 'ai-assistant']),
];

export const ADMIN_GROUPS: SidebarGroupDef[] = [
  GROUP('users', 'المستخدمون', 'Users', 'إدارة الحسابات والأدوار وملفات المعلمين والطلاب.', 'Manage accounts, roles and instructor/student profiles.', ['users', 'user-insights', 'instructor-detail', 'student-detail']),
  GROUP('content', 'المحتوى التعليمي', 'Educational Content', 'الدورات والموافقات وإحصائيات الفيديو.', 'Courses, approvals and video statistics.', ['courses', 'course-approvals', 'video-analytics']),
  GROUP('academic', 'الهيكل الأكاديمي', 'Academic Structure', 'الجهات والكليات والتخصصات وتوزيع الطلاب.', 'Institutions, colleges, majors and student distribution.', ['universities', 'colleges', 'majors', 'students-by-major']),
  GROUP('finance', 'المالية', 'Finance', 'المدفوعات وطرق الدفع والمصاريف والسحوبات والكوبونات.', 'Payments, payment methods, expenses, payouts and coupons.', ['payments', 'abandoned-payments', 'payment-methods', 'financial-dashboard', 'accounting', 'withdrawals', 'coupons']),
  GROUP('support', 'الدعم والطلبات', 'Support & Requests', 'طلبات الدورات المخصصة ومحادثات الدعم وسير العمل.', 'Custom course requests, support chats and workflow.', ['requests', 'support', 'workflow']),
  GROUP('analytics', 'التحليلات والتقارير', 'Analytics & Reports', 'التقارير الشاملة والإشعارات.', 'Comprehensive reports and notifications.', ['reports', 'notifications']),
  GROUP('security', 'الأمان والسجلات', 'Security & Logs', 'سجلات النظام ومحاولات التقاط الشاشة.', 'System logs and screen capture attempts.', ['logs', 'capture-attempts']),
  GROUP('settings', 'الإعدادات', 'Settings', 'إعدادات المنصة والمعلمين والتخزين والأداء.', 'Platform, instructor, storage and performance settings.', ['instructor-specialties', 'instructor-settings', 'general', 'storage', 'performance']),
];

export const getGroups = (role: string): SidebarGroupDef[] => {
  if (role === 'admin' || role === 'secretary' || role === 'production') return ADMIN_GROUPS;
  if (role === 'instructor') return INSTRUCTOR_GROUPS;
  return STUDENT_GROUPS;
};
