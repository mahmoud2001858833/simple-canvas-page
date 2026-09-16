import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Package, Plus, Search, Edit3, Trash2, CheckCircle2, XCircle, 
  Settings, ShoppingBag, Sparkles, AlertCircle, Percent, DollarSign,
  BookOpen, Eye, ArrowUpDown, Layers, RefreshCw, Check, Info, Users,
  X, CheckSquare, Square, ChevronRight, UploadCloud, Loader2, Image as ImageIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CourseBundle,
  CustomBundleSettings,
  DEFAULT_BUNDLE_SETTINGS,
  getAllBundles,
  createCourseBundle,
  updateCourseBundle,
  deleteCourseBundle,
  getCustomBundleSettings,
  saveCustomBundleSettings,
} from "@/services/bundleService";

export const BundlesManagement = () => {
  const { dir } = useLanguage();
  const isRTL = dir === "rtl";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCoursePickerOpen, setIsCoursePickerOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<CourseBundle | null>(null);
  const [deletingBundleId, setDeletingBundleId] = useState<string | null>(null);

  // Form State for Create / Edit
  const [formTitle, setFormTitle] = useState("");
  const [formTitleAr, setFormTitleAr] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDescAr, setFormDescAr] = useState("");
  const [formPrice, setFormPrice] = useState<number>(0);
  const [formThumbnail, setFormThumbnail] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formValidDays, setFormValidDays] = useState<number>(0);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(isRTL ? "يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP)" : "Please select a valid image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error(isRTL ? "حجم الصورة يجب ألا يتجاوز 10 ميغابايت" : "Image size must not exceed 10MB");
      return;
    }

    setIsUploadingImage(true);
    try {
      const { data: authUser } = await supabase.auth.getUser();
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const fileName = `${authUser?.user?.id || "admin"}/bundle-thumbnails/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("chat-images")
        .getPublicUrl(fileName);

      if (publicUrlData?.publicUrl) {
        setFormThumbnail(publicUrlData.publicUrl);
        toast.success(isRTL ? "تم رفع صورة الباقة بنجاح" : "Bundle image uploaded successfully");
      } else {
        throw new Error(isRTL ? "تعذر استخراج رابط الصورة بعد الرفع" : "Failed to retrieve uploaded image URL");
      }
    } catch (error: any) {
      console.error("Bundle thumbnail upload error:", error);
      toast.error((isRTL ? "فشل رفع صورة الباقة: " : "Failed to upload bundle image: ") + (error?.message || ""));
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = "";
    }
  };

  // Custom Bundle Settings State
  const [customSettings, setCustomSettings] = useState<CustomBundleSettings>(DEFAULT_BUNDLE_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // 1. Fetch Bundles
  const { data: bundles = [], isLoading: isLoadingBundles, refetch: refetchBundles } = useQuery({
    queryKey: ["admin-course-bundles"],
    queryFn: getAllBundles,
  });

  // 2. Fetch All Available Courses on the Platform with instructors
  const { data: allCourses = [], isLoading: isLoadingCourses } = useQuery({
    queryKey: ["admin-all-courses-for-bundles"],
    queryFn: async () => {
      const { data: coursesData, error } = await supabase
        .from("courses")
        .select("id, title, title_ar, price, original_price, thumbnail_url, instructor_id, instructor_commission, is_active, is_approved, category, subject_code, subject_name")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching courses for bundles:", error);
        throw error;
      }

      const instructorIds = Array.from(
        new Set((coursesData || []).map((c: any) => c.instructor_id).filter(Boolean) as string[])
      );

      let instructorMap: Record<string, string> = {};
      if (instructorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, full_name_ar")
          .in("id", instructorIds);

        (profiles || []).forEach((p: any) => {
          instructorMap[p.id] = p.full_name_ar || p.full_name || "معلم معتمد";
        });
      }

      return (coursesData || []).map((c: any) => ({
        ...c,
        instructor_name: c.instructor_id ? (instructorMap[c.instructor_id] || "معلم معتمد") : "معلم معتمد",
      }));
    },
  });

  // 3. Fetch Custom Bundle Settings
  const { data: loadedSettings } = useQuery({
    queryKey: ["platform-custom-bundle-settings"],
    queryFn: getCustomBundleSettings,
  });

  useEffect(() => {
    if (loadedSettings) {
      setCustomSettings(loadedSettings);
    }
  }, [loadedSettings]);

  // 4. Fetch Bundle Purchases for analytics
  const { data: purchases = [], isLoading: isLoadingPurchases } = useQuery({
    queryKey: ["admin-bundle-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bundle_purchases")
        .select(`
          id,
          bundle_id,
          user_id,
          amount_paid,
          status,
          purchased_at,
          profiles:user_id (id, full_name, full_name_ar, email),
          course_bundles:bundle_id (title, title_ar)
        `)
        .order("purchased_at", { ascending: false });

      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Reset form when modal opens
  const openCreateDialog = () => {
    setEditingBundle(null);
    setFormTitle("");
    setFormTitleAr("");
    setFormDesc("");
    setFormDescAr("");
    setFormPrice(0);
    setFormThumbnail("");
    setFormIsActive(true);
    setFormValidDays(0);
    setSelectedCourseIds([]);
    setCourseSearch("");
    setIsCreateOpen(true);
  };

  // Open edit modal
  const openEditDialog = (bundle: CourseBundle) => {
    setEditingBundle(bundle);
    setFormTitle(bundle.title || "");
    setFormTitleAr(bundle.title_ar || "");
    setFormDesc(bundle.description || "");
    setFormDescAr(bundle.description_ar || "");
    setFormPrice(bundle.price || 0);
    setFormThumbnail(bundle.thumbnail_url || "");
    setFormIsActive(bundle.is_active);
    setFormValidDays(bundle.valid_days || 0);
    setSelectedCourseIds(bundle.courses?.map(c => c.id) || []);
    setCourseSearch("");
    setIsCreateOpen(true);
  };

  // Calculate sum of selected courses original price
  const calculatedOriginalPrice = useMemo(() => {
    const selected = allCourses.filter(c => selectedCourseIds.includes(c.id));
    return selected.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
  }, [allCourses, selectedCourseIds]);

  // Calculate discount percentage
  const calculatedDiscountPct = useMemo(() => {
    if (calculatedOriginalPrice <= 0 || formPrice <= 0) return 0;
    const diff = calculatedOriginalPrice - formPrice;
    if (diff <= 0) return 0;
    return Math.round((diff / calculatedOriginalPrice) * 100);
  }, [calculatedOriginalPrice, formPrice]);

  // Create / Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formTitleAr.trim() && !formTitle.trim()) {
        throw new Error(isRTL ? "يرجى كتابة عنوان الباقة" : "Please enter bundle title");
      }
      if (selectedCourseIds.length === 0) {
        throw new Error(isRTL ? "يرجى اختيار مادة واحدة على الأقل" : "Please select at least one course");
      }
      if (formPrice < 0) {
        throw new Error(isRTL ? "سعر الباقة غير صحيح" : "Invalid bundle price");
      }

      const payload = {
        title: formTitle.trim() || formTitleAr.trim(),
        title_ar: formTitleAr.trim() || formTitle.trim(),
        description: formDesc.trim() || undefined,
        description_ar: formDescAr.trim() || undefined,
        price: formPrice,
        original_price: calculatedOriginalPrice,
        discount_percentage: calculatedDiscountPct,
        thumbnail_url: formThumbnail.trim() || undefined,
        is_active: formIsActive,
        valid_days: formValidDays > 0 ? formValidDays : undefined,
        course_ids: selectedCourseIds,
      };

      if (editingBundle) {
        await updateCourseBundle(editingBundle.id, payload);
      } else {
        await createCourseBundle(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-course-bundles"] });
      queryClient.invalidateQueries({ queryKey: ["active-course-bundles"] });
      setIsCreateOpen(false);
      toast.success(
        editingBundle
          ? (isRTL ? "تم تحديث الباقة بنجاح" : "Bundle updated successfully")
          : (isRTL ? "تم إنشاء الباقة بنجاح" : "Bundle created successfully")
      );
    },
    onError: (err: any) => {
      toast.error(err.message || (isRTL ? "حدث خطأ أثناء الحفظ" : "Error saving bundle"));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteCourseBundle(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-course-bundles"] });
      queryClient.invalidateQueries({ queryKey: ["active-course-bundles"] });
      setDeletingBundleId(null);
      toast.success(isRTL ? "تم حذف الباقة بنجاح" : "Bundle deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || (isRTL ? "فشل حذف الباقة" : "Failed to delete bundle"));
    },
  });

  // Toggle active status
  const handleToggleActive = async (bundle: CourseBundle) => {
    try {
      await updateCourseBundle(bundle.id, { is_active: !bundle.is_active });
      queryClient.invalidateQueries({ queryKey: ["admin-course-bundles"] });
      toast.success(
        !bundle.is_active
          ? (isRTL ? "تم تفعيل الباقة بنجاح" : "Bundle activated")
          : (isRTL ? "تم تعطيل الباقة" : "Bundle deactivated")
      );
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Save custom bundle settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await saveCustomBundleSettings(customSettings);
      queryClient.invalidateQueries({ queryKey: ["platform-custom-bundle-settings"] });
      toast.success(isRTL ? "تم حفظ إعدادات البكجات بنجاح" : "Bundle settings saved successfully");
    } catch (e: any) {
      toast.error(e.message || (isRTL ? "فشل حفظ الإعدادات" : "Failed to save settings"));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Filtered bundles list
  const filteredBundles = useMemo(() => {
    return bundles.filter(b => {
      const matchesSearch =
        (b.title_ar && b.title_ar.toLowerCase().includes(search.toLowerCase())) ||
        (b.title && b.title.toLowerCase().includes(search.toLowerCase())) ||
        (b.description_ar && b.description_ar.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;
      if (filterActive === "active") return b.is_active;
      if (filterActive === "inactive") return !b.is_active;
      return true;
    });
  }, [bundles, search, filterActive]);

  // Filtered courses for selector in modal
  const filteredCoursesForModal = useMemo(() => {
    if (!courseSearch.trim()) return allCourses;
    const q = courseSearch.toLowerCase();
    return allCourses.filter(c =>
      (c.title_ar && c.title_ar.toLowerCase().includes(q)) ||
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.subject_code && c.subject_code.toLowerCase().includes(q)) ||
      (c.instructor_name && c.instructor_name.toLowerCase().includes(q))
    );
  }, [allCourses, courseSearch]);

  const totalBundleSales = useMemo(() => {
    return purchases.reduce((sum, p: any) => sum + (Number(p.amount_paid) || 0), 0);
  }, [purchases]);

  // Toggle single course selection
  const toggleCourse = (courseId: string) => {
    if (selectedCourseIds.includes(courseId)) {
      setSelectedCourseIds(selectedCourseIds.filter(id => id !== courseId));
    } else {
      setSelectedCourseIds([...selectedCourseIds, courseId]);
    }
  };

  // Select all / Deselect all
  const selectAllCourses = () => {
    const allIds = filteredCoursesForModal.map(c => c.id);
    setSelectedCourseIds(Array.from(new Set([...selectedCourseIds, ...allIds])));
  };

  const deselectAllCourses = () => {
    setSelectedCourseIds([]);
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? "إدارة البكجات والحزم الدراسية" : "Course Bundles & Packages"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isRTL
                ? "إنشاء باقات مخفضة للمقررات، تحديد الأسعار، وضبط قواعد بكج الطالب المخصص"
                : "Create discounted bundles, manage package pricing, and configure student custom bundle rules"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => refetchBundles()}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {isRTL ? "تحديث" : "Refresh"}
          </Button>

          <Button
            onClick={openCreateDialog}
            className="gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-md font-bold"
          >
            <Plus className="w-4 h-4" />
            {isRTL ? "إنشاء بكج جديد" : "Create New Bundle"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">
                {isRTL ? "إجمالي البكجات" : "Total Bundles"}
              </p>
              <h3 className="text-2xl font-bold mt-1">{bundles.length}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {bundles.filter(b => b.is_active).length} {isRTL ? "باقة نشطة ومعروضة" : "active bundles"}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">
                {isRTL ? "مبيعات البكجات" : "Bundle Purchases"}
              </p>
              <h3 className="text-2xl font-bold mt-1">{purchases.length}</h3>
              <p className="text-xs text-green-600 font-medium mt-1">
                {isRTL ? "اشتراك مكتمل" : "completed purchases"}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">
                {isRTL ? "إيرادات البكجات" : "Bundle Revenue"}
              </p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600">
                {totalBundleSales.toLocaleString()} <span className="text-xs font-normal">ر.س</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? "موزعة محاسبياً على المواد" : "prorated across courses"}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-gradient-to-br from-card to-amber-500/5">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase">
                {isRTL ? "قاعدة أنشئ بكجك" : "Custom Bundle Rule"}
              </p>
              <h3 className="text-2xl font-bold mt-1 text-amber-600">
                {customSettings.discount_percentage}%
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? `عند اختيار ${customSettings.min_courses} مواد فأكثر` : `For ${customSettings.min_courses}+ courses`}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="bundles" className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="bundles" className="gap-2 rounded-lg data-[state=active]:bg-background">
            <Package className="w-4 h-4" />
            {isRTL ? "قائمة البكجات" : "Bundles Catalog"}
          </TabsTrigger>
          <TabsTrigger value="custom-settings" className="gap-2 rounded-lg data-[state=active]:bg-background">
            <Settings className="w-4 h-4" />
            {isRTL ? "إعدادات بكج الطالب (أنشئ بكجك)" : "Custom Bundle Settings"}
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2 rounded-lg data-[state=active]:bg-background">
            <ShoppingBag className="w-4 h-4" />
            {isRTL ? "سجل المشتركين بالبكجات" : "Purchase History"}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Bundles List & Cards */}
        <TabsContent value="bundles" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isRTL ? "البحث في البكجات..." : "Search bundles..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant={filterActive === "all" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilterActive("all")}
                className="rounded-lg text-xs"
              >
                {isRTL ? "الكل" : "All"} ({bundles.length})
              </Button>
              <Button
                variant={filterActive === "active" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilterActive("active")}
                className="rounded-lg text-xs"
              >
                {isRTL ? "النشطة فقط" : "Active Only"} ({bundles.filter(b => b.is_active).length})
              </Button>
              <Button
                variant={filterActive === "inactive" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilterActive("inactive")}
                className="rounded-lg text-xs"
              >
                {isRTL ? "المعطلة" : "Inactive"} ({bundles.filter(b => !b.is_active).length})
              </Button>
            </div>
          </div>

          {isLoadingBundles ? (
            <div className="py-16 text-center text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              {isRTL ? "جاري تحميل البكجات..." : "Loading bundles..."}
            </div>
          ) : filteredBundles.length === 0 ? (
            <Card className="border border-dashed p-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground">
                {isRTL ? "لا توجد بكجات حالياً" : "No bundles found"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
                {isRTL
                  ? "ابدأ بإنشاء أول بكج مخفض للمقررات لتظهر للطلاب في الصفحة الرئيسية"
                  : "Start creating your first discounted bundle to showcase to students on the homepage"}
              </p>
              <Button onClick={openCreateDialog} className="gap-2">
                <Plus className="w-4 h-4" />
                {isRTL ? "إنشاء أول بكج" : "Create First Bundle"}
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBundles.map((bundle) => {
                const coursesCount = bundle.courses?.length || 0;
                const savingsAmount = Math.max(0, (bundle.original_price || 0) - bundle.price);

                return (
                  <Card key={bundle.id} className="overflow-hidden border hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      {/* Bundle Thumbnail Header */}
                      <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
                        {bundle.thumbnail_url ? (
                          <img
                            src={bundle.thumbnail_url}
                            alt={bundle.title_ar}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 text-white p-4">
                            <Package className="w-12 h-12 text-amber-400 mb-2 opacity-80" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-amber-200/80">
                              باقة مقررات دراسية
                            </span>
                          </div>
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-3 start-3 flex items-center gap-2">
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold border-none shadow">
                            {bundle.discount_percentage ? `خصم ${bundle.discount_percentage}%` : "عرض خاص"}
                          </Badge>
                          {savingsAmount > 0 && (
                            <Badge variant="secondary" className="bg-black/60 backdrop-blur-md text-white border-white/10 text-xs">
                              {isRTL ? `توفير ${savingsAmount} ر.س` : `Save ${savingsAmount} SAR`}
                            </Badge>
                          )}
                        </div>

                        <div className="absolute top-3 end-3">
                          <Badge
                            variant={bundle.is_active ? "default" : "outline"}
                            className={bundle.is_active ? "bg-emerald-600 text-white border-none shadow" : "bg-black/60 text-white"}
                          >
                            {bundle.is_active ? (isRTL ? "نشطة" : "Active") : (isRTL ? "معطلة" : "Inactive")}
                          </Badge>
                        </div>

                        {/* Courses count overlay */}
                        <div className="absolute bottom-3 start-3 end-3 flex items-center justify-between text-xs text-white/90 bg-black/50 backdrop-blur-md py-1.5 px-3 rounded-lg border border-white/10">
                          <span className="flex items-center gap-1.5 font-medium">
                            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                            {coursesCount} {isRTL ? "مقررات دراسية" : "courses"}
                          </span>
                          <span className="flex items-center gap-1 font-medium">
                            <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                            {bundle.purchases_count || 0} {isRTL ? "مشترك" : "sales"}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <CardContent className="p-5 space-y-4">
                        <div>
                          <h3 className="font-bold text-lg text-foreground line-clamp-1">
                            {isRTL ? bundle.title_ar : bundle.title}
                          </h3>
                          {bundle.description_ar && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {isRTL ? bundle.description_ar : bundle.description}
                            </p>
                          )}
                        </div>

                        {/* Courses preview pills */}
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {isRTL ? "المقررات المشمولة في الباقة:" : "Included Courses:"}
                          </p>
                          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                            {bundle.courses?.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between text-xs bg-muted/40 hover:bg-muted/70 px-2.5 py-1.5 rounded-lg transition-colors"
                              >
                                <span className="font-medium truncate max-w-[200px]" title={c.title_ar || c.title}>
                                  {isRTL ? c.title_ar : c.title}
                                </span>
                                <span className="text-muted-foreground text-[11px] whitespace-nowrap">
                                  {c.price ? `${c.price} ر.س` : "مجاني"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Price Display */}
                        <div className="pt-2 border-t flex items-baseline justify-between">
                          <div>
                            <span className="text-xs text-muted-foreground block">
                              {isRTL ? "سعر الباقة الشامل:" : "Bundle Price:"}
                            </span>
                            <div className="flex items-baseline gap-2 mt-0.5">
                              <span className="text-2xl font-black text-amber-600">
                                {bundle.price} <span className="text-xs font-semibold">ر.س</span>
                              </span>
                              {bundle.original_price && bundle.original_price > bundle.price && (
                                <span className="text-xs text-muted-foreground line-through">
                                  {bundle.original_price} ر.س
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">
                              {bundle.is_active ? (isRTL ? "مفعلة" : "Active") : (isRTL ? "معطلة" : "Inactive")}
                            </span>
                            <Switch
                              checked={bundle.is_active}
                              onCheckedChange={() => handleToggleActive(bundle)}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </div>

                    {/* Actions Footer */}
                    <div className="p-4 pt-0 border-t bg-muted/10 flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(bundle)}
                        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {isRTL ? "تعديل" : "Edit"}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingBundleId(bundle.id)}
                        className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isRTL ? "حذف" : "Delete"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Custom Student Bundle Rules */}
        <TabsContent value="custom-settings" className="space-y-6">
          <Card className="border shadow-sm max-w-3xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {isRTL ? "إعدادات باقات الطلاب المخصصة (أنشئ بكجك)" : "Student Custom Bundle Settings"}
                  </CardTitle>
                  <CardDescription>
                    {isRTL
                      ? "التحكم في الشروط والخصومات التي يحصل عليها الطالب عندما يختار مواده بنفسه في لوحة الطالب"
                      : "Configure the minimum courses and discount rate students receive when building their own custom bundle"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Enable / Disable */}
              <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">
                    {isRTL ? "تفعيل ميزة أنشئ بكجك للطلاب" : "Enable 'Build Your Own Bundle'"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isRTL
                      ? "إظهار تبويب أنشئ بكجك في لوحة تحكم الطالب وتمكين الخصم التلقائي"
                      : "Show the build bundle tab in the student dashboard and allow instant package discounts"}
                  </p>
                </div>
                <Switch
                  checked={customSettings.is_enabled}
                  onCheckedChange={(val) => setCustomSettings({ ...customSettings, is_enabled: val })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Min Courses */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    {isRTL ? "الحد الأدنى لعدد المواد لتفعيل الخصم" : "Minimum Courses to Trigger Discount"}
                  </Label>
                  <div className="relative">
                    <BookOpen className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={2}
                      max={15}
                      value={customSettings.min_courses}
                      onChange={(e) => setCustomSettings({ ...customSettings, min_courses: Math.max(2, parseInt(e.target.value) || 2) })}
                      className="ps-9 rounded-xl font-bold"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {isRTL
                      ? "الموصى به: 4 مواد (يحصل الطالب على الخصم فور تحديد هذا العدد أو أكثر)"
                      : "Default: 4 courses (discount activates when student picks this many or more)"}
                  </p>
                </div>

                {/* Discount Percentage */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    {isRTL ? "نسبة الخصم المئوية لكل مادة" : "Discount Percentage Per Course"}
                  </Label>
                  <div className="relative">
                    <Percent className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={5}
                      max={80}
                      value={customSettings.discount_percentage}
                      onChange={(e) => setCustomSettings({ ...customSettings, discount_percentage: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="ps-9 rounded-xl font-bold"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {isRTL
                      ? "الموصى به: 25% (يتم خصم 25% من سعر كل مادة مختارة)"
                      : "Default: 25% (25% off each selected course price)"}
                  </p>
                </div>
              </div>

              {/* Simulation Preview */}
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-3">
                <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                  <Info className="w-4 h-4" />
                  {isRTL ? "معاينة تجربة الطالب الحالية:" : "Student Experience Simulation:"}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isRTL
                    ? `عندما يختار الطالب ${customSettings.min_courses} مواد أو أكثر بقيمة افتراضية (1000 ر.س)، سيتم تطبيق خصم ${customSettings.discount_percentage}% تلقائياً، ليصبح الإجمالي ${1000 * (1 - customSettings.discount_percentage / 100)} ر.س بتوفير قدره ${1000 * (customSettings.discount_percentage / 100)} ر.س. وسيتم قيد كل مادة في دفتر الحسابات بسعر مخفض، وتحسب عمولة المدرس بدقة.`
                    : `When a student selects ${customSettings.min_courses}+ courses valued at 1000 SAR, a ${customSettings.discount_percentage}% discount is applied, resulting in a total of ${1000 * (1 - customSettings.discount_percentage / 100)} SAR (saving ${1000 * (customSettings.discount_percentage / 100)} SAR). Each course will be itemized in the ledger.`}
                </p>
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold"
              >
                {isSavingSettings ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {isRTL ? "حفظ الإعدادات" : "Save Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Purchase History */}
        <TabsContent value="purchases" className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="p-5 border-b">
              <CardTitle className="text-base font-bold">
                {isRTL ? "سجل مبيعات البكجات والاشتراكات" : "Bundle Purchases Log"}
              </CardTitle>
              <CardDescription>
                {isRTL
                  ? "جميع عمليات شراء البكجات (الجاهزة والمخصصة) والطلاب المستفيدين"
                  : "All completed bundle purchases and enrolled students"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingPurchases ? (
                <div className="py-12 text-center text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                  {isRTL ? "جاري تحميل السجل..." : "Loading purchase records..."}
                </div>
              ) : purchases.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{isRTL ? "لم تتم أي عمليات شراء بكجات بعد" : "No bundle purchases recorded yet"}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                        <TableHead>{isRTL ? "الطالب" : "Student"}</TableHead>
                        <TableHead>{isRTL ? "الباقة" : "Bundle"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "المبلغ المدفوع" : "Amount"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الحالة" : "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((p: any) => {
                        const studentName = p.profiles?.full_name_ar || p.profiles?.full_name || p.profiles?.email || "-";
                        const bundleName = p.course_bundles ? (isRTL ? p.course_bundles.title_ar : p.course_bundles.title) : (isRTL ? "بكج مخصص" : "Custom Bundle");
                        const dateStr = p.purchased_at ? new Date(p.purchased_at).toLocaleDateString(isRTL ? "ar-SA" : "en-US") : "-";

                        return (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs text-muted-foreground">{dateStr}</TableCell>
                            <TableCell className="font-medium">
                              <div>{studentName}</div>
                              <div className="text-xs text-muted-foreground">{p.profiles?.email}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 font-medium">
                                <Package className="w-3.5 h-3.5 text-amber-500" />
                                {bundleName}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-bold text-emerald-600">
                              {p.amount_paid} ر.س
                            </TableCell>
                            <TableCell className="text-center">
                              {p.status === "completed" ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                  {isRTL ? "مكتمل" : "Completed"}
                                </Badge>
                              ) : p.status === "pending" ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                  {isRTL ? "بانتظار التحويل" : "Pending Transfer"}
                                </Badge>
                              ) : (
                                <Badge variant="outline">{p.status}</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Create / Edit Bundle */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-600" />
              {editingBundle
                ? (isRTL ? "تعديل الباقة الدراسية" : "Edit Course Bundle")
                : (isRTL ? "إنشاء باقة دراسية جديدة" : "Create New Course Bundle")}
            </DialogTitle>
            <DialogDescription>
              {isRTL
                ? "حدد المقررات المشمولة في الباقة وحدد السعر الإجمالي المخفض"
                : "Select the bundled courses and set the discounted package price"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {/* Title fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">
                  {isRTL ? "عنوان الباقة (بالعربية) *" : "Bundle Title (Arabic) *"}
                </Label>
                <Input
                  value={formTitleAr}
                  onChange={(e) => setFormTitleAr(e.target.value)}
                  placeholder={isRTL ? "مثال: باقة الهندسة الكهربائية الشاملة" : "Arabic title..."}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">
                  {isRTL ? "عنوان الباقة (بالإنجليزية)" : "Bundle Title (English)"}
                </Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Electrical Engineering Complete Bundle"
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Description fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">
                  {isRTL ? "وصف الباقة (بالعربية)" : "Description (Arabic)"}
                </Label>
                <Textarea
                  value={formDescAr}
                  onChange={(e) => setFormDescAr(e.target.value)}
                  placeholder={isRTL ? "شرح للمقررات المشمولة في الباقة ومميزاتها..." : "Arabic description..."}
                  rows={2}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">
                  {isRTL ? "وصف الباقة (بالإنجليزية)" : "Description (English)"}
                </Label>
                <Textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="English description..."
                  rows={2}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Course Selector Interactive Box */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  {isRTL ? "المقررات المشمولة في الباقة *" : "Courses included in the bundle *"}
                </Label>

                <Badge variant={selectedCourseIds.length > 0 ? "default" : "secondary"} className={selectedCourseIds.length > 0 ? "bg-amber-600 text-white font-bold" : ""}>
                  {selectedCourseIds.length} {isRTL ? "مقررات محددة" : "selected"}
                </Badge>
              </div>

              {/* Clickable Card to open the full courses picker */}
              <div
                onClick={() => setIsCoursePickerOpen(true)}
                className="p-4 rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/70 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3 text-center sm:text-start">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-amber-700 transition-colors">
                      {isRTL ? "اضغط هنا لاختيار المقررات من بين كافة دورات المنصة" : "Click here to select courses from all platform courses"}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isRTL
                        ? `متاح ${allCourses.length} دورة مسجلة على المنصة • تم اختيار ${selectedCourseIds.length} دورة حتى الآن`
                        : `${allCourses.length} courses available • ${selectedCourseIds.length} selected`}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 shrink-0 shadow"
                >
                  <Plus className="w-4 h-4" />
                  {isRTL ? "تصفح واختيار المقررات" : "Browse & Select Courses"}
                </Button>
              </div>

              {/* Selected Courses Chips / Tags */}
              {selectedCourseIds.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>{isRTL ? "المواد المحددة حالياً:" : "Selected courses list:"}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCourseIds([])}
                      className="h-6 text-[11px] text-destructive hover:bg-destructive/10 px-2"
                    >
                      {isRTL ? "إلغاء تحديد الكل" : "Clear all"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                    {allCourses
                      .filter(c => selectedCourseIds.includes(c.id))
                      .map(c => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-2 rounded-xl border bg-card shadow-sm text-xs"
                        >
                          <div className="truncate me-2">
                            <p className="font-bold text-foreground truncate" title={c.title_ar || c.title}>
                              {isRTL ? c.title_ar : c.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {c.instructor_name} • {c.price ? `${c.price} ر.س` : "مجاني"}
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCourse(c.id);
                            }}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-full"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground border rounded-xl bg-muted/20">
                  {isRTL
                    ? "لم تختر أي مقررات بعد. انقر على الزر أعلاه لعرض وتحديد دورات المنصة."
                    : "No courses selected yet. Click above to view and choose from all platform courses."}
                </div>
              )}
            </div>

            {/* Pricing Section with Dynamic Calculator */}
            <div className="p-4 rounded-xl border bg-muted/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {isRTL ? "إجمالي السعر الفردي للمواد المختارة:" : "Combined individual course prices:"}
                </span>
                <span className="font-bold text-sm">
                  {calculatedOriginalPrice} ر.س
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">
                    {isRTL ? "سعر الباقة النهائي (ر.س) *" : "Bundle Deal Price (SAR) *"}
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      value={formPrice}
                      onChange={(e) => setFormPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0"
                      className="ps-9 rounded-xl font-bold text-base"
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-center space-y-1 bg-background p-3 rounded-xl border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{isRTL ? "نسبة الخصم:" : "Discount:"}</span>
                    <span className="font-bold text-amber-600">{calculatedDiscountPct}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{isRTL ? "مقدار التوفير:" : "Savings:"}</span>
                    <span className="font-bold text-emerald-600">
                      {Math.max(0, calculatedOriginalPrice - formPrice)} ر.س
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Thumbnail Upload Section & Active switch */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-500" />
                    {isRTL ? "صورة غلاف الباقة" : "Bundle Cover Image"}
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowManualUrl(!showManualUrl)}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    {showManualUrl 
                      ? (isRTL ? "إخفاء الرابط اليدوي" : "Hide manual URL") 
                      : (isRTL ? "أو إدخال رابط مباشر" : "Or enter direct URL")}
                  </button>
                </div>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploadingImage}
                />

                {formThumbnail ? (
                  /* Image Preview Card */
                  <div className="relative group rounded-2xl overflow-hidden border border-amber-200/60 dark:border-amber-900/40 bg-slate-50 dark:bg-slate-900/50 shadow-sm">
                    <div className="aspect-video w-full max-h-48 overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                      <img
                        src={formThumbnail}
                        alt="Bundle Cover"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as any).src = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60";
                        }}
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="gap-1.5 shadow-md bg-white/90 dark:bg-slate-900/90 hover:bg-white text-xs font-semibold"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        {isRTL ? "تغيير الصورة" : "Change Image"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setFormThumbnail("")}
                        className="gap-1.5 shadow-md text-xs font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isRTL ? "حذف" : "Remove"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Upload Dropzone Box */
                  <div
                    onClick={() => !isUploadingImage && fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all duration-200 ${
                      isUploadingImage
                        ? "border-amber-400 bg-amber-50/40 dark:bg-amber-950/20 cursor-wait"
                        : "border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/30 dark:hover:bg-amber-950/10"
                    }`}
                  >
                    {isUploadingImage ? (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                          {isRTL ? "جاري رفع الصورة إلى التخزين السحابي..." : "Uploading image..."}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {isRTL ? "اضغط هنا لاختيار صورة من جهازك" : "Click to select image from your device"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {isRTL ? "يدعم PNG, JPG, WEBP حتى 10 ميغابايت" : "Supports PNG, JPG, WEBP up to 10MB"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs gap-1.5 border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          {isRTL ? "رفع صورة جديدة" : "Upload New Image"}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Optional direct URL input if toggled */}
                {showManualUrl && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-1">
                    <Input
                      value={formThumbnail}
                      onChange={(e) => setFormThumbnail(e.target.value)}
                      placeholder="https://..."
                      className="rounded-xl text-xs h-9"
                    />
                  </div>
                )}
              </div>

              {/* Active Status Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">
                    {isRTL ? "تفعيل الباقة وظهورها للطلاب" : "Activate Bundle & Publish"}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {isRTL ? "ستظهر الباقة فوراً في الصفحة الرئيسية وقائمة البكجات" : "Bundle will immediately be visible on homepage"}
                  </p>
                </div>
                <Switch
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold"
            >
              {saveMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
              {editingBundle ? (isRTL ? "حفظ التعديلات" : "Save Changes") : (isRTL ? "إنشاء الباقة" : "Create Bundle")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DEDICATED FULL COURSE PICKER MODAL */}
      <Dialog open={isCoursePickerOpen} onOpenChange={setIsCoursePickerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6" dir={dir}>
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-amber-600" />
                  {isRTL ? "اختيار المقررات المشمولة في الباقة" : "Select Courses for Bundle"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {isRTL
                    ? `تصفح وحدد من بين كافة الدورات المتاحة على المنصة (إجمالي ${allCourses.length} دورة).`
                    : `Browse and select from all available courses on the platform (total ${allCourses.length} courses).`}
                </DialogDescription>
              </div>

              <Badge className="bg-amber-600 text-white font-bold text-sm px-3 py-1">
                {selectedCourseIds.length} {isRTL ? "محددة" : "selected"}
              </Badge>
            </div>
          </DialogHeader>

          {/* Search and Bulk Select Tools */}
          <div className="py-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-b">
            <div className="relative w-full sm:w-80">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isRTL ? "ابحث باسم المادة، الرمز، أو المعلم..." : "Search course, code, or teacher..."}
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="ps-9 rounded-xl text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllCourses}
                className="text-xs h-8 gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                {isRTL ? "تحديد كل المعروض" : "Select All Visible"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={deselectAllCourses}
                className="text-xs h-8 gap-1.5 text-destructive hover:bg-destructive/10"
              >
                <Square className="w-3.5 h-3.5" />
                {isRTL ? "إلغاء التحديد" : "Deselect All"}
              </Button>
            </div>
          </div>

          {/* Courses Grid View */}
          <div className="flex-1 overflow-y-auto py-4">
            {isLoadingCourses ? (
              <div className="py-16 text-center text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                {isRTL ? "جاري جلب دورات المنصة..." : "Loading courses..."}
              </div>
            ) : filteredCoursesForModal.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <BookOpen className="w-10 h-10 opacity-30 mx-auto mb-2" />
                <p className="text-sm font-medium">{isRTL ? "لا توجد دورات مطابقة للبحث" : "No courses match your search"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredCoursesForModal.map((course) => {
                  const isSelected = selectedCourseIds.includes(course.id);

                  return (
                    <div
                      key={course.id}
                      onClick={() => toggleCourse(course.id)}
                      className={`flex items-start justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "bg-amber-500/10 border-amber-500 shadow-md ring-2 ring-amber-500/20"
                          : "bg-card border-border/60 hover:border-amber-500/40 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center border mt-0.5 shrink-0 transition-colors ${
                            isSelected
                              ? "bg-amber-600 border-amber-600 text-white shadow"
                              : "border-muted-foreground/30 bg-background"
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4" />}
                        </div>

                        <div className="space-y-1">
                          <h4 className="font-bold text-sm text-foreground line-clamp-1">
                            {isRTL ? course.title_ar : course.title}
                          </h4>
                          {course.title && course.title !== course.title_ar && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {course.title}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                            <span>👨‍🏫 {course.instructor_name}</span>
                            {course.subject_code && (
                              <>
                                <span>•</span>
                                <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                                  {course.subject_code}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-end shrink-0 ms-3">
                        <span className="font-black text-sm text-amber-600 block">
                          {course.price ? `${course.price} ر.س` : "مجاني"}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-emerald-600 block mt-1">
                            {isRTL ? "✓ مضافة" : "Selected"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Sticky Footer */}
          <div className="border-t pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {isRTL ? "تم اختيار:" : "Selected:"}{" "}
              <strong className="text-foreground font-bold">{selectedCourseIds.length} دورة</strong>{" "}
              {isRTL ? "بقيمة إجمالية:" : "with total:"}{" "}
              <strong className="text-amber-600 font-bold">{calculatedOriginalPrice} ر.س</strong>
            </div>

            <Button
              type="button"
              onClick={() => setIsCoursePickerOpen(false)}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold px-6"
            >
              <Check className="w-4 h-4 me-1.5" />
              {isRTL ? "تأكيد الاختيار وحفظ المواد" : "Confirm & Apply Selection"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingBundleId} onOpenChange={(open) => !open && setDeletingBundleId(null)}>
        <DialogContent dir={dir} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {isRTL ? "تأكيد حذف الباقة" : "Confirm Bundle Deletion"}
            </DialogTitle>
            <DialogDescription>
              {isRTL
                ? "هل أنت متأكد من حذف هذه الباقة؟ لن يؤثر الحذف على تسجيلات الطلاب السابقة الذين اشتروا الباقة."
                : "Are you sure you want to delete this bundle? This will not affect existing student enrollments."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setDeletingBundleId(null)}>
              {isRTL ? "تراجع" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deletingBundleId && deleteMutation.mutate(deletingBundleId)}
            >
              {deleteMutation.isPending ? (isRTL ? "جاري الحذف..." : "Deleting...") : (isRTL ? "نعم، احذف الباقة" : "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
