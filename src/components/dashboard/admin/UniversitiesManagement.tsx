import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";

export const UniversitiesManagement = () => {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    name_ar: "",
    country: "السعودية",
    logo_url: "",
    is_active: true,
  });

  const { data: universities = [], isLoading } = useQuery({
    queryKey: ["admin-universities", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("universities")
        .select("*")
        .order("name");

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,name_ar.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("universities").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-universities"] });
      toast.success(isRTL ? "تم إضافة الجامعة بنجاح" : "University added successfully");
      resetForm();
    },
    onError: () => {
      toast.error(isRTL ? "حدث خطأ" : "An error occurred");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from("universities").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-universities"] });
      toast.success(isRTL ? "تم تحديث الجامعة" : "University updated");
      resetForm();
    },
    onError: () => {
      toast.error(isRTL ? "حدث خطأ" : "An error occurred");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("universities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-universities"] });
      toast.success(isRTL ? "تم حذف الجامعة" : "University deleted");
    },
    onError: () => {
      toast.error(isRTL ? "حدث خطأ - قد تكون هناك كليات مرتبطة" : "Error - may have linked colleges");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("universities")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-universities"] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      name_ar: "",
      country: "السعودية",
      logo_url: "",
      is_active: true,
    });
    setEditingUniversity(null);
    setDialogOpen(false);
  };

  const handleEdit = (university: any) => {
    setEditingUniversity(university);
    setFormData({
      name: university.name,
      name_ar: university.name_ar,
      country: university.country || "السعودية",
      logo_url: university.logo_url || "",
      is_active: university.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUniversity) {
      updateMutation.mutate({ id: editingUniversity.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            {isRTL ? "إدارة الجامعات" : "Universities Management"}
          </h2>
          <p className="text-muted-foreground">
            {isRTL ? "إضافة وتعديل الجامعات" : "Add and edit universities"}
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              {isRTL ? "جامعة جديدة" : "New University"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUniversity
                  ? isRTL
                    ? "تعديل الجامعة"
                    : "Edit University"
                  : isRTL
                  ? "جامعة جديدة"
                  : "New University"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="space-y-2">
                <Label>{isRTL ? "الدولة" : "Country"}</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "رابط الشعار" : "Logo URL"}</Label>
                <Input
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>{isRTL ? "نشط" : "Active"}</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <Button type="submit" className="w-full">
                {editingUniversity
                  ? isRTL
                    ? "تحديث"
                    : "Update"
                  : isRTL
                  ? "إضافة"
                  : "Add"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className={`absolute top-3 h-4 w-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
            <Input
              placeholder={isRTL ? "البحث..." : "Search..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={isRTL ? "pr-10" : "pl-10"}
            />
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
                  <TableHead>{isRTL ? "الجامعة" : "University"}</TableHead>
                  <TableHead>{isRTL ? "الدولة" : "Country"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isRTL ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {universities.map((university) => (
                  <TableRow key={university.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {university.logo_url ? (
                          <img
                            src={university.logo_url}
                            alt={university.name}
                            className="w-10 h-10 rounded object-contain bg-muted"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">
                            {isRTL ? university.name_ar : university.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {isRTL ? university.name : university.name_ar}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{university.country}</TableCell>
                    <TableCell>
                      <Switch
                        checked={university.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: university.id, is_active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(university)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(university.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {universities.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {isRTL ? "لا توجد جامعات" : "No universities found"}
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
