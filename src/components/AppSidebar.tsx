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
  { to: '/topics', icon: MessageSquareText, label: 'Topic of the Day' },
  { to: '/grading', icon: Award, label: 'Grading' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/activity-log', icon: History, label: 'Activity Log' },
  { to: '/profile', icon: Settings, label: 'Profile' },
];

const SidebarContent = ({ user, signOut, onNavClick }: { user: any; signOut: () => void; onNavClick?: () => void }) => {
  const location = useLocation();

  return (
    <div className="h-full flex flex-col bg-sidebar">
      {/* Brand */}
      <div className="p-5 pb-6 flex items-center gap-3 border-b border-sidebar-border">
        <img src="/logo.ico" alt="iRobokid" className="w-9 h-9 rounded-xl shadow-md" />
        <div>
          <h2 className="font-heading font-bold text-sidebar-primary-foreground text-base leading-tight tracking-tight">iRobokid</h2>
          <span className="text-[11px] text-sidebar-foreground/70 uppercase tracking-wider font-medium">Instructor</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-5 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
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

      {/* User footer */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
          <UserAvatar name={null} email={user?.email} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-sidebar-foreground/80 truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const AppSidebar = () => {
  const { signOut, user } = useAuth();
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
            <SidebarContent user={user} signOut={signOut} onNavClick={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 z-50 shadow-xl">
      <SidebarContent user={user} signOut={signOut} />
    </aside>
  );
};

export default AppSidebar;
