import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionLink?: string;
  onAction?: () => void;
  className?: string;
  variant?: 'default' | 'card' | 'minimal';
  illustration?: 'courses' | 'certificates' | 'requests' | 'payments' | 'notifications' | 'messages' | 'none';
}

const illustrations: Record<string, React.ReactNode> = {
  courses: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      <defs>
        <linearGradient id="coursesGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect x="30" y="40" width="140" height="90" rx="8" fill="url(#coursesGrad)" stroke="hsl(var(--primary))" strokeWidth="2" strokeOpacity="0.3" />
      <rect x="45" y="55" width="80" height="8" rx="4" fill="hsl(var(--primary))" fillOpacity="0.3" />
      <rect x="45" y="70" width="60" height="6" rx="3" fill="hsl(var(--muted-foreground))" fillOpacity="0.3" />
      <rect x="45" y="85" width="100" height="6" rx="3" fill="hsl(var(--muted-foreground))" fillOpacity="0.2" />
      <circle cx="145" cy="65" r="15" fill="hsl(var(--primary))" fillOpacity="0.2" />
      <path d="M140 65 L152 72 L140 79 Z" fill="hsl(var(--primary))" fillOpacity="0.5" />
    </svg>
  ),
  certificates: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      <defs>
        <linearGradient id="certGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect x="40" y="35" width="120" height="85" rx="6" fill="url(#certGrad)" stroke="hsl(var(--warning))" strokeWidth="2" strokeOpacity="0.4" />
      <circle cx="100" cy="60" r="20" fill="none" stroke="hsl(var(--warning))" strokeWidth="3" strokeOpacity="0.5" />
      <path d="M92 60 L98 66 L110 54" stroke="hsl(var(--warning))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="60" y="90" width="80" height="6" rx="3" fill="hsl(var(--muted-foreground))" fillOpacity="0.3" />
      <rect x="70" y="102" width="60" height="5" rx="2.5" fill="hsl(var(--muted-foreground))" fillOpacity="0.2" />
    </svg>
  ),
  requests: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      <defs>
        <linearGradient id="reqGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
          <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect x="50" y="30" width="100" height="100" rx="8" fill="url(#reqGrad)" stroke="hsl(var(--primary))" strokeWidth="2" strokeOpacity="0.3" />
      <rect x="65" y="50" width="70" height="8" rx="4" fill="hsl(var(--primary))" fillOpacity="0.3" />
      <rect x="65" y="65" width="50" height="6" rx="3" fill="hsl(var(--muted-foreground))" fillOpacity="0.3" />
      <rect x="65" y="78" width="60" height="6" rx="3" fill="hsl(var(--muted-foreground))" fillOpacity="0.2" />
      <circle cx="100" cy="105" r="12" fill="hsl(var(--primary))" fillOpacity="0.2" />
      <path d="M94 105 H106 M100 99 V111" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      <defs>
        <linearGradient id="payGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity="0.2" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect x="35" y="50" width="130" height="80" rx="8" fill="url(#payGrad)" stroke="hsl(var(--success))" strokeWidth="2" strokeOpacity="0.3" />
      <rect x="35" y="65" width="130" height="20" fill="hsl(var(--muted-foreground))" fillOpacity="0.15" />
      <rect x="50" y="95" width="40" height="25" rx="4" fill="hsl(var(--warning))" fillOpacity="0.3" />
      <circle cx="140" cy="107" r="10" fill="hsl(var(--success))" fillOpacity="0.3" />
    </svg>
  ),
  notifications: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      <circle cx="100" cy="70" r="35" fill="hsl(var(--primary))" fillOpacity="0.1" stroke="hsl(var(--primary))" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M100 45 C85 45 75 58 75 72 L75 85 L70 95 L130 95 L125 85 L125 72 C125 58 115 45 100 45" 
            fill="hsl(var(--primary))" fillOpacity="0.2" stroke="hsl(var(--primary))" strokeWidth="2" strokeOpacity="0.4" />
      <circle cx="100" cy="105" r="8" fill="hsl(var(--primary))" fillOpacity="0.3" />
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 200 150" className="w-full h-full">
      <rect x="40" y="40" width="120" height="80" rx="12" fill="hsl(var(--primary))" fillOpacity="0.1" stroke="hsl(var(--primary))" strokeWidth="2" strokeOpacity="0.3" />
      <rect x="55" y="60" width="60" height="8" rx="4" fill="hsl(var(--primary))" fillOpacity="0.3" />
      <rect x="55" y="75" width="80" height="6" rx="3" fill="hsl(var(--muted-foreground))" fillOpacity="0.3" />
      <rect x="55" y="88" width="50" height="6" rx="3" fill="hsl(var(--muted-foreground))" fillOpacity="0.2" />
      <polygon points="60,120 80,120 70,135" fill="hsl(var(--primary))" fillOpacity="0.2" />
    </svg>
  ),
};

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionLink,
  onAction,
  className = '',
  variant = 'default',
  illustration = 'none',
}: EmptyStateProps) => {
  const containerClasses = {
    default: 'py-12 px-6',
    card: 'py-16 px-8 bg-gradient-to-b from-muted/30 to-transparent rounded-2xl border border-dashed border-muted-foreground/20',
    minimal: 'py-8 px-4',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`text-center ${containerClasses[variant]} ${className}`}
    >
      {illustration !== 'none' && illustrations[illustration] ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="w-48 h-36 mx-auto mb-6"
        >
          {illustrations[illustration]}
        </motion.div>
      ) : (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="w-20 h-20 bg-gradient-to-br from-muted to-muted/50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"
        >
          <Icon className="w-10 h-10 text-muted-foreground" />
        </motion.div>
      )}
      
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-lg font-semibold text-foreground mb-2"
      >
        {title}
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed"
      >
        {description}
      </motion.p>

      {actionLabel && (actionLink || onAction) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {actionLink ? (
            <Link to={actionLink}>
              <Button className="bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 shadow-lg shadow-primary/20">
                {actionLabel}
              </Button>
            </Link>
          ) : (
            <Button onClick={onAction} className="bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 shadow-lg shadow-primary/20">
              {actionLabel}
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};
