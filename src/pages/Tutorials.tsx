import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Users, PlayCircle } from 'lucide-react';

import studentSignup from '@/assets/tutorials/student-signup.mov.asset.json';
import buyCourses from '@/assets/tutorials/buy-courses.mov.asset.json';
import trackLearning from '@/assets/tutorials/track-learning.mov.asset.json';
import instructorSignup from '@/assets/tutorials/instructor-signup.mov.asset.json';
import uploadCourses from '@/assets/tutorials/upload-courses.mov.asset.json';
import withdrawEarnings from '@/assets/tutorials/withdraw-earnings.mov.asset.json';

interface VideoItem {
  title_ar: string;
  title_en: string;
  desc_ar: string;
  desc_en: string;
  url: string;
}

const studentVideos: VideoItem[] = [
  {
    title_ar: 'تسجيل الدخول وإنشاء الحساب',
    title_en: 'Sign Up & Login',
    desc_ar: 'شرح كيفية إنشاء حساب جديد كطالب وتسجيل الدخول إلى المنصة',
    desc_en: 'How to create a new student account and log in to the platform',
    url: studentSignup.url,
  },
  {
    title_ar: 'شراء الدورات',
    title_en: 'Buying Courses',
    desc_ar: 'آلية شراء الدورات وإتمام عملية الدفع بطرق آمنة',
    desc_en: 'How to purchase courses and complete payment securely',
    url: buyCourses.url,
  },
  {
    title_ar: 'متابعة الدورات',
    title_en: 'Tracking Your Learning',
    desc_ar: 'كيفية متابعة تقدمك في الدورات والوصول إلى الدروس',
    desc_en: 'How to track your progress and access lessons',
    url: trackLearning.url,
  },
];

const instructorVideos: VideoItem[] = [
  {
    title_ar: 'إنشاء حساب المعلم',
    title_en: 'Create Instructor Account',
    desc_ar: 'خطوات إنشاء حساب جديد كمعلم على المنصة',
    desc_en: 'Steps to create a new instructor account on the platform',
    url: instructorSignup.url,
  },
  {
    title_ar: 'رفع الكورسات',
    title_en: 'Uploading Courses',
    desc_ar: 'شرح طريقة رفع الدورات والدروس وإدارة المحتوى التعليمي',
    desc_en: 'How to upload courses, lessons and manage your content',
    url: uploadCourses.url,
  },
  {
    title_ar: 'سحب الأرباح وخيارات لوحة التحكم',
    title_en: 'Withdraw Earnings & Dashboard Options',
    desc_ar: 'كيفية سحب الأرباح وشرح الخيارات الأخرى في لوحة تحكم المعلم',
    desc_en: 'How to withdraw earnings and explore other instructor dashboard options',
    url: withdrawEarnings.url,
  },
];

const VideoGrid = ({ videos, isRTL }: { videos: VideoItem[]; isRTL: boolean }) => (
  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
    {videos.map((v, i) => (
      <Card key={i} className="overflow-hidden hover:shadow-elegant transition-all duration-300 group">
        <div className="relative aspect-video bg-muted">
          <video
            src={v.url}
            controls
            preload="metadata"
            className="w-full h-full object-cover"
            controlsList="nodownload"
          />
        </div>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PlayCircle className="w-5 h-5 text-accent shrink-0" />
            {isRTL ? v.title_ar : v.title_en}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {isRTL ? v.desc_ar : v.desc_en}
          </p>
        </CardContent>
      </Card>
    ))}
  </div>
);

const Tutorials = () => {
  const { language, dir } = useLanguage();
  const isRTL = language === 'ar';
  const [tab, setTab] = useState('students');

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Navbar />
      <main className="pt-32 pb-20 container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient-gold">
            {isRTL ? 'فيديوهات توضيحية' : 'Tutorial Videos'}
          </h1>
          <p className="text-lg text-muted-foreground">
            {isRTL
              ? 'تعلّم كيفية استخدام المنصة خطوة بخطوة من خلال فيديوهات قصيرة للطلاب والمعلمين'
              : 'Learn how to use the platform step by step with short videos for students and instructors'}
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="max-w-6xl mx-auto">
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto h-14">
            <TabsTrigger value="students" className="gap-2 h-full text-base">
              <GraduationCap className="w-5 h-5" />
              {isRTL ? 'قسم الطلاب' : 'Students'}
            </TabsTrigger>
            <TabsTrigger value="instructors" className="gap-2 h-full text-base">
              <Users className="w-5 h-5" />
              {isRTL ? 'قسم المعلمين' : 'Instructors'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            <VideoGrid videos={studentVideos} isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="instructors">
            <VideoGrid videos={instructorVideos} isRTL={isRTL} />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Tutorials;
