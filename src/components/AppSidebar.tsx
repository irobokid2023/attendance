import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  School,
  BookOpen,
  Users,
  ClipboardCheck,
  CalendarDays,
  Award,
  Menu,
  MessageSquareText,
  History,
  Settings,
  IndianRupee,
  ListChecks,
  ShieldCheck,
  Settings2,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import UserAvatar from '@/components/UserAvatar';
import { useState, useEffect } from 'react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/schools', icon: School, label: 'Schools' },
  { to: '/classes', icon: BookOpen, label: 'Classes' },
  { to: '/students', icon: Users, label: 'Students' },
  { to: '/attendance', icon: ClipboardCheck, label: 'Attendance' },
  { to: '/media', icon: Upload, label: 'Upload Media' },
  { to: '/topics', icon: MessageSquareText, label: 'Topic of the Day' },
  { to: '/payments', icon: IndianRupee, label: 'Payments' },
  { to: '/misc-tasks', icon: ListChecks, label: 'Miscellaneous Tasks' },
  { to: '/grading', icon: Award, label: 'Grading' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/profile', icon: Settings, label: 'Profile' },
];

const adminNavItems = [
  { to: '/activity-log', icon: History, label: 'Activity Log' },
  { to: '/admin', icon: ShieldCheck, label: 'Admin Management' },
  { to: '/admin-settings', icon: Settings2, label: 'Admin Settings' },
];

const SidebarContent = ({ user, signOut, onNavClick, role }: { user: any; signOut: () => void; onNavClick?: () => void; role: string | null }) => {
  const location = useLocation();

  return (
    <div className="h-full flex flex-col bg-sidebar">
      {/* Brand */}
      <div className="p-4 sm:p-5 pb-5 flex items-center gap-3 border-b border-sidebar-border">
        <img src="/logo.ico" alt="iRobokid" className="w-9 h-9 rounded-xl shadow-md shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading font-bold text-sidebar-primary-foreground text-base leading-tight tracking-tight truncate">iRobokid</h2>
          {role && (
            <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-sidebar-primary/15 text-sidebar-primary text-[10px] font-semibold uppercase tracking-wider max-w-full truncate">
              {role === 'admin' ? 'Admin' : 'Instructor'}
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-5 space-y-0.5 overflow-y-auto">
        {[...navItems, ...(role === 'admin' ? adminNavItems : [])].map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavClick}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary/15 text-sidebar-primary shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className={cn('w-[18px] h-[18px] transition-colors', isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground')} />
              {label}
            </NavLink>
          );
        })}
      </nav>

    </div>
  );
};

const AppSidebar = () => {
  const { signOut, user, role } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-sidebar flex items-center justify-center text-sidebar-primary-foreground shadow-lg active:scale-95 transition-transform"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="p-0 w-64 border-r-0">
            <SidebarContent user={user} signOut={signOut} onNavClick={() => setOpen(false)} role={role} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 z-50 shadow-xl">
      <SidebarContent user={user} signOut={signOut} role={role} />
    </aside>
  );
};

export default AppSidebar;
