import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import UserAvatar from './UserAvatar';
import NotificationBell from './NotificationBell';
import HeaderNav from './HeaderNav';
import MobileBottomNav from './MobileBottomNav';
import CommandPalette from './CommandPalette';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';



const NestedLayoutContext = createContext(false);

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const nested = useContext(NestedLayoutContext);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [fullName, setFullName] = useState<string>('');

  useEffect(() => {
    if (!user || nested) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setFullName(data?.full_name || ''));
  }, [user, nested]);

  if (nested) {
    // Rendered inside another DashboardLayout — just pass children through.
    return <>{children}</>;
  }

  return (
    <NestedLayoutContext.Provider value={true}>
      <div className="min-h-screen bg-background">
        <CommandPalette />
        <AppSidebar />
        <header className={cn(
          'fixed top-0 right-0 z-40 flex items-center gap-3 h-14 px-6 bg-background/80 backdrop-blur-sm border-b border-border/50',
          isMobile ? 'left-0 pl-16' : 'left-64'
        )}>
          <HeaderNav />
          <div className="flex-1" />
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open profile menu"
              >
                <UserAvatar name={fullName} email={user?.email} size="sm" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  {fullName && (
                    <p className="text-sm font-medium leading-none">{fullName}</p>
                  )}
                  <p className={cn('leading-none text-muted-foreground', fullName ? 'text-xs' : 'text-sm')}>
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className={cn(isMobile ? 'p-4 pt-20 pb-24' : 'ml-64 p-8 pt-20')}>
          {children}
        </main>
        {isMobile && <MobileBottomNav />}

      </div>
    </NestedLayoutContext.Provider>
  );
};

export default DashboardLayout;
