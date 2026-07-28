import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LazyImage from "@/components/ui/LazyImage";
import { Search, Clock, Users, Star, Filter, GraduationCap, ChevronLeft, ChevronRight, Home, Heart } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { OnboardingTooltip } from "@/components/onboarding/OnboardingTooltip";
import { useWishlist } from "@/hooks/useWishlist";

// Onboarding steps for Courses page
const coursesOnboardingSteps = [
  {
    id: "courses-search",
    title: "Search Courses",
    title_ar: "البحث عن دورة",
    description: "Use the search bar to find courses by name or description",
    description_ar: "استخدم شريط البحث للعثور على الدورات بالاسم أو الوصف",
    target: "[data-onboarding='courses-search']",
    placement: "bottom" as const,
  },
  {
    id: "courses-filters",
    title: "Filter by University",
    title_ar: "فلترة حسب الجهة",
    description: "Filter courses by university, college, and major to find what fits your studies",
    description_ar: "فلتر الدورات حسب الجهة والكلية والتخصص للعثور على ما يناسب دراستك",
    target: "[data-onboarding='courses-filters']",
    placement: "bottom" as const,
  },
  {
    id: "courses-grid",
    title: "Browse Courses",
    title_ar: "تصفح الدورات",
    description: "Click on any course card to view its details and enroll",
    description_ar: "اضغط على أي بطاقة دورة لعرض تفاصيله والتسجيل فيه",
    target: "[data-onboarding='courses-grid']",
    placement: "top" as const,
  },
];

const COURSES_PER_PAGE = 12;

const Courses = () => {
  const { language, t } = useLanguage();
  const { user, role } = useAuth();
  const { startOnboarding, state } = useOnboarding();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRTL = language === "ar";

  const universityFromUrl = searchParams.get("university");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUniversity, setSelectedUniversity] = useState<string>(universityFromUrl || "all");
  const [selectedCollege, setSelectedCollege] = useState<string>("all");
  const [selectedMajor, setSelectedMajor] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const { isInWishlist, toggleWishlist } = useWishlist();

  // Sync URL param changes
  useEffect(() => {
    if (universityFromUrl) {
      setSelectedUniversity(universityFromUrl);
    }
  }, [universityFromUrl]);

  // Start onboarding for courses page
  useEffect(() => {
    if (user && state.hasSeenWelcome && !state.completedSteps.includes("courses-search")) {
      const timer = setTimeout(() => {
        startOnboarding(coursesOnboardingSteps);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, state.hasSeenWelcome, state.completedSteps, startOnboarding]);

  // Fetch universities
  const { data: universities = [] } = useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("universities")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch colleges based on selected university
  const { data: colleges = [] } = useQuery({
    queryKey: ["colleges", selectedUniversity],
    queryFn: async () => {
      let query = supabase
        .from("colleges")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (selectedUniversity && selectedUniversity !== "all") {
        query = query.eq("university_id", selectedUniversity);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch majors based on selected college
  const { data: majors = [] } = useQuery({
    queryKey: ["majors", selectedCollege],
    queryFn: async () => {
      let query = supabase
        .from("majors")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (selectedCollege && selectedCollege !== "all") {
        query = query.eq("college_id", selectedCollege);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedMajor, selectedUniversity, selectedCollege]);

  // Instructors see all courses on the platform, but their own uploaded courses are marked as free
  const isInstructorView = role === 'instructor' && !!user?.id;

  // Fetch courses with server-side pagination
  const { data: coursesData, isLoading } = useQuery({
    queryKey: ["courses", searchQuery, selectedMajor, selectedUniversity, selectedCollege, currentPage, role || 'public', isInstructorView ? user?.id : ''],
    queryFn: async () => {
      let query = supabase
        .from("courses")
        .select(`
          *,
          majors (
            id,
            name,
            name_ar,
            colleges (
              id,
              name,
              name_ar,
              universities (
                id,
                name,
                name_ar
              )
            )
          )
        `, { count: 'exact' })
        .order("created_at", { ascending: false });

      if (role === 'admin') {
        query = query.eq("is_active", true);
      } else {
        query = query.eq("is_active", true).eq("is_approved", true);
      }

      if (selectedMajor && selectedMajor !== "all") {
        query = query.eq("major_id", selectedMajor);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      // Filter by search query
      let filteredData = data || [];
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        filteredData = filteredData.filter(
          (course) =>
            course.title.toLowerCase().includes(searchLower) ||
            course.title_ar.toLowerCase().includes(searchLower) ||
            course.description?.toLowerCase().includes(searchLower) ||
            course.description_ar?.toLowerCase().includes(searchLower)
        );
      }

      // Filter by university/college if major not selected
      if (selectedUniversity && selectedUniversity !== "all" && selectedMajor === "all") {
        filteredData = filteredData.filter(
          (course) =>
            (course.majors as any)?.colleges?.universities?.id === selectedUniversity
        );
      }

      if (selectedCollege && selectedCollege !== "all" && selectedMajor === "all") {
        filteredData = filteredData.filter(
          (course) => (course.majors as any)?.colleges?.id === selectedCollege
        );
      }

      // For instructor view: mark only their own courses as free
      if (isInstructorView) {
        filteredData = filteredData.map((c: any) =>
          c.instructor_id === user!.id ? { ...c, price: 0, original_price: 0 } : c
        );
      }

      const totalCount = filteredData.length;
      const totalPages = Math.ceil(totalCount / COURSES_PER_PAGE);
      const startIndex = (currentPage - 1) * COURSES_PER_PAGE;
      const paginatedCourses = filteredData.slice(startIndex, startIndex + COURSES_PER_PAGE);

      return {
        courses: paginatedCourses,
        totalCount,
        totalPages,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache for performance
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  const courses = coursesData?.courses || [];
  const totalCount = coursesData?.totalCount || 0;
  const totalPages = coursesData?.totalPages || 1;

  // Fetch enrollment counts using optimized database function
  const { data: enrollmentCounts = {} } = useQuery({
    queryKey: ["enrollment-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_course_enrollment_counts');
      if (error) {
        // Fallback to regular query if RPC fails
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("enrollments")
          .select("course_id");
        if (fallbackError) throw fallbackError;

        const counts: Record<string, number> = {};
        fallbackData.forEach((enrollment) => {
          counts[enrollment.course_id] = (counts[enrollment.course_id] || 0) + 1;
        });
        return counts;
      }

      const counts: Record<string, number> = {};
      (data || []).forEach((item: { course_id: string; count: number }) => {
        counts[item.course_id] = Number(item.count);
      });
      return counts;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes cache for better performance
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  const handleUniversityChange = (value: string) => {
    setSelectedUniversity(value);
    setSelectedCollege("all");
    setSelectedMajor("all");
  };

  const handleCollegeChange = (value: string) => {
    setSelectedCollege(value);
    setSelectedMajor("all");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedUniversity("all");
    setSelectedCollege("all");
    setSelectedMajor("all");
  };

  return (
    <>
    <OnboardingTooltip />
    <div className={`min-h-screen bg-background ${isRTL ? "rtl" : "ltr"}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Back to Home Button */}
      <div className="container mx-auto px-4 pt-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <Home className="h-4 w-4" />
          {isRTL ? "العودة للرئيسية" : "Back to Home"}
        </Button>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold mb-4 text-center">
            {isRTL ? "استكشف الدورات" : "Explore Courses"}
          </h1>
          <p className="text-lg text-center opacity-90 max-w-2xl mx-auto">
            {isRTL
              ? "اكتشف مجموعة واسعة من الدورات المصممة خصيصًا لتخصصك الأكاديمي"
              : "Discover a wide range of courses tailored to your university major"}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filters Section */}
        <Card className="mb-8">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">
                {isRTL ? "فلترة الدورات" : "Filter Courses"}
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="lg:col-span-2" data-onboarding="courses-search">
                <div className="relative">
                  <Search className={`absolute top-3 h-4 w-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
                  <Input
                    placeholder={isRTL ? "ابحث عن دورة..." : "Search courses..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={isRTL ? "pr-10" : "pl-10"}
                  />
                </div>
              </div>

              {/* University Filter */}
              <div data-onboarding="courses-filters">
                <Select value={selectedUniversity} onValueChange={handleUniversityChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? "الجهة" : "University"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? "جميع الجهات" : "All Universities"}</SelectItem>
                    {universities.map((uni) => (
                      <SelectItem key={uni.id} value={uni.id}>
                        {isRTL ? uni.name_ar : uni.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* College Filter */}
              <Select value={selectedCollege} onValueChange={handleCollegeChange}>
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? "الكلية" : "College"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "جميع الكليات" : "All Colleges"}</SelectItem>
                  {colleges.map((college) => (
                    <SelectItem key={college.id} value={college.id}>
                      {isRTL ? college.name_ar : college.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Major Filter */}
              <Select value={selectedMajor} onValueChange={setSelectedMajor}>
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? "التخصص" : "Major"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "جميع التخصصات" : "All Majors"}</SelectItem>
                  {majors.map((major) => (
                    <SelectItem key={major.id} value={major.id}>
                      {isRTL ? major.name_ar : major.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            {(searchQuery || selectedUniversity !== "all" || selectedCollege !== "all" || selectedMajor !== "all") && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-4">
                {isRTL ? "مسح الفلاتر" : "Clear Filters"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-muted-foreground">
            {isRTL
              ? `${totalCount} دورة متاح`
              : `${totalCount} courses available`}
          </p>
          {totalPages > 1 && (
            <p className="text-sm text-muted-foreground">
              {isRTL 
                ? `صفحة ${currentPage} من ${totalPages}`
                : `Page ${currentPage} of ${totalPages}`}
            </p>
          )}
        </div>

        {/* Courses Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg" />
                <CardContent className="pt-4">
                  <div className="h-6 bg-muted rounded mb-2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <Card className="p-12 text-center">
            <GraduationCap className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {isRTL ? "لا توجد دورات" : "No Courses Found"}
            </h3>
            <p className="text-muted-foreground">
              {isRTL
                ? "جرب تغيير معايير البحث أو الفلترة"
                : "Try changing your search or filter criteria"}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-onboarding="courses-grid">
            {courses.map((course) => (
              <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
                {/* Course Image with Lazy Loading */}
                <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
                  {course.thumbnail_url ? (
                    <LazyImage
                      src={course.thumbnail_url}
                      alt={isRTL ? course.title_ar : course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      containerClassName="w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <GraduationCap className="h-16 w-16 text-primary/40" />
                    </div>
                  )}
                  {course.is_featured && (
                    <Badge className="absolute top-3 left-3 bg-yellow-500 z-10">
                      <Star className="h-3 w-3 mr-1" />
                      {isRTL ? "مميز" : "Featured"}
                    </Badge>
                  )}
                  {(course.price === 0 || course.price === null) ? (
                    <Badge className="absolute top-3 right-3 z-10 bg-green-600 hover:bg-green-700 text-white border-0">
                      {isRTL ? "مجاني" : "Free"}
                    </Badge>
                  ) : course.original_price && course.original_price > (course.price || 0) ? (
                    <Badge variant="destructive" className="absolute top-3 right-3 z-10">
                      {Math.round(((course.original_price - course.price!) / course.original_price) * 100)}%
                      {isRTL ? " خصم" : " OFF"}
                    </Badge>
                  ) : null}
                  {/* Wishlist Button */}
                  {user && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist.mutate(course.id); }}
                      className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors shadow-sm"
                    >
                      <Heart className={`w-4 h-4 ${isInWishlist(course.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                    </button>
                  )}
                </div>

                <CardHeader className="pb-2">
                  <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
                    {isRTL ? course.title_ar : course.title}
                  </h3>
                  {(course.majors as any) && (
                    <p className="text-sm text-muted-foreground">
                      {isRTL
                        ? (course.majors as any).name_ar
                        : (course.majors as any).name}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="pb-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {isRTL ? course.description_ar : course.description}
                  </p>

                  <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        {course.duration_hours} {isRTL ? "ساعة" : "hrs"}
                      </span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    {(course.price === 0 || course.price === null) ? (
                      <span className="text-xl font-bold text-green-600">
                        {isRTL ? "مجاني" : "Free"}
                      </span>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-primary">
                          {course.price} {isRTL ? "ر.س" : "SAR"}
                        </span>
                        {course.original_price && course.original_price > (course.price || 0) && (
                          <span className="text-sm text-muted-foreground line-through">
                            {course.original_price}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <Button asChild size="sm">
                    <Link to={`/courses/${course.id}`}>
                      {isRTL ? "عرض التفاصيل" : "View Details"}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              {isRTL ? "السابق" : "Previous"}
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-10"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              {isRTL ? "التالي" : "Next"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default Courses;
