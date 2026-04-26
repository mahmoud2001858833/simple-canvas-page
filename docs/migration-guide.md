# 🚀 خطة نقل المنصة الكاملة - دليل تفصيلي

## 📋 ملخص المنصة الحالية

| المكون | التقنية الحالية | الوظيفة |
|--------|----------------|---------|
| الواجهة (Frontend) | React + Vite + TypeScript | موقع الويب |
| قاعدة البيانات | PostgreSQL (Supabase) | تخزين البيانات |
| المصادقة | Supabase Auth | تسجيل الدخول |
| التخزين | Supabase Storage + Cloudflare R2 | ملفات + فيديوهات |
| الدوال الخلفية | Supabase Edge Functions (Deno) | منطق الأعمال |
| بوابة الدفع | PayTabs + Alinma Pay | المدفوعات |
| البريد | Resend | إرسال الإيميلات |
| CDN الفيديو | Cloudflare R2 + Bunny CDN | بث الفيديوهات |

---

## 🖥️ مواصفات السيرفر المطلوب لـ 5000 طالب

### الخيار 1: سيرفرات مُدارة (Managed - موصى به)

#### أ. قاعدة البيانات (PostgreSQL)
| المواصفة | القيمة | السبب |
|----------|--------|-------|
| RAM | 8 GB كحد أدنى | لتخزين الاستعلامات المتكررة في الذاكرة |
| CPU | 4 vCPU | لمعالجة الطلبات المتزامنة |
| تخزين SSD | 100 GB NVMe | سرعة القراءة/الكتابة |
| النسخ الاحتياطي | يومي تلقائي | حماية البيانات |
| الموقع | أوروبا أو الشرق الأوسط | أقل تأخير للمستخدمين |

**الخيارات المتاحة:**

| الخدمة | الخطة | التكلفة/شهر | المميزات |
|--------|-------|------------|----------|
| **Supabase Pro** (الأسهل) | Pro Plan | $25 | نفس التقنية، أسهل نقل، Auth + Storage + Functions مدمجة |
| **DigitalOcean Managed DB** | db-s-4vcpu-8gb | $100 | إدارة تلقائية، نسخ احتياطي |
| **AWS RDS** | db.m5.large | $140 | موثوقية عالية، قابل للتوسع |
| **Hetzner Cloud** | CCX23 + PostgreSQL | $45 | أرخص، أداء ممتاز |

#### ب. سيرفر الواجهة (Frontend Hosting)
| الخدمة | التكلفة/شهر | المميزات |
|--------|------------|----------|
| **Vercel** (الحالي) | مجاني - $20 | CDN عالمي، Deploy تلقائي من GitHub |
| **Netlify** | مجاني - $19 | بديل ممتاز |
| **Cloudflare Pages** | مجاني | سريع جداً، CDN مدمج |

#### ج. تخزين الفيديوهات والملفات
| الخدمة | التكلفة | المميزات |
|--------|---------|----------|
| **Cloudflare R2** (الحالي) | $0.015/GB/شهر | بدون رسوم خروج (Egress) |
| **Bunny Storage** (الحالي) | $0.01/GB/شهر | CDN سريع مدمج |
| **AWS S3** | $0.023/GB/شهر | الأكثر موثوقية |

### الخيار 2: سيرفر VPS خاص (أرخص لكن يحتاج خبرة)

| المواصفة | القيمة |
|----------|--------|
| RAM | 16 GB |
| CPU | 8 vCPU |
| تخزين | 200 GB NVMe SSD |
| النظام | Ubuntu 22.04 LTS |
| Bandwidth | 10 TB/شهر |

**الخدمات المقترحة:**

| الخدمة | التكلفة/شهر |
|--------|------------|
| **Hetzner** CPX41 | ~$30 |
| **DigitalOcean** Premium Droplet | ~$48 |
| **Contabo** VPS L | ~$15 |

**البرامج المطلوبة على VPS:**
- Nginx (Reverse Proxy + Static Files)
- PostgreSQL 15+
- Node.js 18+ (للـ API)
- Redis (للتخزين المؤقت - اختياري)
- Certbot (SSL مجاني)
- PM2 (إدارة العمليات)

---

## 📊 حسابات السعة لـ 5000 طالب

### قاعدة البيانات
```
- عدد الجداول: ~30 جدول
- حجم البيانات المتوقع: ~5-10 GB
- الاتصالات المتزامنة: ~500-1000 (10-20% من الطلاب)
- الاستعلامات/ثانية: ~200-500
```

### التخزين
```
- متوسط حجم فيديو: 500 MB
- عدد الفيديوهات المتوقع: 200-500
- إجمالي التخزين: 100-250 GB
- الملفات الأخرى (PDF, صور): ~10 GB
```

### الباندويث
```
- متوسط المشاهدة/طالب: 2 ساعة/يوم
- Bitrate متوسط: 2 Mbps
- الباندويث اليومي: 5000 × 2h × 0.9GB/h × 20% = ~1.8 TB/يوم
- الباندويث الشهري: ~20-50 TB
ملاحظة: هذا هو السبب في استخدام CDN (Cloudflare R2) وليس السيرفر المباشر
```

### التكلفة الشهرية المتوقعة

| البند | التكلفة (الخيار المُدار) | التكلفة (VPS) |
|-------|------------------------|---------------|
| قاعدة البيانات | $25-140 | $0 (مثبت على VPS) |
| الواجهة | $0-20 | $0 (مثبت على VPS) |
| تخزين الفيديو (R2) | $2-4 | $2-4 |
| CDN الفيديو | $0 (R2 مجاني) | $0 |
| VPS | - | $15-48 |
| الدومين | $10-15/سنة | $10-15/سنة |
| SSL | مجاني | مجاني (Let's Encrypt) |
| **الإجمالي** | **$27-165/شهر** | **$17-53/شهر** |

---

## 📝 خطوات النقل التفصيلية

### المرحلة 1: التحضير (يوم 1-2)

#### الخطوة 1.1: تصدير الكود من GitHub
```bash
# 1. استنساخ المشروع
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# 2. تثبيت التبعيات
npm install

# 3. بناء المشروع للتأكد من عدم وجود أخطاء
npm run build
```

#### الخطوة 1.2: توثيق المتغيرات البيئية المطلوبة
أنشئ ملف `.env.production` على السيرفر الجديد:
```env
# Supabase/Database Connection
VITE_SUPABASE_URL=https://YOUR_NEW_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_NEW_ANON_KEY

# سيتم ملؤها بعد إنشاء المشروع الجديد
```

#### الخطوة 1.3: قائمة الأسرار (Secrets) المطلوبة
هذه الأسرار تحتاج نقلها للسيرفر الجديد:
```
1. PAYTABS_PROFILE_ID - معرف حساب PayTabs
2. PAYTABS_SERVER_KEY - مفتاح سيرفر PayTabs
3. ALINMA_MERCHANT_ID - معرف تاجر الإنماء
4. ALINMA_MERCHANT_KEY - مفتاح تاجر الإنماء
5. ALINMA_TERMINAL_ID - معرف طرفية الإنماء
6. ALINMA_TERMINAL_PASSWORD - كلمة مرور الطرفية
7. RESEND_API_KEY - مفتاح API لخدمة البريد
8. BUNNY_STORAGE_PASSWORD - كلمة مرور Bunny Storage
9. BUNNY_STORAGE_HOST - عنوان Bunny Storage
10. BUNNY_STORAGE_USERNAME - اسم مستخدم Bunny
11. BUNNY_TOKEN_KEY - مفتاح توكن Bunny
12. BUNNY_CDN_BASE_URL - عنوان CDN
13. GOOGLE_AI_API_KEY - مفتاح Google AI
```

---

### المرحلة 2: إنشاء قاعدة البيانات الجديدة (يوم 2-3)

#### الخيار أ: استخدام Supabase مستقل (الأسهل والأسرع)

##### الخطوة 2.1: إنشاء مشروع Supabase جديد
1. اذهب لـ https://supabase.com/dashboard
2. أنشئ حساب جديد أو سجل دخول
3. اضغط "New Project"
4. اختر:
   - Organization: أنشئ منظمة جديدة
   - Project Name: اسم المنصة
   - Database Password: كلمة مرور قوية (احفظها!)
   - Region: أقرب منطقة (eu-central-1 لأوروبا أو me-south-1 للشرق الأوسط)
5. انتظر حتى يتم إنشاء المشروع (2-3 دقائق)

##### الخطوة 2.2: تشغيل ملفات الـ Migration
1. في لوحة Supabase الجديدة، اذهب لـ **SQL Editor**
2. افتح ملفات المهاجرة من المجلد `supabase/migrations/` بالترتيب الزمني
3. شغّل كل ملف بالترتيب:
```
ملف 1: 20240101000000_initial_schema.sql
ملف 2: 20240102000000_add_chapters.sql
... وهكذا بالترتيب
```

**مهم جداً:** شغّل الملفات بالترتيب! كل ملف يعتمد على الملف السابق.

##### الخطوة 2.3: إنشاء الـ Database Functions
شغّل في SQL Editor:
```sql
-- كل الـ Functions موجودة في ملفات الـ migration
-- تأكد من تشغيلها جميعاً
-- تشمل: handle_new_user, has_role, get_user_role, validate_coupon, etc.
```

##### الخطوة 2.4: إعداد المصادقة (Authentication)
1. في لوحة Supabase → Authentication → Settings
2. فعّل Email/Password
3. **لا تفعّل** Auto-confirm (يجب على المستخدم تأكيد إيميله)
4. اضبط Redirect URLs لتشمل الدومين الجديد

##### الخطوة 2.5: إنشاء Storage Buckets
```sql
-- في SQL Editor
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('request-files', 'request-files', false),
  ('course-videos', 'course-videos', false),
  ('chat-images', 'chat-images', true),
  ('temp-uploads', 'temp-uploads', false),
  ('lesson-files', 'lesson-files', true);
```

##### الخطوة 2.6: إعداد الأسرار (Secrets)
في لوحة Supabase → Edge Functions → Secrets:
أضف كل الأسرار المذكورة في الخطوة 1.3

---

#### الخيار ب: استخدام VPS + PostgreSQL (أرخص، يحتاج خبرة)

##### الخطوة 2.1: إعداد السيرفر
```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت PostgreSQL 15
sudo apt install postgresql-15 postgresql-client-15 -y

# تثبيت Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# تثبيت Nginx
sudo apt install nginx -y

# تثبيت Certbot لـ SSL
sudo apt install certbot python3-certbot-nginx -y

# تثبيت PM2 لإدارة العمليات
sudo npm install -g pm2
```

##### الخطوة 2.2: إعداد PostgreSQL
```bash
# تسجيل الدخول كـ postgres
sudo -u postgres psql

# إنشاء قاعدة البيانات والمستخدم
CREATE DATABASE platform_db;
CREATE USER platform_user WITH ENCRYPTED PASSWORD 'كلمة_مرور_قوية_جداً';
GRANT ALL PRIVILEGES ON DATABASE platform_db TO platform_user;

# تفعيل الإضافات المطلوبة
\c platform_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
\q
```

##### الخطوة 2.3: تشغيل ملفات الـ Migration
```bash
# تشغيل كل ملفات المهاجرة بالترتيب
for f in supabase/migrations/*.sql; do
  psql -U platform_user -d platform_db -f "$f"
done
```

##### الخطوة 2.4: تحويل Edge Functions لـ Node.js API
**هذا هو الجزء الأصعب!** يجب تحويل كل Edge Function من Deno إلى Node.js.

مثال - تحويل `create-paytabs-payment`:
```javascript
// قبل (Deno - Edge Function)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// بعد (Node.js - Express)
const express = require('express');
const router = express.Router();

router.post('/create-paytabs-payment', async (req, res) => {
  // نفس المنطق مع تعديلات بسيطة
});
```

**قائمة الـ Edge Functions التي تحتاج تحويل:**
```
1. ai-assistant - المساعد الذكي
2. create-paytabs-payment - إنشاء دفعة PayTabs
3. payment-webhook - استقبال إشعارات الدفع
4. create-tabby-session - إنشاء جلسة Tabby
5. create-alinma-payment - إنشاء دفعة الإنماء
6. alinma-webhook - إشعارات الإنماء
7. send-email-otp - إرسال رمز التحقق
8. verify-email-otp - التحقق من الرمز
9. send-password-reset-otp - إرسال رمز إعادة كلمة المرور
10. reset-password-with-otp - إعادة تعيين كلمة المرور
11. get-signed-video-url - رابط فيديو موقّع
12. get-storage-stats - إحصائيات التخزين
13. upload-to-r2 - رفع للـ R2
14. upload-video-r2 - رفع فيديو للـ R2
15. r2-multipart - رفع متعدد الأجزاء
16. upload-to-bunny - رفع لـ Bunny
17. check-deadlines - فحص المواعيد
18. analyze-request-files - تحليل ملفات الطلبات
19. download-request-files-zip - تحميل ملفات كـ ZIP
20. generate-course-image - إنشاء صورة كورس
21. send-notification-email - إرسال إيميل إشعار
22. get-bunny-video-url - رابط فيديو Bunny
```

---

### المرحلة 3: نقل البيانات (يوم 3-4)

#### الخطوة 3.1: تصدير البيانات من القاعدة الحالية

من Lovable Cloud → Database → Tables → Export لكل جدول:

**ترتيب التصدير (مهم بسبب العلاقات):**
```
1. universities (الجامعات)
2. colleges (الكليات)
3. majors (التخصصات)
4. profiles (المستخدمين) ⚠️
5. user_roles (الأدوار)
6. courses (الكورسات)
7. chapters (الفصول)
8. lessons (الدروس)
9. lesson_attachments (مرفقات الدروس)
10. chapter_files (ملفات الفصول)
11. quizzes (الاختبارات)
12. quiz_questions (أسئلة الاختبارات)
13. quiz_options (خيارات الأسئلة)
14. enrollments (التسجيلات)
15. payments (المدفوعات)
16. lesson_progress (تقدم الدروس)
17. certificates (الشهادات)
18. notifications (الإشعارات)
19. custom_course_requests (الطلبات المخصصة)
20. request_messages (رسائل الطلبات)
21. request_files (ملفات الطلبات)
22. messages (الرسائل)
23. course_reviews (التقييمات)
24. coupons (الكوبونات)
25. coupon_usage (استخدام الكوبونات)
26. instructor_earnings (أرباح المدرسين)
27. withdrawal_requests (طلبات السحب)
28. device_sessions (جلسات الأجهزة)
29. platform_settings (إعدادات المنصة)
30. support_chats (محادثات الدعم)
31. support_messages (رسائل الدعم)
```

#### الخطوة 3.2: استيراد البيانات

##### لـ Supabase المستقل:
1. في SQL Editor، استخدم `COPY` أو Import CSV
2. أو استخدم Supabase CLI:
```bash
# تثبيت Supabase CLI
npm install -g supabase

# ربط المشروع الجديد
supabase link --project-ref YOUR_NEW_PROJECT_REF

# استيراد البيانات
psql postgres://postgres:PASSWORD@db.YOUR_REF.supabase.co:5432/postgres \
  -c "\COPY universities FROM 'universities.csv' WITH CSV HEADER"
```

##### لـ VPS + PostgreSQL:
```bash
# استيراد كل ملف CSV
psql -U platform_user -d platform_db \
  -c "\COPY universities FROM 'universities.csv' WITH CSV HEADER"

# كرر لكل جدول بالترتيب
```

#### الخطوة 3.3: نقل المستخدمين (⚠️ الجزء الأهم)

**مشكلة:** كلمات المرور مشفرة في Supabase Auth ولا يمكن تصديرها مباشرة.

**الحلول:**

1. **إذا استخدمت Supabase مستقل:**
   - استخدم Supabase Migration Tool لنقل auth.users
   - أو اطلب من المستخدمين إعادة تعيين كلمات المرور

2. **إذا استخدمت VPS:**
   - يجب بناء نظام مصادقة جديد
   - أرسل إيميل لكل المستخدمين لإعادة تعيين كلمات المرور
   - أو استخدم مكتبة مثل `passport.js` أو `lucia-auth`

#### الخطوة 3.4: نقل ملفات التخزين
```bash
# تحميل الملفات من Storage الحالي
# الملفات في Buckets: request-files, course-videos, chat-images, lesson-files, temp-uploads

# إذا Supabase مستقل - رفعها للـ Storage الجديد
# إذا VPS - رفعها لمجلد على السيرفر أو S3/R2
```

**ملاحظة:** الفيديوهات موجودة أصلاً على Cloudflare R2 وBunny CDN، فلا تحتاج نقل!

---

### المرحلة 4: تعديل الكود (يوم 4-5)

#### الخطوة 4.1: تحديث ملف الاتصال
```typescript
// src/integrations/supabase/client.ts
// تغيير URL و Key للمشروع الجديد
const SUPABASE_URL = "https://YOUR_NEW_PROJECT.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "YOUR_NEW_ANON_KEY";
```

#### الخطوة 4.2: تحديث ملف البيئة
```env
VITE_SUPABASE_URL=https://YOUR_NEW_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_NEW_ANON_KEY
VITE_SUPABASE_PROJECT_ID=YOUR_NEW_PROJECT_ID
```

#### الخطوة 4.3: تحديث Webhook URLs
في لوحة PayTabs:
```
Webhook URL: https://YOUR_NEW_DOMAIN/functions/v1/payment-webhook
```

في لوحة Alinma:
```
Webhook URL: https://YOUR_NEW_DOMAIN/functions/v1/alinma-webhook
```

#### الخطوة 4.4: تحديث vercel.json (إذا كنت على Vercel)
```json
{
  "rewrites": [
    {
      "source": "/functions/v1/alinma-webhook",
      "destination": "https://YOUR_NEW_PROJECT.supabase.co/functions/v1/alinma-webhook"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

### المرحلة 5: نشر Edge Functions (يوم 5-6)

#### إذا Supabase مستقل:
```bash
# تثبيت Supabase CLI
npm install -g supabase

# تسجيل الدخول
supabase login

# ربط المشروع
supabase link --project-ref YOUR_NEW_REF

# نشر كل الـ Functions
supabase functions deploy ai-assistant
supabase functions deploy create-paytabs-payment
supabase functions deploy payment-webhook
supabase functions deploy create-alinma-payment
supabase functions deploy alinma-webhook
supabase functions deploy send-email-otp
supabase functions deploy verify-email-otp
supabase functions deploy send-password-reset-otp
supabase functions deploy reset-password-with-otp
supabase functions deploy get-signed-video-url
supabase functions deploy get-storage-stats
supabase functions deploy upload-to-r2
supabase functions deploy r2-multipart
supabase functions deploy upload-to-bunny
supabase functions deploy check-deadlines
supabase functions deploy analyze-request-files
supabase functions deploy download-request-files-zip
supabase functions deploy generate-course-image
supabase functions deploy send-notification-email
supabase functions deploy get-bunny-video-url
supabase functions deploy create-tabby-session

# إعداد الأسرار
supabase secrets set PAYTABS_PROFILE_ID=xxx
supabase secrets set PAYTABS_SERVER_KEY=xxx
# ... كل الأسرار الأخرى
```

---

### المرحلة 6: النشر والاختبار (يوم 6-7)

#### الخطوة 6.1: بناء ونشر الواجهة
```bash
# بناء المشروع
npm run build

# نشر على Vercel
npx vercel --prod

# أو نشر على Nginx (VPS)
sudo cp -r dist/* /var/www/html/
```

#### الخطوة 6.2: إعداد Nginx (لو VPS)
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    root /var/www/html;
    index index.html;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

```bash
# تفعيل SSL
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### الخطوة 6.3: قائمة الاختبارات
```
✅ التسجيل وإنشاء حساب جديد
✅ تسجيل الدخول
✅ التحقق من البريد الإلكتروني
✅ إعادة تعيين كلمة المرور
✅ عرض الكورسات
✅ التسجيل في كورس
✅ الدفع عبر PayTabs
✅ الدفع عبر الإنماء
✅ مشاهدة الفيديوهات
✅ تحميل الملفات
✅ لوحة الأدمن
✅ لوحة المدرس
✅ لوحة الطالب
✅ الاختبارات (Quizzes)
✅ الشهادات
✅ الإشعارات
✅ محادثات الدعم
✅ الطلبات المخصصة
✅ الكوبونات
✅ رفع الفيديوهات (Instructor)
✅ حماية تسجيل الشاشة
✅ المساعد الذكي
```

---

### المرحلة 7: ربط الدومين (يوم 7)

#### الخطوة 7.1: شراء/نقل الدومين
1. اشترِ دومين من Namecheap أو GoDaddy أو Cloudflare
2. اضبط DNS Records:
```
A Record: @ → IP_السيرفر
CNAME: www → yourdomain.com
```

#### الخطوة 7.2: إذا Vercel
1. في لوحة Vercel → Settings → Domains
2. أضف الدومين واتبع التعليمات

---

## 🔒 إعدادات الأمان بعد النقل

### 1. جدار الحماية (Firewall)
```bash
# السماح فقط بالمنافذ المطلوبة
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 2. النسخ الاحتياطي التلقائي
```bash
# إنشاء سكريبت نسخ احتياطي
cat > /opt/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U platform_user platform_db > /opt/backups/db_$DATE.sql
# حذف النسخ الأقدم من 30 يوم
find /opt/backups -type f -mtime +30 -delete
EOF

chmod +x /opt/backup.sh

# جدولة النسخ الاحتياطي كل 6 ساعات
crontab -e
# 0 */6 * * * /opt/backup.sh
```

### 3. مراقبة الأداء
```bash
# تثبيت أدوات المراقبة
sudo apt install htop iotop -y

# أو استخدام خدمة مراقبة مثل:
# - UptimeRobot (مجاني) - مراقبة التوفر
# - Netdata (مجاني) - مراقبة الأداء
# - Datadog (مدفوع) - مراقبة شاملة
```

---

## ⏱️ الجدول الزمني الكامل

| اليوم | المهمة | المدة |
|-------|--------|-------|
| 1-2 | تحضير وتصدير الكود والبيانات | 2 يوم |
| 2-3 | إنشاء قاعدة البيانات والجداول | 1-2 يوم |
| 3-4 | نقل البيانات والمستخدمين | 1-2 يوم |
| 4-5 | تعديل الكود والإعدادات | 1-2 يوم |
| 5-6 | نشر Edge Functions | 1 يوم |
| 6-7 | الاختبار الشامل | 1-2 يوم |
| 7 | ربط الدومين والإطلاق | 1 يوم |
| **الإجمالي** | | **7-10 أيام** |

---

## ✅ التوصية النهائية

### للشركة التي تريد أسهل وأسرع حل:
```
1. Supabase Pro ($25/شهر) → قاعدة بيانات + Auth + Functions + Storage
2. Vercel Pro ($20/شهر) → استضافة الواجهة
3. Cloudflare R2 (الحالي) → الفيديوهات
4. Resend ($0-20/شهر) → البريد

💰 الإجمالي: $45-65/شهر
⏱️ وقت النقل: 5-7 أيام
👨‍💻 يحتاج: مطور واحد متوسط الخبرة
```

### للشركة التي تريد أرخص حل:
```
1. Hetzner VPS ($30/شهر) → كل شيء على سيرفر واحد
2. Cloudflare R2 → الفيديوهات
3. Resend → البريد

💰 الإجمالي: $30-35/شهر
⏱️ وقت النقل: 10-14 يوم (يحتاج تحويل Edge Functions)
👨‍💻 يحتاج: مطور خبير في DevOps
```

---

## ❓ أسئلة شائعة

**س: هل أفقد البيانات أثناء النقل؟**
ج: لا، إذا اتبعت الخطوات بالترتيب. يُنصح بإجراء النقل في وقت قليل الاستخدام (مثلاً 2 صباحاً).

**س: هل يتوقف الموقع أثناء النقل؟**
ج: يمكن إجراء النقل بدون توقف (Zero Downtime) عبر تشغيل الموقعين معاً ثم تحويل DNS.

**س: هل يمكن الرجوع إذا حصلت مشكلة؟**
ج: نعم، الموقع الأصلي يبقى شغّال حتى تتأكد من نجاح النقل.

**س: هل أقدر أستمر بالتطوير عبر Lovable؟**
ج: نعم! طالما الكود على GitHub، تقدر تعدل عبر Lovable. بس التعديلات على قاعدة البيانات تكون يدوية على السيرفر الجديد.
