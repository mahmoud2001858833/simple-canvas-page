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
import { Plus, Pencil, Trash2, School, Search } from "lucide-react";

export const CollegesManagement = () => {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCollege, setEditingCollege] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUniversity, setFilterUniversity] = useState<string>("all");
  const [formData, setFormData] = useState({
    name: "",
    name_ar: "",
    university_id: "",
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

  const { data: colleges = [], isLoading } = useQuery({
    queryKey: ["admin-colleges", searchQuery, filterUniversity],
    queryFn: async () => {
      let query = supabase
        .from("colleges")
        .select(`
          *,
          universities (id, name, name_ar)
        `)
        .order("name");

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,name_ar.ilike.%${searchQuery}%`);
      }

      if (filterUniversity && filterUniversity !== "all") {
        query = query.eq("university_id", filterUniversity);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("colleges").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-colleges"] });
      toast.success(isRTL ? "تم إضافة الكلية بنجاح" : "College added successfully");
      resetForm();
    },
    onError: () => {
      toast.error(isRTL ? "حدث خطأ" : "An error occurred");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from("colleges").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-colleges"] });
      toast.success(isRTL ? "تم تحديث الكلية" : "College updated");
      resetForm();
    },
    onError: () => {
      toast.error(isRTL ? "حدث خطأ" : "An error occurred");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colleges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-colleges"] });
      toast.success(isRTL ? "تم حذف الكلية" : "College deleted");
    },
    onError: () => {
      toast.error(isRTL ? "حدث خطأ - قد تكون هناك تخصصات مرتبطة" : "Error - may have linked majors");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("colleges").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-colleges"] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      name_ar: "",
      university_id: "",
      is_active: true,
    });
    setEditingCollege(null);
    setDialogOpen(false);
  };

  const handleEdit = (college: any) => {
    setEditingCollege(college);
    setFormData({
      name: college.name,
      name_ar: college.name_ar,
      university_id: college.university_id,
      is_active: college.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCollege) {
      updateMutation.mutate({ id: editingCollege.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <School className="h-6 w-6" />
            {isRTL ? "إدارة الكليات" : "Colleges Management"}
          </h2>
          <p className="text-muted-foreground">
            {isRTL ? "إضافة وتعديل الكليات" : "Add and edit colleges"}
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              {isRTL ? "كلية جديدة" : "New College"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCollege
                  ? isRTL
                    ? "تعديل الكلية"
                    : "Edit College"
                  : isRTL
                  ? "كلية جديدة"
                  : "New College"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{isRTL ? "الجهة" : "University"}</Label>
                <Select
                  value={formData.university_id}
                  onValueChange={(value) => setFormData({ ...formData, university_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? "اختر الجهة" : "Select university"} />
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
              <Button type="submit" className="w-full" disabled={!formData.university_id}>
                {editingCollege ? (isRTL ? "تحديث" : "Update") : (isRTL ? "إضافة" : "Add")}
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
            <Select value={filterUniversity} onValueChange={setFilterUniversity}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={isRTL ? "جميع الجهات" : "All Universities"} />
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
                  <TableHead>{isRTL ? "الكلية" : "College"}</TableHead>
                  <TableHead>{isRTL ? "الجهة" : "University"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isRTL ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colleges.map((college) => (
                  <TableRow key={college.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {isRTL ? college.name_ar : college.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {isRTL ? college.name : college.name_ar}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(college.universities as any) &&
                        (isRTL
                          ? (college.universities as any).name_ar
                          : (college.universities as any).name)}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={college.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: college.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(college)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(college.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {colleges.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {isRTL ? "لا توجد كليات" : "No colleges found"}
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
