import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'accent';
}

const variantStyles = {
  default: 'bg-card',
  primary: 'bg-primary/5 border-primary/10',
  success: 'bg-success/5 border-success/10',
  warning: 'bg-warning/5 border-warning/10',
  accent: 'bg-accent/5 border-accent/10',
};

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  accent: 'bg-accent/10 text-accent',
};

const StatCard = ({ title, value, icon: Icon, trend, variant = 'default' }: StatCardProps) => (
  <div className={cn('stat-card', variantStyles[variant])}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{title}</p>
        <p className="text-3xl font-bold font-heading mt-2 text-card-foreground">{value}</p>
        {trend && <p className="text-xs text-success mt-1.5 font-medium">{trend}</p>}
      </div>
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shadow-sm', iconVariantStyles[variant])}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

export default StatCard;
