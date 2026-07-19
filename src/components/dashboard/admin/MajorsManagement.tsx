import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GraduationCap, Search } from "lucide-react";

export const MajorsManagement = () => {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMajor, setEditingMajor] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUniversity, setFilterUniversity] = useState<string>("all");
  const [filterCollege, setFilterCollege] = useState<string>("all");
  const [selectedUniversity, setSelectedUniversity] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    name_ar: "",
    college_id: "",
    is_active: true,
  });

  const { data: universities = [] } = useQuery({
    queryKey: ["universities-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("universities")
        .select("id, name, name_ar")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: colleges = [] } = useQuery({
    queryKey: ["colleges-list", selectedUniversity || filterUniversity],
    queryFn: async () => {
      let query = supabase
        .from("colleges")
        .select("id, name, name_ar, university_id")
        .eq("is_active", true)
        .order("name");

      const uniId = selectedUniversity || (filterUniversity !== "all" ? filterUniversity : null);
      if (uniId) {
        query = query.eq("university_id", uniId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: majors = [], isLoading } = useQuery({
    queryKey: ["admin-majors", searchQuery, filterCollege],
    queryFn: async () => {
      let query = supabase
        .from("majors")
        .select(`
          *,
          colleges (
            id, name, name_ar,
            universities (id, name, name_ar)
          )
        `)
        .order("name");

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,name_ar.ilike.%${searchQuery}%`);
      }

      if (filterCollege && filterCollege !== "all") {
        query = query.eq("college_id", filterCollege);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("majors").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-majors"] });
      toast.success(isRTL ? "تم إضافة التخصص بنجاح" : "Major added successfully");
      resetForm();
    },
    onError: () => {
      toast.error(isRTL ? "حدث خطأ" : "An error occurred");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from("majors").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-majors"] });
      toast.success(isRTL ? "تم تحديث التخصص" : "Major updated");
      resetForm();
    },
    onError: () => {
      toast.error(isRTL ? "حدث خطأ" : "An error occurred");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("majors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-majors"] });
      toast.success(isRTL ? "تم حذف التخصص" : "Major deleted");
    },
    onError: () => {
      toast.error(isRTL ? "حدث خطأ - قد تكون هناك دورات مرتبطة" : "Error - may have linked courses");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("majors").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-majors"] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      name_ar: "",
      college_id: "",
      is_active: true,
    });
    setEditingMajor(null);
    setSelectedUniversity("");
    setDialogOpen(false);
  };

  const handleEdit = (major: any) => {
    setEditingMajor(major);
    setSelectedUniversity((major.colleges as any)?.universities?.id || "");
    setFormData({
      name: major.name,
      name_ar: major.name_ar,
      college_id: major.college_id,
      is_active: major.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMajor) {
      updateMutation.mutate({ id: editingMajor.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            {isRTL ? "إدارة التخصصات" : "Majors Management"}
          </h2>
          <p className="text-muted-foreground">
            {isRTL ? "إضافة وتعديل التخصصات" : "Add and edit majors"}
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              {isRTL ? "تخصص جديد" : "New Major"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingMajor
                  ? isRTL
                    ? "تعديل التخصص"
                    : "Edit Major"
                  : isRTL
                  ? "تخصص جديد"
                  : "New Major"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{isRTL ? "الجامعة" : "University"}</Label>
                <Select
                  value={selectedUniversity}
                  onValueChange={(value) => {
                    setSelectedUniversity(value);
                    setFormData({ ...formData, college_id: "" });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? "اختر الجامعة" : "Select university"} />
                  </SelectTrigger>
                  <SelectContent>
                    {universities.map((uni) => (
                      <SelectItem key={uni.id} value={uni.id}>
                        {isRTL ? uni.name_ar : uni.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "الكلية" : "College"}</Label>
                <Select
                  value={formData.college_id}
                  onValueChange={(value) => setFormData({ ...formData, college_id: value })}
                  disabled={!selectedUniversity}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? "اختر الكلية" : "Select college"} />
                  </SelectTrigger>
                  <SelectContent>
                    {colleges.map((college) => (
                      <SelectItem key={college.id} value={college.id}>
                        {isRTL ? college.name_ar : college.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                <Input
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  required
                  dir="rtl"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>{isRTL ? "نشط" : "Active"}</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!formData.college_id}>
                {editingMajor ? (isRTL ? "تحديث" : "Update") : (isRTL ? "إضافة" : "Add")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className={`absolute top-3 h-4 w-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
              <Input
                placeholder={isRTL ? "البحث..." : "Search..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={isRTL ? "pr-10" : "pl-10"}
              />
            </div>
            <Select
              value={filterUniversity}
              onValueChange={(value) => {
                setFilterUniversity(value);
                setFilterCollege("all");
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={isRTL ? "جميع الجامعات" : "All Universities"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "جميع الجامعات" : "All Universities"}</SelectItem>
                {universities.map((uni) => (
                  <SelectItem key={uni.id} value={uni.id}>
                    {isRTL ? uni.name_ar : uni.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCollege} onValueChange={setFilterCollege}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={isRTL ? "جميع الكليات" : "All Colleges"} />
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
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "التخصص" : "Major"}</TableHead>
                  <TableHead>{isRTL ? "الكلية" : "College"}</TableHead>
                  <TableHead>{isRTL ? "الجامعة" : "University"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isRTL ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {majors.map((major) => (
                  <TableRow key={major.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {isRTL ? major.name_ar : major.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {isRTL ? major.name : major.name_ar}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(major.colleges as any) &&
                        (isRTL
                          ? (major.colleges as any).name_ar
                          : (major.colleges as any).name)}
                    </TableCell>
                    <TableCell>
                      {(major.colleges as any)?.universities &&
                        (isRTL
                          ? (major.colleges as any).universities.name_ar
                          : (major.colleges as any).universities.name)}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={major.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: major.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(major)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(major.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {majors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {isRTL ? "لا توجد تخصصات" : "No majors found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
