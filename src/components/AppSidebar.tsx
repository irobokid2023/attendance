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
  LogOut,
  Settings,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/schools', icon: School, label: 'Schools' },
  { to: '/classes', icon: BookOpen, label: 'Classes' },
  { to: '/students', icon: Users, label: 'Students' },
  { to: '/attendance', icon: ClipboardCheck, label: 'Attendance' },
  
  { to: '/grading', icon: Award, label: 'Grading' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/profile', icon: Settings, label: 'Profile' },
];

const SidebarContent = ({ user, signOut, onNavClick }: { user: any; signOut: () => void; onNavClick?: () => void }) => {
  const location = useLocation();

  return (
    <div className="h-full flex flex-col bg-sidebar">
      <div className="p-5 flex items-center gap-3">
        <img src="/logo.ico" alt="iRobokid" className="w-9 h-9 rounded-xl" />
        <div>
          <h2 className="font-heading font-bold text-sidebar-primary-foreground text-base leading-tight">iRobokid</h2>
          <span className="text-xs text-sidebar-foreground">Instructor</span>
        </div>
      </div>

      <nav className="flex-1 px-3 mt-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="w-4.5 h-4.5" />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold text-sidebar-accent-foreground">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-sidebar-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
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
          className="fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-sidebar flex items-center justify-center text-sidebar-primary-foreground shadow-lg"
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
    <aside className="fixed left-0 top-0 h-screen w-64 z-50">
      <SidebarContent user={user} signOut={signOut} />
    </aside>
  );
};

export default AppSidebar;
