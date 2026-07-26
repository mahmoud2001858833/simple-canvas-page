import { motion } from "framer-motion";
import { BookOpen, GraduationCap, CreditCard, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface QuickActionsProps {
  onAction: (message: string) => void;
  isRTL: boolean;
}

type Action = {
  icon: any;
  labelAr: string;
  labelEn: string;
  message: string;
  navigateTo?: string;
  requiresAuth?: boolean;
};

const actions: Action[] = [
  {
    icon: BookOpen,
    labelAr: "الدورات المتاحة",
    labelEn: "Available Courses",
    message: "بدي أشوف الدورات المتاحة",
    navigateTo: "/courses",
  },
  {
    icon: GraduationCap,
    labelAr: "طلب دورة خاصة",
    labelEn: "Custom Course",
    message: "كيف أطلب دورة خاصة؟",
    navigateTo: "/dashboard?tab=request",
    requiresAuth: true,
  },
  {
    icon: CreditCard,
    labelAr: "طرق الدفع",
    labelEn: "Payment Methods",
    message: "ما هي طرق الدفع المتاحة؟",
  },
  {
    icon: MessageCircle,
    labelAr: "تواصل معنا",
    labelEn: "Contact Us",
    message: "كيف أتواصل مع الدعم؟",
  },
];

export function QuickActions({ onAction, isRTL }: QuickActionsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleClick = (action: Action) => {
    if (action.navigateTo) {
      if (action.requiresAuth && !user) {
        navigate(`/login?redirect=${encodeURIComponent(action.navigateTo)}`);
      } else {
        navigate(action.navigateTo);
      }
      return;
    }
    onAction(action.message);
  };

  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {actions.map((action, index) => (
        <motion.div
          key={action.labelEn}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleClick(action)}
            className="w-full h-auto py-2 px-3 flex flex-col items-center gap-1 text-xs hover:bg-primary/5 hover:border-primary/30 transition-colors"
          >
            <action.icon className="h-4 w-4 text-primary" />
            <span>{isRTL ? action.labelAr : action.labelEn}</span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}
