import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardCheck, Upload, MessageSquareText, School } from 'lucide-react';
import { cn } from '@/lib/utils';

const quickActions = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/attendance', icon: ClipboardCheck, label: 'Attendance' },
  { to: '/media', icon: Upload, label: 'Media' },
  { to: '/topics', icon: MessageSquareText, label: 'Topic' },
  { to: '/manage', icon: School, label: 'Manage' },
];

const MobileBottomNav = () => (
  <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border">
    <div className="grid grid-cols-5">
      {quickActions.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors active:scale-95',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )
          }
        >
          <Icon className="w-5 h-5" />
          {label}
        </NavLink>
      ))}
    </div>
  </nav>
);

export default MobileBottomNav;
